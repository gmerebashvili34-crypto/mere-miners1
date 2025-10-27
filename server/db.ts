// Database connection for MereMiners — Supabase (PostgreSQL) via node-postgres
import pg from 'pg';
const { Pool } = pg as unknown as { Pool: typeof import('pg').Pool };
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a Supabase database?",
  );
}

// Supabase requires SSL in most environments. rejectUnauthorized=false is common.
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export const db = drizzle(pool, { schema });
