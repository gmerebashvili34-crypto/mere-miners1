import 'dotenv/config';
import { pool } from '../db';

async function columnExists(table: string, column: string) {
  const { rows } = await pool.query(
    `select exists (
       select 1 from information_schema.columns 
       where table_schema = 'public' and table_name = $1 and column_name = $2
     ) as exists`,
    [table, column]
  );
  return rows[0]?.exists === true;
}

async function addColumnIfMissing() {
  const hasIsTemporary = await columnExists('user_miners', 'is_temporary');
  if (!hasIsTemporary) {
    console.log('Adding user_miners.is_temporary ...');
    await pool.query(`alter table public.user_miners add column is_temporary boolean not null default false`);
  }
  const hasExpiresAt = await columnExists('user_miners', 'expires_at');
  if (!hasExpiresAt) {
    console.log('Adding user_miners.expires_at ...');
    await pool.query(`alter table public.user_miners add column expires_at timestamp`);
  }
}

async function main() {
  await addColumnIfMissing();
  console.log('Migration completed');
}

main().then(() => process.exit(0)).catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
