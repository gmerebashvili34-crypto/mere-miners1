import cron from 'node-cron';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { decryptString } from '../lib/crypto';
import { getTronWeb, getUSDTBalance, buildAndSendTRC20 } from '../lib/tron';
import { tronService } from '../tronService';

let task: cron.ScheduledTask | null = null;

export function startSweeper() {
  if (task) return;
  const enabledRaw = (process.env.SWEEP_ENABLED || '').trim();
  const enabled = enabledRaw.toLowerCase() === 'true' || enabledRaw === '1' || enabledRaw.toLowerCase() === 'yes';
  if (!enabled) {
    console.log(`[sweeper] Disabled (set SWEEP_ENABLED=true to enable); current SWEEP_ENABLED="${enabledRaw}"`);
    return;
  }

  const cronExpr = process.env.SWEEP_CRON || '*/90 * * * * *'; // every 90s
  const minUsdt = parseFloat(process.env.SWEEP_MIN_USDT || '1');
  const minTrxForGas = parseFloat(process.env.SWEEP_MIN_TRX || '10'); // TRX
  const topupTrxAmount = parseFloat(process.env.SWEEP_TOPUP_TRX || '20'); // TRX

  const platformKey = process.env.COLD_WALLET_PRIVATE_KEY || process.env.TRON_PRIVATE_KEY || '';
  if (!platformKey) {
    console.warn('[sweeper] No platform private key set (COLD_WALLET_PRIVATE_KEY). Skipping sweeper.');
    return;
  }

  const platformAddr = tronService.getPlatformWalletAddress?.() || (() => {
    try {
      const tw = getTronWeb(platformKey);
      // @ts-ignore
      return tw.address.fromPrivateKey(platformKey);
    } catch {
      return '';
    }
  })();

  if (!platformAddr) {
    console.warn('[sweeper] Could not derive platform address. Skipping sweeper.');
    return;
  }

  task = cron.schedule(cronExpr, async () => {
    try {
      // Fetch user wallets
      const res = await db.execute(sql`SELECT user_id, address, encrypted_private_key FROM user_wallets WHERE address IS NOT NULL AND encrypted_private_key IS NOT NULL`);
      const rows = (res as any).rows as Array<{ user_id: string; address: string; encrypted_private_key: string }>;
      if (!rows?.length) return;

      for (const r of rows) {
        try {
          // Check USDT balance
          const usdtBal = await getUSDTBalance(r.address);
          if (usdtBal < minUsdt) continue;

          // Ensure TRX for gas
          const twQuery = getTronWeb();
          const trxBalSun = await twQuery.trx.getBalance(r.address);
          const trxBal = trxBalSun / 1_000_000;
          if (trxBal < minTrxForGas) {
            // Top up TRX from platform wallet
            try {
              const twPlatform = getTronWeb(platformKey);
              const toSun = Math.floor(topupTrxAmount * 1_000_000);
              await twPlatform.trx.sendTransaction(r.address, toSun);
              console.log(`[sweeper] Topped up ${topupTrxAmount} TRX to ${r.address} for gas`);
              // Defer sweep until next cycle to allow TRX confirm
              continue;
            } catch (e) {
              console.warn('[sweeper] TRX top-up failed for', r.address, (e as any)?.message || e);
              continue;
            }
          }

          // Decrypt private key
          let pk: string;
          try {
            pk = decryptString(r.encrypted_private_key);
          } catch (e) {
            console.warn('[sweeper] Failed to decrypt private key for', r.address, (e as any)?.message || e);
            continue;
          }

          // Sweep full USDT balance to platform address
          const txid = await buildAndSendTRC20({ fromPrivateKey: pk, to: platformAddr, amountUSDT: usdtBal });
          console.log(`[sweeper] Swept ${usdtBal} USDT from ${r.address} -> ${platformAddr} (tx: ${txid})`);

          // Log admin action
          await db.execute(sql`INSERT INTO admin_actions (action, details) VALUES ('deposit_sweep', jsonb_build_object('from', ${r.address}, 'to', ${platformAddr}, 'amount_usdt', ${usdtBal}, 'txid', ${txid}))`);
        } catch (err) {
          console.error('[sweeper] error per wallet:', r.address, err);
        }
      }
    } catch (err) {
      console.error('[sweeper] error:', err);
    }
  });
  task.start();
  console.log('[sweeper] started');
}

export function stopSweeper() {
  task?.stop();
  task = null;
}
