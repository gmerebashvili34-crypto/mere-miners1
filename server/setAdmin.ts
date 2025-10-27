import 'dotenv/config';
// Utility script to set a user as admin
// Usage: npx tsx server/setAdmin.ts <email>
import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

async function setAdmin() {
  const email = process.argv[2];
  
  if (!email) {
    console.error("Usage: npx tsx server/setAdmin.ts <email>");
    process.exit(1);
  }

  console.log(`Setting admin status for user: ${email}`);
  
  const user = await db.select().from(users).where(eq(users.email, email)).limit(1);
  
  if (user.length === 0) {
    console.error(`User with email ${email} not found!`);
    console.log("Please log in first to create your user account.");
    process.exit(1);
  }

  await db.update(users)
    .set({ isAdmin: true })
    .where(eq(users.email, email));

  console.log(`✅ User ${email} is now an admin!`);
  process.exit(0);
}

setAdmin().catch(console.error);
