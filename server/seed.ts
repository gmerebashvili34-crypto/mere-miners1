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
      imageUrl: "/attached_assets/generated_images/3D_cube_miner_toy_5d2c8aa5.png",
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
      imageUrl: "/attached_assets/generated_images/3D_tower_miner_toy_c3b3e643.png",
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
      name: "Crystal Miner",
      description: "Crystalline structure with prismatic light refraction",
      imageUrl: "/attached_assets/generated_images/3D_crystal_miner_toy_51ddddc1.png",
      thRate: 3.5,
      basePriceUsd: "48.98",
      basePriceMere: "97.96",
      dailyYieldUsd: "0.28",
      dailyYieldMere: "0.56",
      roiDays: 175,
      rarity: "common",
      isAvailable: true,
    },
    {
      name: "Sphere Miner",
      description: "Advanced spherical design with hexagonal pattern",
      imageUrl: "/attached_assets/generated_images/3D_sphere_miner_toy_0ad19441.png",
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
      name: "Spiral Reactor",
      description: "Spiral design with advanced cooling system",
      imageUrl: "/attached_assets/generated_images/3D_spiral_reactor_toy_601d962e.png",
      thRate: 7.5,
      basePriceUsd: "104.93",
      basePriceMere: "209.86",
      dailyYieldUsd: "0.60",
      dailyYieldMere: "1.20",
      roiDays: 175,
      rarity: "rare",
      isAvailable: true,
    },
    {
      name: "Quantum Box",
      description: "Minimalist high-performance mining unit",
      imageUrl: "/attached_assets/generated_images/3D_quantum_box_toy_f58da41d.png",
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
      name: "Fusion Core",
      description: "Compact fusion reactor with quantum processing",
      imageUrl: "/attached_assets/generated_images/3D_fusion_core_toy_896391d2.png",
      thRate: 15.0,
      basePriceUsd: "209.85",
      basePriceMere: "419.70",
      dailyYieldUsd: "1.20",
      dailyYieldMere: "2.40",
      roiDays: 175,
      rarity: "epic",
      isAvailable: true,
    },
    {
      name: "Titan Core",
      description: "Industrial-grade processing with triple redundancy",
      imageUrl: "/attached_assets/generated_images/3D_titan_core_toy_d428c84b.png",
      thRate: 20.0,
      basePriceUsd: "279.80",
      basePriceMere: "559.60",
      dailyYieldUsd: "1.60",
      dailyYieldMere: "3.20",
      roiDays: 175,
      rarity: "epic",
      isAvailable: true,
    },
    {
      name: "Pyramid Elite",
      description: "Elite-tier supercomputer with holographic circuitry",
      imageUrl: "/attached_assets/generated_images/3D_pyramid_elite_toy_6f249ad7.png",
      thRate: 25.0,
      basePriceUsd: "349.75",
      basePriceMere: "699.50",
      dailyYieldUsd: "2.00",
      dailyYieldMere: "4.00",
      roiDays: 175,
      rarity: "legendary",
      isAvailable: true,
    },
    {
      name: "Mega Fortress",
      description: "Ultimate powerhouse with AI-driven optimization",
      imageUrl: "/attached_assets/generated_images/3D_mega_fortress_toy_07aae49e.png",
      thRate: 50.0,
      basePriceUsd: "699.50",
      basePriceMere: "1399.00",
      dailyYieldUsd: "4.00",
      dailyYieldMere: "8.00",
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

  // Create premium-only season pass rewards (balanced)
  const rewards = [];
  for (let tier = 0; tier < 20; tier++) {
    const rewardAmount = tier < 5 ? (tier + 1) * 50 : // Tiers 0-4: 50-250 MERE
                        tier < 10 ? (tier + 1) * 75 : // Tiers 5-9: 450-750 MERE
                        tier < 15 ? (tier + 1) * 100 : // Tiers 10-14: 1100-1500 MERE
                        (tier + 1) * 150; // Tiers 15-19: 2400-3000 MERE
    
    // Premium rewards - mix of MERE and special rewards
    rewards.push({
      seasonId: season.id,
      tier,
      isPremium: true,
      rewardType: tier % 5 === 4 ? "booster" : "mere",
      rewardValue: tier % 5 === 4 ? "0.25" : rewardAmount.toString(), // 25% boost every 5 tiers
      rewardMetadata: {
        name: tier % 5 === 4 ? "Hashrate Boost +25%" : `${rewardAmount} MERE`,
        description: tier % 5 === 4 ? "Permanent +25% boost to all miners" : "Instant MERE reward",
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
