import { seedVenues, type VenueSeed } from "../seed/venues.js";

/**
 * In-process venue lookup.
 *
 * Derived from the same seed the database is built from, so the curated facts
 * live in exactly one place. This is used on the ingestion path, where a
 * synchronous lookup avoids a query per scraped event.
 */

export type VenueFacts = VenueSeed;

/** Alias lookup built once at module load. */
const BY_ALIAS = new Map<string, VenueFacts>();
for (const venue of seedVenues) {
  BY_ALIAS.set(venue.name.toLowerCase(), venue);
  for (const alias of venue.aliases) {
    BY_ALIAS.set(alias.toLowerCase(), venue);
  }
}

/** Aliases sorted longest first, so a specific match beats a shorter substring. */
const ALIASES_BY_LENGTH = Array.from(BY_ALIAS.keys()).sort((a, b) => b.length - a.length);

/**
 * Look up curated facts for a venue.
 *
 * Tries an exact alias match first, then checks whether any alias appears
 * inside the given text, so "Des Moines Civic Center - Main Stage" resolves.
 */
export function findVenueFacts(
  ...candidates: Array<string | null | undefined>
): VenueFacts | undefined {
  const texts = candidates
    .filter((text): text is string => Boolean(text && text.trim()))
    .map((text) => text.toLowerCase().trim());

  for (const text of texts) {
    const exact = BY_ALIAS.get(text);
    if (exact) return exact;
  }

  for (const text of texts) {
    for (const alias of ALIASES_BY_LENGTH) {
      if (text.includes(alias)) return BY_ALIAS.get(alias);
    }
  }

  return undefined;
}

export { seedVenues };
