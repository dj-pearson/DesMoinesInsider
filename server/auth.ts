import type { Express, NextFunction, Request, Response } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import MemoryStore from "memorystore";
import bcrypt from "bcryptjs";
import { getPool, isDatabaseConfigured } from "./db.js";
import type { PublicUser, User } from "@shared/schema.js";

/**
 * Session-based authentication.
 *
 * Sessions live in Postgres so they survive a restart and work across more than
 * one server process. The in-memory store is a development fallback only.
 */

declare module "express-session" {
  interface SessionData {
    userId?: string;
    /** Set only by an operator process, never by anything a visitor can reach. */
    isAdmin?: boolean;
  }
}

/** bcrypt cost. 12 is the current sensible default for interactive logins. */
const BCRYPT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * A dummy hash used to keep login timing roughly constant when the account
 * does not exist. Without it, a missing username returns noticeably faster than
 * a wrong password, which is enough to enumerate accounts.
 */
const TIMING_DECOY_HASH = bcrypt.hashSync("timing-decoy-not-a-real-password", BCRYPT_ROUNDS);

export async function burnTimingBudget(password: string): Promise<void> {
  await bcrypt.compare(password, TIMING_DECOY_HASH);
}

/** Strip the hash before any user object crosses the API boundary. */
export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    homeNeighborhoodId: user.homeNeighborhoodId,
    createdAt: user.createdAt,
  };
}

export function setupSessions(app: Express): void {
  const isProduction = process.env.NODE_ENV === "production";
  const secret = process.env.SESSION_SECRET;

  // A predictable secret lets anyone forge a session cookie, so production
  // refuses to start without one rather than falling back to a default.
  if (isProduction && !secret) {
    throw new Error(
      "SESSION_SECRET is required in production. Refusing to start with a default signing key.",
    );
  }

  if (!secret) {
    console.warn(
      "[auth] SESSION_SECRET is not set. Using a development-only key; sessions will not survive a restart.",
    );
  }

  const store = isDatabaseConfigured
    ? new (connectPgSimple(session))({
        pool: getPool() as never,
        tableName: "user_sessions",
        createTableIfMissing: true,
      })
    : new (MemoryStore(session))({ checkPeriod: 86_400_000 });

  app.use(
    session({
      store,
      secret: secret ?? "development-only-insecure-key",
      resave: false,
      saveUninitialized: false,
      name: "dsm.sid",
      cookie: {
        httpOnly: true, // no script access, so XSS cannot read the cookie
        secure: isProduction, // HTTPS only once deployed
        sameSite: "lax", // blocks cross-site POSTs, which covers most CSRF
        maxAge: 30 * 24 * 60 * 60 * 1000,
      },
    }),
  );
}

/** Reject anything that is not a signed-in user. */
export function requireUser(req: Request, res: Response, next: NextFunction): void {
  if (!req.session?.userId) {
    res.status(401).json({ message: "Sign in to do that" });
    return;
  }
  next();
}
