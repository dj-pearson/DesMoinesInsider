import { fetchHtml, fetchJson } from "./http.js";
import { isPlausibleEventDate, parseLocalTimestamp } from "./dates.js";
import { textOf } from "./html.js";
import { SOURCE_PRIORITY } from "./types.js";
import type { EventSource, ScrapedEvent } from "./types.js";

/**
 * Blank Park Zoo.
 *
 * The zoo's calendar is a SiteWrench widget that renders in the browser, so
 * there is nothing to read in the page HTML. Rather than run a headless browser
 * to watch it fetch its own data, this calls the same endpoint the widget calls.
 *
 * The widget's site id, calendar id and API token are printed into the page in
 * its `swCalendarV2.init({...})` call, so they are read from there on each run
 * instead of being hardcoded. That matters: the token is a per-site value the
 * zoo can rotate, and a hardcoded copy would fail silently the day they do.
 */

const EVENTS_PAGE = "https://www.blankparkzoo.com/events/";

interface SiteWrenchEvent {
  Subject?: string;
  Description?: string;
  StartDateTimeInTimeZone?: string;
  Location?: string;
  LocationName?: string;
  DetailUrl?: string;
  Url?: string;
}

interface WidgetConfig {
  apiUrl: string;
  apiToken: string;
  siteId: string;
  pagePartId: string;
}

/** Read the widget's own configuration out of the page that embeds it. */
export function parseWidgetConfig(html: string): WidgetConfig | null {
  const init = /swCalendarV2\.init\(\{([\s\S]{0,1200}?)\}\)/.exec(html)?.[1];
  if (!init) return null;

  const value = (key: string): string | undefined =>
    new RegExp(`${key}\\s*:\\s*['"]?([^'",\\s}]+)`, "i").exec(init)?.[1];

  const apiUrl = value("apiUrl");
  const apiToken = value("apiToken");
  const siteId = value("siteId");
  const pagePartId = value("pagePartId");
  if (!apiUrl || !apiToken || !siteId || !pagePartId) return null;

  return { apiUrl: apiUrl.replace(/\/$/, ""), apiToken, siteId, pagePartId };
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export const blankParkZoo: EventSource = {
  name: "Blank Park Zoo",
  defaultCategory: "Family",
  venueSlug: "blank-park-zoo",
  sourcePriority: SOURCE_PRIORITY.DIRECT_VENUE,
  async scrape(): Promise<ScrapedEvent[]> {
    const now = new Date();
    const config = parseWidgetConfig(await fetchHtml(EVENTS_PAGE));
    if (!config) {
      throw new Error("Could not find the calendar widget configuration on the zoo events page");
    }

    const end = new Date(now.getTime() + 120 * 24 * 60 * 60 * 1000);
    const url =
      `${config.apiUrl}/pageparts/calendars/${config.pagePartId}/events` +
      `?token=${encodeURIComponent(config.apiToken)}&siteid=${encodeURIComponent(config.siteId)}` +
      `&start=${isoDay(now)}&end=${isoDay(end)}`;

    const payload = await fetchJson<SiteWrenchEvent[]>(url, 30_000);
    const events: ScrapedEvent[] = [];
    const seen = new Set<string>();

    for (const item of payload) {
      const title = textOf(item.Subject);
      // The API gives both a UTC field and a wall-clock one; the wall-clock
      // field plus the zone is the pair that survives a daylight-saving change.
      const date = parseLocalTimestamp(item.StartDateTimeInTimeZone);
      if (!title || !date || !isPlausibleEventDate(date, now)) continue;

      // Zoo hours and daily keeper talks repeat every single day. Keeping one
      // row per title stops a hundred identical "Kids Kingdom" entries from
      // burying the events people are actually looking for.
      if (seen.has(title)) continue;
      seen.add(title);

      events.push({
        title,
        description: textOf(item.Description) || title,
        date,
        location: "Des Moines, IA",
        category: "Family",
        sourceUrl: item.DetailUrl ?? item.Url ?? EVENTS_PAGE,
        venue: item.LocationName?.trim() || "Blank Park Zoo",
      });
    }

    return events;
  },
};
