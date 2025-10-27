import type { Express, RequestHandler } from "express";
import session from "express-session";
import connectPg from "connect-pg-simple";

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const hasDb = Boolean(process.env.DATABASE_URL);
  const pgStore = connectPg(session);
  let sessionStore: session.Store;
  // Expose which store we are using for debug endpoints
  try { (globalThis as any).__SESSION_STORE_TYPE = undefined; } catch {}
  if (!hasDb) {
    console.warn("[auth] DATABASE_URL not set. Falling back to in-memory session store (not durable). Set DATABASE_URL for production.");
    sessionStore = new session.MemoryStore();
    try { (globalThis as any).__SESSION_STORE_TYPE = 'memory'; } catch {}
  } else {
    try {
      sessionStore = new pgStore({
        conString: process.env.DATABASE_URL,
        createTableIfMissing: true,
        ttl: sessionTtl,
        tableName: "sessions",
      });
      try { (globalThis as any).__SESSION_STORE_TYPE = 'postgres'; } catch {}
    } catch (e) {
      console.error("[auth] Failed to initialize Postgres session store. Falling back to memory store:", (e as any)?.message || e);
      sessionStore = new session.MemoryStore();
      try { (globalThis as any).__SESSION_STORE_TYPE = 'memory'; } catch {}
    }
  }
  const secret = process.env.SESSION_SECRET || "dev-session-secret-change-me";
  if (!process.env.SESSION_SECRET) {
    console.warn("[auth] SESSION_SECRET is not set. Using a development default. Set SESSION_SECRET in .env for production.");
  }
  // Cookie behavior for HTTPS deployments
  const isProd = (process.env.NODE_ENV || '').toLowerCase() === 'production';
  const cookieSecure = process.env.COOKIE_SECURE === 'true' || isProd;
  // In HTTPS/production, allow cross-site for reliability with custom domains
  const cookieSameSite: 'lax' | 'none' = cookieSecure ? 'none' : 'lax';
  // Optional explicit cookie domain for custom domains (e.g., example.com or .example.com)
  const cookieDomain = process.env.COOKIE_DOMAIN || undefined;
  return session({
    secret,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
  // Secure cookies for production; allow http locally if not
      secure: cookieSecure,
      sameSite: cookieSameSite,
      domain: cookieDomain,
      maxAge: sessionTtl,
    },
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  console.log("[auth] Session-based authentication initialized");
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  const sessionUserId = (req.session as any)?.userId;
  if (sessionUserId) return next();
  return res.status(401).json({ message: "Unauthorized" });
};
