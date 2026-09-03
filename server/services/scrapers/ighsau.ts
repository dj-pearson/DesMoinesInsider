import { fetchHtml } from "./http.js";
import { isPlausibleEventDate } from "./dates.js";
import { attrOf, elementsByClass, textOf } from "./html.js";
import { toStateTournamentEvent } from "./stateTournaments.js";
import { zonedTimeToUtc, getZonedParts } from "@shared/weekend.js";
import { SOURCE_PRIORITY } from "./types.js";
import type { EventSource, ScrapedEvent } from "./types.js";

/**
 * Iowa Girls High School Athletic Union — the state tournament schedule.
 *
 * Their calendar is a month grid: each day cell carries its number, and the
 * events inside it carry only a title. The month and year come from the URL we
 * asked for, so the parser is told which month it is reading rather than trying
 * to infer it from the page.
 *
 * Only state tournaments held in Des Moines survive; see stateTournaments.ts
 * for why regionals and out-of-town finals are dropped.
 */

const ORIGIN = "https://ighsau.org";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** How many months ahead to read. A tournament season is announced well early. */
const MONTHS_AHEAD = 9;

export function parseMonthGrid(
  html: string,
  year: number,
  month: number,
  now: Date = new Date(),
): ScrapedEvent[] {
  const events: ScrapedEvent[] = [];

  for (const cell of elementsByClass(html, "day-cell")) {
    const dayText = textOf(elementsByClass(cell, "day-number")[0]);
    const day = Number(dayText);
    if (!Number.isInteger(day) || day < 1 || day > 31) continue;

    for (const item of elementsByClass(cell, "event-item")) {
      // The full title is on the element's title attribute; the visible span is
      // sometimes truncated with an ellipsis.
      const title = attrOf(item, "title") || textOf(elementsByClass(item, "event-title")[0]);
      if (!title) continue;

      const date = zonedTimeToUtc(year, month, day, 12);
      if (!isPlausibleEventDate(date, now)) continue;

      const event = toStateTournamentEvent(title, date, {
        organization: "Iowa Girls High School Athletic Union",
        sourceUrl: `${ORIGIN}/calendar?month=${MONTH_NAMES[month - 1]}&year=${year}`,
      });
      if (event) events.push(event);
    }
  }

  return events;
}

export const ighsau: EventSource = {
  name: "Iowa Girls High School Athletic Union",
  defaultCategory: "High School Sports",
  venueSlug: "wells-fargo-arena",
  sourcePriority: SOURCE_PRIORITY.GOVERNING_BODY,
  async scrape(): Promise<ScrapedEvent[]> {
    const now = new Date();
    const start = getZonedParts(now);
    const events: ScrapedEvent[] = [];
    const seen = new Set<string>();

    for (let offset = 0; offset < MONTHS_AHEAD; offset += 1) {
      const month = ((start.month - 1 + offset) % 12) + 1;
      const year = start.year + Math.floor((start.month - 1 + offset) / 12);
      const url = `${ORIGIN}/calendar?month=${MONTH_NAMES[month - 1]}&year=${year}`;

      try {
        for (const event of parseMonthGrid(await fetchHtml(url, 30_000), year, month, now)) {
          // A tournament spans several days and appears in every one of them;
          // one row per tournament per day is right, duplicates are not.
          const key = `${event.title}|${event.date.toISOString()}`;
          if (seen.has(key)) continue;
          seen.add(key);
          events.push(event);
        }
      } catch (error) {
        // One month failing should not lose the rest of the season.
        console.warn(
          `[scrapers] IGHSAU ${MONTH_NAMES[month - 1]} ${year} failed:`,
          error instanceof Error ? error.message : error,
        );
      }
    }

    return events;
  },
};
