import 'dotenv/config';
import bcrypt from 'bcrypt';
import { nanoid } from 'nanoid';
import { db } from '../db';
import { users, minerTypes, userMiners } from '@shared/schema';
import { eq } from 'drizzle-orm';

async function ensureUser(email: string, password?: string) {
  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing.length > 0) return existing[0];

  const passwordHash = password ? await bcrypt.hash(password, 10) : undefined;
  const referralCode = `MERE${nanoid(6).toUpperCase()}`;

  const [created] = await db.insert(users).values({
    email,
    passwordHash,
    referralCode,
  }).returning();
  return created;
}

async function ensureOneThMinerType() {
  const existing = await db.select().from(minerTypes).where(eq(minerTypes.thRate, 1.0)).limit(1);
  if (existing.length > 0) return existing[0];
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
  return created;
}

async function grantTrial(userId: string, minerTypeId: string) {
  // If user already has any miners, do not duplicate
  const owned = await db.select({ id: userMiners.id }).from(userMiners).where(eq(userMiners.userId, userId)).limit(1);
  if (owned.length > 0) {
    console.log('User already has a miner; skipping grant');
    return false;
  }

  const now = new Date();
  const expires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  await db.insert(userMiners).values({
    userId,
    minerTypeId,
    slotPosition: 1,
    isActive: true,
    boostMultiplier: 1.0,
    upgradeLevel: 0,
    isTemporary: true as any,
    expiresAt: expires as any,
  } as any);

  return true;
}

async function main() {
  const email = process.argv[2];
  const password = process.argv[3];
  if (!email) {
    console.error('Usage: tsx server/tools/grantOrCreateTrialForEmail.ts <email> [password]');
    process.exit(1);
  }

  const user = await ensureUser(email, password);
  const oneTh = await ensureOneThMinerType();
  const granted = await grantTrial(user.id, oneTh.id);
  console.log(`User: ${user.email} (${user.id})`);
  console.log(granted ? '✓ Trial miner granted and placed in slot 1' : '↷ Trial grant skipped (already has miner)');
}

main().then(() => process.exit(0)).catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
