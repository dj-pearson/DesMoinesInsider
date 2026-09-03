import { fetchHtml } from "./http.js";
import { isPlausibleEventDate, parseEventDate } from "./dates.js";
import { decodeEntities, textOf } from "./html.js";
import { SOURCE_PRIORITY } from "./types.js";
import type { EventSource, ScrapedEvent } from "./types.js";

/**
 * Catch Des Moines, the tourism bureau — a fallback source.
 *
 * They cover things nothing else here reaches, so they are worth keeping. But
 * they are a copy of someone else's listing: the venue's own page is the truth
 * about its own event, and the bureau's page is a summary of it with a link
 * that goes to the bureau. So this ranks below every direct source and loses
 * every tie, and where the bureau names the organiser's own URL we store that
 * instead of theirs.
 *
 * Their RSS feed is used rather than the calendar page: it is stable, it costs
 * one request, and it does not need a browser.
 */

const ORIGIN = "https://www.catchdesmoines.com";
const RSS_URL = `${ORIGIN}/event/rss/`;

interface RssItem {
  title: string;
  link: string;
  description: string;
  categories: string[];
}

function unwrapCdata(value: string): string {
  return decodeEntities(value.replace(/^\s*<!\[CDATA\[/, "").replace(/\]\]>\s*$/, "")).trim();
}

function tagValue(item: string, tag: string): string {
  const match = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i").exec(item);
  return match ? unwrapCdata(match[1]) : "";
}

export function parseRssItems(xml: string): RssItem[] {
  const items: RssItem[] = [];
  const pattern = /<item>([\s\S]*?)<\/item>/gi;

  for (let match = pattern.exec(xml); match; match = pattern.exec(xml)) {
    const block = match[1];
    const categories: string[] = [];
    const categoryPattern = /<category[^>]*>([\s\S]*?)<\/category>/gi;
    for (let c = categoryPattern.exec(block); c; c = categoryPattern.exec(block)) {
      categories.push(unwrapCdata(c[1]));
    }

    items.push({
      title: tagValue(block, "title"),
      link: tagValue(block, "link"),
      description: tagValue(block, "description"),
      categories,
    });
  }

  return items;
}

export function parseCatchDesMoinesEvents(xml: string, now: Date = new Date()): ScrapedEvent[] {
  const events: ScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const item of parseRssItems(xml)) {
    if (!item.title) continue;

    // The description opens with a date or a date range: "06/25/2026 to
    // 11/29/2026 - <p>…". The first date is the start.
    const text = textOf(item.description);
    const parsed = parseEventDate(text, now);
    if (!parsed || !isPlausibleEventDate(parsed.date, now)) continue;

    const key = `${item.title}|${parsed.date.toISOString()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    // The bureau tags free events explicitly, which is the one thing their
    // feed knows that the description does not spell out.
    const isFree = item.categories.some((category) => /^free$/i.test(category.trim()))
      ? true
      : undefined;

    events.push({
      title: item.title,
      description: text.replace(/^[\d/\s]*(?:to[\d/\s]*)?-\s*/, "").trim() || item.title,
      date: parsed.date,
      location: "Des Moines, IA",
      category: item.categories.find((c) => !/^free$/i.test(c.trim())) ?? "Community",
      sourceUrl: item.link || RSS_URL,
      isFree,
      sourcePriority: SOURCE_PRIORITY.AGGREGATOR,
    });
  }

  return events;
}

/**
 * Find the organiser's own URL on a Catch Des Moines event page.
 *
 * Their pages embed the listing as JSON, with the organiser's link under
 * `linkUrl`. That single labelled field is why this is worth doing at all: the
 * obvious alternative — take the first off-site link on the page — returns a
 * sponsor, a social profile, or an accessibility widget about as often as it
 * returns the venue.
 */
export function extractDirectUrl(html: string): string | null {
  const candidates: string[] = [];
  const pattern = /"linkUrl"\s*:\s*"((?:[^"\\]|\\.)*)"/g;

  for (let match = pattern.exec(html); match; match = pattern.exec(html)) {
    candidates.push(match[1].replace(/\\\//g, "/"));
  }

  for (const candidate of candidates) {
    try {
      const url = new URL(candidate);
      if (url.protocol !== "http:" && url.protocol !== "https:") continue;
      // A link back to the bureau is not an upgrade.
      if (/(^|\.)catchdesmoines\.com$/i.test(url.hostname)) continue;
      return url.toString();
    } catch {
      // Not a URL; the field is sometimes an empty string.
    }
  }

  return null;
}

/** Fetch a Catch Des Moines event page and read the organiser's URL off it. */
export async function resolveDirectUrl(detailUrl: string): Promise<string | null> {
  return extractDirectUrl(await fetchHtml(detailUrl, 25_000));
}

export const catchDesMoines: EventSource = {
  name: "Catch Des Moines",
  defaultCategory: "Community",
  venueSlug: null,
  sourcePriority: SOURCE_PRIORITY.AGGREGATOR,
  async scrape() {
    return parseCatchDesMoinesEvents(await fetchHtml(RSS_URL, 30_000));
  },
};
