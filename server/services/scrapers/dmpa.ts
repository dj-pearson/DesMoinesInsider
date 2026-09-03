import { absoluteUrl, fetchHtml } from "./http.js";
import { isPlausibleEventDate, parseEventDate } from "./dates.js";
import { elementsByClass, firstHref, firstImage, textByClass } from "./html.js";
import { SOURCE_PRIORITY } from "./types.js";
import type { EventSource, ScrapedEvent } from "./types.js";

/**
 * Des Moines Performing Arts — the Civic Center, the Temple for Performing
 * Arts, the Stoner Theater, and the free programming on Cowles Commons.
 *
 * DMPA is one organisation across several rooms, so it is one source here; the
 * venue on each event is what separates a Broadway touring show at the Civic
 * Center from a lunchtime concert on the Commons. The venue name is carried
 * through verbatim because the venue seed has curated parking notes for each of
 * them, and those notes differ sharply — the Civic Center has no lot of its own.
 *
 * Their listing page renders server-side, so no browser is needed. Dates come
 * in AP style ("Wednesday, Sept. 9 · 10 a.m."), which is exactly what
 * `parseEventDate` is for.
 */

const LISTING_URL = "https://www.desmoinesperformingarts.org/whats-on";

export function parseDmpaEvents(html: string, now: Date = new Date()): ScrapedEvent[] {
  const events: ScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const item of elementsByClass(html, "event-item")) {
    const title = textByClass(item, "event-item__title");
    const dateText = textByClass(item, "event-item__date");
    if (!title || !dateText) continue;

    const parsed = parseEventDate(dateText, now);
    if (!parsed || !isPlausibleEventDate(parsed.date, now)) continue;

    const sourceUrl = absoluteUrl(firstHref(item), LISTING_URL) ?? LISTING_URL;
    // The same show appears in both the scroller and the grid on this page.
    const key = `${title}|${parsed.date.toISOString()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const venue = textByClass(item, "event-item__venue");
    const suffix = textByClass(item, "event-item__suffix");

    events.push({
      title,
      // The listing gives no blurb; the suffix ("On Cowles Commons") is the
      // only extra context, and the enhancer fills in the rest from the page.
      description: suffix || title,
      date: parsed.date,
      location: "Des Moines, IA",
      category: "Arts",
      sourceUrl,
      imageUrl: absoluteUrl(firstImage(item), LISTING_URL),
      venue: venue || "Des Moines Civic Center",
    });
  }

  return events;
}

export const desMoinesPerformingArts: EventSource = {
  name: "Des Moines Performing Arts",
  defaultCategory: "Arts",
  venueSlug: "des-moines-civic-center",
  sourcePriority: SOURCE_PRIORITY.DIRECT_VENUE,
  async scrape() {
    return parseDmpaEvents(await fetchHtml(LISTING_URL, 30_000));
  },
};
