import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";
import { nanoid } from "nanoid";

const SALT_ROUNDS = 10;

// Generate unique referral code
function generateReferralCode(): string {
  return `MERE${nanoid(6).toUpperCase()}`;
}

export async function signUp(
  email: string,
  password: string,
  firstName: string,
  lastName: string,
  referralCode?: string
) {
  // Validate inputs
  if (!email || !password || !firstName || !lastName) {
    throw new Error("All fields are required");
  }

  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters long");
  }

  // Check if user already exists
  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  
  if (existing.length > 0) {
    throw new Error("Email already registered");
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  // Handle referral
  let referredById: string | null = null;
  if (referralCode) {
    const referrer = await db.select().from(users).where(eq(users.referralCode, referralCode)).limit(1);
    if (referrer.length > 0) {
      referredById = referrer[0].id;
    }
  }

  // Create user
  const newUser = await db.insert(users).values({
    email,
    passwordHash,
    firstName,
    lastName,
    referralCode: generateReferralCode(),
    referredById,
  }).returning();

  // Update referrer's count if applicable
  if (referredById) {
    const [referrer] = await db.select().from(users).where(eq(users.id, referredById)).limit(1);
    if (referrer) {
      await db
        .update(users)
        .set({ totalReferrals: referrer.totalReferrals + 1 })
        .where(eq(users.id, referredById));
    }
  }

  return newUser[0];
}

export async function signIn(email: string, password: string) {
  // Validate inputs
  if (!email || !password) {
    throw new Error("Email and password are required");
  }

  // Find user
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  
  if (!user) {
    throw new Error("Invalid email or password");
  }

  // Check if user has password (Replit Auth users don't)
  if (!user.passwordHash) {
    throw new Error("This account uses Replit Auth. Please log in with Replit.");
  }

  // Verify password
  const isValid = await bcrypt.compare(password, user.passwordHash);
  
  if (!isValid) {
    throw new Error("Invalid email or password");
  }

  return user;
}
