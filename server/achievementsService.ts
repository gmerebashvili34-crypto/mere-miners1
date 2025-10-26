import { db } from "./db";
import { users, userMiners, achievements, userAchievements, transactions, userSeasonPass } from "@shared/schema";
import { eq, and, sql, count } from "drizzle-orm";

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
      .where(eq(userAchievements.userId, userId));

    const userAchievementsMap = new Map(
      userAchievementRecords.map((ua) => [ua.achievementId, ua])
    );

    // Calculate current stats for the user
    const stats = await this.getUserStats(userId);

    const newlyUnlocked: string[] = [];

    for (const achievement of allAchievements) {
      const userAchievement = userAchievementsMap.get(achievement.id);
      
      // Skip if already unlocked
      if (userAchievement?.isUnlocked) continue;

      const criteria = achievement.criteria as { type: string; value: number };
      
      // Check if achievement criteria is met
      const progress = this.getProgressForCriteria(criteria.type, stats);
      const isUnlocked = progress >= criteria.value;

      if (userAchievement) {
        // Update existing record
        if (progress !== userAchievement.progress || isUnlocked) {
          await db
            .update(userAchievements)
            .set({
              progress,
              isUnlocked,
              unlockedAt: isUnlocked ? new Date() : userAchievement.unlockedAt,
            })
            .where(eq(userAchievements.id, userAchievement.id));

          if (isUnlocked && !userAchievement.isUnlocked) {
            newlyUnlocked.push(achievement.id);
            await this.awardAchievement(userId, achievement);
          }
        }
      } else {
        // Create new achievement tracking record
        await db.insert(userAchievements).values({
          userId,
          achievementId: achievement.id,
          progress,
          isUnlocked,
          unlockedAt: isUnlocked ? new Date() : null,
        });

        if (isUnlocked) {
          newlyUnlocked.push(achievement.id);
          await this.awardAchievement(userId, achievement);
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
    const user = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.id, userId),
    });

    // Count total miners owned
    const [minersCountResult] = await db
      .select({ count: count() })
      .from(userMiners)
      .where(and(
        eq(userMiners.userId, userId),
        eq(userMiners.isActive, true)
      ));

    const totalMinersOwned = minersCountResult?.count || 0;

    // Count miners placed in slots
    const [placedMinersResult] = await db
      .select({ count: count() })
      .from(userMiners)
      .where(and(
        eq(userMiners.userId, userId),
        eq(userMiners.isActive, true),
        sql`${userMiners.slotPosition} IS NOT NULL`
      ));

    const minersPlaced = placedMinersResult?.count || 0;

    // Calculate total hashrate
    const placedMiners = await db.query.userMiners.findMany({
      where: (userMiners, { and, eq, isNotNull }) => and(
        eq(userMiners.userId, userId),
        eq(userMiners.isActive, true),
        isNotNull(userMiners.slotPosition)
      ),
      with: {
        minerType: true,
      },
    });

    const totalHashrate = placedMiners.reduce((sum, miner) => {
      return sum + (miner.minerType.thRate * (miner.boostMultiplier || 1.0));
    }, 0);

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
    const seasonPass = await db.query.userSeasonPass.findFirst({
      where: (pass, { eq }) => eq(pass.userId, userId),
    });

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

  private async awardAchievement(userId: string, achievement: any) {
    const rewardAmount = parseFloat(achievement.rewardMere || "0");
    
    if (rewardAmount > 0) {
      await db.transaction(async (tx) => {
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
          metadata: { achievementId: achievement.id },
        });
      });

      console.log(`🏆 Achievement unlocked for user ${userId}: ${achievement.name} (${rewardAmount} MERE reward)`);
    }
  }
}

export const achievementsService = new AchievementsService();
