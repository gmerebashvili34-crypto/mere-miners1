import type { Request, Response } from 'express';
import { encryptString } from '../lib/crypto';
import { createTronAccount } from '../lib/tron';
import { db } from '../db';
import { sql } from 'drizzle-orm';

export async function adminCreateWallet(req: Request, res: Response) {
  try {
    const userId = (req.query.user_id as string) || '';
    if (!userId) return res.status(400).json({ message: 'user_id required' });

    const acct = await createTronAccount();
    const enc = encryptString(acct.privateKey);

    await db.execute(sql`
      INSERT INTO user_wallets (user_id, address, encrypted_private_key, note)
      VALUES (${userId}, ${acct.address}, ${enc}, ${'hot wallet'})
      ON CONFLICT (user_id)
      DO UPDATE SET address = EXCLUDED.address, encrypted_private_key = EXCLUDED.encrypted_private_key, updated_at = now()
    `);

    return res.json({ address: acct.address });
  } catch (err: any) {
    console.error('[adminCreateWallet] error:', err);
    return res.status(500).json({ message: err.message || 'failed' });
  }
}
