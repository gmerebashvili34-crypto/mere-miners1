import { OAuth2Client } from 'google-auth-library';
import { db } from './db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

function getClient(): OAuth2Client {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error('GOOGLE_CLIENT_ID not configured');
  return new OAuth2Client(clientId);
}

export async function verifyGoogleIdToken(idToken: string): Promise<{ email: string; sub: string; name?: string } | null> {
  const client = getClient();
  const ticket = await client.verifyIdToken({ idToken, audience: process.env.GOOGLE_CLIENT_ID });
  const payload = ticket.getPayload();
  if (!payload?.email || !payload?.sub) return null;
  return { email: payload.email, sub: payload.sub, name: payload.name };
}

function generateReferralCode(): string {
  return `MERE${nanoid(6).toUpperCase()}`;
}

export async function findOrCreateGoogleUser(email: string) {
  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing.length) return existing[0];
  const [created] = await db.insert(users).values({ email, referralCode: generateReferralCode() }).returning();
  return created;
}
