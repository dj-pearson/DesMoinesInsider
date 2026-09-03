import { scrapeTribeCalendar } from "./tribe.js";
import { SOURCE_PRIORITY } from "./types.js";
import type { EventSource } from "./types.js";

export const artCenter: EventSource = {
  name: "Des Moines Art Center",
  defaultCategory: "Arts",
  venueSlug: "des-moines-art-center",
  sourcePriority: SOURCE_PRIORITY.DIRECT_VENUE,
  scrape: () =>
    scrapeTribeCalendar({
      origin: "https://www.desmoinesartcenter.org",
      venueName: "Des Moines Art Center",
      location: "Des Moines, IA",
      category: "Arts",
    }),
};
