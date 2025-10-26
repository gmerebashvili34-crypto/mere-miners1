// Seed data for MereMiners
import { db } from "./db";
import { minerTypes, seasons, seasonPassRewards, achievements } from "@shared/schema";

async function seed() {
  console.log("Seeding database...");

  // Check if data already exists
  const existingMiners = await db.select().from(minerTypes).limit(1);
  if (existingMiners.length > 0) {
    console.log("Database already seeded!");
    return;
  }

  // Create miner types (1 TH/s base unit)
  // Using paths that will be accessible through the Vite asset system
  const minerData = [
    {
      name: "Cube Miner",
      description: "Entry-level compact mining unit with reliable performance",
      imageUrl: "/attached_assets/generated_images/Gold_accent_mining_rig_f7e3dcd1.png",
      thRate: 1.0,
      basePriceUsd: "13.99",
      basePriceMere: "27.98",
      dailyYieldUsd: "0.08",
      dailyYieldMere: "0.16",
      roiDays: 175,
      rarity: "common",
      isAvailable: true,
    },
    {
      name: "Tower Miner",
      description: "Elegant vertical design with enhanced cooling",
      imageUrl: "/attached_assets/generated_images/Gold_tower_miner_8d6aee5b.png",
      thRate: 2.5,
      basePriceUsd: "34.98",
      basePriceMere: "69.96",
      dailyYieldUsd: "0.20",
      dailyYieldMere: "0.40",
      roiDays: 175,
      rarity: "common",
      isAvailable: true,
    },
    {
      name: "Sphere Miner",
      description: "Advanced spherical design with hexagonal pattern",
      imageUrl: "/attached_assets/generated_images/Gold_sphere_miner_f2c342a6.png",
      thRate: 5.0,
      basePriceUsd: "69.95",
      basePriceMere: "139.90",
      dailyYieldUsd: "0.40",
      dailyYieldMere: "0.80",
      roiDays: 175,
      rarity: "rare",
      isAvailable: true,
    },
    {
      name: "Quantum Box",
      description: "Minimalist high-performance mining unit",
      imageUrl: "/attached_assets/generated_images/Gold_box_miner_35ba3735.png",
      thRate: 10.0,
      basePriceUsd: "139.90",
      basePriceMere: "279.80",
      dailyYieldUsd: "0.80",
      dailyYieldMere: "1.60",
      roiDays: 175,
      rarity: "epic",
      isAvailable: true,
    },
    {
      name: "Pyramid Elite",
      description: "Elite-tier supercomputer with holographic circuitry",
      imageUrl: "/attached_assets/generated_images/Gold_pyramid_elite_miner_e9c12d5d.png",
      thRate: 25.0,
      basePriceUsd: "349.75",
      basePriceMere: "699.50",
      dailyYieldUsd: "2.00",
      dailyYieldMere: "4.00",
      roiDays: 175,
      rarity: "legendary",
      isAvailable: true,
    },
  ];

  await db.insert(minerTypes).values(minerData);
  console.log("✓ Miner types created");

  // Create current season
  const now = new Date();
  const seasonEnd = new Date(now);
  seasonEnd.setDate(seasonEnd.getDate() + 30); // 30 days from now

  const [season] = await db.insert(seasons).values({
    name: "Genesis Season",
    startAt: now,
    endAt: seasonEnd,
    isActive: true,
  }).returning();
  console.log("✓ Season created");

  // Create season pass rewards
  const rewards = [];
  for (let tier = 0; tier < 20; tier++) {
    // Free rewards
    rewards.push({
      seasonId: season.id,
      tier,
      isPremium: false,
      rewardType: "mere",
      rewardValue: ((tier + 1) * 10).toString(),
      rewardMetadata: { name: `${(tier + 1) * 10} MERE` },
    });

    // Premium rewards
    rewards.push({
      seasonId: season.id,
      tier,
      isPremium: true,
      rewardType: tier % 5 === 4 ? "miner" : "mere",
      rewardValue: ((tier + 1) * 25).toString(),
      rewardMetadata: {
        name: tier % 5 === 4 ? "Premium Miner" : `${(tier + 1) * 25} MERE`,
      },
    });
  }

  await db.insert(seasonPassRewards).values(rewards);
  console.log("✓ Season pass rewards created");

  // Create achievements
  const achievementsData = [
    {
      name: "First Steps",
      description: "Make your first miner purchase",
      icon: "ShoppingCart",
      category: "shop",
      criteria: { type: "total_purchases", value: 1 },
      rewardMere: "10.00",
      tier: "bronze",
    },
    {
      name: "Collector",
      description: "Own 10 miners",
      icon: "Package",
      category: "shop",
      criteria: { type: "total_miners_owned", value: 10 },
      rewardMere: "50.00",
      tier: "silver",
    },
    {
      name: "Mining Beginner",
      description: "Place your first miner in a slot",
      icon: "Zap",
      category: "mining",
      criteria: { type: "miners_placed", value: 1 },
      rewardMere: "5.00",
      tier: "bronze",
    },
    {
      name: "Full Capacity",
      description: "Fill all 6 default slots",
      icon: "Grid3x3",
      category: "mining",
      criteria: { type: "slots_filled", value: 6 },
      rewardMere: "25.00",
      tier: "silver",
    },
    {
      name: "Hash Power",
      description: "Reach 10 TH/s total hashrate",
      icon: "TrendingUp",
      category: "mining",
      criteria: { type: "total_hashrate", value: 10 },
      rewardMere: "30.00",
      tier: "silver",
    },
    {
      name: "Mining Tycoon",
      description: "Reach 50 TH/s total hashrate",
      icon: "Crown",
      category: "mining",
      criteria: { type: "total_hashrate", value: 50 },
      rewardMere: "100.00",
      tier: "gold",
    },
    {
      name: "First Earnings",
      description: "Earn your first MERE from mining",
      icon: "Coins",
      category: "mining",
      criteria: { type: "total_mined", value: 0.01 },
      rewardMere: "5.00",
      tier: "bronze",
    },
    {
      name: "MERE Millionaire",
      description: "Mine 1000 MERE total",
      icon: "BadgeDollarSign",
      category: "mining",
      criteria: { type: "total_mined", value: 1000 },
      rewardMere: "250.00",
      tier: "platinum",
    },
    {
      name: "Premium Pass",
      description: "Unlock the Season Pass premium tier",
      icon: "Star",
      category: "special",
      criteria: { type: "season_pass_premium", value: 1 },
      rewardMere: "20.00",
      tier: "gold",
    },
    {
      name: "Social Butterfly",
      description: "Refer 5 friends who make a purchase",
      icon: "Users",
      category: "social",
      criteria: { type: "successful_referrals", value: 5 },
      rewardMere: "75.00",
      tier: "gold",
    },
  ];

  await db.insert(achievements).values(achievementsData);
  console.log("✓ Achievements created");

  console.log("Database seeded successfully!");
}

seed().catch((error) => {
  console.error("Error seeding database:", error);
  process.exit(1);
});
