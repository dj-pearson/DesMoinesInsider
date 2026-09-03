import { fetchHtml } from "./http.js";
import { parseSeeTicketsEvents } from "./seetickets.js";
import { SOURCE_PRIORITY } from "./types.js";
import type { EventSource } from "./types.js";

/**
 * xBk Live, the listening room on Forest Avenue.
 *
 * Exactly the sort of venue a tourism calendar misses and a resident calendar
 * should not: 200 capacity, touring indie acts, four or five nights a week.
 */

const LISTING_URL = "https://xbklive.com/";

export const xbkLive: EventSource = {
  name: "xBk Live",
  defaultCategory: "Music",
  venueSlug: "xbk-live",
  sourcePriority: SOURCE_PRIORITY.DIRECT_VENUE,
  async scrape() {
    return parseSeeTicketsEvents(await fetchHtml(LISTING_URL), {
      listingUrl: LISTING_URL,
      venueName: "xBk Live",
      location: "Des Moines, IA",
      category: "Music",
    });
  },
};
