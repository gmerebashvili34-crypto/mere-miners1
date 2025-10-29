// Database storage implementation for MereMiners (Supabase PostgreSQL)
import {
  users,
  minerTypes,
  userMiners,
  transactions,
  seasons,
  leaderboardEntries,
  seasonPassRewards,
  userSeasonPass,
  dailyGames,
  type User,
  type UpsertUser,
  type MinerType,
  type InsertMinerType,
  type UserMiner,
  type InsertUserMiner,
  type Transaction,
  type InsertTransaction,
  type Season,
  type InsertSeason,
  type LeaderboardEntry,
  type InsertLeaderboardEntry,
  type SeasonPassReward,
  type UserSeasonPass,
  type DailyGame,
} from "@shared/schema";
import { db } from "./db";
import { DEFAULT_SLOTS } from "@shared/constants";
import { eq, and, desc, sql, count } from "drizzle-orm";
import { nanoid } from "nanoid";
// Interface for storage operations
export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByReferralCode(referralCode: string): Promise<User | undefined>;
  getUserByDepositAddress(address: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserBalance(userId: string, amountMere: string, operation: "add" | "subtract"): Promise<void>;
  setUserDepositAddress(userId: string, address: string): Promise<void>;
  incrementReferralCount(userId: string): Promise<void>;
  
  // Miner Type operations
  getMinerTypes(): Promise<MinerType[]>;
  getMinerType(id: string): Promise<MinerType | undefined>;
  createMinerType(minerType: InsertMinerType): Promise<MinerType>;
  
  // User Miner operations
  getUserMiners(userId: string): Promise<(UserMiner & { minerType: MinerType })[]>;
  getUserMiner(id: string): Promise<(UserMiner & { minerType: MinerType }) | undefined>;
  createUserMiner(userMiner: InsertUserMiner): Promise<UserMiner>;
  updateMinerSlot(minerId: string, slotPosition: number | null): Promise<void>;
  upgradeMiner(minerId: string, userId: string): Promise<{ newLevel: number; cost: number }>;
  
  // Transaction operations
  getUserTransactions(userId: string): Promise<Transaction[]>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  
  // Leaderboard operations
  getCurrentSeason(): Promise<Season | undefined>;
  getLeaderboard(seasonId: string, limit?: number): Promise<(LeaderboardEntry & { user: User })[]>;
  upsertLeaderboardEntry(entry: InsertLeaderboardEntry): Promise<void>;
  
  // Season Pass operations
  getUserSeasonPass(userId: string, seasonId: string): Promise<UserSeasonPass | undefined>;
  createUserSeasonPass(userId: string, seasonId: string): Promise<UserSeasonPass>;
  updateSeasonPassTier(userId: string, seasonId: string, tier: number): Promise<void>;
  upgradeSeasonPass(userId: string, seasonId: string): Promise<void>;
  claimSeasonPassReward(userId: string, seasonId: string, rewardId: string): Promise<void>;
  getSeasonPassRewards(seasonId: string): Promise<SeasonPassReward[]>;
  
  // Unlocking slots
  unlockSlot(userId: string): Promise<{ newSlotCount: number }>;
  getUserSlotCount(userId: string): Promise<number>;
  
  // Daily Games operations
  getLastDailyGame(userId: string, gameType: string): Promise<DailyGame | undefined>;
  hasPlayedGameBefore(userId: string, gameType: string): Promise<boolean>;
  playDailyGame(userId: string, gameType: string, rewardMere: string, metadata?: any): Promise<DailyGame>;
}

export class DatabaseStorage implements IStorage {
  private slotCounts = new Map<string, number>();
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByReferralCode(referralCode: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.referralCode, referralCode));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const referralCode = userData.referralCode || `MERE${nanoid(6).toUpperCase()}`;
    
    const [user] = await db
      .insert(users)
      .values({
        ...userData,
        referralCode,
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          profileImageUrl: userData.profileImageUrl,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async getUserByDepositAddress(address: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.depositAddress, address));
    return user;
  }

  async updateUserBalance(userId: string, amountMere: string, operation: "add" | "subtract"): Promise<void> {
    const amount = parseFloat(amountMere);
    if (operation === "add") {
      await db
        .update(users)
        .set({
          mereBalance: sql`${users.mereBalance} + ${amount}`,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));
    } else {
      // Safety: prevent negative balances using an atomic conditional update
      const result = await db
        .update(users)
        .set({
          mereBalance: sql`${users.mereBalance} - ${amount}`,
          updatedAt: new Date(),
        })
        .where(and(eq(users.id, userId), sql`${users.mereBalance} >= ${amount}`))
        .returning();
      if ((result as any[]).length === 0) {
        throw new Error("Insufficient MERE balance");
      }
    }
  }

  async setUserDepositAddress(userId: string, address: string): Promise<void> {
    await db
      .update(users)
      .set({ depositAddress: address, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  async incrementReferralCount(userId: string): Promise<void> {
    await db
      .update(users)
      .set({
        totalReferrals: sql`${users.totalReferrals} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  // Miner Type operations
  async getMinerTypes(): Promise<MinerType[]> {
    return await db.select().from(minerTypes).where(eq(minerTypes.isAvailable, true));
  }

  async getMinerType(id: string): Promise<MinerType | undefined> {
    const [minerType] = await db.select().from(minerTypes).where(eq(minerTypes.id, id));
    return minerType;
  }

  async createMinerType(minerType: InsertMinerType): Promise<MinerType> {
    const [created] = await db.insert(minerTypes).values(minerType).returning();
    return created;
  }

  // User Miner operations
  async getUserMiners(userId: string): Promise<(UserMiner & { minerType: MinerType })[]> {
    const result = await db
      .select()
      .from(userMiners)
      .innerJoin(minerTypes, eq(userMiners.minerTypeId, minerTypes.id))
      .where(eq(userMiners.userId, userId))
      .orderBy(desc(userMiners.purchasedAt));
    
    const rows = result as Array<{ user_miners: UserMiner; miner_types: MinerType }>;
    return rows.map((row) => ({
      ...row.user_miners,
      minerType: row.miner_types,
    }));
  }

  async getUserMiner(id: string): Promise<(UserMiner & { minerType: MinerType }) | undefined> {
    const result = await db
      .select()
      .from(userMiners)
      .innerJoin(minerTypes, eq(userMiners.minerTypeId, minerTypes.id))
      .where(eq(userMiners.id, id))
      .limit(1);
    
    if (result.length === 0) return undefined;
    
    return {
      ...result[0].user_miners,
      minerType: result[0].miner_types,
    };
  }

  async createUserMiner(userMiner: InsertUserMiner): Promise<UserMiner> {
    const [created] = await db.insert(userMiners).values(userMiner).returning();
    return created;
  }

  async updateMinerSlot(minerId: string, slotPosition: number | null): Promise<void> {
    await db
      .update(userMiners)
      .set({ slotPosition })
      .where(eq(userMiners.id, minerId));
  }

  async upgradeMiner(minerId: string, userId: string): Promise<{ newLevel: number; cost: number }> {
    const result = await db
      .select()
      .from(userMiners)
      .innerJoin(minerTypes, eq(userMiners.minerTypeId, minerTypes.id))
      .where(and(eq(userMiners.id, minerId), eq(userMiners.userId, userId)))
      .limit(1);

    if (result.length === 0) {
      throw new Error("Miner not found");
    }

    const miner = result[0].user_miners;
    const minerType = result[0].miner_types;
    // Block upgrades for trial/temporary miners
    if (miner.isTemporary) {
      throw new Error("Trial miners cannot be upgraded");
    }
    const currentLevel = miner.upgradeLevel;
    const upgradeCost = 25.98;

    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) {
      throw new Error("User not found");
    }

    const balance = parseFloat(user.mereBalance);
    if (balance < upgradeCost) {
      throw new Error(`Insufficient balance. Need ${upgradeCost.toFixed(2)} MERE`);
    }

    await this.updateUserBalance(userId, upgradeCost.toFixed(2), "subtract");

    const newLevel = currentLevel + 1;
    await db
      .update(userMiners)
      .set({ upgradeLevel: newLevel })
      .where(eq(userMiners.id, minerId));

    await this.createTransaction({
      userId,
      type: "purchase",
      amountMere: upgradeCost.toFixed(2),
      amountUsd: (upgradeCost * 0.5).toFixed(2),
      description: `Upgraded ${minerType.name} to level ${newLevel}`,
      status: "completed",
      metadata: { minerId, oldLevel: currentLevel, newLevel },
    });

    return { newLevel, cost: upgradeCost };
  }

  // Transaction operations
  async getUserTransactions(userId: string): Promise<Transaction[]> {
    return await db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, userId))
      .orderBy(desc(transactions.createdAt))
      .limit(50);
  }

  async createTransaction(transaction: InsertTransaction): Promise<Transaction> {
    const [created] = await db.insert(transactions).values(transaction).returning();
    return created;
  }

  // Leaderboard operations
  async getCurrentSeason(): Promise<Season | undefined> {
    const [season] = await db
      .select()
      .from(seasons)
      .where(eq(seasons.isActive, true))
      .orderBy(desc(seasons.startAt))
      .limit(1);
    return season;
  }

  async getLeaderboard(seasonId: string, limit: number = 100): Promise<(LeaderboardEntry & { user: User })[]> {
    const result = await db
      .select()
      .from(leaderboardEntries)
      .innerJoin(users, eq(leaderboardEntries.userId, users.id))
      .where(eq(leaderboardEntries.seasonId, seasonId))
      .orderBy(desc(leaderboardEntries.totalMined))
      .limit(limit);
    
    const rowsLb = result as Array<{ leaderboard_entries: LeaderboardEntry; users: User }>;
    return rowsLb.map((row, index: number) => ({
      ...row.leaderboard_entries,
      rank: index + 1,
      user: row.users,
    }));
  }

  async upsertLeaderboardEntry(entry: InsertLeaderboardEntry): Promise<void> {
    await db
      .insert(leaderboardEntries)
      .values(entry)
      .onConflictDoUpdate({
        target: [leaderboardEntries.userId, leaderboardEntries.seasonId],
        set: {
          totalMined: entry.totalMined,
          totalHashrate: entry.totalHashrate,
          updatedAt: new Date(),
        },
      });
  }

  // Season Pass operations
  async getUserSeasonPass(userId: string, seasonId: string): Promise<UserSeasonPass | undefined> {
    const [pass] = await db
      .select()
      .from(userSeasonPass)
      .where(and(eq(userSeasonPass.userId, userId), eq(userSeasonPass.seasonId, seasonId)));
    return pass;
  }

  async createUserSeasonPass(userId: string, seasonId: string): Promise<UserSeasonPass> {
    const [pass] = await db
      .insert(userSeasonPass)
      .values({
        userId,
        seasonId,
        currentTier: 0,
        hasPremium: false,
        claimedRewards: [],
      })
      .returning();
    return pass;
  }

  async updateSeasonPassTier(userId: string, seasonId: string, tier: number): Promise<void> {
    await db
      .update(userSeasonPass)
      .set({
        currentTier: tier,
        updatedAt: new Date(),
      })
      .where(and(eq(userSeasonPass.userId, userId), eq(userSeasonPass.seasonId, seasonId)));
  }

  async upgradeSeasonPass(userId: string, seasonId: string): Promise<void> {
    await db
      .update(userSeasonPass)
      .set({
        hasPremium: true,
        updatedAt: new Date(),
      })
      .where(and(eq(userSeasonPass.userId, userId), eq(userSeasonPass.seasonId, seasonId)));
  }

  async claimSeasonPassReward(userId: string, seasonId: string, rewardId: string): Promise<void> {
    const [pass] = await db
      .select()
      .from(userSeasonPass)
      .where(and(eq(userSeasonPass.userId, userId), eq(userSeasonPass.seasonId, seasonId)));
    
    if (!pass) throw new Error("Season pass not found");
    
    const claimed = Array.isArray(pass.claimedRewards) ? (pass.claimedRewards as string[]) : [];
    
    if (!claimed.includes(rewardId)) {
      claimed.push(rewardId);
      await db
        .update(userSeasonPass)
        .set({
          claimedRewards: claimed,
          updatedAt: new Date(),
        })
        .where(and(eq(userSeasonPass.userId, userId), eq(userSeasonPass.seasonId, seasonId)));
    }
  }

  async getSeasonPassRewards(seasonId: string): Promise<SeasonPassReward[]> {
    return await db
      .select()
      .from(seasonPassRewards)
      .where(eq(seasonPassRewards.seasonId, seasonId))
      .orderBy(seasonPassRewards.tier);
  }

  // Slot operations (persisted via transactions count)
  async unlockSlot(userId: string): Promise<{ newSlotCount: number }> {
    const current = await this.getUserSlotCount(userId);
    const maxAllowed = DEFAULT_SLOTS + 8;
    const next = Math.min(current + 1, maxAllowed);
    // The transaction recording happens in the route; we return the target count immediately
    return { newSlotCount: next };
  }

  async getUserSlotCount(userId: string): Promise<number> {
    // Count only v3 unlock transactions to establish a fresh baseline (ignoring any previous markers)
    const [row] = await db
      .select({ c: count() })
      .from(transactions)
      .where(and(
        eq(transactions.userId, userId),
        eq(transactions.type, "purchase"),
        eq(transactions.status, "completed"),
        eq(transactions.description, "Unlocked mining slot v3"),
      ));
    const extra = Math.min(Number(row?.c || 0), 8);
    return DEFAULT_SLOTS + extra;
  }

  // Daily Games operations
  async getLastDailyGame(userId: string, gameType: string): Promise<DailyGame | undefined> {
    const [game] = await db
      .select()
      .from(dailyGames)
      .where(and(eq(dailyGames.userId, userId), eq(dailyGames.gameType, gameType)))
      .orderBy(desc(dailyGames.lastPlayedAt))
      .limit(1);
    return game;
  }

  async hasPlayedGameBefore(userId: string, gameType: string): Promise<boolean> {
    const games = await db
      .select({ id: dailyGames.id })
      .from(dailyGames)
      .where(and(eq(dailyGames.userId, userId), eq(dailyGames.gameType, gameType)))
      .limit(1);
    return games.length > 0;
  }

  async playDailyGame(userId: string, gameType: string, rewardMere: string, metadata?: any): Promise<DailyGame> {
    await this.updateUserBalance(userId, rewardMere, "add");
    
    const [game] = await db
      .insert(dailyGames)
      .values({
        userId,
        gameType,
        lastPlayedAt: new Date(),
        rewardMere,
        metadata: metadata || null,
      })
      .returning();
    
    return game;
  }
}

export const storage = new DatabaseStorage();

