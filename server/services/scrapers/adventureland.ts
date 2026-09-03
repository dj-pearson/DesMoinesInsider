import { fetchHtml } from "./http.js";
import { parseJsonLdEvents } from "./jsonld.js";
import { isPlausibleEventDate, parseEventDate } from "./dates.js";
import { elementsByClass, firstHref, firstImage, headingText, textOf } from "./html.js";
import { absoluteUrl } from "./http.js";
import type { EventSource, ScrapedEvent } from "./types.js";

/**
 * Adventureland's event calendar — the seasonal weekends that are the reason to
 * drive to Altoona on a specific date rather than any date: Phantom Fall Fest,
 * Bike Nights, the season opener.
 *
 * Structured data first, then the card markup. The park sits behind a CDN that
 * refuses plain HTTP clients from some networks, so a failure here is often the
 * network rather than the parser; the run record keeps the two distinguishable
 * by storing the error.
 */

const LISTING_URL = "https://www.adventurelandresort.com/events";

export function parseAdventurelandEvents(html: string, now: Date = new Date()): ScrapedEvent[] {
  const structured = parseJsonLdEvents(
    html,
    {
      venueName: "Adventureland",
      location: "Altoona, IA",
      category: "Family",
      pageUrl: LISTING_URL,
    },
    now,
  );
  if (structured.length > 0) return structured;

  const events: ScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const card of [...elementsByClass(html, "event"), ...elementsByClass(html, "event-card")]) {
    const title = headingText(card);
    if (!title) continue;

    const parsed = parseEventDate(textOf(card), now);
    if (!parsed || !isPlausibleEventDate(parsed.date, now)) continue;

    const key = `${title}|${parsed.date.toISOString()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    events.push({
      title,
      description: title,
      date: parsed.date,
      location: "Altoona, IA",
      category: "Family",
      sourceUrl: absoluteUrl(firstHref(card), LISTING_URL) ?? LISTING_URL,
      imageUrl: absoluteUrl(firstImage(card), LISTING_URL),
      venue: "Adventureland",
    });
  }

  return events;
}

export const adventureland: EventSource = {
  name: "Adventureland",
  defaultCategory: "Family",
  venueSlug: "adventureland",
  async scrape() {
    return parseAdventurelandEvents(await fetchHtml(LISTING_URL, 30_000));
  },
};
