import { db } from "./db";
import { users, userMiners, achievements, userAchievements, transactions, userSeasonPass, minerTypes } from "@shared/schema";
import type { UserAchievement } from "@shared/schema";
import { eq, and, sql, count, isNotNull, gte } from "drizzle-orm";

interface AchievementCheckContext {
  userId: string;
  type: string;
  value?: number;
}

export class AchievementsService {
  async checkAndUnlockAchievements(context: AchievementCheckContext) {
    const { userId, type } = context;

    // Get all active achievements that haven't been unlocked yet
    const allAchievements = await db
      .select()
      .from(achievements)
      .where(eq(achievements.isActive, true));

    // Get user's current achievement progress
    const userAchievementRecords = await db
      .select()
      .from(userAchievements)
      .where(eq(userAchievements.userId, userId)) as UserAchievement[];

    const userAchievementsMap = new Map<string, UserAchievement>(
      userAchievementRecords.map((ua: UserAchievement) => [ua.achievementId, ua])
    );

    // Calculate current stats for the user
    const stats = await this.getUserStats(userId);

    const newlyUnlocked: string[] = [];

    for (const achievement of allAchievements) {
      const userAchievement = userAchievementsMap.get(achievement.id);

      // Skip if already unlocked (as of our initial read)
      if (userAchievement?.isUnlocked) continue;

      const criteria = achievement.criteria as { type: string; value: number };

      // Check if achievement criteria is met
      const progress = this.getProgressForCriteria(criteria.type, stats);
      const meetsCriteria = progress >= criteria.value;

      if (userAchievement) {
        // Always keep progress up to date
        if (progress !== userAchievement.progress) {
          await db
            .update(userAchievements)
            .set({ progress })
            .where(eq(userAchievements.id, userAchievement.id));
        }

        // If criteria met, try to atomically flip is_unlocked from false -> true and award exactly once
        if (meetsCriteria) {
          const justUnlocked = await this.tryUnlockAndAward(userId, achievement.id, achievement);
          if (justUnlocked) newlyUnlocked.push(achievement.id);
        }
      } else {
        // No record yet. Create a tracking record first (locked), then try to unlock atomically if criteria is met.
        // Note: We intentionally create as locked to avoid double-award on concurrent inserts.
        try {
          await db.insert(userAchievements).values({
            userId,
            achievementId: achievement.id,
            progress,
            isUnlocked: false,
            unlockedAt: null,
          });
        } catch (e) {
          // If another concurrent process inserted, ignore
        }

        if (meetsCriteria) {
          const justUnlocked = await this.tryUnlockAndAward(userId, achievement.id, achievement);
          if (justUnlocked) newlyUnlocked.push(achievement.id);
        }
      }
    }

    return {
      checked: allAchievements.length,
      newlyUnlocked: newlyUnlocked.length,
      achievementIds: newlyUnlocked,
    };
  }

  private async getUserStats(userId: string) {
    // Get user data
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

    // Count total miners owned
    const [minersCountResult] = await db
      .select({ count: count() })
      .from(userMiners)
      .where(and(
        eq(userMiners.userId, userId),
        eq(userMiners.isActive, true),
        // Count only real, paid miners (exclude temporary trial miners)
        eq(userMiners.isTemporary, false as any)
      ));

    const totalMinersOwned = minersCountResult?.count || 0;

    // Count miners placed in slots
    const [placedMinersResult] = await db
      .select({ count: count() })
      .from(userMiners)
      .where(and(
        eq(userMiners.userId, userId),
        eq(userMiners.isActive, true),
        // Only real miners
        eq(userMiners.isTemporary, false as any),
        sql`${userMiners.slotPosition} IS NOT NULL`
      ));

    const minersPlaced = placedMinersResult?.count || 0;

    // Calculate total hashrate using explicit join to minerTypes
    const minerRows = await db
      .select({ thRate: minerTypes.thRate, boostMultiplier: userMiners.boostMultiplier })
      .from(userMiners)
      .innerJoin(minerTypes, eq(userMiners.minerTypeId, minerTypes.id))
      .where(and(
        eq(userMiners.userId, userId),
        eq(userMiners.isActive, true),
        // Only real miners contribute to hashrate for achievements
        eq(userMiners.isTemporary, false as any),
        isNotNull(userMiners.slotPosition)
      ));

    const totalHashrate = (minerRows as Array<{ thRate: number; boostMultiplier: number | null }>).reduce(
      (sum: number, row) => sum + row.thRate * (row.boostMultiplier || 1.0),
      0
    );

    // Count total purchases (transactions of type "purchase")
    const [purchasesResult] = await db
      .select({ count: count() })
      .from(transactions)
      .where(and(
        eq(transactions.userId, userId),
        eq(transactions.type, "purchase")
      ));

    const totalPurchases = purchasesResult?.count || 0;

    // Check premium pass status
  const [seasonPass] = await db.select().from(userSeasonPass).where(eq(userSeasonPass.userId, userId)).limit(1);

    const hasPremiumPass = seasonPass?.hasPremium ? 1 : 0;

    // Track successful referrals (users who were referred by this user)
    const [referralsResult] = await db
      .select({ count: count() })
      .from(users)
      .where(eq(users.referredById, userId));
    
    const successfulReferrals = referralsResult?.count || 0;

    return {
      totalMined: parseFloat(user?.totalMined || "0"),
      totalMinersOwned,
      minersPlaced,
      slotsFilledCount: minersPlaced,
      totalHashrate,
      totalPurchases,
      hasPremiumPass,
      successfulReferrals,
    };
  }

  private getProgressForCriteria(type: string, stats: any): number {
    switch (type) {
      case "total_purchases":
        return stats.totalPurchases;
      case "total_miners_owned":
        return stats.totalMinersOwned;
      case "miners_placed":
        return stats.minersPlaced;
      case "slots_filled":
        return stats.slotsFilledCount;
      case "total_hashrate":
        return Math.floor(stats.totalHashrate);
      case "total_mined":
        return stats.totalMined;
      case "season_pass_premium":
        return stats.hasPremiumPass;
      case "successful_referrals":
        return stats.successfulReferrals;
      default:
        return 0;
    }
  }

  // Attempt to flip is_unlocked=false -> true atomically and award once. Returns true only for the first successful flip.
  private async tryUnlockAndAward(userId: string, achievementId: string, achievement: any): Promise<boolean> {
    const rewardAmount = parseFloat(achievement.rewardMere || "0");

    let unlockedNow = false;

  await db.transaction(async (tx: any) => {
      // Atomically unlock only if currently locked
      const updated = await tx
        .update(userAchievements)
        .set({ isUnlocked: true, unlockedAt: new Date() })
        .where(and(
          eq(userAchievements.userId, userId),
          eq(userAchievements.achievementId, achievementId),
          eq(userAchievements.isUnlocked, false as any)
        ))
        .returning({ id: userAchievements.id });

      if (updated.length > 0) {
        unlockedNow = true;

        // Credit reward only for the first process that flipped the flag
        if (rewardAmount > 0) {
          // Credit MERE reward
          await tx
            .update(users)
            .set({
              mereBalance: sql`${users.mereBalance} + ${rewardAmount}`,
              updatedAt: new Date(),
            })
            .where(eq(users.id, userId));

          // Create transaction record
          await tx.insert(transactions).values({
            userId,
            type: "reward",
            amountMere: rewardAmount.toString(),
            amountUsd: (rewardAmount * 0.5).toFixed(2),
            description: `Achievement unlocked: ${achievement.name}`,
            status: "completed",
            metadata: { achievementId },
          });
        }
      }
    });

    if (unlockedNow && rewardAmount > 0) {
      console.log(`🏆 Achievement unlocked for user ${userId}: ${achievement.name} (${rewardAmount} MERE reward)`);
    }

    return unlockedNow;
  }
}

export const achievementsService = new AchievementsService();
