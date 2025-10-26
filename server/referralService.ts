import { db } from "./db";
import { users, transactions } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { REFERRAL_BONUS_PERCENT } from "@shared/constants";

export async function creditReferralBonus(
  refereeUserId: string,
  earningsAmount: number
): Promise<void> {
  if (earningsAmount <= 0) return;

  const referee = await db.query.users.findFirst({
    where: eq(users.id, refereeUserId),
  });

  if (!referee || !referee.referredById) {
    return;
  }

  const referrerId = referee.referredById;
  
  // Security: Prevent self-referral bonus (should never happen but double-check)
  if (referrerId === refereeUserId) {
    console.error(`[SECURITY] Self-referral detected: User ${refereeUserId} trying to refer themselves`);
    return;
  }

  const bonusAmount = earningsAmount * (REFERRAL_BONUS_PERCENT / 100);

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({
        mereBalance: sql`${users.mereBalance} + ${bonusAmount}`,
        totalReferralEarnings: sql`${users.totalReferralEarnings} + ${bonusAmount}`,
      })
      .where(eq(users.id, referrerId));

    await tx.insert(transactions).values({
      userId: referrerId,
      type: "referral_bonus",
      amountMere: bonusAmount.toFixed(8),
      description: `Referral bonus (${REFERRAL_BONUS_PERCENT}% of friend's earnings)`,
      status: "completed",
      metadata: {
        refereeUserId,
        refereeEarnings: earningsAmount,
      },
    });
  });
}

export async function getReferralStats(userId: string) {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) {
    return null;
  }

  const referrals = await db.query.users.findMany({
    where: eq(users.referredById, userId),
    columns: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      totalMined: true,
      createdAt: true,
    },
  });

  const referralTransactions = await db.query.transactions.findMany({
    where: eq(transactions.userId, userId),
    orderBy: (transactions, { desc }) => [desc(transactions.createdAt)],
  });

  const referralBonusTransactions = referralTransactions.filter(
    (t) => t.type === "referral_bonus"
  );

  return {
    totalReferrals: user.totalReferrals || 0,
    totalReferralEarnings: parseFloat(user.totalReferralEarnings || "0"),
    referrals: referrals.map((r) => ({
      id: r.id,
      name: r.firstName && r.lastName ? `${r.firstName} ${r.lastName}` : r.email?.split("@")[0] || "Miner",
      totalMined: parseFloat(r.totalMined || "0"),
      joinedAt: r.createdAt,
    })),
    recentBonuses: referralBonusTransactions.slice(0, 10).map((t) => ({
      id: t.id,
      amount: parseFloat(t.amountMere || "0"),
      description: t.description,
      createdAt: t.createdAt,
    })),
  };
}
