import { db } from "./db";
import { users, userMiners, transactions, leaderboardEntries, minerTypes, seasons } from "@shared/schema";
import { eq, and, isNotNull, sql, gte } from "drizzle-orm";
import { TH_DAILY_YIELD_MERE } from "@shared/constants";
import { creditReferralBonus } from "./referralService";
import { achievementsService } from "./achievementsService";

export class EarningsEngine {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private isCalculating = false;
  private lastRunAt: Date | null = null;

  start() {
    if (this.isRunning) {
      console.log("Earnings engine already running");
      return;
    }

    console.log("🚀 Starting earnings engine...");
    this.isRunning = true;

    this.calculateEarnings();

    this.intervalId = setInterval(() => {
      this.calculateEarnings();
    }, 60 * 1000); // Run every minute

    console.log("✅ Earnings engine started");
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log("⏹️ Earnings engine stopped");
  }

  async calculateEarnings() {
    // Prevent overlapping calculations
    if (this.isCalculating) {
      console.log("⏭️ Skipping earnings calculation - previous run still in progress");
      return;
    }

    this.isCalculating = true;

    try {
      console.log(`[${new Date().toISOString()}] Calculating earnings...`);
      this.lastRunAt = new Date();

      const activeMinersList = await db
        .select({
          userId: userMiners.userId,
          minerId: userMiners.id,
          thRate: minerTypes.thRate,
          boostMultiplier: userMiners.boostMultiplier,
          upgradeLevel: userMiners.upgradeLevel,
          lastUpdate: userMiners.lastEarningsUpdate,
          expiresAt: userMiners.expiresAt,
        })
        .from(userMiners)
        .innerJoin(minerTypes, eq(userMiners.minerTypeId, minerTypes.id))
        .where(
          and(
            isNotNull(userMiners.slotPosition),
            eq(userMiners.isActive, true),
            // If expiresAt is set and in the past, exclude from earnings
            sql`${userMiners.expiresAt} IS NULL OR ${userMiners.expiresAt} > NOW()`
          )
        );

      if (activeMinersList.length === 0) {
        console.log("No active miners found");
        return;
      }

      // Group miners by user and calculate total earnings per user
      const userMinersMap = new Map<string, Array<{ minerId: string; earnings: number; minutesSince: number }>>();
      const now = new Date();

      for (const miner of activeMinersList) {
        const lastUpdate = miner.lastUpdate || new Date(Date.now() - 60000);
        const minutesSinceUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60);
        
        // Upgrades are cosmetic only - no performance bonus
        const dailyEarnings = TH_DAILY_YIELD_MERE * miner.thRate * (miner.boostMultiplier || 1.0);
        const earningsPerMinute = dailyEarnings / (24 * 60);
        const earnings = earningsPerMinute * minutesSinceUpdate;

        if (earnings > 0) {
          if (!userMinersMap.has(miner.userId)) {
            userMinersMap.set(miner.userId, []);
          }
          userMinersMap.get(miner.userId)!.push({
            minerId: miner.minerId,
            earnings,
            minutesSince: minutesSinceUpdate,
          });
        }
      }

      // Process each user's earnings in a single atomic transaction
      for (const [userId, minersList] of Array.from(userMinersMap.entries())) {
        const totalEarnings = minersList.reduce((sum, m) => sum + m.earnings, 0);
        
        if (totalEarnings <= 0) continue;

        const roundedEarnings = Math.floor(totalEarnings * 100000000) / 100000000;

        try {
          await db.transaction(async (tx: any) => {
            // Update user balance and total mined
            await tx
              .update(users)
              .set({
                mereBalance: sql`${users.mereBalance} + ${roundedEarnings}`,
                totalMined: sql`${users.totalMined} + ${roundedEarnings}`,
                updatedAt: now,
              })
              .where(eq(users.id, userId));

            // Create daily transaction record (only one per day)
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            const [todayTransaction] = await tx
              .select()
              .from(transactions)
              .where(
                and(
                  eq(transactions.userId, userId),
                  eq(transactions.type, "earnings"),
                  gte(transactions.createdAt, today)
                )
              )
              .limit(1);

            if (todayTransaction) {
              // Update existing daily transaction
              await tx
                .update(transactions)
                .set({
                  amountMere: sql`${transactions.amountMere} + ${roundedEarnings}`,
                  amountUsd: sql`${transactions.amountUsd} + ${roundedEarnings * 0.5}`,
                })
                .where(eq(transactions.id, todayTransaction.id));
            } else {
              // Create new daily transaction
              await tx.insert(transactions).values({
                userId,
                type: "earnings",
                amountMere: roundedEarnings.toString(),
                amountUsd: (roundedEarnings * 0.5).toFixed(2),
                description: "Daily mining earnings",
                status: "completed",
              });
            }

            // Update leaderboard
            const [activeSeasons] = await tx
              .select()
              .from(seasons)
              .where(eq(seasons.isActive, true))
              .limit(1);

            if (activeSeasons) {
              const [entry] = await tx
                .select()
                .from(leaderboardEntries)
                .where(and(eq(leaderboardEntries.userId, userId), eq(leaderboardEntries.seasonId, activeSeasons.id)))
                .limit(1);

              if (entry) {
                await tx
                  .update(leaderboardEntries)
                  .set({
                    totalMined: sql`${leaderboardEntries.totalMined} + ${roundedEarnings}`,
                    updatedAt: now,
                  })
                  .where(eq(leaderboardEntries.id, entry.id));
              } else {
                await tx.insert(leaderboardEntries).values({
                  userId,
                  seasonId: activeSeasons.id,
                  totalMined: roundedEarnings.toString(),
                  totalHashrate: 0,
                });
              }
            }

            // CRITICAL: Only update lastEarningsUpdate after ALL other operations succeed
            // This ensures atomicity - if transaction fails, miners won't lose their accrued earnings
            for (const miner of minersList) {
              await tx
                .update(userMiners)
                .set({ lastEarningsUpdate: now })
                .where(eq(userMiners.id, miner.minerId));
            }
          });

          console.log(`💰 Credited ${roundedEarnings.toFixed(8)} MERE to user ${userId}`);

          // Credit referral bonus to referrer (if applicable)
          await creditReferralBonus(userId, roundedEarnings);

          // Check and unlock any earnings-based achievements idempotently
          await achievementsService.checkAndUnlockAchievements({ userId, type: "earnings" });
        } catch (error) {
          console.error(`❌ Failed to credit earnings for user ${userId}:`, error);
          // If transaction fails, lastEarningsUpdate is NOT updated, so earnings will be retried next cycle
        }
      }

      console.log(`✅ Earnings calculated for ${userMinersMap.size} users`);
    } catch (error) {
      console.error("❌ Error calculating earnings:", error);
    } finally {
      // Always release the lock, even if an error occurred
      this.isCalculating = false;
    }
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      isCalculating: this.isCalculating,
      lastRunAt: this.lastRunAt,
    } as const;
  }
}

export const earningsEngine = new EarningsEngine();
