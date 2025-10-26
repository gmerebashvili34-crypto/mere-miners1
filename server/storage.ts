// Database storage implementation for MereMiners
import {
  users,
  minerTypes,
  userMiners,
  transactions,
  seasons,
  leaderboardEntries,
  seasonPassRewards,
  userSeasonPass,
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
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql } from "drizzle-orm";

// Interface for storage operations
export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  getUserByReferralCode(referralCode: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserBalance(userId: string, amountMere: string, operation: "add" | "subtract"): Promise<void>;
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
}

export class DatabaseStorage implements IStorage {
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
    const [user] = await db
      .insert(users)
      .values(userData)
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
      await db
        .update(users)
        .set({
          mereBalance: sql`${users.mereBalance} - ${amount}`,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));
    }
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
    
    return result.map(row => ({
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
    
    return result.map((row, index) => ({
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
      .where(
        and(
          eq(userSeasonPass.userId, userId),
          eq(userSeasonPass.seasonId, seasonId)
        )
      );
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
      .where(
        and(
          eq(userSeasonPass.userId, userId),
          eq(userSeasonPass.seasonId, seasonId)
        )
      );
  }

  async upgradeSeasonPass(userId: string, seasonId: string): Promise<void> {
    await db
      .update(userSeasonPass)
      .set({
        hasPremium: true,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(userSeasonPass.userId, userId),
          eq(userSeasonPass.seasonId, seasonId)
        )
      );
  }

  async claimSeasonPassReward(userId: string, seasonId: string, rewardId: string): Promise<void> {
    const [pass] = await db
      .select()
      .from(userSeasonPass)
      .where(
        and(
          eq(userSeasonPass.userId, userId),
          eq(userSeasonPass.seasonId, seasonId)
        )
      );
    
    if (!pass) throw new Error("Season pass not found");
    
    const claimed = (pass.claimedRewards as string[]) || [];
    if (!claimed.includes(rewardId)) {
      claimed.push(rewardId);
      await db
        .update(userSeasonPass)
        .set({
          claimedRewards: claimed,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(userSeasonPass.userId, userId),
            eq(userSeasonPass.seasonId, seasonId)
          )
        );
    }
  }

  async getSeasonPassRewards(seasonId: string): Promise<SeasonPassReward[]> {
    return await db
      .select()
      .from(seasonPassRewards)
      .where(eq(seasonPassRewards.seasonId, seasonId))
      .orderBy(seasonPassRewards.tier);
  }

  // Slot operations
  async unlockSlot(userId: string): Promise<{ newSlotCount: number }> {
    // This is simplified - in production you'd track this per user
    // For now, we'll just return success
    return { newSlotCount: 10 };
  }

  async getUserSlotCount(userId: string): Promise<number> {
    // Default slot count - could be extended to track per user
    return 6;
  }
}

export const storage = new DatabaseStorage();
