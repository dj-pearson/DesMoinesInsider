import { timingSafeEqual } from "crypto";
import type { NextFunction, Request, Response } from "express";

/**
 * Admin authentication for the operational endpoints (scraping, AI
 * enhancement, moderation). These endpoints spend money and drive headless
 * browsers, so they must never be reachable by an anonymous visitor.
 *
 * Two credentials are accepted:
 *  - an `ADMIN_TOKEN` presented as `X-Admin-Token` or `Authorization: Bearer`,
 *    used by cron runners, deploy hooks, and curl;
 *  - an authenticated admin session, once sessions land in US-017.
 */

/** Constant-time string comparison that does not leak length via early exit. */
function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, "utf8");
  const bufferB = Buffer.from(b, "utf8");
  if (bufferA.length !== bufferB.length) {
    // Still burn a comparison so the failure timing matches the mismatch case.
    timingSafeEqual(bufferA, bufferA);
    return false;
  }
  return timingSafeEqual(bufferA, bufferB);
}

/** Shape of the session we will have once US-017 adds express-session. */
interface MaybeAdminSession {
  session?: { isAdmin?: boolean };
}

/** Pull the bearer token out of the request, from either accepted header. */
function extractToken(req: Request): string | undefined {
  const headerToken = req.get("x-admin-token");
  if (headerToken) return headerToken;

  const authorization = req.get("authorization");
  if (authorization?.toLowerCase().startsWith("bearer ")) {
    return authorization.slice("bearer ".length).trim();
  }

  return undefined;
}

export function isAdminRequest(req: Request): boolean {
  if ((req as Request & MaybeAdminSession).session?.isAdmin === true) {
    return true;
  }

  const expected = process.env.ADMIN_TOKEN;
  const provided = extractToken(req);

  // With no ADMIN_TOKEN configured there is no valid credential, so nothing
  // authenticates. Failing closed is the only safe default here.
  if (!expected || !provided) return false;

  return safeEqual(provided, expected);
}

/**
 * Express middleware. Rejects anything that is not a verified admin.
 *
 * Responds 503 when the server has no ADMIN_TOKEN configured at all, because
 * that is an operator misconfiguration rather than a caller mistake, and the
 * distinction saves real debugging time. It leaks nothing useful: an attacker
 * learns only that the endpoint is unusable.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const hasSession = (req as Request & MaybeAdminSession).session?.isAdmin === true;

  if (!process.env.ADMIN_TOKEN && !hasSession) {
    console.warn(
      `[auth] Rejected ${req.method} ${req.path}: ADMIN_TOKEN is not configured on this server.`,
    );
    res.status(503).json({
      message:
        "Admin endpoints are disabled because ADMIN_TOKEN is not configured on the server.",
    });
    return;
  }

  if (!isAdminRequest(req)) {
    console.warn(`[auth] Rejected unauthorized ${req.method} ${req.path}`);
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  next();
}
