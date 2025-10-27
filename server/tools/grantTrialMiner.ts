import 'dotenv/config';
import { db } from '../db';
import { users, userMiners, minerTypes } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';

async function main() {
  // Find all users who have zero miners
  const userList = await db.select().from(users);
  let ensuredTypeId: string | null = null;

  // Try get a 1 TH/s miner type
  const oneTh = await db.select().from(minerTypes).where(eq(minerTypes.thRate, 1.0)).limit(1);
  if (oneTh.length > 0) {
    ensuredTypeId = oneTh[0].id;
  } else {
    // Create a hidden trial miner type
    const [created] = await db.insert(minerTypes).values({
      name: 'Starter Trial Miner',
      description: '1 TH/s trial miner for new users (7 days)',
      imageUrl: '/attached_assets/generated_images/Black_Background_Cube_Miner_c9e82d6a.png',
      thRate: 1.0,
      basePriceUsd: '0.00',
      basePriceMere: '0.00',
      dailyYieldUsd: '0.08',
      dailyYieldMere: '0.16',
      roiDays: 7,
      rarity: 'common',
      isAvailable: false,
    }).returning();
    ensuredTypeId = created.id;
  }

  const now = new Date();
  const expires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  let granted = 0;

  for (const u of userList) {
    const owned = await db.select({ id: userMiners.id }).from(userMiners).where(eq(userMiners.userId, u.id)).limit(1);
    if (owned.length > 0) continue;

    // Place in slot 1 by default
    await db.insert(userMiners).values({
      userId: u.id,
      minerTypeId: ensuredTypeId!,
      slotPosition: 1,
      isActive: true,
      boostMultiplier: 1.0,
      upgradeLevel: 0,
      isTemporary: true as any,
      expiresAt: expires as any,
    } as any);

    // Reset lastEarningsUpdate to now to avoid backdating
    await db.update(userMiners)
      .set({ lastEarningsUpdate: now })
      .where(eq(userMiners.userId, u.id));

    granted++;
  }

  console.log(`Granted trial miner to ${granted} user(s)`);
}

main().then(() => process.exit(0)).catch((err) => {
  console.error('Grant trial failed:', err);
  process.exit(1);
});
