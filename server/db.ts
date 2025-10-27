// Database connection for MereMiners — Supabase (PostgreSQL) via node-postgres
import pg from 'pg';
const { Pool } = pg as unknown as { Pool: typeof import('pg').Pool };
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

// Graceful DB initialization: if DATABASE_URL is missing, don't crash the serverless function.
const HAS_DB = Boolean(process.env.DATABASE_URL);

// Export a Pool-like object; when DB is disabled, methods throw with a helpful error.
export const pool: import('pg').Pool = HAS_DB
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      // Supabase typically requires SSL; disable cert verification by default
      ssl: { rejectUnauthorized: false },
    })
  : (new Proxy({}, {
      get: () => {
        return async () => {
          throw new Error("Database not configured. Set DATABASE_URL in your environment.");
        };
      },
    }) as unknown as import('pg').Pool);

// When DB is disabled, export a proxy that throws on use with a helpful error
function createDisabledDbProxy(): any {
  const err = () => {
    throw new Error(
  "Database not configured. Set DATABASE_URL in your deployment environment variables."
    );
  };
  return new Proxy(
    {},
    {
      get: () => err,
      apply: () => err(),
    }
  );
}

export const db: ReturnType<typeof drizzle> | any = HAS_DB
  ? drizzle(pool as NonNullable<typeof pool>, { schema })
  : createDisabledDbProxy();

if (!HAS_DB) {
  console.warn(
    "[db] DATABASE_URL is not set. API will run, but any database operation will return a 500 with a clear message."
  );
}
