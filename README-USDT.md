# USDT (TRC-20) Deposits & Withdrawals

This module adds production-ready, per-user TRON hot wallets for USDT (TRC-20) deposits and a queued withdrawal flow using TronGrid + TronWeb.

USDT contract (TRC-20): `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t`

## What’s included

- Per-user hot wallets (address + AES-256-GCM encrypted private key) in `user_wallets`
- Deposit scanning via TronGrid with confirmations and idempotent crediting
- Withdrawal queue with background worker, atomic balance updates, and failure refunds
- Admin endpoints for wallet creation and health/sweep stubs
- AES crypto helpers (`server/lib/crypto.ts`)
- Tron helpers (`server/lib/tron.ts`)
- Cron workers (`server/workers/*.ts`) wired at startup
- SQL schema (`server/sql/tron_usdt.sql`)
- Basic unit test for crypto (`tests/crypto.test.ts`)

## Endpoints (JWT-protected)

- POST `/api/admin/create-wallet?user_id=<id>` (admin JWT)
  - Generates a TRON account and stores encrypted private key
  - Returns the public deposit address
- POST `/webhook/deposit` (optional webhook)
  - Example receiver to record pending deposits
- POST `/api/usdt/withdraw` (user JWT)
  - Body: `{ user_id, destination_address, amount }`
  - Queues a withdrawal processed by the background worker

Note: Existing session-based endpoints remain unchanged. These USDT endpoints expect `Authorization: Bearer <JWT>` with `JWT_SECRET` configured.

## Database

Apply the SQL:

- `server/sql/tron_usdt.sql`

Tables:
- `user_wallets(user_id UNIQUE, address UNIQUE, encrypted_private_key)`
- `usdt_deposits(txid UNIQUE, status: pending/confirmed/applied)`
- `usdt_withdrawals(status: queued/locked/processing/completed/failed)`
- `admin_actions` (audit log)

Balances are kept in `users.usdt_balance` (already in your schema). Deposits credit this column atomically once confirmations are met.

## Config

See `.env.example` for required variables.

- `TRONGRID_API_KEY` – TronGrid API key
- `TRONGRID_URL` – defaults to `https://api.trongrid.io`
- `USDT_CONTRACT` – TRC-20 USDT contract (default: `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t`)
- `ENCRYPTION_KEY` – AES-256 key/passphrase
- `JWT_SECRET` – for JWT verification
- `USDT_CONFIRMATIONS` – default 1
- `DEPOSIT_SCAN_CRON` – default every 30s
- `WITHDRAW_SCAN_CRON` – default every 20s
- `WITHDRAW_BATCH_SIZE` – default 5
- `COLD_WALLET_PRIVATE_KEY` – central wallet private key for withdrawals (preferred)
- `TRON_PRIVATE_KEY` – optional legacy name; used only if `COLD_WALLET_PRIVATE_KEY` is not set

## Running

- Start the app normally; workers start automatically from `server/jobs/scheduler.ts`.

## Example cURL

- Create wallet (admin JWT):

```
curl -X POST "http://localhost:3000/api/admin/create-wallet?user_id=<USER_ID>" \
  -H "Authorization: Bearer <ADMIN_JWT>"
```

- Queue withdrawal (user JWT):

```
curl -X POST http://localhost:3000/api/usdt/withdraw \
  -H "Authorization: Bearer <USER_JWT>" \
  -H "Content-Type: application/json" \
  -d '{"user_id":"<USER_ID>","destination_address":"T...","amount":5.5}'
```

- Simulate deposit webhook:

```
curl -X POST http://localhost:3000/webhook/deposit \
  -H "Content-Type: application/json" \
  -d '{"txId":"<TXID>","to":"<USER_ADDR>","amount":12.34}'
```

## Frontend snippets

- To show deposit address, call `POST /api/admin/create-wallet?user_id=<id>` (admin flow) or read address from your profile if already created.
- For live updates, poll your transactions endpoint or add a simple webhook receiver on your client host at `/webhook/deposit` and reflect credits upon receipt.
- TronLink: to request on-chain address for manual signing, use `window.tronWeb`/`window.tronLink` APIs—but server-sign remains default for withdrawals.

## Security & Ops

- Private keys are AES-256-GCM encrypted at rest; key is loaded from `ENCRYPTION_KEY`.
- Do not log private keys. No plaintext keys are written to disk.
- Set `USDT_CONFIRMATIONS>=1` in production.
- Add KYC/AML, velocity limits, manual reviews for large withdrawals.
- Maintain TRX for gas in your central wallet; consider auto-funding per-user addresses only for sweeping.
- Consider a periodic sweep to a cold wallet: decrypt each user hot key and transfer USDT to a safe wallet.

## Extras

- Script idea: verify USDT token info
  - Use `getTronWeb()` then `tw.trx.getTokenInfo(USDT_CONTRACT)` (TronWeb) or read `decimals` from the contract if supported by ABI.
