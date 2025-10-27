import 'dotenv/config';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
// Use CJS require to get a constructable TronWeb
// eslint-disable-next-line @typescript-eslint/no-var-requires
const TronWebModule: any = require('tronweb');

const USDT_CONTRACT_ADDRESS = process.env.USDT_CONTRACT || 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';

const TRONGRID_API_KEY = process.env.TRONGRID_API_KEY as string;
const TRON_PRIVATE_KEY = (process.env.COLD_WALLET_PRIVATE_KEY || process.env.TRON_PRIVATE_KEY) as string;

if (!TRONGRID_API_KEY || !TRON_PRIVATE_KEY) {
  console.error('Missing TRONGRID_API_KEY or COLD_WALLET_PRIVATE_KEY/TRON_PRIVATE_KEY in .env');
  process.exit(1);
}

async function main() {
  const TronWebCtor = TronWebModule.TronWeb || TronWebModule.default || TronWebModule;
  const tronWeb = new TronWebCtor({
    fullHost: 'https://api.trongrid.io',
    headers: { 'TRON-PRO-API-KEY': TRONGRID_API_KEY },
    privateKey: TRON_PRIVATE_KEY,
  });

  const platformAddress = tronWeb.address.fromPrivateKey(TRON_PRIVATE_KEY);
  console.log('Platform wallet address:', platformAddress);

  const trxSun = await tronWeb.trx.getBalance(platformAddress);
  console.log('TRX balance:', trxSun / 1_000_000);

  const usdt = await tronWeb.contract().at(USDT_CONTRACT_ADDRESS);
  const [symbol, decimals] = await Promise.all([
    usdt.symbol().call(),
    usdt.decimals().call(),
  ]);
  console.log('USDT symbol:', symbol);
  console.log('USDT decimals:', Number(decimals?.toString?.() ?? decimals));

  const usdtBalRaw = await usdt.balanceOf(platformAddress).call();
  const usdtBal = parseInt(usdtBalRaw.toString()) / 1_000_000;
  console.log('USDT balance:', usdtBal);
}

main().catch((err) => {
  console.error('Sanity check failed:', err);
  process.exit(1);
});
