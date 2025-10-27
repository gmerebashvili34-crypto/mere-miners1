import 'dotenv/config';
import { db } from '../db';
import { achievements } from '@shared/schema';
import { eq } from 'drizzle-orm';

async function main() {
  // New smaller rewards (example mapping by name)
  const targetRewards: Record<string, number> = {
    'First Steps': 5,
    'Collector': 15,
    'Mining Beginner': 2,
    'Full Capacity': 10,
    'Hash Power': 12,
    'Mining Tycoon': 40,
    'First Earnings': 1,
    'MERE Millionaire': 100,
    'Premium Pass': 8,
    'Social Butterfly': 20,
  };

  const all = await db.select().from(achievements);
  let updated = 0;

  for (const a of all) {
    const next = targetRewards[a.name as keyof typeof targetRewards];
    if (typeof next === 'number') {
      await db.update(achievements)
        .set({ rewardMere: next.toFixed(2) as any })
        .where(eq(achievements.id, a.id));
      updated++;
    }
  }

  console.log(`Updated rewards for ${updated} achievements`);
}

main().then(() => process.exit(0)).catch((err) => {
  console.error('Failed to tune rewards:', err);
  process.exit(1);
});
