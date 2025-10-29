import { sql } from 'drizzle-orm';
import {
  index,
  uniqueIndex,
  integer,
  jsonb,
  numeric,
  pgTable,
  timestamp,
  varchar,
  boolean,
  real,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Session storage table (required for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table (supports both Replit Auth and email/password)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  passwordHash: varchar("password_hash"), // For email/password auth (null for Replit Auth users)
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  mereBalance: numeric("mere_balance", { precision: 20, scale: 8 }).notNull().default("0"),
  usdtBalance: numeric("usdt_balance", { precision: 20, scale: 8 }).notNull().default("0"),
  totalMined: numeric("total_mined", { precision: 20, scale: 8 }).notNull().default("0"),
  referralCode: varchar("referral_code").unique(),
  referredById: varchar("referred_by_id").references((): any => users.id), // Who invited this user
  totalReferrals: integer("total_referrals").notNull().default(0), // Count of successful referrals
  totalReferralEarnings: numeric("total_referral_earnings", { precision: 20, scale: 8 }).notNull().default("0"), // Total MERE earned from referrals
  depositAddress: varchar("deposit_address").unique(), // Unique TRON address for USDT deposits (Option B)
  depositPrivateKey: varchar("deposit_private_key"), // Custodial private key for deposit address (handle securely)
  isAdmin: boolean("is_admin").notNull().default(false), // Admin access flag
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// Miner types/models available in the shop
export const minerTypes = pgTable("miner_types", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  description: varchar("description"),
  imageUrl: varchar("image_url").notNull(),
  thRate: real("th_rate").notNull(), // TH/s (hash rate)
  basePriceUsd: numeric("base_price_usd", { precision: 10, scale: 2 }).notNull(),
  basePriceMere: numeric("base_price_mere", { precision: 10, scale: 2 }).notNull(),
  dailyYieldUsd: numeric("daily_yield_usd", { precision: 10, scale: 2 }).notNull(),
  dailyYieldMere: numeric("daily_yield_mere", { precision: 10, scale: 2 }).notNull(),
  roiDays: integer("roi_days").notNull(),
  rarity: varchar("rarity").notNull().default("common"), // common, rare, epic, legendary
  isAvailable: boolean("is_available").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertMinerTypeSchema = createInsertSchema(minerTypes).omit({
  id: true,
  createdAt: true,
});

export type InsertMinerType = z.infer<typeof insertMinerTypeSchema>;
export type MinerType = typeof minerTypes.$inferSelect;

// User-owned miners
export const userMiners = pgTable("user_miners", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  minerTypeId: varchar("miner_type_id").notNull().references(() => minerTypes.id),
  slotPosition: integer("slot_position"), // null if not placed in mining room
  upgradeLevel: integer("upgrade_level").notNull().default(0), // 0-5, each level adds 20% hashrate
  purchasedAt: timestamp("purchased_at").defaultNow(),
  isActive: boolean("is_active").notNull().default(true),
  boostMultiplier: real("boost_multiplier").notNull().default(1.0),
  lastEarningsUpdate: timestamp("last_earnings_update").defaultNow(),
  // Trial/temporary miner support
  isTemporary: boolean("is_temporary").notNull().default(false),
  expiresAt: timestamp("expires_at"),
});

export const userMinersRelations = relations(userMiners, ({ one }) => ({
  user: one(users, {
    fields: [userMiners.userId],
    references: [users.id],
  }),
  minerType: one(minerTypes, {
    fields: [userMiners.minerTypeId],
    references: [minerTypes.id],
  }),
}));

export const insertUserMinerSchema = createInsertSchema(userMiners).omit({
  id: true,
  purchasedAt: true,
  lastEarningsUpdate: true,
});

export type InsertUserMiner = z.infer<typeof insertUserMinerSchema>;
export type UserMiner = typeof userMiners.$inferSelect;

// Transaction history
export const transactions = pgTable("transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: varchar("type").notNull(), // deposit, withdrawal, purchase, earnings, reward
  amountMere: numeric("amount_mere", { precision: 20, scale: 8 }).notNull(),
  amountUsd: numeric("amount_usd", { precision: 20, scale: 2 }),
  description: varchar("description"),
  status: varchar("status").notNull().default("completed"), // pending, completed, failed
  txHash: varchar("tx_hash"), // For blockchain transactions
  metadata: jsonb("metadata"), // Store additional data like miner_id, etc
  createdAt: timestamp("created_at").defaultNow(),
});

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, {
    fields: [transactions.userId],
    references: [users.id],
  }),
}));

export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  createdAt: true,
});

export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactions.$inferSelect;

// Seasons for leaderboard
export const seasons = pgTable("seasons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  startAt: timestamp("start_at").notNull(),
  endAt: timestamp("end_at").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSeasonSchema = createInsertSchema(seasons).omit({
  id: true,
  createdAt: true,
});

export type InsertSeason = z.infer<typeof insertSeasonSchema>;
export type Season = typeof seasons.$inferSelect;

// Leaderboard entries
export const leaderboardEntries = pgTable("leaderboard_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  seasonId: varchar("season_id").notNull().references(() => seasons.id, { onDelete: "cascade" }),
  totalMined: numeric("total_mined", { precision: 20, scale: 8 }).notNull().default("0"),
  totalHashrate: real("total_hashrate").notNull().default(0),
  rank: integer("rank"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const leaderboardEntriesRelations = relations(leaderboardEntries, ({ one }) => ({
  user: one(users, {
    fields: [leaderboardEntries.userId],
    references: [users.id],
  }),
  season: one(seasons, {
    fields: [leaderboardEntries.seasonId],
    references: [seasons.id],
  }),
}));

export const insertLeaderboardEntrySchema = createInsertSchema(leaderboardEntries).omit({
  id: true,
  updatedAt: true,
});

export type InsertLeaderboardEntry = z.infer<typeof insertLeaderboardEntrySchema>;
export type LeaderboardEntry = typeof leaderboardEntries.$inferSelect;

// Season pass rewards
export const seasonPassRewards = pgTable("season_pass_rewards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  seasonId: varchar("season_id").notNull().references(() => seasons.id, { onDelete: "cascade" }),
  tier: integer("tier").notNull(), // 0-based index
  isPremium: boolean("is_premium").notNull().default(false),
  rewardType: varchar("reward_type").notNull(), // mere, miner, booster, skin
  rewardValue: numeric("reward_value", { precision: 20, scale: 8 }),
  rewardMetadata: jsonb("reward_metadata"), // Store additional reward data
  createdAt: timestamp("created_at").defaultNow(),
});

export const seasonPassRewardsRelations = relations(seasonPassRewards, ({ one }) => ({
  season: one(seasons, {
    fields: [seasonPassRewards.seasonId],
    references: [seasons.id],
  }),
}));

export type SeasonPassReward = typeof seasonPassRewards.$inferSelect;

// User season pass progress
export const userSeasonPass = pgTable("user_season_pass", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  seasonId: varchar("season_id").notNull().references(() => seasons.id, { onDelete: "cascade" }),
  currentTier: integer("current_tier").notNull().default(0),
  hasPremium: boolean("has_premium").notNull().default(false),
  claimedRewards: jsonb("claimed_rewards").notNull().default("[]"), // Array of reward IDs
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const userSeasonPassRelations = relations(userSeasonPass, ({ one }) => ({
  user: one(users, {
    fields: [userSeasonPass.userId],
    references: [users.id],
  }),
  season: one(seasons, {
    fields: [userSeasonPass.seasonId],
    references: [seasons.id],
  }),
}));

export type UserSeasonPass = typeof userSeasonPass.$inferSelect;

// Achievements
export const achievements = pgTable("achievements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  description: varchar("description").notNull(),
  icon: varchar("icon").notNull(), // Icon name from lucide-react
  category: varchar("category").notNull(), // mining, shop, social, special
  criteria: jsonb("criteria").notNull(), // { type: "first_purchase", value: 1 }
  rewardMere: numeric("reward_mere", { precision: 10, scale: 2 }),
  tier: varchar("tier").notNull().default("bronze"), // bronze, silver, gold, platinum
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const achievementsRelations = relations(achievements, ({ many }) => ({
  userAchievements: many(userAchievements),
}));

export type Achievement = typeof achievements.$inferSelect;

// User achievements (unlocked achievements)
export const userAchievements = pgTable(
  "user_achievements",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    achievementId: varchar("achievement_id").notNull().references(() => achievements.id, { onDelete: "cascade" }),
    progress: real("progress").notNull().default(0), // Current progress towards achievement (can be decimal for total_mined, hashrate, etc.)
    isUnlocked: boolean("is_unlocked").notNull().default(false),
    unlockedAt: timestamp("unlocked_at"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [uniqueIndex("uq_user_achievement").on(table.userId, table.achievementId)]
);

export const userAchievementsRelations = relations(userAchievements, ({ one }) => ({
  user: one(users, {
    fields: [userAchievements.userId],
    references: [users.id],
  }),
  achievement: one(achievements, {
    fields: [userAchievements.achievementId],
    references: [achievements.id],
  }),
}));

export const insertUserAchievementSchema = createInsertSchema(userAchievements).omit({
  id: true,
  createdAt: true,
});

export type InsertUserAchievement = z.infer<typeof insertUserAchievementSchema>;
export type UserAchievement = typeof userAchievements.$inferSelect;

// Daily Games (mini-games playable once per day)
export const dailyGames = pgTable("daily_games", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  gameType: varchar("game_type").notNull(), // "daily_spin", "lucky_draw", "miner_match", etc.
  lastPlayedAt: timestamp("last_played_at").notNull(),
  rewardMere: numeric("reward_mere", { precision: 10, scale: 2 }).notNull(),
  metadata: jsonb("metadata"), // Additional game-specific data (rarity, score, etc.)
  createdAt: timestamp("created_at").defaultNow(),
});

export const dailyGamesRelations = relations(dailyGames, ({ one }) => ({
  user: one(users, {
    fields: [dailyGames.userId],
    references: [users.id],
  }),
}));

export type DailyGame = typeof dailyGames.$inferSelect;
