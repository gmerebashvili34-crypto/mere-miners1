# MereMiners - Quick Start Guide

## 🚀 Set Up Your Supabase Project

### 1. Create a Supabase Project
1. Go to https://supabase.com
2. Sign in or create an account
3. Click "New Project"
4. Fill in project details (name, database password, region)
5. Wait for project to be provisioned (~2 minutes)

### 2. Get Your Database Connection String
1. In your Supabase project dashboard
2. Go to **Settings** → **Database**
3. Scroll down to **Connection string**
4. Copy the **URI** connection string
5. Replace `[YOUR-PASSWORD]` with your actual database password

### 3. Run the SQL Setup
1. In Supabase dashboard, go to **SQL Editor**
2. Click **New Query**
3. Copy the entire contents of `supabase.sql`
4. Paste into the SQL editor
5. Click **Run** to execute
6. You should see "Success. No rows returned"

### 4. Create Your `.env` File

Create a file named `.env` in the project root with:

```env
# Replace with your actual values from Supabase dashboard
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres
SUPABASE_URL=https://[YOUR-PROJECT-REF].supabase.co
SUPABASE_ANON_KEY=[YOUR-ANON-KEY]
SUPABASE_SERVICE_KEY=[YOUR-SERVICE-ROLE-KEY]
SUPABASE_BUCKET=user-uploads

SESSION_SECRET=change-this-to-a-random-string-in-production
PORT=5000
```

**Where to find these values:**
- `DATABASE_URL`: Settings → Database → Connection string → URI
- `SUPABASE_URL`: Settings → API → Project URL
- `SUPABASE_ANON_KEY`: Settings → API → Project API keys → anon public
- `SUPABASE_SERVICE_KEY`: Settings → API → Project API keys → service_role (secret)

### 5. Install Dependencies & Run

```bash
# Install dependencies (if not already done)
npm install

# Seed the database with miner types and achievements
npx tsx server/seed.ts

# Start the development server
npm run dev
```

### 6. View the Website

Open your browser to: **http://localhost:5000**

## 🎮 What You Can Do

1. **Sign Up**: Create an account with email/password
2. **Purchase Miners**: Buy different miner types in the Shop
3. **Mining Room**: Place miners in slots to start earning MERE
4. **Wallet**: View transactions and manage balances
5. **Leaderboard**: Compete with other players
6. **Achievements**: Unlock achievements and earn rewards
7. **Daily Games**: Play games daily for bonus MERE

## 📝 First Admin Setup

After creating your first account, set yourself as admin:

```bash
npx tsx server/setAdmin.ts your-email@example.com
```

## 🐛 Troubleshooting

### Database Connection Error
- Make sure your `.env` file has the correct `DATABASE_URL`
- Check that your Supabase project is running (not paused)
- Verify the database password is correct

### Cannot Find Module
Run `npm install` to install all dependencies

### Port Already in Use
Change the `PORT` in your `.env` file to a different number (e.g., 5001)

## 📚 Next Steps

- Read `REORGANIZATION_SUMMARY.md` for architecture details
- Check `supabase.sql` to understand the database schema
- Explore the code in `server/` and `client/` directories

## 🎉 You're All Set!

Your MereMiners website should now be running at **http://localhost:5000**

Happy Mining! ⛏️💰
