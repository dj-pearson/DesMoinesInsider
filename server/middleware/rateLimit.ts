import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { Request, Response } from "express";
import { isAdminRequest } from "./auth";

/**
 * Per-IP rate limiting for every state-changing API request.
 *
 * The public surface here is small but expensive: search-count increments write
 * to the database, newsletter signups write rows, and the scrape endpoint drives
 * a headless browser and spends OpenAI credits. Limits keep a single client from
 * running up either bill.
 */

function clientKey(req: Request): string {
  // ipKeyGenerator normalizes IPv6 addresses to a /64 subnet, so a single
  // client cannot cycle through addresses in its own prefix to reset the count.
  return ipKeyGenerator(req.ip ?? "unknown");
}

function tooMany(_req: Request, res: Response): void {
  res.status(429).json({ message: "Too many requests. Please try again shortly." });
}

/**
 * General limiter for POST/PUT/PATCH/DELETE under /api.
 * 60 writes per 15 minutes is far above normal browsing, where a visitor writes
 * only when they click into a place or subscribe.
 */
export const apiWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: clientKey,
  handler: tooMany,
  // Admins run bulk operations from scripts; they authenticate separately.
  skip: (req) => isAdminRequest(req),
});

/**
 * Tight limiter for the endpoints that cost real money per call. Applied on top
 * of admin auth as a backstop against a leaked token or a runaway script.
 */
export const expensiveOperationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: clientKey,
  handler: tooMany,
});

/**
 * Newsletter signup is the one unauthenticated write that creates a durable
 * row keyed on user-supplied text, so it gets its own tighter budget.
 */
export const newsletterLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: clientKey,
  handler: tooMany,
});

/**
 * Community submissions. Tighter than the general write budget because each one
 * creates a row a human then has to review; a flood is a denial of service on
 * the moderator, not just the server.
 */
export const submissionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: clientKey,
  handler: tooMany,
});
