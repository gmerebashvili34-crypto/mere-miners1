# MereMiners Supabase Reorganization Summary

## Overview
The project has been reorganized to use **Supabase** as the primary backend infrastructure, removing duplicate files and unnecessary code.

## Changes Made

### Files Removed
1. **`server/replitAuth.ts`** - Removed (was already empty/exports nothing)
2. **`server/sessionAuth.ts`** - Removed (duplicate of `server/auth.ts`)
3. **`server/storage.ts`** - Recreated (consolidated into a single clean implementation)

### Files Updated
1. **`server/auth.ts`** - Now the single authentication file for session-based auth
   - Added console.log for initialization confirmation
   - Consolidated from two separate auth files

2. **`server/storage.ts`** - Completely recreated
   - Single unified database storage implementation
   - All database operations for the Supabase PostgreSQL backend
   - Implements the IStorage interface with all necessary operations

## Architecture

### Current Stack
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Session-based with express-session
- **Storage**: Supabase Storage (for file uploads via `storageFiles.ts`)
- **ORM**: Drizzle ORM
- **Backend**: Node.js/Express
- **Frontend**: React with TypeScript

### File Structure
```
server/
├── auth.ts              # Single auth implementation
├── db.ts                # Database connection (Supabase PostgreSQL)
├── supabase.ts          # Supabase client configuration
├── storage.ts           # Unified database storage layer
├── storageFiles.ts      # Supabase Storage for file uploads
├── emailAuth.ts         # Email/password authentication
├── routes.ts            # API routes
├── earnings.ts          # Mining earnings engine
├── depositMonitor.ts    # USDT deposit monitoring (TRON)
├── tronService.ts       # TRON blockchain integration
├── achievementsService.ts
├── referralService.ts
├── tools/
│   ├── dbSanity.ts
│   └── tronSanity.ts
└── ...
```

## Environment Variables Required

### Supabase Configuration
```env
DATABASE_URL=postgresql://...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-role-key (optional, for admin operations)
SUPABASE_BUCKET=user-uploads (optional, defaults to 'user-uploads')
```

### Other Required
```env
SESSION_SECRET=your-session-secret
PORT=5000
```

### Optional (for TRON functionality)
```env
TRON_PRIVATE_KEY=your-tron-private-key
PLATFORM_WALLET_ADDRESS=your-platform-wallet
```

## Database

The project uses **Supabase PostgreSQL** with:
- Drizzle ORM for type-safe database operations
- Connection pooling via node-postgres
- SSL support (required for Supabase)

Run migrations:
```bash
npm run db:push
```

Seed database:
```bash
npx tsx server/seed.ts
```

## What Was Consolidated

### Before
- Two separate auth files (`auth.ts` and `sessionAuth.ts`)
- Unclear which authentication method to use
- Duplicate code in multiple files

### After
- Single `auth.ts` file with clear session-based authentication
- Single `storage.ts` file with all database operations
- Clear separation of concerns
- Easier to maintain and understand

## Key Features

### Authentication
- Email/Password authentication via `emailAuth.ts`
- Session-based auth via `auth.ts`
- bcrypt for password hashing
- Express sessions stored in PostgreSQL (via connect-pg-simple)

### Storage Operations
All database operations are accessed via the `storage` instance:
```typescript
import { storage } from './storage';

// User operations
await storage.getUser(userId);
await storage.updateUserBalance(userId, amount, 'add');

// Miner operations
await storage.getUserMiners(userId);
await storage.createUserMiner(userMinerData);

// ... etc
```

### Supabase Integration
- **Database**: PostgreSQL via Drizzle ORM
- **Storage**: File uploads via Supabase Storage
- **Authentication**: Session-based (can be extended to use Supabase Auth)

## Benefits of This Reorganization

1. **Less Duplication**: Removed duplicate auth files
2. **Clearer Structure**: Single storage layer for all DB operations
3. **Better Maintainability**: Easier to find and update code
4. **Type Safety**: Full TypeScript support throughout
5. **Scalability**: Ready for production on Supabase infrastructure

## Next Steps

1. Set up Supabase project if not already done
2. Configure environment variables
3. Run database migrations: `npm run db:push`
4. Seed the database: `npx tsx server/seed.ts`
5. Start development: `npm run dev`

## Notes

- The project is now fully organized for Supabase
- All unnecessary duplicate code has been removed
- Type checking passes successfully
- Ready for deployment

