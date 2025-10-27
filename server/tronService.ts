import { createRequire } from 'module';
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-var-requires
const TronWebModule: any = require('tronweb');

// USDT TRC-20 Contract Address (Mainnet) — can be overridden via env
const USDT_CONTRACT_ADDRESS = process.env.USDT_CONTRACT || 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';

// TronGrid API configuration
const TRONGRID_API_KEY = process.env.TRONGRID_API_KEY;
// Prefer COLD_WALLET_PRIVATE_KEY if set; fallback to legacy TRON_PRIVATE_KEY
const TRON_PRIVATE_KEY = process.env.COLD_WALLET_PRIVATE_KEY || process.env.TRON_PRIVATE_KEY;
const FULL_NODE = 'https://api.trongrid.io';
const SOLIDITY_NODE = 'https://api.trongrid.io';
const EVENT_SERVER = 'https://api.trongrid.io';

const TRON_ENABLED = Boolean(TRONGRID_API_KEY && TRON_PRIVATE_KEY);

export interface USDTTransaction {
  from: string;
  to: string;
  amount: number;
  txId: string;
  timestamp: Date;
  confirmed: boolean;
}

export class TronService {
  private tronWeb: any;
  private platformWalletAddress: string;
  private enabled: boolean;

  constructor() {
    this.enabled = TRON_ENABLED;
    if (!this.enabled) {
      this.tronWeb = null;
      this.platformWalletAddress = '';
      console.warn('⚠️ TronService disabled: Missing TRONGRID_API_KEY or TRON_PRIVATE_KEY');
      return;
    }

    // Initialize TronWeb instance
    const TronWebCtor: any = TronWebModule.TronWeb || TronWebModule.default || TronWebModule;
    this.tronWeb = new TronWebCtor({
      fullHost: FULL_NODE,
      headers: { 'TRON-PRO-API-KEY': TRONGRID_API_KEY },
      privateKey: TRON_PRIVATE_KEY,
    });

    // Get the platform wallet address from the private key
    this.platformWalletAddress = this.tronWeb.address.fromPrivateKey(TRON_PRIVATE_KEY!);
    console.log('🔗 TronService initialized');
    console.log('📍 Platform wallet address:', this.platformWalletAddress);
  }

  /**
   * Create a new TRON account (address + private key) for per-user deposits
   */
  async createAccount(): Promise<{ address: string; privateKey: string }> {
    if (!this.tronWeb) {
      // Fallback: try to construct a minimal TronWeb instance without API key for local keygen
      const TronWebCtor: any = TronWebModule.TronWeb || TronWebModule.default || TronWebModule;
      const tw = new TronWebCtor({ fullHost: FULL_NODE });
      const acct = await tw.createAccount();
      return { address: acct.address.base58, privateKey: acct.privateKey };
    }
    const acct = await this.tronWeb.createAccount();
    return { address: acct.address.base58, privateKey: acct.privateKey };
  }

  /**
   * Get the platform wallet address for deposits
   */
  getPlatformWalletAddress(): string {
    return this.platformWalletAddress;
  }

  /**
   * Validate a TRON address (base58 or hex)
   */
  isValidAddress(address: string): boolean {
    if (!this.enabled || !this.tronWeb) return false;
    try {
      return this.tronWeb.isAddress(address);
    } catch {
      return false;
    }
  }

  /**
   * Get USDT balance for an address
   */
  async getUSDTBalance(address: string): Promise<number> {
    if (!this.enabled || !this.tronWeb) return 0;
    try {
      // Low-level constant contract call to ensure owner_address is set
      const owner = this.platformWalletAddress || 'T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb';
      const contractHex = this.tronWeb.address.toHex(USDT_CONTRACT_ADDRESS);
      const functionSelector = 'balanceOf(address)';
      const parameters = [{ type: 'address', value: address }];
      const resp = await this.tronWeb.transactionBuilder.triggerConstantContract(
        contractHex,
        functionSelector,
        {},
        parameters,
        owner,
      );
      const hex = (resp as any)?.constant_result?.[0];
      if (!hex) return 0;
      const raw = BigInt('0x' + hex);
      return Number(raw) / 1_000_000;
    } catch (error) {
      // Fallback to wrapper with from address
      try {
        const contract = await this.tronWeb.contract().at(USDT_CONTRACT_ADDRESS);
        const balance = await contract.balanceOf(address).call({ from: this.platformWalletAddress });
        return parseInt(balance.toString()) / 1_000_000;
      } catch (e) {
        console.error('Error getting USDT balance:', e);
        return 0;
      }
    }
  }

  /**
   * Get TRX balance for an address (needed for gas fees)
   */
  async getTRXBalance(address: string): Promise<number> {
    if (!this.enabled || !this.tronWeb) return 0;
    try {
      const balance = await this.tronWeb.trx.getBalance(address);
      // TRX has 6 decimals (sun)
      return balance / 1000000;
    } catch (error) {
      console.error('Error getting TRX balance:', error);
      return 0;
    }
  }

  /**
   * Monitor USDT deposits to the platform wallet
   * Returns new deposits since the last check
   */
  async getNewDeposits(lastProcessedTxId?: string): Promise<USDTTransaction[]> {
    if (!this.enabled) return [];
    try {
      const url = `https://api.trongrid.io/v1/accounts/${this.platformWalletAddress}/transactions/trc20`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'TRON-PRO-API-KEY': TRONGRID_API_KEY!,
        },
      });

      if (!response.ok) {
        throw new Error(`TronGrid API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success || !data.data) {
        return [];
      }

      const transactions: USDTTransaction[] = [];
      
      for (const tx of data.data) {
        // Only process transactions TO our platform wallet
        if (tx.to !== this.platformWalletAddress) {
          continue;
        }

        // Only process USDT contract transactions
        if (tx.token_info?.address !== USDT_CONTRACT_ADDRESS) {
          continue;
        }

        // Stop if we've reached the last processed transaction
        if (lastProcessedTxId && tx.transaction_id === lastProcessedTxId) {
          break;
        }

        // Only confirmed transactions
        if (tx.type !== 'Transfer') {
          continue;
        }

        transactions.push({
          from: tx.from,
          to: tx.to,
          amount: parseInt(tx.value) / 1000000, // Convert to USDT (6 decimals)
          txId: tx.transaction_id,
          timestamp: new Date(tx.block_timestamp),
          confirmed: true,
        });
      }

      return transactions;
    } catch (error) {
      console.error('Error fetching deposits:', error);
      return [];
    }
  }

  /**
   * List latest USDT deposits to a specific address
   */
  async getNewDepositsForAddress(address: string): Promise<USDTTransaction[]> {
    if (!address) return [];
    try {
      const url = `https://api.trongrid.io/v1/accounts/${address}/transactions/trc20`;
      const response = await fetch(url, {
        method: 'GET',
        headers: TRONGRID_API_KEY ? { 'TRON-PRO-API-KEY': TRONGRID_API_KEY } : {},
      });
      if (!response.ok) return [];
      const data = await response.json();
      if (!data?.data) return [];
      const txs: USDTTransaction[] = [];
      for (const tx of data.data) {
        if (tx.to !== address) continue;
        if (tx.token_info?.address !== USDT_CONTRACT_ADDRESS) continue;
        if (tx.type !== 'Transfer') continue;
        txs.push({
          from: tx.from,
          to: tx.to,
          amount: parseInt(tx.value) / 1_000_000,
          txId: tx.transaction_id,
          timestamp: new Date(tx.block_timestamp),
          confirmed: true,
        });
      }
      return txs;
    } catch (err) {
      console.error('Error fetching address deposits:', err);
      return [];
    }
  }

  /**
   * Send USDT to a recipient address
   */
  async sendUSDT(toAddress: string, amount: number): Promise<string> {
    if (!this.enabled || !this.tronWeb) {
      throw new Error('Tron service is disabled (missing env).');
    }
    try {
      // Validate address
      if (!this.tronWeb.isAddress(toAddress)) {
        throw new Error('Invalid TRON address');
      }

      // Check if we have enough balance
      const balance = await this.getUSDTBalance(this.platformWalletAddress);
      if (balance < amount) {
        throw new Error(`Insufficient USDT balance. Have: ${balance}, Need: ${amount}`);
      }

      // Check if we have enough TRX for gas
      const trxBalance = await this.getTRXBalance(this.platformWalletAddress);
      if (trxBalance < 10) {
        console.warn(`⚠️ Low TRX balance for gas fees: ${trxBalance} TRX`);
      }

      // Get the USDT contract
      const contract = await this.tronWeb.contract().at(USDT_CONTRACT_ADDRESS);

      // Convert amount to smallest unit (6 decimals)
      const amountInSmallestUnit = Math.floor(amount * 1000000);

      console.log(`💸 Sending ${amount} USDT to ${toAddress}...`);

      // Send transaction
      const tx = await contract.transfer(
        toAddress,
        amountInSmallestUnit
      ).send({
        feeLimit: 100000000, // 100 TRX max fee
        callValue: 0,
      });

      console.log(`✅ USDT sent! Transaction ID: ${tx}`);
      return tx;
    } catch (error: any) {
      console.error('Error sending USDT:', error);
      throw new Error(`Failed to send USDT: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Verify a transaction by ID
   */
  async verifyTransaction(txId: string): Promise<boolean> {
    if (!this.enabled) return false;
    try {
      const url = `https://api.trongrid.io/wallet/gettransactionbyid`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'TRON-PRO-API-KEY': TRONGRID_API_KEY!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ value: txId }),
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      return data && data.ret && data.ret[0]?.contractRet === 'SUCCESS';
    } catch (error) {
      console.error('Error verifying transaction:', error);
      return false;
    }
  }
}

// Export singleton instance
export const tronService = new TronService();
export const tronEnabled = TRON_ENABLED;
