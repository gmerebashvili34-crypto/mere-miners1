import { createRequire } from 'module';
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-var-requires
const TronWebModule: any = require('tronweb');

export const USDT_CONTRACT = process.env.USDT_CONTRACT || 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';

export function getTronWeb(privateKey?: string) {
  const TRONGRID_API_KEY = process.env.TRONGRID_API_KEY;
  const FULL_HOST = process.env.TRONGRID_URL || 'https://api.trongrid.io';
  const TronWebCtor: any = TronWebModule.TronWeb || TronWebModule.default || TronWebModule;
  const headers = TRONGRID_API_KEY ? { 'TRON-PRO-API-KEY': TRONGRID_API_KEY } : {};
  return new TronWebCtor({ fullHost: FULL_HOST, privateKey, headers });
}

export async function createTronAccount() {
  const tw = getTronWeb();
  const acct = await tw.createAccount();
  return { address: acct.address.base58 as string, privateKey: acct.privateKey as string };
}

export async function getCurrentBlockNumber(): Promise<number> {
  const tw = getTronWeb();
  const block = await tw.trx.getCurrentBlock();
  return block?.block_header?.raw_data?.number ?? 0;
}

export async function getTransactionInfo(txId: string): Promise<{ blockNumber?: number } | null> {
  const tw = getTronWeb();
  try {
    const info = await tw.trx.getTransactionInfo(txId);
    return { blockNumber: (info as any)?.blockNumber };
  } catch {
    return null;
  }
}

export async function getUSDTBalance(address: string): Promise<number> {
  // Prefer low-level constant call to explicitly set owner_address to avoid "owner_address isn't set" errors
  const pk = process.env.COLD_WALLET_PRIVATE_KEY || process.env.TRON_PRIVATE_KEY;
  const tw = getTronWeb(pk);
  const owner = pk ? tw.address.fromPrivateKey(pk) : 'T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb';
  try {
    const contractHex = tw.address.toHex(USDT_CONTRACT);
    const functionSelector = 'balanceOf(address)';
    const parameters = [{ type: 'address', value: address }];
    const options = {} as any;
    const resp = await tw.transactionBuilder.triggerConstantContract(
      contractHex,
      functionSelector,
      options,
      parameters,
      owner,
    );
    const hex = (resp as any)?.constant_result?.[0];
    if (!hex) return 0;
    const raw = BigInt('0x' + hex);
    return Number(raw) / 1_000_000;
  } catch {
    // Fallback to contract wrapper with from address if constant call fails
    try {
      const contract = await tw.contract().at(USDT_CONTRACT);
      const raw = await contract.balanceOf(address).call({ from: owner });
      const num = typeof (raw as any)?.toString === 'function' ? parseInt((raw as any).toString(), 10) : parseInt(String(raw), 10);
      return (isNaN(num) ? 0 : num) / 1_000_000;
    } catch {
      return 0;
    }
  }
}

export async function buildAndSendTRC20({
  fromPrivateKey,
  to,
  amountUSDT,
}: {
  fromPrivateKey: string;
  to: string;
  amountUSDT: number;
}): Promise<string> {
  const tw = getTronWeb(fromPrivateKey);
  const contract = await tw.contract().at(USDT_CONTRACT);
  const amount = Math.floor(amountUSDT * 1_000_000);
  const tx = await contract.transfer(to, amount).send({ feeLimit: 100_000_000, callValue: 0 });
  return tx as string; // txId
}

export async function listAddressUSDTTransfers(address: string): Promise<Array<{
  txId: string; from: string; to: string; amount: number; blockTimestamp: number;
}>> {
  const TRONGRID_API_KEY = process.env.TRONGRID_API_KEY;
  const FULL_HOST = process.env.TRONGRID_URL || 'https://api.trongrid.io';
  const url = `${FULL_HOST}/v1/accounts/${address}/transactions/trc20`;
  const res = await fetch(url, {
    headers: TRONGRID_API_KEY ? { 'TRON-PRO-API-KEY': TRONGRID_API_KEY } : {},
  });
  if (!res.ok) return [];
  const data = await res.json();
  const out: Array<{ txId: string; from: string; to: string; amount: number; blockTimestamp: number }> = [];
  for (const tx of data?.data || []) {
    if (tx?.token_info?.address !== USDT_CONTRACT) continue;
    if (tx?.type !== 'Transfer') continue;
    out.push({
      txId: tx.transaction_id,
      from: tx.from,
      to: tx.to,
      amount: parseInt(tx.value, 10) / 1_000_000,
      blockTimestamp: tx.block_timestamp,
    });
  }
  return out;
}
