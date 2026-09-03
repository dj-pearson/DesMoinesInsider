import { fetchHtml } from "./http.js";
import { isPlausibleEventDate, parseEventDate, parseTimeOfDay } from "./dates.js";
import { elementsByClass, headingText, textByClass, textOf } from "./html.js";
import { getZonedParts, zonedTimeToUtc } from "@shared/weekend.js";
import { SOURCE_PRIORITY } from "./types.js";
import type { EventSource, ScrapedEvent } from "./types.js";

/**
 * Science Center of Iowa.
 *
 * Their calendar is a day view: one heading gives the date, and the events
 * under it carry only a start time. So the parser walks the page in order,
 * holding the most recent date heading and applying it to the events that
 * follow — reading each block on its own would lose the date entirely.
 *
 * The page's range selector is applied in the browser, not on the server, so
 * the response is always the current day however it is asked — the week view is
 * not reachable over plain HTTP. That is fine for a source scraped daily: each
 * run picks up that day's programming, and the museum's schedule is published
 * far enough ahead that nothing is missed.
 */

const CALENDAR_URL = "https://www.sciowa.org/programs-and-events/event-calendar/";

/** Split the page at each date heading so events keep the date above them. */
function sectionsByDate(html: string): Array<{ dateText: string; body: string }> {
  const sections: Array<{ dateText: string; body: string }> = [];
  const headingPattern = /<div class="form-filters">([\s\S]*?)<\/div>/gi;
  const matches: RegExpExecArray[] = [];
  for (let match = headingPattern.exec(html); match; match = headingPattern.exec(html)) {
    matches.push(match);
  }

  for (let index = 0; index < matches.length; index += 1) {
    const start = matches[index].index + matches[index][0].length;
    const end = index + 1 < matches.length ? matches[index + 1].index : html.length;
    sections.push({ dateText: textOf(matches[index][1]), body: html.slice(start, end) });
  }

  return sections;
}

export function parseScienceCenterEvents(html: string, now: Date = new Date()): ScrapedEvent[] {
  const events: ScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const section of sectionsByDate(html)) {
    const day = parseEventDate(section.dateText, now);
    if (!day) continue;
    const parts = getZonedParts(day.date);

    for (const item of elementsByClass(section.body, "event")) {
      const title = headingText(item) || textByClass(item, "title");
      if (!title) continue;

      // Times sit on the event, the date on the heading, so they are combined
      // here rather than parsed from one string.
      const time = parseTimeOfDay(textByClass(item, "time"));
      const date = time
        ? zonedTimeToUtc(parts.year, parts.month, parts.day, time.hour, time.minute)
        : day.date;
      if (!isPlausibleEventDate(date, now)) continue;

      const key = `${title}|${date.toISOString()}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const location = textByClass(item, "location");

      events.push({
        title,
        description: textByClass(item, "mce-content") || title,
        date,
        location: "Des Moines, IA",
        category: "Family",
        sourceUrl: CALENDAR_URL,
        venue: location ? `Science Center of Iowa — ${location}` : "Science Center of Iowa",
      });
    }
  }

  return events;
}

export const scienceCenter: EventSource = {
  name: "Science Center of Iowa",
  defaultCategory: "Family",
  venueSlug: "science-center-of-iowa",
  sourcePriority: SOURCE_PRIORITY.DIRECT_VENUE,
  async scrape() {
    return parseScienceCenterEvents(await fetchHtml(CALENDAR_URL));
  },
};
