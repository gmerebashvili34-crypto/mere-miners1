// Add new miners to existing database
import { db } from "./db";
import { minerTypes } from "@shared/schema";
import { eq } from "drizzle-orm";

async function addNewMiners() {
  console.log("Adding new miners...");

  // Check which miners already exist
  const existing = await db.select().from(minerTypes);
  const existingNames = existing.map(m => m.name);

  const newMiners = [
    {
      name: "Prism Miner",
      description: "Crystalline structure for optimal heat dispersion",
      imageUrl: "/attached_assets/generated_images/Gold_accent_mining_rig_f7e3dcd1.png",
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
      name: "Helix Miner",
      description: "Spiral architecture with dual-core processing",
      imageUrl: "/attached_assets/generated_images/Gold_tower_miner_8d6aee5b.png",
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
      name: "Nexus Reactor",
      description: "Energy-efficient reactor core with quantum acceleration",
      imageUrl: "/attached_assets/generated_images/Gold_sphere_miner_f2c342a6.png",
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
      name: "Omega Core",
      description: "Military-grade processing with triple redundancy",
      imageUrl: "/attached_assets/generated_images/Gold_box_miner_35ba3735.png",
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
      name: "Titan Fortress",
      description: "Ultimate mining powerhouse with AI optimization",
      imageUrl: "/attached_assets/generated_images/Gold_pyramid_elite_miner_e9c12d5d.png",
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

  const minersToAdd = newMiners.filter(m => !existingNames.includes(m.name));

  if (minersToAdd.length > 0) {
    await db.insert(minerTypes).values(minersToAdd);
    console.log(`✓ Added ${minersToAdd.length} new miners`);
  } else {
    console.log("All miners already exist!");
  }
}

addNewMiners().catch((error) => {
  console.error("Error adding miners:", error);
  process.exit(1);
});
