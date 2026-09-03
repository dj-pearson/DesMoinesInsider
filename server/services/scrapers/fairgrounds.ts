import { absoluteUrl, fetchHtml } from "./http.js";
import { isPlausibleEventDate, parseEventDate } from "./dates.js";
import { elementsByClass, firstHref, headingText, textOf } from "./html.js";
import { SOURCE_PRIORITY } from "./types.js";
import type { EventSource, ScrapedEvent } from "./types.js";

/**
 * The Iowa State Fairgrounds year-round calendar.
 *
 * Worth having as its own source: outside of fair week the grounds run horse
 * sales, dog shows, gun shows, and swap meets almost every weekend, and none of
 * that appears on the fair's own site. This is the calendar residents actually
 * need, and it is the one nobody aggregates.
 *
 * Each row reads "Sep 04 - Sep 06, 2026 | Building name". The year sits at the
 * end of the range, so the whole string is handed to the date parser, which
 * takes the first date it finds and picks up the year from later in the text.
 */

const CALENDAR_URL = "https://www.iowastatefairgrounds.org/event-calendar";

export function parseFairgroundsEvents(html: string, now: Date = new Date()): ScrapedEvent[] {
  const events: ScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const row of elementsByClass(html, "event")) {
    const title = headingText(row);
    if (!title) continue;

    // The <p> above the heading holds "dates | buildings".
    const meta = textOf(/<p\b[^>]*>([\s\S]*?)<\/p>/i.exec(row)?.[1]);
    const parsed = parseEventDate(meta, now);
    if (!parsed || !isPlausibleEventDate(parsed.date, now)) continue;

    const key = `${title}|${parsed.date.toISOString()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    // Everything after the pipe is the building, which is the useful half of
    // the line for anyone trying to find the right gate.
    const building = meta.split("|").slice(1).join(" ").replace(/\s*,\s*$/, "").trim();

    events.push({
      title,
      description: building ? `${title} at the Iowa State Fairgrounds, ${building}.` : title,
      date: parsed.date,
      location: "Des Moines, IA",
      category: "Community",
      sourceUrl: absoluteUrl(firstHref(row), CALENDAR_URL) ?? CALENDAR_URL,
      venue: building ? `Iowa State Fairgrounds — ${building}` : "Iowa State Fairgrounds",
    });
  }

  return events;
}

export const iowaStateFairgrounds: EventSource = {
  name: "Iowa State Fairgrounds",
  defaultCategory: "Community",
  venueSlug: "iowa-state-fairgrounds",
  sourcePriority: SOURCE_PRIORITY.DIRECT_VENUE,
  async scrape() {
    return parseFairgroundsEvents(await fetchHtml(CALENDAR_URL));
  },
};
