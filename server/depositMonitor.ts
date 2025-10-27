import { tronService, tronEnabled } from './tronService';
import { storage } from './storage';
import { db } from './db';
import { transactions, users } from '@shared/schema';
import { eq, desc, sql, isNotNull } from 'drizzle-orm';
import { MIN_DEPOSIT_USDT } from '@shared/constants';

class DepositMonitor {
  private isRunning: boolean = false;
  private pollInterval: number = 30000; // Poll every 30 seconds
  private lastProcessedTxId: string | undefined; // legacy (platform wallet mode)
  private intervalId: NodeJS.Timeout | null = null;

  constructor() {
    console.log('💰 DepositMonitor initialized');
  }

  /**
   * Load the last processed transaction ID from database
   */
  private async loadLastProcessedTxId(): Promise<void> {
    try {
      // Get the most recent deposit transaction by txHash (descending order = newest first)
      const [lastDeposit] = await db
        .select()
        .from(transactions)
        .where(eq(transactions.type, 'deposit'))
        .orderBy(desc(transactions.createdAt))
        .limit(1);

      if (lastDeposit && lastDeposit.txHash) {
        this.lastProcessedTxId = lastDeposit.txHash;
        console.log(`📝 Loaded last processed TX: ${this.lastProcessedTxId.substring(0, 10)}...`);
      }
    } catch (error) {
      console.error('❌ Error loading last processed TX ID:', error);
    }
  }

  /**
   * Start monitoring for deposits
   */
  async start() {
    if (this.isRunning) {
      console.log('⚠️ Deposit monitor is already running');
      return;
    }

    if (!tronEnabled) {
      console.warn('⚠️ Skipping deposit monitor start: Tron service disabled');
      return;
    }

    console.log('🚀 Starting deposit monitor...');
    this.isRunning = true;

    // Load last processed transaction ID from database (for idempotency)
    await this.loadLastProcessedTxId();

  // Check immediately on start
  this.checkForDeposits();

    // Then check every 30 seconds
    this.intervalId = setInterval(() => {
      this.checkForDeposits();
    }, this.pollInterval);

    console.log(`✅ Deposit monitor started (polling every ${this.pollInterval / 1000}s)`);
  }

  /**
   * Stop monitoring for deposits
   */
  stop() {
    if (!this.isRunning) {
      return;
    }

    console.log('🛑 Stopping deposit monitor...');
    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    console.log('✅ Deposit monitor stopped');
  }

  /**
   * Check if a transaction hash already exists in the database
   */
  private async txHashExists(txHash: string): Promise<boolean> {
    try {
      const [existing] = await db
        .select()
        .from(transactions)
        .where(eq(transactions.txHash, txHash))
        .limit(1);
      return !!existing;
    } catch (error) {
      console.error('❌ Error checking txHash existence:', error);
      return false;
    }
  }

  /**
   * Check for new deposits and credit users
   */
  private async checkForDeposits() {
    try {
      // Fetch all users with assigned deposit addresses
      const usersWithAddresses = await db
        .select()
        .from(users)
        .where(isNotNull(users.depositAddress));

      for (const u of usersWithAddresses) {
        const deposits = await tronService.getNewDepositsForAddress(u.depositAddress!);
        if (!deposits || deposits.length === 0) continue;

        console.log(`💎 Found ${deposits.length} new deposit(s) for ${u.id}`);

        for (const deposit of deposits) {
        try {
          // Check for duplicate transaction hash (idempotency guard)
          const exists = await this.txHashExists(deposit.txId);
          if (exists) {
            console.log(`⚠️ Skipping duplicate deposit TX: ${deposit.txId}`);
            continue;
          }

          // Minimum deposit guard
          if (deposit.amount < MIN_DEPOSIT_USDT) {
            console.log(`ℹ️ Ignoring small deposit ${deposit.amount} USDT < ${MIN_DEPOSIT_USDT}`);
            continue;
          }

          // Credit USDT directly to user's USDT balance; conversion is optional in-app
          const usdtAmount = deposit.amount;

          console.log(`📥 Processing deposit: ${usdtAmount} USDT from ${deposit.from}`);
          console.log(`   TX: ${deposit.txId}`);

          // For per-user addresses, credit the owner of the address (u)
          const user = u;
          if (user) {
            // Credit user USDT balance and record transaction atomically
            await db.transaction(async (tx) => {
              await tx
                .update(users)
                .set({
                  usdtBalance: sql`${users.usdtBalance} + ${usdtAmount}`,
                  updatedAt: new Date(),
                } as any)
                .where(eq(users.id, user.id));

              await tx
                .insert(transactions)
                .values({
                  userId: user.id,
                  type: 'deposit',
                  amountMere: '0',
                  amountUsd: usdtAmount.toString(),
                  description: `USDT deposit credited (${usdtAmount} USDT)`,
                  status: 'completed',
                  txHash: deposit.txId,
                  metadata: { from: deposit.from, to: deposit.to },
                });
            });

            console.log(`✅ Credited ${usdtAmount} USDT to user ${user.id} (from ${deposit.from})`);
          } else {
            console.log(`🕵️ No user linked to sender address ${deposit.from}. Skipping credit.`);
          }
        } catch (error) {
          console.error(`❌ Error processing deposit ${deposit.txId}:`, error);
        }
        }

      }

    } catch (error) {
      console.error('❌ Error checking for deposits:', error);
    }
  }

  /**
   * Get the current monitoring status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      pollInterval: this.pollInterval,
      lastProcessedTxId: this.lastProcessedTxId,
    };
  }
}

// Export singleton instance
export const depositMonitor = new DepositMonitor();
