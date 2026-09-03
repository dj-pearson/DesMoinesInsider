import { absoluteUrl, fetchHtml } from "./http.js";
import { isPlausibleEventDate, parseEventDate } from "./dates.js";
import { elementsByClass, firstHref, firstImage, headingText, textOf } from "./html.js";
import { freeUnlessPriced } from "./civic.js";
import type { EventSource, ScrapedEvent } from "./types.js";

/**
 * Polk County Conservation — Jester Park and the county's other parks.
 *
 * Naturalist programmes, night hikes, the nature centre's toddler sessions and
 * the equestrian centre. Almost all of it is free or a few dollars, and it is
 * the closest thing the metro has to a public outdoors calendar.
 *
 * The page ships a "load more" endpoint that returns the same card markup, so
 * this asks that endpoint for a large page directly instead of scraping the
 * first twelve and stopping.
 */

const ORIGIN = "https://www.polkcountyiowa.gov";
const LISTING_URL = `${ORIGIN}/conservation/events/`;
/** The site's own load-more endpoint, asked for a season at a time. */
const FEED_URL = `${ORIGIN}/umbraco/surface/events/GetEventItems?siteRootNodeId=13408&take=100`;

export function parsePolkEvents(html: string, now: Date = new Date()): ScrapedEvent[] {
  const events: ScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const card of elementsByClass(html, "event-card")) {
    const title = headingText(card);
    if (!title) continue;

    // The date sits in its own bold span; the surrounding text also holds the
    // park name, so the date is read from the narrower element first.
    const dateText = textOf(elementsByClass(card, "font-weight-bold")[0]) || textOf(card);
    const parsed = parseEventDate(dateText, now);
    if (!parsed || !isPlausibleEventDate(parsed.date, now)) continue;

    const href = absoluteUrl(firstHref(card), LISTING_URL);
    const key = href ?? `${title}|${parsed.date.toISOString()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    // The park sits in the paragraph introduced by a map-pin icon, with no
    // class of its own, so it is read from the icon rather than guessed out of
    // the card text — which starts with the title and the date.
    const park = textOf(
      /fa-map-marker-alt[^>]*>\s*<\/span>([\s\S]*?)<\/p>/i.exec(card)?.[1],
    );

    events.push({
      title,
      description: title,
      date: parsed.date,
      location: "Polk County, IA",
      category: "Outdoors",
      sourceUrl: href ?? LISTING_URL,
      imageUrl: absoluteUrl(firstImage(card), LISTING_URL),
      venue: park || "Polk County Conservation",
      isFree: freeUnlessPriced(title, textOf(card)),
    });
  }

  return events;
}

export const polkCountyConservation: EventSource = {
  name: "Polk County Conservation",
  defaultCategory: "Outdoors",
  venueSlug: null,
  async scrape() {
    return parsePolkEvents(await fetchHtml(FEED_URL, 40_000));
  },
};
