import { scrapeTribeCalendar } from "./tribe.js";
import type { EventSource } from "./types.js";

/**
 * Water Works Park's calendar covers the whole park, and the amphitheater is
 * only part of it. Everything else in the park — trail runs, the arboretum, the
 * dog park — is a real event too, so nothing is filtered out here; the venue
 * name on each event is what decides where it shows up.
 */
export const lauridsenAmphitheater: EventSource = {
  name: "Lauridsen Amphitheater at Water Works Park",
  defaultCategory: "Music",
  venueSlug: "lauridsen-amphitheater",
  scrape: () =>
    scrapeTribeCalendar({
      origin: "https://www.dsmwaterworkspark.com",
      venueName: "Lauridsen Amphitheater at Water Works Park",
      location: "Des Moines, IA",
      category: "Music",
    }),
};
