import { scrapeTribeCalendar } from "./tribe.js";
import { SOURCE_PRIORITY } from "./types.js";
import type { EventSource } from "./types.js";

export const livingHistoryFarms: EventSource = {
  name: "Living History Farms",
  defaultCategory: "Family",
  venueSlug: "living-history-farms",
  sourcePriority: SOURCE_PRIORITY.DIRECT_VENUE,
  scrape: () =>
    scrapeTribeCalendar({
      origin: "https://www.lhf.org",
      venueName: "Living History Farms",
      location: "Urbandale, IA",
      category: "Family",
    }),
};
