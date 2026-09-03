import { scrapeTribeCalendar } from "./tribe.js";
import { SOURCE_PRIORITY } from "./types.js";
import type { EventSource } from "./types.js";

export const botanicalGarden: EventSource = {
  name: "Greater Des Moines Botanical Garden",
  defaultCategory: "Family",
  venueSlug: "greater-des-moines-botanical-garden",
  sourcePriority: SOURCE_PRIORITY.DIRECT_VENUE,
  scrape: () =>
    scrapeTribeCalendar({
      origin: "https://dmbotanicalgarden.com",
      venueName: "Greater Des Moines Botanical Garden",
      location: "Des Moines, IA",
      category: "Family",
    }),
};
