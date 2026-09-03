import { fetchHtml, fetchJson } from "./http.js";
import { isPlausibleEventDate, parseLocalTimestamp } from "./dates.js";
import { textOf } from "./html.js";
import { freeUnlessPriced, isAdministrativeEvent } from "./civic.js";
import type { EventSource, ScrapedEvent } from "./types.js";

/**
 * Adapter for the Revize CMS calendar, which both the City of Des Moines and
 * the City of Altoona run.
 *
 * The calendar renders in the browser from a JSON endpoint, so this calls the
 * endpoint directly. It needs the site's "webspace" key, which is printed into
 * the page as `RZ.webspace = '...'` — read from the page each run rather than
 * hardcoded, so a site rename does not silently produce an empty calendar.
 *
 * Usefully, every entry names the calendar it came from, so parks programming
 * can be separated from council agendas without guessing from the title.
 */

interface RevizeEvent {
  title?: string;
  primary_calendar_name?: string;
  start?: string;
  url?: string;
  location?: string;
  desc?: string;
}

export interface RevizeConfig {
  /** Site origin, e.g. "https://www.dsm.city". */
  origin: string;
  /** Page that embeds the calendar, used to read the webspace key. */
  calendarPage: string;
  sourceName: string;
  location: string;
  neighborhoodSlug?: string;
  category: string;
  /** Keep only entries whose calendar name matches; omit to keep all. */
  calendarFilter?: (calendarName: string) => boolean;
}

/** Read `RZ.webspace = 'cityofdesmoines'` out of the page. */
export function parseWebspace(html: string): string | null {
  return /RZ\.webspace\s*=\s*['"]([^'"]+)['"]/.exec(html)?.[1] ?? null;
}

export function revizeToEvents(
  payload: RevizeEvent[],
  config: RevizeConfig,
  now: Date = new Date(),
): ScrapedEvent[] {
  const events: ScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const item of payload) {
    const title = textOf(item.title);
    const calendarName = item.primary_calendar_name ?? "";
    if (!title || isAdministrativeEvent(title, calendarName)) continue;
    if (config.calendarFilter && !config.calendarFilter(calendarName)) continue;

    const date = parseLocalTimestamp(item.start);
    if (!date || !isPlausibleEventDate(date, now)) continue;

    const key = `${title}|${date.toISOString()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    // Descriptions arrive percent-encoded with HTML inside.
    let description = title;
    try {
      description = textOf(decodeURIComponent(item.desc ?? "")) || title;
    } catch {
      description = textOf(item.desc) || title;
    }

    const location = item.location?.trim();

    events.push({
      title,
      description,
      date,
      location: location || config.location,
      category: config.category,
      sourceUrl: item.url?.trim() || config.calendarPage,
      venue: location || config.sourceName,
      isFree: freeUnlessPriced(title, description),
      neighborhoodSlug: config.neighborhoodSlug,
    });
  }

  return events;
}

export function createRevizeSource(config: RevizeConfig): EventSource {
  return {
    name: config.sourceName,
    defaultCategory: config.category,
    venueSlug: null,
    async scrape(): Promise<ScrapedEvent[]> {
      const page = await fetchHtml(config.calendarPage, 30_000);
      const webspace = parseWebspace(page);
      if (!webspace) {
        throw new Error(`Could not find the Revize webspace key on ${config.calendarPage}`);
      }

      const url =
        `${config.origin}/_assets_/plugins/revizeCalendar/calendar_data_handler.php` +
        `?webspace=${encodeURIComponent(webspace)}` +
        `&relative_revize_url=//cms2.revize.com&protocol=https:`;

      return revizeToEvents(await fetchJson<RevizeEvent[]>(url, 40_000), config);
    },
  };
}
