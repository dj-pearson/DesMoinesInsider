import { scrapeTribeCalendar } from "./tribe.js";
import type { EventSource } from "./types.js";

/**
 * Historic Valley Junction — the Thursday farmers market, the summer concert
 * series, and the district's own events. West Des Moines' main street runs its
 * own calendar, separate from the city's.
 */
export const valleyJunction: EventSource = {
  name: "Historic Valley Junction",
  defaultCategory: "Community",
  venueSlug: "historic-valley-junction",
  scrape: () =>
    scrapeTribeCalendar({
      origin: "https://valleyjunction.com",
      venueName: "Historic Valley Junction",
      location: "West Des Moines, IA",
      category: "Community",
      neighborhoodSlug: "valley-junction",
      freeByDefault: true,
    }),
};
