import { Pool as NeonPool, neonConfig } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { drizzle as drizzleNodePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import ws from "ws";
import * as schema from "@shared/schema";

/**
 * Neon's serverless driver reaches Postgres over a WebSocket. Node has no
 * global WebSocket on the versions we target, so hand it `ws`.
 */
neonConfig.webSocketConstructor = ws;

export const DATABASE_URL = process.env.DATABASE_URL;

/**
 * True when the app is configured to talk to a real Postgres database.
 * `server/storage.ts` uses this to choose between `DatabaseStorage` and the
 * in-memory development fallback.
 */
export const isDatabaseConfigured = Boolean(DATABASE_URL);

/**
 * Neon is served over a WebSocket endpoint and needs its own driver. Every
 * other Postgres (Railway, Supabase direct, RDS, a local instance) speaks plain
 * TCP and needs node-postgres. Picking by host keeps a single DATABASE_URL
 * working across all of them.
 */
function isNeonUrl(url: string): boolean {
  try {
    return /(^|\.)neon\.(tech|build)$/.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

/**
 * Both drivers expose the same Drizzle query-builder surface. We type the
 * client as the node-postgres flavour and cast the Neon one to it so callers
 * do not have to narrow a union on every query.
 */
export type AppDatabase = NodePgDatabase<typeof schema>;

let pool: NeonPool | pg.Pool | undefined;
let dbInstance: AppDatabase | undefined;

function requireUrl(): string {
  if (!DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is not set. Provision a Postgres database and set DATABASE_URL before using the database.",
    );
  }
  return DATABASE_URL;
}

/**
 * Lazily create the connection pool. Building it at module scope would make
 * importing this file throw wherever DATABASE_URL is absent.
 */
export function getPool(): NeonPool | pg.Pool {
  if (!pool) {
    const url = requireUrl();
    pool = isNeonUrl(url)
      ? new NeonPool({ connectionString: url })
      : new pg.Pool({ connectionString: url });
  }
  return pool;
}

/** The Drizzle client, bound to the shared schema so queries are fully typed. */
export function getDb(): AppDatabase {
  if (!dbInstance) {
    const url = requireUrl();
    dbInstance = isNeonUrl(url)
      ? (drizzleNeon(getPool() as NeonPool, { schema }) as unknown as AppDatabase)
      : drizzleNodePg(getPool() as pg.Pool, { schema });
  }
  return dbInstance;
}

/** Close the pool. Used on graceful shutdown and in tests. */
export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = undefined;
    dbInstance = undefined;
  }
}
