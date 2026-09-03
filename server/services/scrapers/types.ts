import type { ScrapedEvent } from "../scraper.js";

export type { ScrapedEvent };

/**
 * One place we pull events from.
 *
 * `venueSlug` points at an entry in `server/seed/venues.ts`, which is what
 * gives a scraped event its parking notes, nearby food, and neighbourhood
 * without the scraper having to know any of that.
 */
export interface EventSource {
  /** Human-readable, and the key `scrape_runs` rows are recorded under. */
  name: string;
  /** Used when the source gives us nothing better; the normalizer refines it. */
  defaultCategory: string;
  /** Slug of the venue in the venue seed. */
  venueSlug: string;
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
