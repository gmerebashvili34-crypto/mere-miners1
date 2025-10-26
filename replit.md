# MereMiners - Premium Crypto Mining Game

## Overview
MereMiners is a premium mobile-first crypto mining game PWA featuring a luxury black & gold aesthetic. Users acquire 3D miners, place them in a visual slot grid to generate passive MERE token income, and compete on seasonal leaderboards. The project aims to deliver an engaging simulation experience with a sophisticated design and robust economic model.

## User Preferences
I prefer detailed explanations.
I want iterative development.
Ask before making major changes.
Do not make changes to the `server/setAdmin.ts` file.

## System Architecture

### UI/UX Decisions
The game features a luxury black & gold theme with a primary gold color `#D4AF37` and a background black `#0B0B0D`. Typography uses Poppins for display and Inter for body text, with JetBrains Mono for addresses. Animations include pulse glows, float effects for miners, sparkle effects, and smooth hover elevations to enhance user interaction. The design system leverages shadcn/ui components for a consistent and modern look.

### Technical Implementations
- **Frontend:** React + TypeScript, Vite, TailwindCSS (with custom theme), Wouter for routing, TanStack Query v5 for state management.
- **Backend:** Express.js, Node.js with TypeScript.
- **Database:** PostgreSQL (Neon) with Drizzle ORM for type-safe database interactions.
- **Authentication:** Replit Auth (OIDC) integrated for secure user management and session handling.
- **Core Features:**
    - **Authentication:** Replit Auth OIDC, auto-profile creation with referral codes.
    - **Mining Room:** Visual slot grid (6-20 slots), drag-and-place miners, real-time stats (Hashrate, Daily Earnings), miner upgrades (unlimited levels, flat 25.98 MERE/$12.99 USD per level, cosmetic only).
    - **Shop System:** 10 unique miner types, each purchasable only once per type (one-time purchase limit), rarity-based discounts (Rare: -4%, Epic: -5%, Legendary: -7%).
    - **Wallet:** MERE token balance, real USDT (TRC-20) deposit/withdrawal via TronGrid, transaction history with blockchain verification.
    - **Leaderboard (Ranks):** Seasonal rankings based on MERE mined, top 3 podium, season countdown.
    - **Season Pass:** Free and Premium tracks with 20 tiers, claimable rewards, progress based on mining. Premium Pass costs 999 MERE, rewards 1,290 MERE (30% profit) plus 10 TH/s total hashrate boosts.
    - **Mini-Games:** Three daily mini-games playable once per 24 hours:
        - **Daily Spin:** Spinning wheel with randomized rewards (0.01-0.05 MERE), animated wheel, countdown timer.
        - **Lucky Draw:** Rarity-based gem rewards (0.01-0.07 MERE), first play guaranteed 0.01 MERE, weighted probabilities (50% Common: 0.01-0.02, 30% Rare: 0.02-0.04, 15% Epic: 0.04-0.06, 5% Legendary: 0.06-0.07), rarity-specific colors.
        - **Miner Match:** Memory card matching game with 6 pairs, performance-based rewards (0.08 MERE for perfect game, decreasing by 0.01 per extra move, min 0.01 MERE), move tracking.
    - **Profile:** User stats, shareable referral codes (10% bonus), achievement system, referral statistics.
    - **Real-Time Earnings Engine:** Background worker for automatic MERE crediting and leaderboard updates.
    - **Achievement System:** 10 achievements with MERE rewards, real-time progress, auto-crediting.
    - **Referral Rewards System:** Unique referral codes, 10% bonus on referee earnings, detailed stats tracking.
    - **Admin Panel:** Access control, system stats, user management (promote/demote admin), miner type management, season management.

### System Design Choices
The project is structured into `client/`, `server/`, and `shared/` directories. `shared/` contains Drizzle schema definitions and shared constants, promoting code reusability and consistency. The system prioritizes mobile-first design and PWA capabilities. Database schema includes tables for users, miner types, user miners, transactions, seasons, leaderboard entries, season pass data, achievements, daily games, and sessions, all managed through Drizzle ORM.

## External Dependencies
- **Replit:** Hosting, OIDC authentication, and database auto-provisioning.
- **Neon:** Managed PostgreSQL database service.
- **TronGrid:** Blockchain API for USDT (TRC-20) deposits/withdrawals on TRON mainnet.
- **TronWeb:** JavaScript library for interacting with TRON blockchain.
- **Lucide React:** Icon library.
- **Google Fonts:** For Poppins, Inter, and JetBrains Mono fonts.

## Blockchain Integration (TronGrid)
- **Network:** TRON Mainnet
- **Token:** USDT (TRC-20) - Contract: `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t`
- **Platform Wallet:** `TKBiqUdUqikwfRDyrBkgoeRWF5tEiHV4HU` (single wallet for all deposits - Option A)
- **Deposit System:** 
  - Automatic polling every 30 seconds for incoming USDT
  - Idempotent transaction processing with duplicate detection
  - Deposits recorded as "pending" and require manual user assignment
  - Exchange rate: 1 MERE = 0.5 USDT (automatic conversion)
- **Withdrawal System:**
  - Real blockchain transactions via TronWeb
  - 2% withdrawal fee
  - Automatic refund on blockchain failure
  - Transaction hash recorded for verification
- **Services:**
  - `TronService`: Core blockchain operations (send, balance check, deposit monitoring)
  - `DepositMonitor`: Background service for detecting incoming deposits