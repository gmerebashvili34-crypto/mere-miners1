import 'dotenv/config';
import { db } from '../db';
import { sql } from 'drizzle-orm';

async function main() {
  const res = await db.execute(sql`select now()`);
  console.log('DB now():', (res as any)?.rows?.[0]?.now || (res as any)?.rows?.[0]);
}

main().then(() => process.exit(0)).catch((err) => {
  console.error('DB sanity failed:', err);
  process.exit(1);
});
