import type { Express, RequestHandler } from "express";
import session from "express-session";
import connectPg from "connect-pg-simple";

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  const secret = process.env.SESSION_SECRET || "dev-session-secret-change-me";
  if (!process.env.SESSION_SECRET) {
    console.warn("[auth] SESSION_SECRET is not set. Using a development default. Set SESSION_SECRET in .env for production.");
  }
  return session({
    secret,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      // Important: allow running locally over http even in production builds
      // Opt-in to secure cookies with COOKIE_SECURE=true in real HTTPS environments
      secure: process.env.COOKIE_SECURE === 'true',
      sameSite: 'lax',
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
