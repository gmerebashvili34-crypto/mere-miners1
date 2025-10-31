# Mere Miners

Mere Miners is a TypeScript full stack web app that blends a crypto mining management game with real USDT wallet integrations. The project ships a React + Vite client, an Express API server, and a shared Drizzle schema so data models stay in sync across the stack. The app now includes installable PWA support for smooth mobile play.

## Contents

- [Architecture](#architecture)
- [Key Features](#key-features)
- [Getting Started](#getting-started)
- [Environment Setup](#environment-setup)
- [Development Scripts](#development-scripts)
- [Running Tests](#running-tests)
- [Database and Storage](#database-and-storage)
- [PWA and Frontend Deployments](#pwa-and-frontend-deployments)
- [Project Conventions](#project-conventions)
- [Further Reading](#further-reading)

## Architecture

- **Client (`client/`)**: Vite + React UI with Tailwind CSS, React Query, and a mobile focused navigation. Pages live under `client/src/pages`, shared UI in `client/src/components`, and hooks in `client/src/hooks`. The entry point `client/src/main.tsx` now registers the service worker.
- **Server (`server/`)**: Express API that exposes routes via `server/routes.ts` and orchestrates background jobs for TRON deposits, withdrawals, and sweepers. Domain logic sits in services like `server/storage.ts`, `server/tronService.ts`, and controllers under `server/controllers/`.
- **Shared (`shared/`)**: Authoritative Drizzle schema (`shared/schema.ts`) and constants (`shared/constants.ts`). Always model data here first, then propagate to server and client.
- **Jobs (`server/jobs/`, `server/workers/`)**: Scheduler bootstraps deposit scanners, sweeper, and withdraw workers when the server starts.

## Key Features

- **Crypto Mining Gameplay**: Manage miners, upgrade rooms, and compete in seasonal leaderboards via routes defined in `server/routes.ts` and client pages like `client/src/pages/MiningRoom.tsx`.
- **USDT Wallet Integration**: TRON TRC-20 deposit and withdrawal flow using `server/tronService.ts` and SQL helpers in `server/sql/tron_usdt.sql`.
- **Supabase Backend**: PostgreSQL + Storage access through `server/supabase.ts` and `server/storageFiles.ts`.
- **PWA Ready**: Installable with offline shell caching (`client/public/sw.js`, `client/public/manifest.webmanifest`, and updated icons generated via `tools/generateFavicon.js`).
- **React Query Data Layer**: Query client configured in `client/src/lib/queryClient.ts` to keep auth and wallet data fresh.

## Getting Started

1. **Install dependencies**:
	```powershell
	npm install
	```
	Optional but recommended:
	```powershell
	cd client; npm install
	cd ..\server; npm install
	```
2. **Copy environment template**:
	```powershell
	copy .env.example .env
	```
3. **Populate `.env`** with Supabase keys, TRON settings, SMTP credentials, and JWT secrets. See [Environment Setup](#environment-setup).
4. **Run in development**:
	```powershell
	npm run dev
	```
	This starts the Express API (port defaults to 3000) and serves the Vite client through the same server.

## Environment Setup

Key variables (see `supabase.sql` and `.env.example` for the full list):
- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` for database access.
- `SUPABASE_STORAGE_BUCKET` for asset uploads.
- `TRONGRID_API_KEY`, `TRON_PRIVATE_KEY` and `ENCRYPTION_KEY` for USDT wallet operations.
- `SESSION_SECRET`, `JWT_SECRET`, `ADMIN_JWT_SECRET` for auth flows.
- `SMTP_*` fields when enabling transactional email via `server/emailer.ts`.

## Development Scripts

- `npm run dev`: Starts the Express server with Vite middleware.
- `npm run build`: Produces the production bundle (`dist/public` for static assets, `dist/index.js` for the server).
- `npm start`: Runs the built server bundle (requires `npm run build` first).
- `npm run test`: Executes Vitest suites from `tests/`.
- `npm run db:push`: Applies Drizzle schema changes.
- `npm run db:sanity`, `npm run db:tron`: Schema sanity checks and TRON table setup.
- `npm run admin:grant -- user@example.com`: Promote a user to admin.

## Running Tests

Vitest is configured at `vitest.config.ts`. Run `npm run test` to cover utility functions (see `tests/crypto.test.ts`) and add more suites under `tests/` as features evolve.

## Database and Storage

- All schema edits happen in `shared/schema.ts`, then run `npm run db:push`.
- Use storage helpers (`server/storage.ts`) for queries so balance updates, transactions, and business rules stay atomic.
- Seed data via `npx tsx server/seed.ts`. Grant trial miners or achievements using scripts in `server/tools/`.

## PWA and Frontend Deployments

- Static assets build to `dist/public`. Deploy this folder to Netlify or any static host.
- Include `_redirects` (already generated) with `/* /index.html 200` to support SPA routing on Netlify.
- The service worker precaches the app shell. Regenerate icons with `node tools/generateFavicon.js` after updating branding.
- When testing PWA installability, run `npm run build`, serve `dist/public`, and audit via Chrome Lighthouse.

## Project Conventions

- Type-first development: update `shared/schema.ts`, then adjust server storage and routes, then client hooks/components.
- Sanitize user objects before returning them from routes (see examples in `server/routes.ts`).
- Monetary values stay as strings in API layers to avoid float precision issues; keep numeric handling in storage layer.
- Background jobs register through `server/jobs/scheduler.ts`; new cron-style tasks go here.
- Prefer `server/storage.ts` for database mutations instead of calling Drizzle directly from routes.

## Further Reading

- `QUICK_START.md` for environment bootstrapping and Supabase provisioning.
- `README-USDT.md` for USDT wallet flows and worker details.
- `REORGANIZATION_SUMMARY.md` for historical context on the current architecture.
- `supabase.sql` to inspect tables required by external services.

Happy mining!

