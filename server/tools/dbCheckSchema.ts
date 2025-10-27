import 'dotenv/config';
import { pool } from '../db';

const TABLES = [
  'users',
  'miner_types',
  'user_miners',
  'transactions',
  'seasons',
  'leaderboard_entries',
  'season_pass_rewards',
  'user_season_pass',
  'achievements',
  'user_achievements',
  'daily_games',
  'sessions',
] as const;

type TableName = typeof TABLES[number];

async function tableExists(table: TableName) {
  const { rows } = await pool.query(
    `select exists (
       select 1 from information_schema.tables 
       where table_schema = 'public' and table_name = $1
     ) as exists`,
    [table]
  );
  return rows[0]?.exists === true;
}

async function countRows(table: TableName) {
  try {
    const { rows } = await pool.query(`select count(*)::bigint as cnt from public."${table}"`);
    return Number(rows[0]?.cnt ?? 0);
  } catch (e: any) {
    return { error: e.message } as const;
  }
}

async function checkPgcrypto() {
  const { rows } = await pool.query(`select exists (select 1 from pg_extension where extname = 'pgcrypto') as installed`);
  return rows[0]?.installed === true;
}

async function main() {
  const summary: any = { ok: true, pgcrypto: false, tables: {} };

  summary.pgcrypto = await checkPgcrypto();

  for (const t of TABLES) {
    const exists = await tableExists(t);
    (summary.tables as any)[t] = { exists };
    if (exists) {
      (summary.tables as any)[t].count = await countRows(t);
    } else {
      summary.ok = false;
    }
  }

  // Print a readable report
  console.log('--- Supabase schema check ---');
  console.log('pgcrypto extension:', summary.pgcrypto ? 'installed' : 'MISSING');
  for (const t of TABLES) {
    const info = (summary.tables as any)[t];
    if (info.exists) {
      console.log(`${t}: exists (${info.count} rows)`);
    } else {
      console.log(`${t}: MISSING`);
    }
  }

  if (!summary.pgcrypto) {
    console.log('\nAction: run the pgcrypto extension creation in your Supabase SQL editor:');
    console.log('  CREATE EXTENSION IF NOT EXISTS "pgcrypto";');
  }

  if (!summary.ok) {
    console.log('\nSome tables are missing. Apply your supabase.sql in the Supabase SQL Editor or with psql:');
    console.log('  -- Supabase SQL Editor: paste supabase.sql and click Run');
    console.log('  -- CLI example (Windows PowerShell):');
    console.log('  psql "<your-connection-url>" -f "C:\\Users\\Giorgi\\Desktop\\MereMiners\\supabase.sql"');
  }
}

main().then(() => process.exit(0)).catch((err) => {
  console.error('Schema check failed:', err);
  process.exit(1);
});
