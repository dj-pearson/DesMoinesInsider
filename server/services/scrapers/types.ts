import type { ScrapedEvent } from "../scraper.js";

export type { ScrapedEvent };

/**
 * One place we pull events from.
 *
 * `venueSlug` points at an entry in `server/seed/venues.ts`, which is what
 * gives a scraped event its parking notes, nearby food, and neighbourhood
 * without the scraper having to know any of that.
 */
/**
 * Which source wins when two of them list the same event.
 *
 * Higher wins. The numbers are spaced so a tier can be inserted without
 * renumbering everything, and the ordering is the whole point of this file:
 * a venue's own page is the truth about its own event, and an aggregator is a
 * copy of it — usually with a worse title, a vaguer time, and a link that goes
 * to the aggregator rather than to where you buy a ticket.
 */
export const SOURCE_PRIORITY = {
  /** The venue or organiser publishing its own calendar. */
  DIRECT_VENUE: 100,
  /** A city, library or county publishing its own programming. */
  CIVIC: 90,
  /** A league or association publishing its own schedule. */
  GOVERNING_BODY: 80,
  /**
   * Tourism bureaus and search aggregators. Used only to fill gaps: they cover
   * events nothing else reaches, but never win a tie.
   */
  AGGREGATOR: 10,
} as const;

export interface EventSource {
  /** Human-readable, and the key `scrape_runs` rows are recorded under. */
  name: string;
  /** Used when the source gives us nothing better; the normalizer refines it. */
  defaultCategory: string;
  /**
   * Slug of the venue in the venue seed, or null for a source that spans a
   * whole city rather than one room. A suburb's calendar covers its parks, its
   * library and its main street, so pinning it to a single venue would be a
   * lie; those sources carry a neighborhood on each event instead.
   */
  venueSlug: string | null;
  /**
   * Rank for deduplication; see SOURCE_PRIORITY. Stamped onto every event this
   * source returns, so the winner can be chosen after the fact without knowing
   * which scraper produced which event.
   */
  sourcePriority: number;
  scrape(): Promise<ScrapedEvent[]>;
}

/** What one source did on one run. */
export interface SourceRunResult {
  source: string;
  ok: boolean;
  count: number;
  durationMs: number;
  error?: string;
}
