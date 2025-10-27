import type { Request, Response } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { buildAndSendTRC20 } from '../lib/tron';
import { decryptString } from '../lib/crypto';

// POST /api/usdt/withdraw { user_id, destination_address, amount }
export async function requestWithdrawal(req: Request, res: Response) {
  try {
    const { user_id, destination_address, amount } = req.body || {};
    const amt = parseFloat(amount);
    if (!user_id || !destination_address || !amt || amt <= 0) return res.status(400).json({ message: 'invalid body' });

    // Check user balance
    const userRow = await db.execute(sql`SELECT usdt_balance FROM users WHERE id=${user_id} LIMIT 1`);
    const bal = parseFloat((userRow as any).rows?.[0]?.usdt_balance ?? '0');
    const reserve = parseFloat(process.env.WITHDRAW_FEE_RESERVE_USDT || '0');
    if (bal < amt + reserve) return res.status(400).json({ message: 'insufficient balance' });

    // Queue withdrawal
    const r = await db.execute(sql`
      INSERT INTO usdt_withdrawals (user_id, destination_address, amount_usdt, status)
      VALUES (${user_id}, ${destination_address}, ${amt}, 'queued')
      RETURNING id
    `);
    const id = (r as any).rows?.[0]?.id as string;
    return res.json({ queued: true, id });
  } catch (err: any) {
    console.error('[requestWithdrawal] error:', err);
    return res.status(500).json({ message: err.message || 'failed' });
  }
}

// Worker helper: process a queued withdrawal
export async function processWithdrawalRecord(w: { id: string; user_id: string; destination_address: string; amount_usdt: number }) {
  // For production, you may choose: send from central wallet OR from user hot wallet.
  // Below demonstrates central wallet approach (COLD_WALLET_PRIVATE_KEY).
  const fromKey = process.env.COLD_WALLET_PRIVATE_KEY;
  if (!fromKey) throw new Error('COLD_WALLET_PRIVATE_KEY not set');

  // Deduct balance atomically before broadcast to prevent race double-spend
  await db.transaction(async (tx) => {
    const upd = await tx.execute(sql`UPDATE users SET usdt_balance = usdt_balance - ${w.amount_usdt}, updated_at=now() WHERE id=${w.user_id} AND usdt_balance >= ${w.amount_usdt} RETURNING id`);
    const ok = (upd as any).rows?.length;
    if (!ok) throw new Error('insufficient balance at confirm time');
    await tx.execute(sql`UPDATE usdt_withdrawals SET status='processing', updated_at=now() WHERE id=${w.id}`);
  });

  try {
    const txId = await buildAndSendTRC20({ fromPrivateKey: fromKey, to: w.destination_address, amountUSDT: w.amount_usdt });
    await db.execute(sql`UPDATE usdt_withdrawals SET status='completed', txid=${txId}, completed_at=now(), updated_at=now() WHERE id=${w.id}`);
    await db.execute(sql`INSERT INTO admin_actions (action, details) VALUES ('withdraw_completed', jsonb_build_object('withdraw_id', ${w.id}, 'txid', ${txId}))`);
  } catch (err: any) {
    console.error('[withdraw worker] broadcast failed:', err);
    // Refund
    await db.transaction(async (tx) => {
      await tx.execute(sql`UPDATE users SET usdt_balance = usdt_balance + ${w.amount_usdt}, updated_at=now() WHERE id=${w.user_id}`);
      await tx.execute(sql`UPDATE usdt_withdrawals SET status='failed', fail_reason=${err.message || 'broadcast failed'}, updated_at=now() WHERE id=${w.id}`);
    });
    throw err;
  }
}
