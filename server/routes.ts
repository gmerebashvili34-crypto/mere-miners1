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
import { signUp, signIn, requireUserId } from "./emailAuth";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Email/Password authentication routes
  app.post('/api/auth/signup', async (req, res) => {
    try {
      const { email, password, referralCode } = req.body;
      
      const user = await signUp(email, password, referralCode);
      
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
        const userId = requireUserId(req, res);
      if (!userId) return;
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
      const userId = requireUserId(req, res);
      if (!userId) return;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const { minerTypeId } = req.body;

      if (!minerTypeId) {
        return res.status(400).json({ message: "Invalid request" });
      }

      // Get miner type
      const minerType = await storage.getMinerType(minerTypeId);
      if (!minerType || !minerType.isAvailable) {
        return res.status(404).json({ message: "Miner not found or unavailable" });
      }

      // Check if user already owns this miner type (one per type limit)
      const ownedMiners = await storage.getUserMiners(userId);
      const alreadyOwns = ownedMiners.some(m => m.minerType.id === minerTypeId);
      if (alreadyOwns) {
        return res.status(400).json({ message: "You already own this miner type. Each miner can only be purchased once." });
      }

      // Apply rarity-based discount
      let discountPercent = 0;
      if (minerType.rarity === "rare") discountPercent = 4;
      else if (minerType.rarity === "epic") discountPercent = 5;
      else if (minerType.rarity === "legendary") discountPercent = 7;
      
      const basePrice = parseFloat(minerType.basePriceMere);
      const finalCost = basePrice * (1 - discountPercent / 100);

      // Check user balance
      const user = await storage.getUser(userId);
      if (!user || parseFloat(user.mereBalance) < finalCost) {
        return res.status(400).json({ message: "Insufficient MERE balance" });
      }

      // Deduct balance
      await storage.updateUserBalance(userId, finalCost.toString(), "subtract");

      // Create user miner (only one)
      await storage.createUserMiner({
        userId,
        minerTypeId,
        slotPosition: null,
        isActive: true,
        boostMultiplier: 1.0,
      });

      // Record transaction
      const description = discountPercent > 0 
        ? `Purchased ${minerType.name} (-${discountPercent}% ${minerType.rarity} discount)`
        : `Purchased ${minerType.name}`;
      
      await storage.createTransaction({
        userId,
        type: "purchase",
        amountMere: finalCost.toFixed(2),
        amountUsd: (finalCost * 0.5).toFixed(2),
        description,
        status: "completed",
        metadata: { minerTypeId, quantity: 1, discount: discountPercent, originalPrice: basePrice },
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
      const userId = requireUserId(req, res);
      if (!userId) return;
      const miners = await storage.getUserMiners(userId);
      res.json(miners);
    } catch (error) {
      console.error("Error fetching mining room:", error);
      res.status(500).json({ message: "Failed to fetch mining room" });
    }
  });

  app.get('/api/mining/slots', isAuthenticated, async (req: any, res) => {
    try {
      const userId = requireUserId(req, res);
      if (!userId) return;
      const slotCount = await storage.getUserSlotCount(userId);
      res.json({ totalSlots: 20, unlockedSlots: slotCount });
    } catch (error) {
      console.error("Error fetching slots:", error);
      res.status(500).json({ message: "Failed to fetch slots" });
    }
  });

  app.post('/api/mining/place', isAuthenticated, async (req: any, res) => {
    try {
      const userId = requireUserId(req, res);
      if (!userId) return;
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
      const userId = requireUserId(req, res);
      if (!userId) return;
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

  app.post('/api/mining/upgrade', isAuthenticated, async (req: any, res) => {
    try {
      const userId = requireUserId(req, res);
      if (!userId) return;
      const { minerId } = req.body;

      if (!minerId) {
        return res.status(400).json({ message: "Invalid request" });
      }

      // Upgrade the miner
      const result = await storage.upgradeMiner(minerId, userId);

      res.json(result);
    } catch (error: any) {
      console.error("Error upgrading miner:", error);
      res.status(400).json({ message: error.message || "Failed to upgrade miner" });
    }
  });

  app.post('/api/mining/unlock-slot', isAuthenticated, async (req: any, res) => {
    try {
      const userId = requireUserId(req, res);
      if (!userId) return;

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
      const userId = requireUserId(req, res);
      if (!userId) return;
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
      const userId = requireUserId(req, res);
      if (!userId) return;
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

  app.post('/api/wallet/convert', isAuthenticated, async (req: any, res) => {
    try {
      const userId = requireUserId(req, res);
      if (!userId) return;
      const { fromCurrency, toCurrency, amount } = req.body;

      const convertAmount = parseFloat(amount);
      if (!convertAmount || convertAmount <= 0) {
        return res.status(400).json({ message: "Invalid amount" });
      }

      // Get user balance
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(400).json({ message: "User not found" });
      }

      let convertedAmount = 0;
      let description = "";

      if (fromCurrency === "MERE" && toCurrency === "USDT") {
        // Convert MERE to USDT (1 MERE = 0.5 USDT)
        if (parseFloat(user.mereBalance) < convertAmount) {
          return res.status(400).json({ message: "Insufficient MERE balance" });
        }
        convertedAmount = convertAmount * 0.5;
        description = `Converted ${convertAmount} MERE to ${convertedAmount.toFixed(2)} USDT`;
        
        // Actually deduct MERE and add USDT
        await db.transaction(async (tx) => {
          // Deduct MERE (with balance check to prevent negative balance)
          const result = await tx
            .update(users)
            .set({
              mereBalance: sql`${users.mereBalance} - ${convertAmount}`,
              updatedAt: new Date(),
            })
            .where(and(
              eq(users.id, userId),
              sql`${users.mereBalance} >= ${convertAmount}`
            ))
            .returning();
          
          if (result.length === 0) {
            throw new Error("Insufficient MERE balance");
          }
          
          // Add USDT
          await tx
            .update(users)
            .set({
              usdtBalance: sql`${users.usdtBalance} + ${convertedAmount}`,
              updatedAt: new Date(),
            })
            .where(eq(users.id, userId));
        });
      } else if (fromCurrency === "USDT" && toCurrency === "MERE") {
        // Convert USDT to MERE (1 USDT = 2 MERE)
        if (parseFloat(user.usdtBalance) < convertAmount) {
          return res.status(400).json({ message: "Insufficient USDT balance" });
        }
        convertedAmount = convertAmount * 2;
        description = `Converted ${convertAmount} USDT to ${convertedAmount.toFixed(2)} MERE`;
        
        // Actually deduct USDT and add MERE
        await db.transaction(async (tx) => {
          // Deduct USDT (with balance check to prevent negative balance)
          const result = await tx
            .update(users)
            .set({
              usdtBalance: sql`${users.usdtBalance} - ${convertAmount}`,
              updatedAt: new Date(),
            })
            .where(and(
              eq(users.id, userId),
              sql`${users.usdtBalance} >= ${convertAmount}`
            ))
            .returning();
          
          if (result.length === 0) {
            throw new Error("Insufficient USDT balance");
          }
          
          // Add MERE
          await tx
            .update(users)
            .set({
              mereBalance: sql`${users.mereBalance} + ${convertedAmount}`,
              updatedAt: new Date(),
            })
            .where(eq(users.id, userId));
        });
      } else {
        return res.status(400).json({ message: "Invalid currency pair" });
      }

      // Record transaction
      await storage.createTransaction({
        userId,
        type: "conversion",
        amountMere: fromCurrency === "MERE" ? convertAmount.toString() : convertedAmount.toString(),
        amountUsd: fromCurrency === "USDT" ? convertAmount.toString() : convertedAmount.toString(),
        description,
        status: "completed",
      });

      res.json({ success: true, converted: convertedAmount });
    } catch (error) {
      console.error("Error processing conversion:", error);
      res.status(500).json({ message: "Failed to process conversion" });
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
      const userId = requireUserId(req, res);
      if (!userId) return;
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
      const userId = requireUserId(req, res);
      if (!userId) return;
      const upgradeCost = 999; // 999 MERE

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
      const userId = requireUserId(req, res);
      if (!userId) return;
      const { rewardId } = req.body;

      if (!rewardId) {
        return res.status(400).json({ message: "Invalid request" });
      }

      const season = await storage.getCurrentSeason();
      if (!season) {
        return res.status(404).json({ message: "No active season" });
      }

      // Get the reward details
      const [reward] = await db.select().from(seasonPassRewards).where(eq(seasonPassRewards.id, rewardId));
      
      if (!reward) {
        return res.status(404).json({ message: "Reward not found" });
      }

      // Verify reward belongs to current season
      if (reward.seasonId !== season.id) {
        return res.status(400).json({ message: "Reward does not belong to current season" });
      }

      // Get user's season pass progress
      const userPass = await storage.getUserSeasonPass(userId, season.id);
      if (!userPass) {
        return res.status(404).json({ message: "Season pass not found" });
      }

      // Check if user has reached required tier
      if (userPass.currentTier < reward.tier) {
        return res.status(403).json({ message: "You haven't reached this tier yet" });
      }

      // Check if premium reward requires premium status
      if (reward.isPremium && !userPass.hasPremium) {
        return res.status(403).json({ message: "Premium pass required for this reward" });
      }

      // Check if reward was already claimed
      const claimedRewards = Array.isArray(userPass.claimedRewards) 
        ? (userPass.claimedRewards as string[]) 
        : [];
      if (claimedRewards.includes(rewardId)) {
        return res.status(400).json({ message: "Reward already claimed" });
      }

      // Claim reward
      await storage.claimSeasonPassReward(userId, season.id, rewardId);

      // Grant the reward based on type
      if (reward.rewardType === "mere" && reward.rewardValue) {
        // Credit MERE to user balance
        const amount = parseFloat(reward.rewardValue);
        await storage.updateUserBalance(userId, amount.toString(), "add");
        
        // Create transaction record
        await storage.createTransaction({
          userId,
          type: "reward",
          amountMere: amount.toString(),
          description: `Season Pass Tier ${reward.tier} Reward`,
          status: "completed",
        });
      } else if (reward.rewardType === "booster" && reward.rewardMetadata) {
        // Apply hashrate booster to all active miners
        const metadata = reward.rewardMetadata as any;
        const boostMultiplier = metadata.multiplier || 1.0;
        
        await db.update(userMiners)
          .set({ boostMultiplier: sql`${userMiners.boostMultiplier} * ${boostMultiplier}` })
          .where(and(
            eq(userMiners.userId, userId),
            eq(userMiners.isActive, true)
          ));
      }
      // Note: "miner" and "skin" rewards would require additional implementation

      res.json({ success: true, reward });
    } catch (error) {
      console.error("Error claiming reward:", error);
      res.status(500).json({ message: "Failed to claim reward" });
    }
  });

  // Achievements routes
  app.get('/api/achievements', isAuthenticated, async (req: any, res) => {
    try {
      const userId = requireUserId(req, res);
      if (!userId) return;
      
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
      const userId = requireUserId(req, res);
      if (!userId) return;
      const stats = await getReferralStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching referral stats:", error);
      res.status(500).json({ message: "Failed to fetch referral stats" });
    }
  });

  // Daily Games routes
  app.get('/api/games/daily-spin/status', isAuthenticated, async (req: any, res) => {
    try {
      const userId = requireUserId(req, res);
      if (!userId) return;
      
      const lastGame = await storage.getLastDailyGame(userId, 'daily_spin');
      
      if (!lastGame) {
        return res.json({ 
          canPlay: true, 
          lastPlayedAt: null,
          nextPlayAt: null 
        });
      }
      
      const lastPlayedAt = new Date(lastGame.lastPlayedAt);
      const now = new Date();
      const nextPlayAt = new Date(lastPlayedAt);
      nextPlayAt.setHours(24, 0, 0, 0); // Next play at midnight
      
      const canPlay = now >= nextPlayAt;
      
      res.json({
        canPlay,
        lastPlayedAt: lastPlayedAt.toISOString(),
        nextPlayAt: nextPlayAt.toISOString(),
        lastReward: lastGame.rewardMere,
      });
    } catch (error) {
      console.error("Error checking daily spin status:", error);
      res.status(500).json({ message: "Failed to check game status" });
    }
  });

  app.post('/api/games/daily-spin/play', isAuthenticated, async (req: any, res) => {
    try {
      const userId = requireUserId(req, res);
      if (!userId) return;
      
      // Check if user can play
      const lastGame = await storage.getLastDailyGame(userId, 'daily_spin');
      
      if (lastGame) {
        const lastPlayedAt = new Date(lastGame.lastPlayedAt);
        const now = new Date();
        const nextPlayAt = new Date(lastPlayedAt);
        nextPlayAt.setHours(24, 0, 0, 0);
        
        if (now < nextPlayAt) {
          return res.status(400).json({ 
            message: "You've already played today. Come back tomorrow!",
            nextPlayAt: nextPlayAt.toISOString()
          });
        }
      }
      
      // Generate random reward (0.01-0.05 MERE)
      const rewardMere = (0.01 + Math.random() * 0.04).toFixed(2);
      
      // Play the game and credit reward
      const game = await storage.playDailyGame(userId, 'daily_spin', rewardMere);
      
      res.json({
        success: true,
        reward: rewardMere,
        playedAt: game.lastPlayedAt,
      });
    } catch (error) {
      console.error("Error playing daily spin:", error);
      res.status(500).json({ message: "Failed to play game" });
    }
  });

  // Lucky Draw game routes
  app.get('/api/games/lucky-draw/status', isAuthenticated, async (req: any, res) => {
    try {
      const userId = requireUserId(req, res);
      if (!userId) return;
      
      const lastGame = await storage.getLastDailyGame(userId, 'lucky_draw');
      const hasPlayedBefore = await storage.hasPlayedGameBefore(userId, 'lucky_draw');
      
      if (!lastGame) {
        return res.json({ 
          canPlay: true, 
          lastPlayedAt: null,
          nextPlayAt: null,
          isFirstPlay: !hasPlayedBefore
        });
      }
      
      const lastPlayedAt = new Date(lastGame.lastPlayedAt);
      const now = new Date();
      const nextPlayAt = new Date(lastPlayedAt);
      nextPlayAt.setHours(24, 0, 0, 0);
      
      const canPlay = now >= nextPlayAt;
      
      res.json({
        canPlay,
        lastPlayedAt: lastPlayedAt.toISOString(),
        nextPlayAt: nextPlayAt.toISOString(),
        lastReward: lastGame.rewardMere,
        lastRarity: (lastGame.metadata as any)?.rarity,
        isFirstPlay: false
      });
    } catch (error) {
      console.error("Error checking lucky draw status:", error);
      res.status(500).json({ message: "Failed to check game status" });
    }
  });

  app.post('/api/games/lucky-draw/play', isAuthenticated, async (req: any, res) => {
    try {
      const userId = requireUserId(req, res);
      if (!userId) return;
      
      // Check if user can play
      const lastGame = await storage.getLastDailyGame(userId, 'lucky_draw');
      
      if (lastGame) {
        const lastPlayedAt = new Date(lastGame.lastPlayedAt);
        const now = new Date();
        const nextPlayAt = new Date(lastPlayedAt);
        nextPlayAt.setHours(24, 0, 0, 0);
        
        if (now < nextPlayAt) {
          return res.status(400).json({ 
            message: "You've already played today. Come back tomorrow!",
            nextPlayAt: nextPlayAt.toISOString()
          });
        }
      }
      
      // Check if first play
      const hasPlayedBefore = await storage.hasPlayedGameBefore(userId, 'lucky_draw');
      
      let rewardMere: string;
      let rarity: string;
      
      if (!hasPlayedBefore) {
        // First play always gives 0.01 MERE (Common)
        rewardMere = '0.01';
        rarity = 'common';
      } else {
        // Rarity-based rewards with weighted probabilities (0.01-0.07 MERE)
        const rand = Math.random() * 100;
        
        if (rand < 50) { // 50% chance - Common
          rewardMere = (0.01 + Math.random() * 0.01).toFixed(2); // 0.01-0.02
          rarity = 'common';
        } else if (rand < 80) { // 30% chance - Rare
          rewardMere = (0.02 + Math.random() * 0.02).toFixed(2); // 0.02-0.04
          rarity = 'rare';
        } else if (rand < 95) { // 15% chance - Epic
          rewardMere = (0.04 + Math.random() * 0.02).toFixed(2); // 0.04-0.06
          rarity = 'epic';
        } else { // 5% chance - Legendary
          rewardMere = (0.06 + Math.random() * 0.01).toFixed(2); // 0.06-0.07
          rarity = 'legendary';
        }
      }
      
      // Play the game and credit reward
      const game = await storage.playDailyGame(userId, 'lucky_draw', rewardMere, { rarity });
      
      res.json({
        success: true,
        reward: rewardMere,
        rarity,
        playedAt: game.lastPlayedAt,
        isFirstPlay: !hasPlayedBefore
      });
    } catch (error) {
      console.error("Error playing lucky draw:", error);
      res.status(500).json({ message: "Failed to play game" });
    }
  });

  // Miner Match game routes
  app.get('/api/games/miner-match/status', isAuthenticated, async (req: any, res) => {
    try {
      const userId = requireUserId(req, res);
      if (!userId) return;
      
      const lastGame = await storage.getLastDailyGame(userId, 'miner_match');
      
      if (!lastGame) {
        return res.json({ 
          canPlay: true, 
          lastPlayedAt: null,
          nextPlayAt: null 
        });
      }
      
      const lastPlayedAt = new Date(lastGame.lastPlayedAt);
      const now = new Date();
      const nextPlayAt = new Date(lastPlayedAt);
      nextPlayAt.setHours(24, 0, 0, 0);
      
      const canPlay = now >= nextPlayAt;
      
      res.json({
        canPlay,
        lastPlayedAt: lastPlayedAt.toISOString(),
        nextPlayAt: nextPlayAt.toISOString(),
        lastReward: lastGame.rewardMere,
        lastMoves: (lastGame.metadata as any)?.moves,
      });
    } catch (error) {
      console.error("Error checking miner match status:", error);
      res.status(500).json({ message: "Failed to check game status" });
    }
  });

  app.post('/api/games/miner-match/play', isAuthenticated, async (req: any, res) => {
    try {
      const userId = requireUserId(req, res);
      if (!userId) return;
      
      // Check if user can play
      const lastGame = await storage.getLastDailyGame(userId, 'miner_match');
      
      if (lastGame) {
        const lastPlayedAt = new Date(lastGame.lastPlayedAt);
        const now = new Date();
        const nextPlayAt = new Date(lastPlayedAt);
        nextPlayAt.setHours(24, 0, 0, 0);
        
        if (now < nextPlayAt) {
          return res.status(400).json({ 
            message: "You've already played today. Come back tomorrow!",
            nextPlayAt: nextPlayAt.toISOString()
          });
        }
      }
      
      const { moves } = req.body;
      
      // Calculate reward based on moves (fewer moves = better reward)
      // Perfect game (12 moves = 6 pairs) = 0.08 MERE
      // Each extra move reduces reward by 0.01 MERE, minimum 0.01 MERE
      let rewardMere: string;
      if (moves <= 12) {
        rewardMere = '0.08';
      } else {
        const extraMoves = moves - 12;
        const penalty = extraMoves * 0.01;
        const reward = Math.max(0.01, 0.08 - penalty);
        rewardMere = reward.toFixed(2);
      }
      
      // Play the game and credit reward
      const game = await storage.playDailyGame(userId, 'miner_match', rewardMere, { moves });
      
      res.json({
        success: true,
        reward: rewardMere,
        moves,
        playedAt: game.lastPlayedAt,
      });
    } catch (error) {
      console.error("Error playing miner match:", error);
      res.status(500).json({ message: "Failed to play game" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
