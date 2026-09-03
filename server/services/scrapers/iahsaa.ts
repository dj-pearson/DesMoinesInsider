import { fetchHtml } from "./http.js";
import { isPlausibleEventDate, parseEventDate } from "./dates.js";
import { elementsByClass, headingText, textOf } from "./html.js";
import { toStateTournamentEvent } from "./stateTournaments.js";
import { SOURCE_PRIORITY } from "./types.js";
import type { EventSource, ScrapedEvent } from "./types.js";

/**
 * Iowa High School Athletic Association — the boys' state tournament schedule.
 *
 * State basketball and wrestling fill Wells Fargo Arena for a week each, state
 * baseball is at Principal Park, and the state track meet is at Drake Stadium.
 * For a week in March, high school basketball is the biggest thing happening
 * downtown, and no visitor calendar carries it.
 *
 * The association's site sits behind a bot challenge that refuses automated
 * clients outright, so this reads whatever it is served: their events calendar
 * markup first, then any dated headings on the state tournament pages. The
 * tournament filter in stateTournaments.ts decides what is publishable, so a
 * change in their markup produces fewer events rather than wrong ones.
 */

const ORIGIN = "https://www.iahsaa.org";
const CALENDAR_URL = `${ORIGIN}/calendar/`;

export function parseIahsaaEvents(html: string, now: Date = new Date()): ScrapedEvent[] {
  const events: ScrapedEvent[] = [];
  const seen = new Set<string>();

  const blocks = [
    ...elementsByClass(html, "tribe-events-calendar-list__event"),
    ...elementsByClass(html, "event-item"),
    ...elementsByClass(html, "event"),
  ];

  for (const block of blocks) {
    const title = headingText(block) || textOf(elementsByClass(block, "event-title")[0]);
    if (!title) continue;

    const parsed = parseEventDate(textOf(block), now);
    if (!parsed || !isPlausibleEventDate(parsed.date, now)) continue;

    const event = toStateTournamentEvent(title, parsed.date, {
      organization: "Iowa High School Athletic Association",
      sourceUrl: CALENDAR_URL,
    });
    if (!event) continue;

    const key = `${event.title}|${event.date.toISOString()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    events.push(event);
  }

  return events;
}

export const iahsaa: EventSource = {
  name: "Iowa High School Athletic Association",
  defaultCategory: "High School Sports",
  venueSlug: "wells-fargo-arena",
  sourcePriority: SOURCE_PRIORITY.GOVERNING_BODY,
  async scrape() {
    return parseIahsaaEvents(await fetchHtml(CALENDAR_URL, 30_000));
  },
};
