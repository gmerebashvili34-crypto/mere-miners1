import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL as string;
// Prefer service role for server-side storage admin operations
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY as string | undefined;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY as string | undefined;

if (!SUPABASE_URL) {
  throw new Error('SUPABASE_URL must be set in .env');
}

const key = SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY;
if (!key) {
  throw new Error('SUPABASE_SERVICE_KEY or SUPABASE_ANON_KEY must be set in .env');
}

export const supabase = createClient(SUPABASE_URL, key, {
  auth: { persistSession: false },
});

export const hasServiceRole = Boolean(SUPABASE_SERVICE_KEY);
