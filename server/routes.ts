import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { calculateDiscountedPrice, TH_DAILY_YIELD_MERE, SLOT_EXPANSION_PRICE_MERE } from "@shared/constants";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

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
      const userId = req.user.claims.sub;
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

      res.json({ success: true, cost: finalCost });
    } catch (error) {
      console.error("Error purchasing miner:", error);
      res.status(500).json({ message: "Failed to purchase miner" });
    }
  });

  // Mining room routes
  app.get('/api/mining/room', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const miners = await storage.getUserMiners(userId);
      res.json(miners);
    } catch (error) {
      console.error("Error fetching mining room:", error);
      res.status(500).json({ message: "Failed to fetch mining room" });
    }
  });

  app.get('/api/mining/slots', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const slotCount = await storage.getUserSlotCount(userId);
      res.json({ totalSlots: 20, unlockedSlots: slotCount });
    } catch (error) {
      console.error("Error fetching slots:", error);
      res.status(500).json({ message: "Failed to fetch slots" });
    }
  });

  app.post('/api/mining/place', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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

      res.json({ success: true });
    } catch (error) {
      console.error("Error placing miner:", error);
      res.status(500).json({ message: "Failed to place miner" });
    }
  });

  app.post('/api/mining/remove', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;

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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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

      res.json({ success: true });
    } catch (error) {
      console.error("Error upgrading season pass:", error);
      res.status(500).json({ message: "Failed to upgrade season pass" });
    }
  });

  app.post('/api/season-pass/claim', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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

  const httpServer = createServer(app);
  return httpServer;
}
