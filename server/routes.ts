import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { calculateDiscountedPrice, TH_DAILY_YIELD_MERE, SLOT_EXPANSION_PRICE_MERE } from "@shared/constants";
import { db } from "./db";
import { achievements, userAchievements, users, minerTypes, userMiners, transactions, seasons } from "@shared/schema";
import { eq, sum, count, sql, isNotNull } from "drizzle-orm";
import { achievementsService } from "./achievementsService";
import { getReferralStats } from "./referralService";
import { requireAdmin } from "./adminMiddleware";
import { signUp, signIn } from "./emailAuth";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Email/Password authentication routes
  app.post('/api/auth/signup', async (req, res) => {
    try {
      const { email, password, firstName, lastName, referralCode } = req.body;
      
      const user = await signUp(email, password, firstName, lastName, referralCode);
      
      // Set session
      (req.session as any).userId = user.id;
      
      res.json({ success: true, user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        mereBalance: user.mereBalance,
        totalMined: user.totalMined,
        referralCode: user.referralCode,
        isAdmin: user.isAdmin,
      }});
    } catch (error: any) {
      console.error("Sign up error:", error);
      res.status(400).json({ message: error.message || "Failed to sign up" });
    }
  });

  app.post('/api/auth/signin', async (req, res) => {
    try {
      const { email, password } = req.body;
      
      const user = await signIn(email, password);
      
      // Set session
      (req.session as any).userId = user.id;
      
      res.json({ success: true, user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        mereBalance: user.mereBalance,
        totalMined: user.totalMined,
        referralCode: user.referralCode,
        isAdmin: user.isAdmin,
      }});
    } catch (error: any) {
      console.error("Sign in error:", error);
      res.status(400).json({ message: error.message || "Failed to sign in" });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Failed to log out" });
      }
      res.json({ success: true });
    });
  });

  // Auth routes (supports both Replit Auth and email/password)
  app.get('/api/auth/user', async (req: any, res) => {
    try {
      // Check email/password session first
      const sessionUserId = (req.session as any)?.userId;
      if (sessionUserId) {
        const user = await storage.getUser(sessionUserId);
        return res.json(user);
      }
      
      // Fall back to Replit Auth
      if (req.user?.claims?.sub) {
        const userId = getUserId(req);
        const user = await storage.getUser(userId);
        return res.json(user);
      }
      
      res.status(401).json({ message: "Unauthorized" });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Helper function to get user ID from either auth method
  function getUserId(req: any): string | null {
    const sessionUserId = req.session?.userId;
    if (sessionUserId) return sessionUserId;
    return req.user?.claims?.sub || null;
  }

  // Shop routes
  app.get('/api/shop/miners', isAuthenticated, async (_req, res) => {
    try {
      const miners = await storage.getMinerTypes();
      res.json(miners);
    } catch (error) {
      console.error("Error fetching miners:", error);
      res.status(500).json({ message: "Failed to fetch miners" });
    }
  });

  app.post('/api/shop/buy', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const { minerTypeId, quantity } = req.body;

      if (!minerTypeId || !quantity || quantity < 1) {
        return res.status(400).json({ message: "Invalid request" });
      }

      // Get miner type
      const minerType = await storage.getMinerType(minerTypeId);
      if (!minerType || !minerType.isAvailable) {
        return res.status(404).json({ message: "Miner not found or unavailable" });
      }

      // Calculate total cost with bulk discount
      const totalTH = minerType.thRate * quantity;
      const pricePerTH = parseFloat(minerType.basePriceMere) / minerType.thRate;
      const pricing = calculateDiscountedPrice(totalTH);
      const finalCost = pricing.finalPrice;

      // Check user balance
      const user = await storage.getUser(userId);
      if (!user || parseFloat(user.mereBalance) < finalCost) {
        return res.status(400).json({ message: "Insufficient MERE balance" });
      }

      // Deduct balance
      await storage.updateUserBalance(userId, finalCost.toString(), "subtract");

      // Create user miners
      for (let i = 0; i < quantity; i++) {
        await storage.createUserMiner({
          userId,
          minerTypeId,
          slotPosition: null,
          isActive: true,
          boostMultiplier: 1.0,
        });
      }

      // Record transaction
      await storage.createTransaction({
        userId,
        type: "purchase",
        amountMere: finalCost.toString(),
        amountUsd: (finalCost * 0.5).toString(),
        description: `Purchased ${quantity}x ${minerType.name}`,
        status: "completed",
        metadata: { minerTypeId, quantity },
      });

      // Check and unlock achievements
      await achievementsService.checkAndUnlockAchievements({ userId, type: "purchase" });

      res.json({ success: true, cost: finalCost });
    } catch (error) {
      console.error("Error purchasing miner:", error);
      res.status(500).json({ message: "Failed to purchase miner" });
    }
  });

  // Mining room routes
  app.get('/api/mining/room', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const miners = await storage.getUserMiners(userId);
      res.json(miners);
    } catch (error) {
      console.error("Error fetching mining room:", error);
      res.status(500).json({ message: "Failed to fetch mining room" });
    }
  });

  app.get('/api/mining/slots', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const slotCount = await storage.getUserSlotCount(userId);
      res.json({ totalSlots: 20, unlockedSlots: slotCount });
    } catch (error) {
      console.error("Error fetching slots:", error);
      res.status(500).json({ message: "Failed to fetch slots" });
    }
  });

  app.post('/api/mining/place', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { minerId, slotPosition } = req.body;

      if (!minerId || slotPosition === undefined) {
        return res.status(400).json({ message: "Invalid request" });
      }

      // Verify ownership
      const miner = await storage.getUserMiner(minerId);
      if (!miner || miner.userId !== userId) {
        return res.status(404).json({ message: "Miner not found" });
      }

      // Update slot position
      await storage.updateMinerSlot(minerId, slotPosition);

      // Check and unlock achievements
      await achievementsService.checkAndUnlockAchievements({ userId, type: "miner_placed" });

      res.json({ success: true });
    } catch (error) {
      console.error("Error placing miner:", error);
      res.status(500).json({ message: "Failed to place miner" });
    }
  });

  app.post('/api/mining/remove', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { minerId } = req.body;

      if (!minerId) {
        return res.status(400).json({ message: "Invalid request" });
      }

      // Verify ownership
      const miner = await storage.getUserMiner(minerId);
      if (!miner || miner.userId !== userId) {
        return res.status(404).json({ message: "Miner not found" });
      }

      // Remove from slot
      await storage.updateMinerSlot(minerId, null);

      res.json({ success: true });
    } catch (error) {
      console.error("Error removing miner:", error);
      res.status(500).json({ message: "Failed to remove miner" });
    }
  });

  app.post('/api/mining/unlock-slot', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);

      // Check user balance
      const user = await storage.getUser(userId);
      if (!user || parseFloat(user.mereBalance) < SLOT_EXPANSION_PRICE_MERE) {
        return res.status(400).json({ message: "Insufficient MERE balance" });
      }

      // Deduct cost
      await storage.updateUserBalance(userId, SLOT_EXPANSION_PRICE_MERE.toString(), "subtract");

      // Unlock slot (simplified - in production track per user)
      const result = await storage.unlockSlot(userId);

      // Record transaction
      await storage.createTransaction({
        userId,
        type: "purchase",
        amountMere: SLOT_EXPANSION_PRICE_MERE.toString(),
        amountUsd: (SLOT_EXPANSION_PRICE_MERE * 0.5).toString(),
        description: "Unlocked mining slot",
        status: "completed",
      });

      res.json(result);
    } catch (error) {
      console.error("Error unlocking slot:", error);
      res.status(500).json({ message: "Failed to unlock slot" });
    }
  });

  // Wallet routes
  app.get('/api/wallet/transactions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const transactions = await storage.getUserTransactions(userId);
      res.json(transactions);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  app.post('/api/wallet/deposit/generate', isAuthenticated, async (req: any, res) => {
    try {
      // In production, generate a unique TRC-20 address
      // For demo, return a mock address
      const mockAddress = `T${Math.random().toString(36).substring(2, 15).toUpperCase()}`;
      res.json({ address: mockAddress });
    } catch (error) {
      console.error("Error generating deposit address:", error);
      res.status(500).json({ message: "Failed to generate deposit address" });
    }
  });

  app.post('/api/wallet/withdraw', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { amountMere } = req.body;

      const amount = parseFloat(amountMere);
      if (!amount || amount <= 0) {
        return res.status(400).json({ message: "Invalid amount" });
      }

      // Check balance
      const user = await storage.getUser(userId);
      if (!user || parseFloat(user.mereBalance) < amount) {
        return res.status(400).json({ message: "Insufficient balance" });
      }

      // Calculate fee (2%)
      const fee = amount * 0.02;
      const total = amount - fee;

      // Deduct from balance
      await storage.updateUserBalance(userId, amount.toString(), "subtract");

      // Record transaction
      await storage.createTransaction({
        userId,
        type: "withdrawal",
        amountMere: amount.toString(),
        amountUsd: (total * 0.5).toString(),
        description: `Withdrawal (Fee: ${fee.toFixed(2)} MERE)`,
        status: "pending",
      });

      res.json({ success: true, amount: total });
    } catch (error) {
      console.error("Error processing withdrawal:", error);
      res.status(500).json({ message: "Failed to process withdrawal" });
    }
  });

  // Leaderboard routes
  app.get('/api/leaderboard', isAuthenticated, async (_req, res) => {
    try {
      const season = await storage.getCurrentSeason();
      if (!season) {
        return res.json([]);
      }

      const leaderboard = await storage.getLeaderboard(season.id, 100);
      res.json(leaderboard);
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
      res.status(500).json({ message: "Failed to fetch leaderboard" });
    }
  });

  app.get('/api/leaderboard/season', isAuthenticated, async (_req, res) => {
    try {
      const season = await storage.getCurrentSeason();
      if (!season) {
        return res.status(404).json({ message: "No active season" });
      }

      res.json({
        id: season.id,
        name: season.name,
        endAt: season.endAt,
      });
    } catch (error) {
      console.error("Error fetching season:", error);
      res.status(500).json({ message: "Failed to fetch season" });
    }
  });

  // Season Pass routes
  app.get('/api/season-pass', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const season = await storage.getCurrentSeason();
      
      if (!season) {
        return res.status(404).json({ message: "No active season" });
      }

      let userPass = await storage.getUserSeasonPass(userId, season.id);
      if (!userPass) {
        userPass = await storage.createUserSeasonPass(userId, season.id);
      }

      const rewards = await storage.getSeasonPassRewards(season.id);

      res.json({
        ...userPass,
        rewards,
        seasonName: season.name,
      });
    } catch (error) {
      console.error("Error fetching season pass:", error);
      res.status(500).json({ message: "Failed to fetch season pass" });
    }
  });

  app.post('/api/season-pass/upgrade', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const upgradeCost = 200; // 200 MERE

      // Check balance
      const user = await storage.getUser(userId);
      if (!user || parseFloat(user.mereBalance) < upgradeCost) {
        return res.status(400).json({ message: "Insufficient MERE balance" });
      }

      const season = await storage.getCurrentSeason();
      if (!season) {
        return res.status(404).json({ message: "No active season" });
      }

      // Deduct cost
      await storage.updateUserBalance(userId, upgradeCost.toString(), "subtract");

      // Upgrade pass
      await storage.upgradeSeasonPass(userId, season.id);

      // Record transaction
      await storage.createTransaction({
        userId,
        type: "purchase",
        amountMere: upgradeCost.toString(),
        amountUsd: (upgradeCost * 0.5).toString(),
        description: "Season Pass Premium Upgrade",
        status: "completed",
      });

      // Check and unlock achievements
      await achievementsService.checkAndUnlockAchievements({ userId, type: "season_pass_premium" });

      res.json({ success: true });
    } catch (error) {
      console.error("Error upgrading season pass:", error);
      res.status(500).json({ message: "Failed to upgrade season pass" });
    }
  });

  app.post('/api/season-pass/claim', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { rewardId } = req.body;

      if (!rewardId) {
        return res.status(400).json({ message: "Invalid request" });
      }

      const season = await storage.getCurrentSeason();
      if (!season) {
        return res.status(404).json({ message: "No active season" });
      }

      // Claim reward
      await storage.claimSeasonPassReward(userId, season.id, rewardId);

      // TODO: Grant the reward based on type (MERE, miner, booster)

      res.json({ success: true });
    } catch (error) {
      console.error("Error claiming reward:", error);
      res.status(500).json({ message: "Failed to claim reward" });
    }
  });

  // Achievements routes
  app.get('/api/achievements', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      
      // Get all achievements with user progress
      const allAchievements = await db.select().from(achievements).where(eq(achievements.isActive, true));
      const userAchievementRecords = await db.select().from(userAchievements).where(eq(userAchievements.userId, userId));
      
      const achievementsWithProgress = allAchievements.map(ach => {
        const userAch = userAchievementRecords.find(ua => ua.achievementId === ach.id);
        return {
          ...ach,
          progress: userAch?.progress || 0,
          isUnlocked: userAch?.isUnlocked || false,
          unlockedAt: userAch?.unlockedAt || null,
        };
      });

      res.json(achievementsWithProgress);
    } catch (error) {
      console.error("Error fetching achievements:", error);
      res.status(500).json({ message: "Failed to fetch achievements" });
    }
  });

  // Referral routes
  app.get('/api/referrals', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const stats = await getReferralStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching referral stats:", error);
      res.status(500).json({ message: "Failed to fetch referral stats" });
    }
  });

  // Admin routes
  app.get('/api/admin/stats', isAuthenticated, requireAdmin, async (_req, res) => {
    try {
      // Get total users
      const totalUsersResult = await db.select({ count: count() }).from(users);
      const totalUsers = Number(totalUsersResult[0]?.count || 0);

      // Get total MERE in circulation (sum of all user balances)
      const totalMereResult = await db.select({ total: sum(users.mereBalance) }).from(users);
      const totalMereInCirculation = parseFloat(totalMereResult[0]?.total || "0");

      // Get total MERE mined
      const totalMinedResult = await db.select({ total: sum(users.totalMined) }).from(users);
      const totalMereMined = parseFloat(totalMinedResult[0]?.total || "0");

      // Get active miners count
      const activeMinersResult = await db.select({ count: count() })
        .from(userMiners)
        .where(eq(userMiners.isActive, true));
      const activeMiners = Number(activeMinersResult[0]?.count || 0);

      // Get placed miners count (miners with slot positions)
      const placedMinersResult = await db.select({ count: count() })
        .from(userMiners)
        .where(isNotNull(userMiners.slotPosition));
      const placedMiners = Number(placedMinersResult[0]?.count || 0);

      // Get transaction stats
      const totalTransactionsResult = await db.select({ count: count() }).from(transactions);
      const totalTransactions = Number(totalTransactionsResult[0]?.count || 0);

      // Get total deposits value
      const totalDepositsResult = await db.select({ total: sum(transactions.amountMere) })
        .from(transactions)
        .where(eq(transactions.type, "deposit"));
      const totalDeposits = parseFloat(totalDepositsResult[0]?.total || "0");

      // Get total withdrawals value
      const totalWithdrawalsResult = await db.select({ total: sum(transactions.amountMere) })
        .from(transactions)
        .where(eq(transactions.type, "withdrawal"));
      const totalWithdrawals = parseFloat(totalWithdrawalsResult[0]?.total || "0");

      res.json({
        totalUsers,
        totalMereInCirculation,
        totalMereMined,
        activeMiners,
        placedMiners,
        totalTransactions,
        totalDeposits,
        totalWithdrawals,
      });
    } catch (error) {
      console.error("Error fetching admin stats:", error);
      res.status(500).json({ message: "Failed to fetch admin stats" });
    }
  });

  app.get('/api/admin/users', isAuthenticated, requireAdmin, async (_req, res) => {
    try {
      const allUsers = await db.select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        mereBalance: users.mereBalance,
        totalMined: users.totalMined,
        isAdmin: users.isAdmin,
        totalReferrals: users.totalReferrals,
        createdAt: users.createdAt,
      }).from(users);

      res.json(allUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.patch('/api/admin/users/:userId/admin', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const { isAdmin } = req.body;

      if (typeof isAdmin !== 'boolean') {
        return res.status(400).json({ message: "Invalid request" });
      }

      await db.update(users)
        .set({ isAdmin })
        .where(eq(users.id, userId));

      res.json({ success: true });
    } catch (error) {
      console.error("Error updating user admin status:", error);
      res.status(500).json({ message: "Failed to update user admin status" });
    }
  });

  app.get('/api/admin/miners', isAuthenticated, requireAdmin, async (_req, res) => {
    try {
      const allMiners = await db.select().from(minerTypes);
      res.json(allMiners);
    } catch (error) {
      console.error("Error fetching miners:", error);
      res.status(500).json({ message: "Failed to fetch miners" });
    }
  });

  app.patch('/api/admin/miners/:minerId', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const { minerId } = req.params;
      const updates = req.body;

      // Validate fields
      const allowedFields = ['name', 'description', 'thRate', 'basePriceMere', 'basePriceUsd', 'dailyYieldMere', 'dailyYieldUsd', 'roiDays', 'isAvailable'];
      const updateData: any = {};
      
      for (const field of allowedFields) {
        if (updates[field] !== undefined) {
          updateData[field] = updates[field];
        }
      }

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ message: "No valid fields to update" });
      }

      await db.update(minerTypes)
        .set(updateData)
        .where(eq(minerTypes.id, minerId));

      res.json({ success: true });
    } catch (error) {
      console.error("Error updating miner type:", error);
      res.status(500).json({ message: "Failed to update miner type" });
    }
  });

  app.get('/api/admin/seasons', isAuthenticated, requireAdmin, async (_req, res) => {
    try {
      const allSeasons = await db.select().from(seasons);
      res.json(allSeasons);
    } catch (error) {
      console.error("Error fetching seasons:", error);
      res.status(500).json({ message: "Failed to fetch seasons" });
    }
  });

  app.patch('/api/admin/seasons/:seasonId', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const { seasonId } = req.params;
      const updates = req.body;

      const allowedFields = ['name', 'startAt', 'endAt', 'isActive'];
      const updateData: any = {};
      
      for (const field of allowedFields) {
        if (updates[field] !== undefined) {
          updateData[field] = updates[field];
        }
      }

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ message: "No valid fields to update" });
      }

      await db.update(seasons)
        .set(updateData)
        .where(eq(seasons.id, seasonId));

      res.json({ success: true });
    } catch (error) {
      console.error("Error updating season:", error);
      res.status(500).json({ message: "Failed to update season" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
