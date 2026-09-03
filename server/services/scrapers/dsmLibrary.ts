import { fetchJson } from "./http.js";
import { isPlausibleEventDate, parseLocalTimestamp } from "./dates.js";
import { textOf } from "./html.js";
import { freeUnlessPriced } from "./civic.js";
import type { EventSource, ScrapedEvent } from "./types.js";

/**
 * Des Moines Public Library.
 *
 * The library publishes a complete JSON feed of its programming — story times,
 * author talks, maker sessions, teen nights — across every branch. It is one of
 * the largest sources of genuinely free, genuinely local things to do in the
 * city, and it appears on no regional events calendar.
 *
 * Branches are the reason this is worth its own file rather than a generic
 * reader: each one sits in a specific neighborhood, and mapping them means a
 * resident in Beaverdale sees the Franklin Avenue events as theirs.
 */

const FEED_URL = "https://www.dmpl.org/events/feed/json";

/**
 * Branch to neighborhood. "DMPL Systemwide" and "Off Site" are deliberately
 * absent: they are not a place, and guessing one would put an event in the
 * wrong part of town.
 */
const BRANCH_NEIGHBORHOODS: Record<string, string> = {
  "Central Library": "downtown",
  "Forest Avenue Library": "drake",
  "Franklin Avenue Library": "beaverdale",
  "North Side Library": "highland-park",
  "South Side Library": "south-side",
};

interface LibraryEvent {
  title?: string;
  url?: string;
  start_date?: string;
  description?: string;
  program_description?: string;
  branch?: Record<string, string>;
  room?: Record<string, string>;
  program_type?: Record<string, string>;
  public?: boolean;
  published?: boolean;
}

function firstValue(map: Record<string, string> | undefined): string | undefined {
  if (!map) return undefined;
  const values = Object.values(map);
  return values.length > 0 ? values[0] : undefined;
}

export function parseLibraryEvents(
  payload: LibraryEvent[],
  now: Date = new Date(),
): ScrapedEvent[] {
  const events: ScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const item of payload) {
    if (item.public === false || item.published === false) continue;

    const title = textOf(item.title);
    const date = parseLocalTimestamp(item.start_date);
    if (!title || !date || !isPlausibleEventDate(date, now)) continue;

    const key = `${title}|${date.toISOString()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const branch = firstValue(item.branch);
    const description =
      textOf(item.description) || textOf(item.program_description) || title;

    events.push({
      title,
      description,
      date,
      location: "Des Moines, IA",
      // program_type is the library's own label — "Storytime", "Book Club" —
      // and is a better starting point than a blanket category.
      category: firstValue(item.program_type) ?? "Community",
      sourceUrl: item.url ?? FEED_URL,
      venue: branch ?? "Des Moines Public Library",
      isFree: freeUnlessPriced(title, description),
      neighborhoodSlug: branch ? BRANCH_NEIGHBORHOODS[branch] : undefined,
    });
  }

  return events;
}

export const desMoinesLibrary: EventSource = {
  name: "Des Moines Public Library",
  defaultCategory: "Community",
  venueSlug: "des-moines-central-library",
  async scrape() {
    return parseLibraryEvents(await fetchJson<LibraryEvent[]>(FEED_URL, 40_000));
  },
};
