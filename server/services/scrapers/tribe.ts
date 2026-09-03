import { fetchJson } from "./http.js";
import { isPlausibleEventDate, parseLocalTimestamp } from "./dates.js";
import { textOf } from "./html.js";
import { freeUnlessPriced } from "./civic.js";
import type { ScrapedEvent } from "./types.js";

/**
 * Adapter for "The Events Calendar", the WordPress plugin four of these venues
 * run: the Art Center, the Botanical Garden, Living History Farms, and Water
 * Works Park.
 *
 * They all expose its REST API, which hands back typed fields. That is worth
 * far more than parsing their calendar pages: no markup to break when a theme
 * changes, real start times, and the venue and cost as their own fields. One
 * adapter therefore covers a third of the sources here.
 *
 * The plugin reports `start_date` as wall-clock time in the site's own
 * timezone, with the zone named separately — so it is parsed as Des Moines
 * local time rather than handed to `new Date`, which would read it as UTC.
 */

interface TribeEvent {
  title?: string;
  description?: string;
  excerpt?: string;
  url?: string;
  start_date?: string;
  image?: { url?: string } | false;
  venue?: { venue?: string; city?: string };
  cost?: string;
}

interface TribeResponse {
  events?: TribeEvent[];
}

export interface TribeSourceConfig {
  /** Site origin, e.g. "https://dmbotanicalgarden.com". */
  origin: string;
  /** Venue name to record when the plugin does not name one. */
  venueName: string;
  location: string;
  category: string;
  /** Some sites host several venues; keep only events matching this. */
  venueFilter?: (venueName: string) => boolean;
  /** Slug from the neighborhood seed, when the source is tied to one place. */
  neighborhoodSlug?: string;
  /**
   * Treat events as free unless the listing names a cost. True for civic and
   * main-street calendars, false for a museum that charges admission.
   */
  freeByDefault?: boolean;
}

const PER_PAGE = 50;

export async function scrapeTribeCalendar(
  config: TribeSourceConfig,
  now: Date = new Date(),
): Promise<ScrapedEvent[]> {
  const url =
    `${config.origin}/wp-json/tribe/events/v1/events` +
    `?per_page=${PER_PAGE}&status=publish&start_date=${isoDay(now)}`;

  const payload = await fetchJson<TribeResponse>(url);
  const events: ScrapedEvent[] = [];

  for (const item of payload.events ?? []) {
    const title = textOf(item.title);
    const date = parseLocalTimestamp(item.start_date);
    if (!title || !date || !isPlausibleEventDate(date, now)) continue;

    const venueName = item.venue?.venue ?? config.venueName;
    if (config.venueFilter && !config.venueFilter(venueName)) continue;

    // The plugin returns HTML in both description fields; the excerpt is the
    // short one, so prefer it and fall back to the full body.
    const description = textOf(item.excerpt) || textOf(item.description) || title;

    events.push({
      title,
      description,
      date,
      location: item.venue?.city ? `${item.venue.city}, IA` : config.location,
      category: config.category,
      sourceUrl: item.url ?? config.origin,
      imageUrl: typeof item.image === "object" && item.image ? item.image.url : undefined,
      venue: venueName,
      price: item.cost?.trim() || undefined,
      isFree: config.freeByDefault
        ? freeUnlessPriced(title, description, item.cost ?? undefined)
        : undefined,
      neighborhoodSlug: config.neighborhoodSlug,
    });
  }

  return events;
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}
