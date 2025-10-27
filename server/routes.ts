import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./auth";
import { calculateDiscountedPrice, TH_DAILY_YIELD_MERE, SLOT_EXPANSION_PRICE_MERE, WITHDRAWAL_FEE_PERCENT, MIN_WITHDRAW_USDT } from "@shared/constants";
import { db } from "./db";
import { achievements, userAchievements, users, minerTypes, userMiners, transactions, seasons, seasonPassRewards } from "@shared/schema";
import { eq, sum, count, sql, isNotNull, and } from "drizzle-orm";
import { achievementsService } from "./achievementsService";
import { getReferralStats } from "./referralService";
import { signUp, signIn, requireUserId } from "./emailAuth";
import jwt from 'jsonwebtoken';
import { sendMail } from './emailer.ts';
import { tronService, tronEnabled } from "./tronService";
import { getTronWeb, getUSDTBalance } from './lib/tron';
import { verifyGoogleIdToken, findOrCreateGoogleUser } from './authGoogle';
import { encryptString } from './lib/crypto';
import multer from 'multer';
import { uploadBuffer } from './storageFiles';
import { requireAdminJwt, requireUserJwt } from './authJwt';
import { adminCreateWallet } from './controllers/usdtWalletController';
import { webhookDeposit } from './controllers/usdtDepositController';
import { requestWithdrawal } from './controllers/usdtWithdrawController';

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Email/Password authentication routes
  app.post('/api/auth/signup', async (req, res) => {
    try {
      const { email, password, referralCode } = req.body;
      
      const user = await signUp(email, password, referralCode);
      // Regenerate session to prevent fixation and ensure cookie is set before responding
      await new Promise<void>((resolve, reject) => {
        req.session.regenerate((err) => {
          if (err) return reject(err);
          (req.session as any).userId = user.id;
          req.session.save((saveErr) => {
            if (saveErr) return reject(saveErr);
            resolve();
          });
        });
      });
      
      // Signup bonus: grant a 1 TH/s trial miner for 7 days and auto-place it in slot 1
      try {
        const now = new Date();
        const expires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        
        // Try to find an existing 1 TH/s miner type (Cube Miner by seed)
        let oneThMiner = (await storage.getMinerTypes()).find((m) => m.thRate === 1.0) || null;
        
        // If not found (e.g., seed not run), create a hidden starter type
        if (!oneThMiner) {
          oneThMiner = await storage.createMinerType({
            name: "Starter Trial Miner",
            description: "1 TH/s trial miner for new users (7 days)",
            imageUrl: "/attached_assets/generated_images/Black_Background_Cube_Miner_c9e82d6a.png",
            thRate: 1.0,
            basePriceUsd: "0.00",
            basePriceMere: "0.00",
            dailyYieldUsd: "0.08",
            dailyYieldMere: "0.16",
            roiDays: 7,
            rarity: "common",
            isAvailable: false, // hidden from shop
          });
        }
        
        await storage.createUserMiner({
          userId: user.id,
          minerTypeId: oneThMiner.id,
          slotPosition: 1,
          isActive: true,
          boostMultiplier: 1.0,
          upgradeLevel: 0,
          // trial flags
          isTemporary: true as any,
          expiresAt: expires as any,
        } as any);
      } catch (bonusErr) {
        console.warn("Signup bonus grant failed (non-fatal):", bonusErr);
      }
      
      res.json({ success: true, user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        mereBalance: user.mereBalance,
        totalMined: user.totalMined,
        referralCode: user.referralCode,
        isAdmin: user.isAdmin,
      }});
    } catch (error: any) {
      console.error("Sign up error:", error);
      res.status(400).json({ message: error.message || "Failed to sign up" });
    }
  });

  app.post('/api/auth/signin', async (req, res) => {
    try {
      const { email, password } = req.body;
      
      const user = await signIn(email, password);
      // Regenerate session to prevent fixation and ensure cookie is set before responding
      await new Promise<void>((resolve, reject) => {
        req.session.regenerate((err) => {
          if (err) return reject(err);
          (req.session as any).userId = user.id;
          req.session.save((saveErr) => {
            if (saveErr) return reject(saveErr);
            resolve();
          });
        });
      });
      
      res.json({ success: true, user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        mereBalance: user.mereBalance,
        totalMined: user.totalMined,
        referralCode: user.referralCode,
        isAdmin: user.isAdmin,
      }});
    } catch (error: any) {
      console.error("Sign in error:", error);
      res.status(400).json({ message: error.message || "Failed to sign in" });
    }
  });

  // Google sign-in/up with ID token (from Google Identity Services on the client)
  app.post('/api/auth/google', async (req: any, res) => {
    try {
      const { idToken } = req.body || {};
      if (!idToken) return res.status(400).json({ message: 'Missing idToken' });
      const payload = await verifyGoogleIdToken(idToken);
      if (!payload?.email) return res.status(400).json({ message: 'Invalid Google token' });
      const user = await findOrCreateGoogleUser(payload.email);

      // establish session
      await new Promise<void>((resolve, reject) => {
        req.session.regenerate((err: any) => {
          if (err) return reject(err);
          (req.session as any).userId = user.id;
          req.session.save((saveErr: any) => saveErr ? reject(saveErr) : resolve());
        });
      });

      res.json({ success: true, user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        mereBalance: user.mereBalance,
        totalMined: user.totalMined,
        referralCode: user.referralCode,
        isAdmin: user.isAdmin,
      }});
    } catch (err: any) {
      console.error('Google sign-in failed:', err);
      res.status(400).json({ message: err.message || 'Google sign-in failed' });
    }
  });

  // Forgot password: issue a short-lived reset token and email/log a reset link
  app.post('/api/auth/forgot-password', async (req, res) => {
    try {
      const { email } = req.body || {};
      if (!email) return res.status(400).json({ message: 'Email is required' });
      const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      // Always respond success to avoid account enumeration
      if (!user) return res.json({ success: true });

      // Users who signed up with Google may not have a password; still allow set
      const secret = process.env.JWT_SECRET || 'dev-secret';
      const token = jwt.sign({ sub: user.id, email: user.email, type: 'pwreset' }, secret, { expiresIn: '15m' });
      const origin = (req.headers['x-forwarded-host'] as string) || req.headers.host || `localhost:${process.env.PORT || 3000}`;
      const proto = (req.headers['x-forwarded-proto'] as string) || 'http';
      const link = `${proto}://${origin}/reset-password?token=${encodeURIComponent(token)}`;

      // Try to send email if SMTP is configured; otherwise, log reset URL
      let exposeDevLink = false;
      try {
        await sendMail({
          to: user.email!,
          subject: 'Reset your MereMiners password',
          html: `<p>Click the link below to reset your password. This link expires in 15 minutes.</p><p><a href="${link}">${link}</a></p>`,
        });
      } catch (e) {
        console.warn('[auth] SMTP not configured or send failed; reset link:', link);
        // In development, include the link in the JSON response so you can proceed without SMTP
        exposeDevLink = process.env.NODE_ENV !== 'production' || (process.env.EXPOSE_RESET_LINK_DEV === 'true');
      }

      if (exposeDevLink) {
        return res.json({ success: true, devLink: link });
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to start reset' });
    }
  });

  // Reset password using JWT token
  app.post('/api/auth/reset-password', async (req, res) => {
    try {
      const { token, password } = req.body || {};
      if (!token || !password) return res.status(400).json({ message: 'Invalid request' });
      if (String(password).length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters long' });
      const secret = process.env.JWT_SECRET || 'dev-secret';
      let payload: any;
      try {
        payload = jwt.verify(token, secret);
      } catch (e: any) {
        return res.status(400).json({ message: 'Invalid or expired token' });
      }
      const userId = payload?.sub as string;
      if (!userId) return res.status(400).json({ message: 'Invalid token' });
      const bcrypt = (await import('bcrypt')).default;
      const SALT_ROUNDS = 10;
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, userId));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Failed to reset password' });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Failed to log out" });
      }
      // Clear cookie on client to avoid stale session id
      try {
        const cookieName = (req.session as any)?.cookie?.name || 'connect.sid';
        res.clearCookie(cookieName, {
          httpOnly: true,
          secure: process.env.COOKIE_SECURE === 'true',
          sameSite: 'lax',
        });
      } catch {}
      res.json({ success: true });
    });
  });

  // Auth routes (email/password + session)
  app.get('/api/auth/user', async (req: any, res) => {
    try {
      const sessionUserId = (req.session as any)?.userId;
      if (!sessionUserId) return res.status(401).json({ message: "Unauthorized" });
      const user = await storage.getUser(sessionUserId);
      if (!user) return res.status(404).json({ message: 'User not found' });
      // Sanitize sensitive fields before sending to client
      const safe = {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        profileImageUrl: user.profileImageUrl,
        mereBalance: user.mereBalance,
        usdtBalance: user.usdtBalance,
        totalMined: user.totalMined,
        referralCode: user.referralCode,
        depositAddress: user.depositAddress,
        isAdmin: user.isAdmin,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      } as const;
      return res.json(safe);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Helper function to get user ID from either auth method
  function getUserId(req: any): string | null {
    const sessionUserId = req.session?.userId;
    if (sessionUserId) return sessionUserId;
    return null;
  }

  // Profile routes
  app.patch('/api/profile/update-name', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { firstName, lastName } = req.body;

      if (!firstName) {
        return res.status(400).json({ message: "First name is required" });
      }

      await db
        .update(users)
        .set({
          firstName: firstName.trim(),
          lastName: (lastName || "").trim(),
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      res.json({ success: true, message: "Name updated successfully" });
    } catch (error) {
      console.error("Error updating name:", error);
      res.status(500).json({ message: "Failed to update name" });
    }
  });

  // Shop routes
  app.get('/api/shop/miners', isAuthenticated, async (_req, res) => {
    try {
      const miners = await storage.getMinerTypes();
      res.json(miners);
    } catch (error) {
      console.error("Error fetching miners:", error);
      res.status(500).json({ message: "Failed to fetch miners" });
    }
  });

  app.post('/api/shop/buy', isAuthenticated, async (req: any, res) => {
    try {
      const userId = requireUserId(req, res);
      if (!userId) return;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const { minerTypeId } = req.body;

      if (!minerTypeId) {
        return res.status(400).json({ message: "Invalid request" });
      }

      // Get miner type
      const minerType = await storage.getMinerType(minerTypeId);
      if (!minerType || !minerType.isAvailable) {
        return res.status(404).json({ message: "Miner not found or unavailable" });
      }

      // Check if user already owns this miner type (one per type limit)
      const ownedMiners = await storage.getUserMiners(userId);
      const alreadyOwns = ownedMiners.some(m => m.minerType.id === minerTypeId);
      if (alreadyOwns) {
        return res.status(400).json({ message: "You already own this miner type. Each miner can only be purchased once." });
      }

      // Apply rarity-based discount
      let discountPercent = 0;
      if (minerType.rarity === "rare") discountPercent = 4;
      else if (minerType.rarity === "epic") discountPercent = 5;
      else if (minerType.rarity === "legendary") discountPercent = 7;
      
      const basePrice = parseFloat(minerType.basePriceMere);
      const finalCost = basePrice * (1 - discountPercent / 100);

      // Check user balance
      const user = await storage.getUser(userId);
      if (!user || parseFloat(user.mereBalance) < finalCost) {
        return res.status(400).json({ message: "Insufficient MERE balance" });
      }

      // Deduct balance
      await storage.updateUserBalance(userId, finalCost.toString(), "subtract");

      // Create user miner (only one)
      await storage.createUserMiner({
        userId,
        minerTypeId,
        slotPosition: null,
        isActive: true,
        boostMultiplier: 1.0,
      });

      // Record transaction
      const description = discountPercent > 0 
        ? `Purchased ${minerType.name} (-${discountPercent}% ${minerType.rarity} discount)`
        : `Purchased ${minerType.name}`;
      
      await storage.createTransaction({
        userId,
        type: "purchase",
        amountMere: finalCost.toFixed(2),
        amountUsd: (finalCost * 0.5).toFixed(2),
        description,
        status: "completed",
        metadata: { minerTypeId, quantity: 1, discount: discountPercent, originalPrice: basePrice },
      });

      // Check and unlock achievements
      await achievementsService.checkAndUnlockAchievements({ userId, type: "purchase" });

      res.json({ success: true, cost: finalCost });
    } catch (error) {
      console.error("Error purchasing miner:", error);
      res.status(500).json({ message: "Failed to purchase miner" });
    }
  });

  // Mining room routes
  app.get('/api/mining/room', isAuthenticated, async (req: any, res) => {
    try {
      const userId = requireUserId(req, res);
      if (!userId) return;
      const miners = await storage.getUserMiners(userId);
      res.json(miners);
    } catch (error) {
      console.error("Error fetching mining room:", error);
      res.status(500).json({ message: "Failed to fetch mining room" });
    }
  });

  app.get('/api/mining/slots', isAuthenticated, async (req: any, res) => {
    try {
      const userId = requireUserId(req, res);
      if (!userId) return;
      const slotCount = await storage.getUserSlotCount(userId);
      res.json({ totalSlots: 20, unlockedSlots: slotCount });
    } catch (error) {
      console.error("Error fetching slots:", error);
      res.status(500).json({ message: "Failed to fetch slots" });
    }
  });

  app.post('/api/mining/place', isAuthenticated, async (req: any, res) => {
    try {
      const userId = requireUserId(req, res);
      if (!userId) return;
      const { minerId, slotPosition } = req.body;

      if (!minerId || slotPosition === undefined) {
        return res.status(400).json({ message: "Invalid request" });
      }

      // Verify ownership
      const miner = await storage.getUserMiner(minerId);
      if (!miner || miner.userId !== userId) {
        return res.status(404).json({ message: "Miner not found" });
      }

      // Update slot position
      await storage.updateMinerSlot(minerId, slotPosition);

      // Check and unlock achievements
      await achievementsService.checkAndUnlockAchievements({ userId, type: "miner_placed" });

      res.json({ success: true });
    } catch (error) {
      console.error("Error placing miner:", error);
      res.status(500).json({ message: "Failed to place miner" });
    }
  });

  app.post('/api/mining/remove', isAuthenticated, async (req: any, res) => {
    try {
      const userId = requireUserId(req, res);
      if (!userId) return;
      const { minerId } = req.body;

      if (!minerId) {
        return res.status(400).json({ message: "Invalid request" });
      }

      // Verify ownership
      const miner = await storage.getUserMiner(minerId);
      if (!miner || miner.userId !== userId) {
        return res.status(404).json({ message: "Miner not found" });
      }

      // Remove from slot
      await storage.updateMinerSlot(minerId, null);

      res.json({ success: true });
    } catch (error) {
      console.error("Error removing miner:", error);
      res.status(500).json({ message: "Failed to remove miner" });
    }
  });

  app.post('/api/mining/upgrade', isAuthenticated, async (req: any, res) => {
    try {
      const userId = requireUserId(req, res);
      if (!userId) return;
      const { minerId } = req.body;

      if (!minerId) {
        return res.status(400).json({ message: "Invalid request" });
      }

      // Upgrade the miner
      const result = await storage.upgradeMiner(minerId, userId);

      res.json(result);
    } catch (error: any) {
      console.error("Error upgrading miner:", error);
      res.status(400).json({ message: error.message || "Failed to upgrade miner" });
    }
  });

  app.post('/api/mining/unlock-slot', isAuthenticated, async (req: any, res) => {
    try {
      const userId = requireUserId(req, res);
      if (!userId) return;

      // Check user balance
      const user = await storage.getUser(userId);
      if (!user || parseFloat(user.mereBalance) < SLOT_EXPANSION_PRICE_MERE) {
        return res.status(400).json({ message: "Insufficient MERE balance" });
      }

      // Deduct cost
      await storage.updateUserBalance(userId, SLOT_EXPANSION_PRICE_MERE.toString(), "subtract");

      // Unlock slot (simplified - in production track per user)
      const result = await storage.unlockSlot(userId);

      // Record transaction
      await storage.createTransaction({
        userId,
        type: "purchase",
        amountMere: SLOT_EXPANSION_PRICE_MERE.toString(),
        amountUsd: (SLOT_EXPANSION_PRICE_MERE * 0.5).toString(),
        description: "Unlocked mining slot",
        status: "completed",
      });

      res.json(result);
    } catch (error) {
      console.error("Error unlocking slot:", error);
      res.status(500).json({ message: "Failed to unlock slot" });
    }
  });

  // Wallet routes
  app.get('/api/wallet/transactions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = requireUserId(req, res);
      if (!userId) return;
      const transactions = await storage.getUserTransactions(userId);
      res.json(transactions);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  // File upload route (Supabase Storage)
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
  app.post('/api/storage/upload', isAuthenticated, upload.single('file'), async (req: any, res) => {
    try {
      const userId = requireUserId(req, res);
      if (!userId) return;
  const file = req.file as any;
      if (!file) return res.status(400).json({ message: 'No file provided' });

      const result = await uploadBuffer({
        userId,
        filename: file.originalname,
        buffer: file.buffer,
        contentType: file.mimetype,
      });

      res.json({ success: true, ...result });
    } catch (error: any) {
      console.error('Upload failed:', error);
      res.status(500).json({ message: error.message || 'Upload failed' });
    }
  });

  app.post('/api/wallet/deposit/generate', isAuthenticated, async (req: any, res) => {
    try {
      if (!tronEnabled) {
        return res.status(503).json({ message: 'Blockchain is not configured' });
      }
      const userId = requireUserId(req, res);
      if (!userId) return;

      // If user already has a deposit address, return it
      const user = await storage.getUser(userId);
      if (user?.depositAddress) {
        // Safety: if somehow it was set to the platform wallet address, or reused by another user, replace it
        const platformAddr = tronService.getPlatformWalletAddress?.() || '';
        const isPlatformAddr = platformAddr && user.depositAddress === platformAddr;
        const ownerOfAddress = await storage.getUserByDepositAddress(user.depositAddress);
        const ownedBySomeoneElse = ownerOfAddress && ownerOfAddress.id !== userId;
        if (!isPlatformAddr && !ownedBySomeoneElse) {
          return res.json({ address: user.depositAddress });
        }
        // Otherwise fall through to regenerate a unique one
      }

  // Generate a unique TRON address for this user
      let acct = await tronService.createAccount();
      // Ensure uniqueness at DB level: if collision (extremely unlikely), regenerate once
      const existingOwner = await storage.getUserByDepositAddress(acct.address);
      if (existingOwner) {
        acct = await tronService.createAccount();
      }
      // Store on users table (legacy) and also in user_wallets for scanners
      const secret = process.env.WALLET_KEY_SECRET;
      if (secret) {
        // Encrypt private key at rest using pgcrypto for legacy users table
        await db
          .update(users)
          .set({ 
            depositAddress: acct.address, 
            depositPrivateKey: sql`pgp_sym_encrypt(${acct.privateKey}, ${secret})`, 
            updatedAt: new Date() 
          } as any)
          .where(eq(users.id, userId));
      } else {
        console.warn('[wallet] WALLET_KEY_SECRET not set. Storing deposit private key in plaintext.');
        await db
          .update(users)
          .set({ depositAddress: acct.address, depositPrivateKey: acct.privateKey, updatedAt: new Date() })
          .where(eq(users.id, userId));
      }

      // Also upsert into user_wallets (preferred, AES-GCM via ENCRYPTION_KEY)
      try {
        const enc = encryptString(acct.privateKey);
        await db.execute(sql`
          INSERT INTO user_wallets (user_id, address, encrypted_private_key, note)
          VALUES (${userId}, ${acct.address}, ${enc}, ${'hot wallet'})
          ON CONFLICT (user_id)
          DO UPDATE SET address = EXCLUDED.address, encrypted_private_key = EXCLUDED.encrypted_private_key, updated_at = now()
        `);
      } catch (e) {
        console.warn('[wallet] Failed to upsert user_wallets (continuing):', (e as any)?.message || e);
      }

      return res.json({ address: acct.address });
    } catch (error) {
      console.error("Error generating deposit address:", error);
      res.status(500).json({ message: "Failed to generate deposit address" });
    }
  });

  // Link user's TRON sender address for automatic deposit credit
  app.post('/api/wallet/deposit/link-address', isAuthenticated, async (req: any, res) => {
    try {
      // With per-user auto-generated addresses, manual linking is no longer necessary.
      // Keep endpoint for backward compatibility: just return current user's address.
      const userId = requireUserId(req, res);
      if (!userId) return;
      const user = await storage.getUser(userId);
      if (!user?.depositAddress) {
        return res.status(404).json({ message: 'No deposit address assigned. Generate first.' });
      }
      return res.json({ success: true, address: user.depositAddress });
    } catch (error) {
      console.error('Error linking deposit address:', error);
      res.status(500).json({ message: 'Failed to link address' });
    }
  });

  // Force-scan the current user's deposit address now (useful for debugging)
  app.get('/api/wallet/deposit/scan-now', isAuthenticated, async (req: any, res) => {
    try {
      const userId = requireUserId(req, res);
      if (!userId) return;
      // Prefer user_wallets address; fallback to legacy users.depositAddress
      const row = await db.execute(sql`SELECT address FROM user_wallets WHERE user_id=${userId} LIMIT 1`);
      const address = (row as any).rows?.[0]?.address as string | undefined;
      const addr = address || (await storage.getUser(userId))?.depositAddress;
      if (!addr) return res.status(404).json({ message: 'No deposit address assigned' });
      const { scanAddressAndRecord } = await import('./controllers/usdtDepositController');
      await scanAddressAndRecord(addr);
      const recent = await db.execute(sql`SELECT txid, amount_usdt, status, created_at FROM usdt_deposits WHERE user_id=${userId} ORDER BY created_at DESC LIMIT 10`);
      res.json({ success: true, address: addr, deposits: (recent as any).rows || [] });
    } catch (err: any) {
      console.error('scan-now error:', err);
      res.status(500).json({ message: err.message || 'scan failed' });
    }
  });

  app.post('/api/wallet/withdraw', isAuthenticated, async (req: any, res) => {
    try {
      if (!tronEnabled) {
        return res.status(503).json({ message: 'Blockchain is not configured' });
      }
      const userId = requireUserId(req, res);
      if (!userId) return;

      const { amountUsdt, address } = req.body || {};
      const amtUsdt = parseFloat(amountUsdt);
      if (!amtUsdt || amtUsdt <= 0) {
        return res.status(400).json({ message: 'Invalid amount' });
      }
      if (!address || !address.trim() || !tronService.isValidAddress(address)) {
        return res.status(400).json({ message: 'Invalid TRON address' });
      }

      if (amtUsdt < MIN_WITHDRAW_USDT) {
        return res.status(400).json({ message: `Minimum withdrawal is ${MIN_WITHDRAW_USDT} USDT` });
      }

      // Ensure the user has enough USDT balance (do not deduct here; worker will deduct atomically)
      const user = await storage.getUser(userId);
      if (!user || parseFloat(user.usdtBalance) < amtUsdt) {
        return res.status(400).json({ message: 'Insufficient USDT balance' });
      }

      // Queue withdrawal; worker will process and broadcast
      const r = await db.execute(sql`
        INSERT INTO usdt_withdrawals (user_id, destination_address, amount_usdt, status)
        VALUES (${userId}, ${address}, ${amtUsdt}, 'queued')
        RETURNING id
      `);
      const id = (r as any).rows?.[0]?.id as string | undefined;

      // Optional: record a pending transaction entry
      await storage.createTransaction({
        userId,
        type: 'withdrawal',
        amountMere: '0',
        amountUsd: amtUsdt.toFixed(2),
        description: `USDT withdrawal queued (${amtUsdt.toFixed(2)} USDT)`,
        status: 'pending',
      });

      return res.json({ success: true, queued: true, id });
    } catch (error: any) {
      console.error('Error processing withdrawal:', error);
      res.status(500).json({ message: error.message || 'Failed to process withdrawal' });
    }
  });

  app.post('/api/wallet/convert', isAuthenticated, async (req: any, res) => {
    try {
      const userId = requireUserId(req, res);
      if (!userId) return;
      const { fromCurrency, toCurrency, amount } = req.body;

      const convertAmount = parseFloat(amount);
      if (!convertAmount || convertAmount <= 0) {
        return res.status(400).json({ message: "Invalid amount" });
      }

      // Get user balance
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(400).json({ message: "User not found" });
      }

      let convertedAmount = 0;
      let description = "";

      if (fromCurrency === "MERE" && toCurrency === "USDT") {
        // Convert MERE to USDT (1 MERE = 0.5 USDT)
        if (parseFloat(user.mereBalance) < convertAmount) {
          return res.status(400).json({ message: "Insufficient MERE balance" });
        }
        convertedAmount = convertAmount * 0.5;
        description = `Converted ${convertAmount} MERE to ${convertedAmount.toFixed(2)} USDT`;
        
        // Actually deduct MERE and add USDT
        await db.transaction(async (tx) => {
          // Deduct MERE (with balance check to prevent negative balance)
          const result = await tx
            .update(users)
            .set({
              mereBalance: sql`${users.mereBalance} - ${convertAmount}`,
              updatedAt: new Date(),
            })
            .where(and(
              eq(users.id, userId),
              sql`${users.mereBalance} >= ${convertAmount}`
            ))
            .returning();
          
          if (result.length === 0) {
            throw new Error("Insufficient MERE balance");
          }
          
          // Add USDT
          await tx
            .update(users)
            .set({
              usdtBalance: sql`${users.usdtBalance} + ${convertedAmount}`,
              updatedAt: new Date(),
            })
            .where(eq(users.id, userId));
        });
      } else if (fromCurrency === "USDT" && toCurrency === "MERE") {
        // Convert USDT to MERE (1 USDT = 2 MERE)
        if (parseFloat(user.usdtBalance) < convertAmount) {
          return res.status(400).json({ message: "Insufficient USDT balance" });
        }
        convertedAmount = convertAmount * 2;
        description = `Converted ${convertAmount} USDT to ${convertedAmount.toFixed(2)} MERE`;
        
        // Actually deduct USDT and add MERE
        await db.transaction(async (tx) => {
          // Deduct USDT (with balance check to prevent negative balance)
          const result = await tx
            .update(users)
            .set({
              usdtBalance: sql`${users.usdtBalance} - ${convertAmount}`,
              updatedAt: new Date(),
            })
            .where(and(
              eq(users.id, userId),
              sql`${users.usdtBalance} >= ${convertAmount}`
            ))
            .returning();
          
          if (result.length === 0) {
            throw new Error("Insufficient USDT balance");
          }
          
          // Add MERE
          await tx
            .update(users)
            .set({
              mereBalance: sql`${users.mereBalance} + ${convertedAmount}`,
              updatedAt: new Date(),
            })
            .where(eq(users.id, userId));
        });
      } else {
        return res.status(400).json({ message: "Invalid currency pair" });
      }

      // Record transaction
      await storage.createTransaction({
        userId,
        type: "conversion",
        amountMere: fromCurrency === "MERE" ? convertAmount.toString() : convertedAmount.toString(),
        amountUsd: fromCurrency === "USDT" ? convertAmount.toString() : convertedAmount.toString(),
        description,
        status: "completed",
      });

      res.json({ success: true, converted: convertedAmount });
    } catch (error) {
      console.error("Error processing conversion:", error);
      res.status(500).json({ message: "Failed to process conversion" });
    }
  });

  // Leaderboard routes
  app.get('/api/leaderboard', isAuthenticated, async (_req, res) => {
    try {
      const season = await storage.getCurrentSeason();
      if (!season) {
        return res.json([]);
      }

      const leaderboard = await storage.getLeaderboard(season.id, 100);
      res.json(leaderboard);
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
      res.status(500).json({ message: "Failed to fetch leaderboard" });
    }
  });

  app.get('/api/leaderboard/season', isAuthenticated, async (_req, res) => {
    try {
      const season = await storage.getCurrentSeason();
      if (!season) {
        return res.status(404).json({ message: "No active season" });
      }

      res.json({
        id: season.id,
        name: season.name,
        endAt: season.endAt,
      });
    } catch (error) {
      console.error("Error fetching season:", error);
      res.status(500).json({ message: "Failed to fetch season" });
    }
  });

  // Season Pass routes
  app.get('/api/season-pass', isAuthenticated, async (req: any, res) => {
    try {
      const userId = requireUserId(req, res);
      if (!userId) return;
      const season = await storage.getCurrentSeason();
      
      if (!season) {
        return res.status(404).json({ message: "No active season" });
      }

      let userPass = await storage.getUserSeasonPass(userId, season.id);
      if (!userPass) {
        userPass = await storage.createUserSeasonPass(userId, season.id);
      }

      const rewards = await storage.getSeasonPassRewards(season.id);

      res.json({
        ...userPass,
        rewards,
        seasonName: season.name,
      });
    } catch (error) {
      console.error("Error fetching season pass:", error);
      res.status(500).json({ message: "Failed to fetch season pass" });
    }
  });

  app.post('/api/season-pass/upgrade', isAuthenticated, async (req: any, res) => {
    try {
      const userId = requireUserId(req, res);
      if (!userId) return;
      const upgradeCost = 999; // 999 MERE

      // Check balance
      const user = await storage.getUser(userId);
      if (!user || parseFloat(user.mereBalance) < upgradeCost) {
        return res.status(400).json({ message: "Insufficient MERE balance" });
      }

      const season = await storage.getCurrentSeason();
      if (!season) {
        return res.status(404).json({ message: "No active season" });
      }

      // Deduct cost
      await storage.updateUserBalance(userId, upgradeCost.toString(), "subtract");

      // Upgrade pass
      await storage.upgradeSeasonPass(userId, season.id);

      // Record transaction
      await storage.createTransaction({
        userId,
        type: "purchase",
        amountMere: upgradeCost.toString(),
        amountUsd: (upgradeCost * 0.5).toString(),
        description: "Season Pass Premium Upgrade",
        status: "completed",
      });

      // Check and unlock achievements
      await achievementsService.checkAndUnlockAchievements({ userId, type: "season_pass_premium" });

      res.json({ success: true });
    } catch (error) {
      console.error("Error upgrading season pass:", error);
      res.status(500).json({ message: "Failed to upgrade season pass" });
    }
  });

  app.post('/api/season-pass/claim', isAuthenticated, async (req: any, res) => {
    try {
      const userId = requireUserId(req, res);
      if (!userId) return;
      const { rewardId } = req.body;

      if (!rewardId) {
        return res.status(400).json({ message: "Invalid request" });
      }

      const season = await storage.getCurrentSeason();
      if (!season) {
        return res.status(404).json({ message: "No active season" });
      }

      // Get the reward details
      const [reward] = await db.select().from(seasonPassRewards).where(eq(seasonPassRewards.id, rewardId));
      
      if (!reward) {
        return res.status(404).json({ message: "Reward not found" });
      }

      // Verify reward belongs to current season
      if (reward.seasonId !== season.id) {
        return res.status(400).json({ message: "Reward does not belong to current season" });
      }

      // Get user's season pass progress
      const userPass = await storage.getUserSeasonPass(userId, season.id);
      if (!userPass) {
        return res.status(404).json({ message: "Season pass not found" });
      }

      // Check if user has reached required tier
      if (userPass.currentTier < reward.tier) {
        return res.status(403).json({ message: "You haven't reached this tier yet" });
      }

      // Check if premium reward requires premium status
      if (reward.isPremium && !userPass.hasPremium) {
        return res.status(403).json({ message: "Premium pass required for this reward" });
      }

      // Check if reward was already claimed
      const claimedRewards = Array.isArray(userPass.claimedRewards) 
        ? (userPass.claimedRewards as string[]) 
        : [];
      if (claimedRewards.includes(rewardId)) {
        return res.status(400).json({ message: "Reward already claimed" });
      }

      // Mark as claimed
      await storage.claimSeasonPassReward(userId, season.id, rewardId);

      // Grant the reward based on type (credit balances; no blockchain ops here)
      if (reward.rewardType === "mere" && reward.rewardValue) {
        const value = Number(reward.rewardValue);
        if (isNaN(value) || value <= 0) {
          return res.status(400).json({ message: "Invalid reward value" });
        }
        await db
          .update(users)
          .set({ mereBalance: sql`${users.mereBalance} + ${value}`, updatedAt: new Date() })
          .where(eq(users.id, userId));

        await storage.createTransaction({
          userId,
          type: "reward",
          amountMere: value.toFixed(2),
          amountUsd: (value * 0.5).toFixed(2),
          description: `Season pass reward: +${value.toFixed(2)} MERE (tier ${reward.tier})`,
          status: "completed",
        });
      } else if (reward.rewardType === "usdt" && reward.rewardValue) {
        const value = Number(reward.rewardValue);
        if (isNaN(value) || value <= 0) {
          return res.status(400).json({ message: "Invalid reward value" });
        }
        await db
          .update(users)
          .set({ usdtBalance: sql`${users.usdtBalance} + ${value}`, updatedAt: new Date() })
          .where(eq(users.id, userId));

        await storage.createTransaction({
          userId,
          type: "reward",
          amountMere: '0',
          amountUsd: value.toFixed(2),
          description: `Season pass reward: +${value.toFixed(2)} USDT (tier ${reward.tier})`,
          status: "completed",
        });
      }

      return res.json({ success: true, claimed: true, reward: { type: reward.rewardType, value: reward.rewardValue } });
    } catch (error) {
      console.error("Error claiming season pass reward:", error);
      res.status(500).json({ message: "Failed to claim reward" });
    }
  });

  app.get('/api/achievements', isAuthenticated, async (req: any, res) => {
    try {
      const userId = requireUserId(req, res);
      if (!userId) return;
      
      // Get all achievements with user progress
      const allAchievements = await db.select().from(achievements).where(eq(achievements.isActive, true));
      const userAchievementRecords = await db.select().from(userAchievements).where(eq(userAchievements.userId, userId));
      
      const achievementsWithProgress = allAchievements.map(ach => {
        const userAch = userAchievementRecords.find(ua => ua.achievementId === ach.id);
        return {
          ...ach,
          progress: userAch?.progress || 0,
          isUnlocked: userAch?.isUnlocked || false,
          unlockedAt: userAch?.unlockedAt || null,
        };
      });

      res.json(achievementsWithProgress);
    } catch (error) {
      console.error("Error fetching achievements:", error);
      res.status(500).json({ message: "Failed to fetch achievements" });
    }
  });

  // Referral routes
  app.get('/api/referrals', isAuthenticated, async (req: any, res) => {
    try {
      const userId = requireUserId(req, res);
      if (!userId) return;
      const stats = await getReferralStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching referral stats:", error);
      res.status(500).json({ message: "Failed to fetch referral stats" });
    }
  });

  // Daily Games routes
  app.get('/api/games/daily-spin/status', isAuthenticated, async (req: any, res) => {
    try {
      const userId = requireUserId(req, res);
      if (!userId) return;
      
      const lastGame = await storage.getLastDailyGame(userId, 'daily_spin');
      
      if (!lastGame) {
        return res.json({ 
          canPlay: true, 
          lastPlayedAt: null,
          nextPlayAt: null 
        });
      }
      
      const lastPlayedAt = new Date(lastGame.lastPlayedAt);
      const now = new Date();
      const nextPlayAt = new Date(lastPlayedAt);
      nextPlayAt.setHours(24, 0, 0, 0); // Next play at midnight
      
      const canPlay = now >= nextPlayAt;
      
      res.json({
        canPlay,
        lastPlayedAt: lastPlayedAt.toISOString(),
        nextPlayAt: nextPlayAt.toISOString(),
        lastReward: lastGame.rewardMere,
      });
    } catch (error) {
      console.error("Error checking daily spin status:", error);
      res.status(500).json({ message: "Failed to check game status" });
    }
  });

  app.post('/api/games/daily-spin/play', isAuthenticated, async (req: any, res) => {
    try {
      const userId = requireUserId(req, res);
      if (!userId) return;
      
      // Check if user can play
      const lastGame = await storage.getLastDailyGame(userId, 'daily_spin');
      
      if (lastGame) {
        const lastPlayedAt = new Date(lastGame.lastPlayedAt);
        const now = new Date();
        const nextPlayAt = new Date(lastPlayedAt);
        nextPlayAt.setHours(24, 0, 0, 0);
        
        if (now < nextPlayAt) {
          return res.status(400).json({ 
            message: "You've already played today. Come back tomorrow!",
            nextPlayAt: nextPlayAt.toISOString()
          });
        }
      }
      
      // Generate random reward (0.01-0.05 MERE)
      const rewardMere = (0.01 + Math.random() * 0.04).toFixed(2);
      
      // Play the game and credit reward
      const game = await storage.playDailyGame(userId, 'daily_spin', rewardMere);
      
      res.json({
        success: true,
        reward: rewardMere,
        playedAt: game.lastPlayedAt,
      });
    } catch (error) {
      console.error("Error playing daily spin:", error);
      res.status(500).json({ message: "Failed to play game" });
    }
  });

  // Lucky Draw game routes
  app.get('/api/games/lucky-draw/status', isAuthenticated, async (req: any, res) => {
    try {
      const userId = requireUserId(req, res);
      if (!userId) return;
      
      const lastGame = await storage.getLastDailyGame(userId, 'lucky_draw');
      const hasPlayedBefore = await storage.hasPlayedGameBefore(userId, 'lucky_draw');
      
      if (!lastGame) {
        return res.json({ 
          canPlay: true, 
          lastPlayedAt: null,
          nextPlayAt: null,
          isFirstPlay: !hasPlayedBefore
        });
      }
      
      const lastPlayedAt = new Date(lastGame.lastPlayedAt);
      const now = new Date();
      const nextPlayAt = new Date(lastPlayedAt);
      nextPlayAt.setHours(24, 0, 0, 0);
      
      const canPlay = now >= nextPlayAt;
      
      res.json({
        canPlay,
        lastPlayedAt: lastPlayedAt.toISOString(),
        nextPlayAt: nextPlayAt.toISOString(),
        lastReward: lastGame.rewardMere,
        lastRarity: (lastGame.metadata as any)?.rarity,
        isFirstPlay: false
      });
    } catch (error) {
      console.error("Error checking lucky draw status:", error);
      res.status(500).json({ message: "Failed to check game status" });
    }
  });

  app.post('/api/games/lucky-draw/play', isAuthenticated, async (req: any, res) => {
    try {
      const userId = requireUserId(req, res);
      if (!userId) return;
      
      // Check if user can play
      const lastGame = await storage.getLastDailyGame(userId, 'lucky_draw');
      
      if (lastGame) {
        const lastPlayedAt = new Date(lastGame.lastPlayedAt);
        const now = new Date();
        const nextPlayAt = new Date(lastPlayedAt);
        nextPlayAt.setHours(24, 0, 0, 0);
        
        if (now < nextPlayAt) {
          return res.status(400).json({ 
            message: "You've already played today. Come back tomorrow!",
            nextPlayAt: nextPlayAt.toISOString()
          });
        }
      }
      
      // Check if first play
      const hasPlayedBefore = await storage.hasPlayedGameBefore(userId, 'lucky_draw');
      
      let rewardMere: string;
      let rarity: string;
      
      if (!hasPlayedBefore) {
        // First play always gives 0.01 MERE (Common)
        rewardMere = '0.01';
        rarity = 'common';
      } else {
        // Rarity-based rewards with weighted probabilities (0.01-0.07 MERE)
        const rand = Math.random() * 100;
        
        if (rand < 50) { // 50% chance - Common
          rewardMere = (0.01 + Math.random() * 0.01).toFixed(2); // 0.01-0.02
          rarity = 'common';
        } else if (rand < 80) { // 30% chance - Rare
          rewardMere = (0.02 + Math.random() * 0.02).toFixed(2); // 0.02-0.04
          rarity = 'rare';
        } else if (rand < 95) { // 15% chance - Epic
          rewardMere = (0.04 + Math.random() * 0.02).toFixed(2); // 0.04-0.06
          rarity = 'epic';
        } else { // 5% chance - Legendary
          rewardMere = (0.06 + Math.random() * 0.01).toFixed(2); // 0.06-0.07
          rarity = 'legendary';
        }
      }
      
      // Play the game and credit reward
      const game = await storage.playDailyGame(userId, 'lucky_draw', rewardMere, { rarity });
      
      res.json({
        success: true,
        reward: rewardMere,
        rarity,
        playedAt: game.lastPlayedAt,
        isFirstPlay: !hasPlayedBefore
      });
    } catch (error) {
      console.error("Error playing lucky draw:", error);
      res.status(500).json({ message: "Failed to play game" });
    }
  });

  // Miner Match game routes
  app.get('/api/games/miner-match/status', isAuthenticated, async (req: any, res) => {
    try {
      const userId = requireUserId(req, res);
      if (!userId) return;
      
      const lastGame = await storage.getLastDailyGame(userId, 'miner_match');
      
      if (!lastGame) {
        return res.json({ 
          canPlay: true, 
          lastPlayedAt: null,
          nextPlayAt: null 
        });
      }
      
      const lastPlayedAt = new Date(lastGame.lastPlayedAt);
      const now = new Date();
      const nextPlayAt = new Date(lastPlayedAt);
      nextPlayAt.setHours(24, 0, 0, 0);
      
      const canPlay = now >= nextPlayAt;
      
      res.json({
        canPlay,
        lastPlayedAt: lastPlayedAt.toISOString(),
        nextPlayAt: nextPlayAt.toISOString(),
        lastReward: lastGame.rewardMere,
        lastMoves: (lastGame.metadata as any)?.moves,
      });
    } catch (error) {
      console.error("Error checking miner match status:", error);
      res.status(500).json({ message: "Failed to check game status" });
    }
  });

  app.post('/api/games/miner-match/play', isAuthenticated, async (req: any, res) => {
    try {
      const userId = requireUserId(req, res);
      if (!userId) return;
      
      // Check if user can play
      const lastGame = await storage.getLastDailyGame(userId, 'miner_match');
      
      if (lastGame) {
        const lastPlayedAt = new Date(lastGame.lastPlayedAt);
        const now = new Date();
        const nextPlayAt = new Date(lastPlayedAt);
        nextPlayAt.setHours(24, 0, 0, 0);
        
        if (now < nextPlayAt) {
          return res.status(400).json({ 
            message: "You've already played today. Come back tomorrow!",
            nextPlayAt: nextPlayAt.toISOString()
          });
        }
      }
      
      const { moves } = req.body;
      
      // Calculate reward based on moves (fewer moves = better reward)
      // Perfect game (12 moves = 6 pairs) = 0.08 MERE
      // Each extra move reduces reward by 0.01 MERE, minimum 0.01 MERE
      let rewardMere: string;
      if (moves <= 12) {
        rewardMere = '0.08';
      } else {
        const extraMoves = moves - 12;
        const penalty = extraMoves * 0.01;
        const reward = Math.max(0.01, 0.08 - penalty);
        rewardMere = reward.toFixed(2);
      }
      
      // Play the game and credit reward
      const game = await storage.playDailyGame(userId, 'miner_match', rewardMere, { moves });
      
      res.json({
        success: true,
        reward: rewardMere,
        moves,
        playedAt: game.lastPlayedAt,
      });
    } catch (error) {
      console.error("Error playing miner match:", error);
      res.status(500).json({ message: "Failed to play game" });
    }
  });

  const httpServer = createServer(app);

  // System status endpoint
  app.get('/api/system/status', (_req, res) => {
    try {
      const earnings = require('./earnings');
      const { depositMonitor } = require('./depositMonitor');
      const status = {
        tronEnabled,
        earnings: earnings.earningsEngine.getStatus(),
        deposits: depositMonitor.getStatus(),
        time: new Date().toISOString(),
      };
      res.json(status);
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'Status error' });
    }
  });

  // =====================
  // USDT (TRC-20) endpoints (JWT-protected)
  // =====================
  // Admin: create per-user hot wallet (address + encrypted key)
  app.post('/api/admin/create-wallet', requireAdminJwt, adminCreateWallet);
  // Optional: TronGrid webhook receiver for deposits
  app.post('/webhook/deposit', webhookDeposit);
  // User: queue a USDT withdrawal (processed by worker)
  app.post('/api/usdt/withdraw', requireUserJwt, requestWithdrawal);

  // Admin health dashboard (JWT admin)
  app.get('/api/admin/health', requireAdminJwt, async (_req, res) => {
    try {
      const { getCurrentBlockNumber } = await import('./lib/tron');
      const tw = getTronWeb(process.env.COLD_WALLET_PRIVATE_KEY);
      const addr = process.env.COLD_WALLET_PRIVATE_KEY ? tw.address.fromPrivateKey(process.env.COLD_WALLET_PRIVATE_KEY) : undefined;
      const trxBal = addr ? (await tw.trx.getBalance(addr)) / 1_000_000 : null;
      const block = await getCurrentBlockNumber();
      const pending = await (await import('./db')).db.execute(require('drizzle-orm').sql`SELECT COUNT(1) as c FROM usdt_withdrawals WHERE status IN ('queued','locked','processing')`);
      const c = Number(((pending as any).rows?.[0]?.c) || 0);
      res.json({ tron: { address: addr, trxBalance: trxBal, currentBlock: block }, withdrawals: { pending: c } });
    } catch (err: any) {
      res.status(500).json({ message: err.message || 'health error' });
    }
  });

  // Admin view: sweeper status and sweepable wallets (session admin)
  app.get('/api/admin/sweeps', isAuthenticated, async (req: any, res) => {
    try {
      const adminId = getUserId(req);
      if (!adminId) return res.status(401).json({ message: 'Unauthorized' });
      const me = await storage.getUser(adminId);
      if (!me?.isAdmin) return res.status(403).json({ message: 'Forbidden' });

      const tw = getTronWeb(process.env.COLD_WALLET_PRIVATE_KEY);
      const platformAddress = process.env.COLD_WALLET_PRIVATE_KEY ? tw.address.fromPrivateKey(process.env.COLD_WALLET_PRIVATE_KEY) : null;
      let platformTrx: number | null = null;
      let platformUsdt: number | null = null;
      if (platformAddress) {
        platformTrx = (await tw.trx.getBalance(platformAddress)) / 1_000_000;
        platformUsdt = await getUSDTBalance(platformAddress);
      }

      const SWEEP_MIN_USDT = parseFloat(process.env.SWEEP_MIN_USDT || '1');
      // Fetch recent sweep actions
      const recent = await db.execute(sql`SELECT id, action, details, created_at FROM admin_actions WHERE action = 'deposit_sweep' ORDER BY created_at DESC LIMIT 20`);

      // Sample a set of user wallets to estimate sweepable balances
      const uw = await db.execute(sql`SELECT user_id, address FROM user_wallets WHERE address IS NOT NULL ORDER BY updated_at DESC LIMIT 50`);
      const wallets: Array<{ userId: string; address: string; usdt: number; trx: number; sweepable: boolean }>= [];
      const rows = (uw as any).rows || [];
      for (const r of rows) {
        const address = r.address as string;
        try {
          const [usdt, trxRaw] = await Promise.all([
            getUSDTBalance(address),
            tw.trx.getBalance(address),
          ]);
          const trx = trxRaw / 1_000_000;
          wallets.push({ userId: r.user_id, address, usdt, trx, sweepable: usdt >= SWEEP_MIN_USDT });
        } catch {
          // ignore individual failures
        }
      }

      res.json({
        platform: { address: platformAddress, trx: platformTrx, usdt: platformUsdt },
        sweepEnabled: (process.env.SWEEP_ENABLED || 'false') === 'true',
        thresholdUSDT: SWEEP_MIN_USDT,
        recent: (recent as any).rows || [],
        wallets,
      });
    } catch (err: any) {
      console.error('admin sweeps error:', err);
      res.status(500).json({ message: err.message || 'Failed to load sweeps' });
    }
  });

  // Admin: trigger a single withdraw worker iteration (for cron on serverless)
  app.post('/api/admin/withdraw/run-once', requireAdminJwt, async (_req, res) => {
    try {
      const BATCH = parseInt(process.env.WITHDRAW_BATCH_SIZE || '5', 10);
      const pick = await db.execute(sql`
        UPDATE usdt_withdrawals
        SET status='locked', updated_at=now()
        WHERE id IN (
          SELECT id FROM usdt_withdrawals WHERE status='queued' ORDER BY created_at ASC LIMIT ${BATCH}
        )
        RETURNING id, user_id, destination_address, amount_usdt
      `);
      const rows = (pick as any).rows as Array<{ id: string; user_id: string; destination_address: string; amount_usdt: number }>;
      const { processWithdrawalRecord } = await import('./controllers/usdtWithdrawController');
      const results: Array<{ id: string; ok: boolean; error?: string }> = [];
      for (const r of rows) {
        try {
          await processWithdrawalRecord(r);
          results.push({ id: r.id, ok: true });
        } catch (err: any) {
          results.push({ id: r.id, ok: false, error: err?.message || String(err) });
        }
      }
      res.json({ success: true, picked: rows.length, results });
    } catch (err: any) {
      console.error('[admin withdraw run-once] error:', err);
      res.status(500).json({ message: err.message || 'run-once failed' });
    }
  });

  // Admin: trigger a single sweep pass (for cron on serverless)
  app.post('/api/admin/sweep/run-once', requireAdminJwt, async (_req, res) => {
    try {
      const enabledRaw = (process.env.SWEEP_ENABLED || '').trim();
      const enabled = enabledRaw.toLowerCase() === 'true' || enabledRaw === '1' || enabledRaw.toLowerCase() === 'yes';
      if (!enabled) {
        return res.status(400).json({ message: 'Sweeper disabled (set SWEEP_ENABLED=true)' });
      }
      const minUsdt = parseFloat(process.env.SWEEP_MIN_USDT || '1');
      const minTrxForGas = parseFloat(process.env.SWEEP_MIN_TRX || '10');
      const topupTrxAmount = parseFloat(process.env.SWEEP_TOPUP_TRX || '20');

      const platformKey = process.env.COLD_WALLET_PRIVATE_KEY || process.env.TRON_PRIVATE_KEY || '';
      if (!platformKey) {
        return res.status(400).json({ message: 'No platform private key set' });
      }

      const { getTronWeb, getUSDTBalance, buildAndSendTRC20 } = await import('./lib/tron');
      const { tronService } = await import('./tronService');
      const platformAddr = tronService.getPlatformWalletAddress?.() || (() => {
        try { const tw = getTronWeb(platformKey); /* @ts-ignore */ return tw.address.fromPrivateKey(platformKey); } catch { return ''; }
      })();
      if (!platformAddr) return res.status(400).json({ message: 'Could not derive platform address' });

      const uw = await db.execute(sql`SELECT user_id, address, encrypted_private_key FROM user_wallets WHERE address IS NOT NULL AND encrypted_private_key IS NOT NULL LIMIT 50`);
      const rows = (uw as any).rows as Array<{ user_id: string; address: string; encrypted_private_key: string }>;

      const twQuery = getTronWeb();
      const { decryptString } = await import('./lib/crypto');
      const actions: Array<{ address: string; swept?: number; txid?: string; topup?: number; skipped?: string }>= [];
      for (const r of rows) {
        try {
          const usdtBal = await getUSDTBalance(r.address);
          if (usdtBal < minUsdt) { actions.push({ address: r.address, skipped: 'low_usdt' }); continue; }
          const trxBalSun = await twQuery.trx.getBalance(r.address);
          const trxBal = trxBalSun / 1_000_000;
          if (trxBal < minTrxForGas) {
            try {
              const twPlatform = getTronWeb(platformKey);
              const toSun = Math.floor(topupTrxAmount * 1_000_000);
              await twPlatform.trx.sendTransaction(r.address, toSun);
              actions.push({ address: r.address, topup: topupTrxAmount });
              continue;
            } catch (e) {
              actions.push({ address: r.address, skipped: 'topup_failed' });
              continue;
            }
          }
          const pk = decryptString(r.encrypted_private_key);
          const txid = await buildAndSendTRC20({ fromPrivateKey: pk, to: platformAddr, amountUSDT: usdtBal });
          await db.execute(sql`INSERT INTO admin_actions (action, details) VALUES ('deposit_sweep', jsonb_build_object('from', ${r.address}, 'to', ${platformAddr}, 'amount_usdt', ${usdtBal}, 'txid', ${txid}))`);
          actions.push({ address: r.address, swept: usdtBal, txid });
        } catch (e: any) {
          actions.push({ address: r.address, skipped: e?.message || 'error' });
        }
      }
      res.json({ success: true, actions });
    } catch (err: any) {
      console.error('[admin sweep run-once] error:', err);
      res.status(500).json({ message: err.message || 'run-once failed' });
    }
  });

  // Admin: trigger a single deposit scan over all known wallets (for cron on serverless)
  app.post('/api/admin/deposits/scan-once', requireAdminJwt, async (_req, res) => {
    try {
      const { scanAddressAndRecord } = await import('./controllers/usdtDepositController');
      const rows = await db.execute(sql`SELECT address FROM user_wallets WHERE address IS NOT NULL`);
      const addrs = ((rows as any).rows || []).map((r: any) => r.address as string);
      const results: Array<{ address: string; ok: boolean; error?: string }> = [];
      for (const addr of addrs) {
        try {
          await scanAddressAndRecord(addr);
          results.push({ address: addr, ok: true });
        } catch (e: any) {
          results.push({ address: addr, ok: false, error: e?.message || 'error' });
        }
      }
      res.json({ success: true, scanned: addrs.length, results });
    } catch (err: any) {
      console.error('[admin deposits scan-once] error:', err);
      res.status(500).json({ message: err.message || 'scan-once failed' });
    }
  });

  return httpServer;
}
