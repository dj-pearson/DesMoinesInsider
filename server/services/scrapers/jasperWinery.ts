import { fetchHtml } from "./http.js";
import { isPlausibleEventDate, parseEventDate } from "./dates.js";
import { decodeEntities } from "./html.js";
import { zonedTimeToUtc } from "@shared/weekend.js";
import { getZonedParts } from "@shared/weekend.js";
import type { EventSource, ScrapedEvent } from "./types.js";

/**
 * Jasper Winery's Thursday summer concert series.
 *
 * The site is a Wix build with no event app and no structured data, but the
 * series page links to one sub-page per concert and labels each link with the
 * date and the act — "June 25- The Pork Tornadoes (with Zachary Freedom)".
 * That label is the listing, so it is what gets parsed.
 *
 * The series runs May to early August, so this correctly returns nothing for
 * most of the year: out-of-season concerts are last year's, and the date filter
 * drops them. An empty result here in October is the scraper working.
 */

const SERIES_URL = "https://www.jasperwinery.com/summer-concert-series";

/** Doors are at 6, music at 6:30, every week of the series. */
const SHOW_HOUR = 18;
const SHOW_MINUTE = 30;

export function parseJasperEvents(html: string, now: Date = new Date()): ScrapedEvent[] {
  const linkPattern = new RegExp(
    `<a\\s+href="(${SERIES_URL.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}/[a-z0-9-]+)"[^>]*>([\\s\\S]*?)</a>`,
    "gi",
  );

  const events: ScrapedEvent[] = [];
  const seen = new Set<string>();

  for (let match = linkPattern.exec(html); match; match = linkPattern.exec(html)) {
    const url = match[1];
    const label = decodeEntities(match[2].replace(/<[^>]+>/g, " "))
      .replace(/\s+/g, " ")
      .trim();
    if (!label) continue;

    const parsed = parseEventDate(label, now);
    if (!parsed) continue;

    // Give every concert the series start time rather than the parser's noon
    // default; these are always Thursday evenings.
    const parts = getZonedParts(parsed.date);
    const date = zonedTimeToUtc(parts.year, parts.month, parts.day, SHOW_HOUR, SHOW_MINUTE);
    if (!isPlausibleEventDate(date, now)) continue;

    // The labels carry no year, so "May 7" read in September would otherwise be
    // rolled forward to next May and announce an act that has not been booked.
    // Only this year's dates are real; out of season the right answer is none.
    if (parts.year !== getZonedParts(now).year) continue;

    // Everything after the date is the act: "June 25- The Pork Tornadoes".
    const act = label.replace(/^[^-–—]*[-–—]\s*/, "").trim();
    if (!act || act === label) continue;

    if (seen.has(url)) continue;
    seen.add(url);

    events.push({
      title: `${act} at Jasper Winery`,
      description:
        "Part of Jasper Winery's summer concert series: outdoor live music on " +
        "Thursday evenings, wine and food on site.",
      date,
      location: "Des Moines, IA",
      category: "Music",
      sourceUrl: url,
      venue: "Jasper Winery",
    });
  }

  return events;
}

export const jasperWinery: EventSource = {
  name: "Jasper Winery",
  defaultCategory: "Music",
  venueSlug: "jasper-winery",
  async scrape() {
    return parseJasperEvents(await fetchHtml(SERIES_URL, 30_000));
  },
};
