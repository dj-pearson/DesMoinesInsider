import { scrapeTribeCalendar } from "./tribe.js";
import type { EventSource } from "./types.js";

export const livingHistoryFarms: EventSource = {
  name: "Living History Farms",
  defaultCategory: "Family",
  venueSlug: "living-history-farms",
  scrape: () =>
    scrapeTribeCalendar({
      origin: "https://www.lhf.org",
      venueName: "Living History Farms",
      location: "Urbandale, IA",
      category: "Family",
    }),
};
