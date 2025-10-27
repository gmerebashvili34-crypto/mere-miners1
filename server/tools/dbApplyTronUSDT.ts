import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { db } from '../db';
import { sql } from 'drizzle-orm';

async function main() {
  const file = path.resolve(import.meta.dirname, '..', 'sql', 'tron_usdt.sql');
  const content = await fs.promises.readFile(file, 'utf8');
  // Split on semicolons carefully: here we assume our file uses semicolons to terminate statements
  const statements = content
    .split(/;\s*\n/)
    .map(s => s.trim())
    .filter(Boolean);
  for (const stmt of statements) {
    await db.execute(sql.raw(stmt));
  }
  console.log('Applied tron_usdt.sql');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
