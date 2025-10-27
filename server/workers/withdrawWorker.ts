import cron from 'node-cron';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { processWithdrawalRecord } from '../controllers/usdtWithdrawController';

let task: cron.ScheduledTask | null = null;
const BATCH = parseInt(process.env.WITHDRAW_BATCH_SIZE || '5', 10);

export function startWithdrawWorker() {
  if (task) return;
  const cronExpr = process.env.WITHDRAW_SCAN_CRON || '*/20 * * * * *'; // every 20s
  task = cron.schedule(cronExpr, async () => {
    try {
      // Concurrency-safe pick: mark queued -> locked to this loop
      const pick = await db.execute(sql`
        UPDATE usdt_withdrawals
        SET status='locked', updated_at=now()
        WHERE id IN (
          SELECT id FROM usdt_withdrawals WHERE status='queued' ORDER BY created_at ASC LIMIT ${BATCH}
        )
        RETURNING id, user_id, destination_address, amount_usdt
      `);
      const rows = (pick as any).rows as Array<{ id: string; user_id: string; destination_address: string; amount_usdt: number }>;
      for (const r of rows) {
        try {
          await processWithdrawalRecord(r);
        } catch (err) {
          // already handled
        }
      }
    } catch (err) {
      console.error('[withdrawWorker] error:', err);
    }
  });
  task.start();
  console.log('[withdrawWorker] started');
}

export function stopWithdrawWorker() {
  task?.stop();
  task = null;
}
