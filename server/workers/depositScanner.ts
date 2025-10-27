import cron from 'node-cron';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { scanAddressAndRecord } from '../controllers/usdtDepositController';

let task: cron.ScheduledTask | null = null;

export function startDepositScanner() {
  if (task) return;
  const cronExpr = process.env.DEPOSIT_SCAN_CRON || '*/30 * * * * *'; // every 30s
  task = cron.schedule(cronExpr, async () => {
    try {
      const res = await db.execute(sql`SELECT address FROM user_wallets WHERE address IS NOT NULL`);
      const rows = (res as any).rows as Array<{ address: string }>;
      for (const r of rows) {
        await scanAddressAndRecord(r.address);
      }
    } catch (err) {
      console.error('[depositScanner] error:', err);
    }
  });
  task.start();
  console.log('[depositScanner] started');
}

export function stopDepositScanner() {
  task?.stop();
  task = null;
}
