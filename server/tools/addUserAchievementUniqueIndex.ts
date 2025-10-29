import 'dotenv/config';
import { pool } from '../db';

async function main() {
  const sql = `
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public' AND indexname = 'uq_user_achievement'
      ) THEN
        EXECUTE 'CREATE UNIQUE INDEX uq_user_achievement ON public.user_achievements(user_id, achievement_id)';
      END IF;
    END
    $$;
  `;

  await pool.query(sql);
  console.log('Ensured unique index uq_user_achievement on user_achievements(user_id, achievement_id)');
}

main().then(() => process.exit(0)).catch((err) => {
  console.error('Failed to ensure unique index:', err);
  process.exit(1);
});
