import { fetchHtml } from "./http.js";
import { parseJsonLdEvents } from "./jsonld.js";
import { parseSeeTicketsEvents } from "./seetickets.js";
import { SOURCE_PRIORITY } from "./types.js";
import type { EventSource, ScrapedEvent } from "./types.js";

/**
 * Wooly's, the East Village music hall.
 *
 * Two readers, tried in order, because independent rooms change ticketing
 * platforms every few years and the markup goes with them:
 *
 *  1. schema.org Event data, which every ticketing platform emits for Google;
 *  2. the See Tickets listing widget, which is what most rooms this size embed.
 *
 * Whichever finds events wins. If neither does, this throws rather than
 * returning an empty list, so the run records a failure and someone looks —
 * silently returning nothing is how a dead scraper survives for months.
 */

const LISTING_URL = "https://woolysdsm.com/";

export function parseWoolysEvents(html: string, now: Date = new Date()): ScrapedEvent[] {
  const structured = parseJsonLdEvents(
    html,
    {
      venueName: "Wooly's",
      location: "Des Moines, IA",
      category: "Music",
      pageUrl: LISTING_URL,
    },
    now,
  );
  if (structured.length > 0) return structured;

  return parseSeeTicketsEvents(
    html,
    {
      listingUrl: LISTING_URL,
      venueName: "Wooly's",
      location: "Des Moines, IA",
      category: "Music",
    },
    now,
  );
}

export const woolys: EventSource = {
  name: "Wooly's",
  defaultCategory: "Music",
  venueSlug: "woolys",
  sourcePriority: SOURCE_PRIORITY.DIRECT_VENUE,
  async scrape() {
    const events = parseWoolysEvents(await fetchHtml(LISTING_URL, 30_000));
    if (events.length === 0) {
      throw new Error("Wooly's listing page had no readable events; the page shape may have changed");
    }
    return events;
  },
};
