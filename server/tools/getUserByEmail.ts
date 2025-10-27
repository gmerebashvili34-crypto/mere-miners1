import 'dotenv/config';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: tsx server/tools/getUserByEmail.ts <email>');
    process.exit(1);
  }
  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!rows.length) {
    console.log('No user found for', email);
  } else {
    const u = rows[0];
    console.log({ id: u.id, email: u.email, isAdmin: u.isAdmin, createdAt: u.createdAt, updatedAt: u.updatedAt });
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
