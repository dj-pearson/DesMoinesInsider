import { absoluteUrl, fetchHtml } from "./http.js";
import { parseIcal } from "./ical.js";
import { isPlausibleEventDate } from "./dates.js";
import { decodeEntities, textOf } from "./html.js";
import { freeUnlessPriced, isAdministrativeEvent } from "./civic.js";
import { SOURCE_PRIORITY } from "./types.js";
import type { EventSource, ScrapedEvent } from "./types.js";

/**
 * Adapter for CivicPlus, the platform most Des Moines suburbs run their city
 * site on.
 *
 * Every install publishes real iCalendar feeds and lists them, with labels, at
 * /iCalendar.aspx. So rather than hardcoding the numeric category ids — which
 * differ per city and change when a city adds a calendar — this reads that
 * page and subscribes to what it finds. Adding a suburb is then a name, a host
 * and a neighborhood slug.
 *
 * Feeds whose own label is administrative ("Meetings - City Council") are
 * skipped before they are fetched, which is the cheap half of the filtering;
 * the rest is done per event, because the "all city events" feed every city
 * publishes mixes agendas in with the concerts.
 */

export interface CivicPlusConfig {
  /** Site origin, e.g. "https://www.ankenyiowa.gov". */
  origin: string;
  cityName: string;
  /** Slug from the neighborhood seed. The city knows where it is. */
  neighborhoodSlug: string;
  location: string;
}

/** Cap on how many feeds one city can cost us in a run. */
const MAX_FEEDS = 6;

interface FeedLink {
  url: string;
  label: string;
}

/** Read the feed directory at /iCalendar.aspx. */
export function parseFeedDirectory(html: string, origin: string): FeedLink[] {
  const pattern =
    /<a\b[^>]*href\s*=\s*["']([^"']*iCalendar\.aspx\?catID=\d+[^"']*)["'][^>]*>([\s\S]{0,200}?)<\/a>/gi;
  const feeds: FeedLink[] = [];
  const seen = new Set<string>();

  for (let match = pattern.exec(html); match; match = pattern.exec(html)) {
    const url = absoluteUrl(decodeEntities(match[1]), origin);
    const label = textOf(match[2]);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    feeds.push({ url, label });
  }

  return feeds;
}

/**
 * Pick which feeds to actually fetch.
 *
 * A feed labelled "All ..." already contains everything, so when one exists it
 * is used alone and the per-event filter sorts out the agendas. Otherwise take
 * the non-administrative feeds up to the cap.
 */
export function selectFeeds(feeds: FeedLink[]): FeedLink[] {
  const everything = feeds.find((feed) => /^all\b/i.test(feed.label));
  if (everything) return [everything];

  return feeds.filter((feed) => !isAdministrativeEvent(feed.label)).slice(0, MAX_FEEDS);
}

export function icalToEvents(
  ics: string,
  config: CivicPlusConfig,
  now: Date = new Date(),
): ScrapedEvent[] {
  const events: ScrapedEvent[] = [];

  for (const entry of parseIcal(ics)) {
    const title = entry.summary ?? "";
    if (!title || isAdministrativeEvent(title)) continue;
    if (!isPlausibleEventDate(entry.start, now)) continue;

    const description = textOf(entry.description) || title;
    // CivicPlus pastes rich text into LOCATION, so the raw value arrives as
    // "<p>Terra Park</p> - 6300 NW 62nd Ave". Strip it to something readable.
    const place = textOf(entry.location).replace(/^[\s-]+|[\s-]+$/g, "");

    events.push({
      title,
      description,
      date: entry.start,
      location: place || config.location,
      category: "Community",
      sourceUrl: entry.url || `${config.origin}/calendar.aspx`,
      venue: place || config.cityName,
      isFree: freeUnlessPriced(title, description),
      neighborhoodSlug: config.neighborhoodSlug,
    });
  }

  return events;
}

export function createCivicPlusSource(config: CivicPlusConfig): EventSource {
  return {
    name: config.cityName,
    defaultCategory: "Community",
    // A city calendar spans parks, libraries and main street, not one venue.
    venueSlug: null,
    sourcePriority: SOURCE_PRIORITY.CIVIC,
    async scrape(): Promise<ScrapedEvent[]> {
      const now = new Date();
      const directory = await fetchHtml(`${config.origin}/iCalendar.aspx`, 30_000);
      const feeds = selectFeeds(parseFeedDirectory(directory, config.origin));
      if (feeds.length === 0) {
        throw new Error(`No calendar feeds listed at ${config.origin}/iCalendar.aspx`);
      }

      const events: ScrapedEvent[] = [];
      const seen = new Set<string>();

      for (const feed of feeds) {
        // One bad feed out of six should not cost the other five.
        try {
          for (const event of icalToEvents(await fetchHtml(feed.url, 30_000), config, now)) {
            const key = `${event.title}|${event.date.toISOString()}`;
            if (seen.has(key)) continue;
            seen.add(key);
            events.push(event);
          }
        } catch (error) {
          console.warn(
            `[scrapers] ${config.cityName}: feed "${feed.label}" failed:`,
            error instanceof Error ? error.message : error,
          );
        }
      }

      return events;
    },
  };
}
