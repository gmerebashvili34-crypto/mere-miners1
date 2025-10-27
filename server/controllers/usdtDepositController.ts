import type { Request, Response } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { listAddressUSDTTransfers, getTransactionInfo, getCurrentBlockNumber, USDT_CONTRACT } from '../lib/tron';

const CONFIRMATIONS = parseInt(process.env.USDT_CONFIRMATIONS || '1', 10);

export async function webhookDeposit(req: Request, res: Response) {
  // Example webhook receiver shape; TronGrid may sign payload externally.
  try {
    const { txId, to, amount } = req.body || {};
    if (!txId || !to || !amount) return res.status(400).json({ message: 'invalid payload' });

    const userRow = await db.execute(sql`SELECT user_id FROM user_wallets WHERE address = ${to} LIMIT 1`);
    const userId = (userRow as any).rows?.[0]?.user_id as string | undefined;
    if (!userId) return res.status(200).json({ ok: true }); // ignore unknown address

    // Insert pending deposit idempotently
    await db.execute(sql`
      INSERT INTO usdt_deposits (user_id, address, txid, amount_usdt, status)
      VALUES (${userId}, ${to}, ${txId}, ${amount}, 'pending')
      ON CONFLICT (txid) DO NOTHING
    `);

    return res.json({ ok: true });
  } catch (err: any) {
    console.error('[webhookDeposit] error:', err);
    return res.status(500).json({ message: err.message || 'failed' });
  }
}

export async function scanAddressAndRecord(address: string) {
  const transfers = await listAddressUSDTTransfers(address);
  const nowBlock = await getCurrentBlockNumber().catch(() => 0);
  for (const t of transfers) {
    if (t.to !== address) continue;
    const info = await getTransactionInfo(t.txId);
    const confirms = info?.blockNumber && nowBlock ? Math.max(0, nowBlock - info.blockNumber) : 1;

    // Insert idempotently; set status based on confirmations
    await db.execute(sql`
      INSERT INTO usdt_deposits (user_id, address, txid, amount_usdt, status)
      SELECT uw.user_id, ${address}, ${t.txId}, ${t.amount}, ${confirms >= CONFIRMATIONS ? 'confirmed' : 'pending'}
      FROM user_wallets uw WHERE uw.address = ${address}
      ON CONFLICT (txid) DO NOTHING
    `);

    if (confirms >= CONFIRMATIONS) {
      // Atomically credit user balance if not yet marked applied
      await db.transaction(async (tx) => {
        const res = await tx.execute(sql`UPDATE usdt_deposits SET status='applied', applied_at=now() WHERE txid=${t.txId} AND status <> 'applied' RETURNING user_id, amount_usdt`);
        const row = (res as any).rows?.[0];
        if (!row) return; // already applied
        await tx.execute(sql`UPDATE users SET usdt_balance = usdt_balance + ${row.amount_usdt}, updated_at=now() WHERE id=${row.user_id}`);
        // Record user-visible transaction history entry (deposit)
        await tx.execute(sql`
          INSERT INTO transactions (user_id, type, amount_mere, amount_usd, description, status, tx_hash)
          VALUES (${row.user_id}, 'deposit', 0, ${row.amount_usdt}, 'USDT deposit credited', 'completed', ${t.txId})
        `);
        await tx.execute(sql`INSERT INTO admin_actions (action, details) VALUES ('deposit_applied', jsonb_build_object('txid', ${t.txId}, 'user_id', ${row.user_id}, 'amount', ${row.amount_usdt}))`);
      });
    }
  }
}
