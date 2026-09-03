import { fetchHtml } from "./http.js";
import { isHomeInDesMoines, parseSidearmSchedule } from "./sidearm.js";
import { SOURCE_PRIORITY } from "./types.js";
import type { EventSource, ScrapedEvent } from "./types.js";

/**
 * Drake Bulldogs athletics, every sport.
 *
 * Drake is a genuine cultural fixture here — the Knapp Center on a Missouri
 * Valley night, the Drake Relays every April — and it is completely absent from
 * the visitor calendars. Worth having all of it, not just basketball: a Sunday
 * soccer match at Cownie is a real thing to do.
 *
 * Only home games are kept. An away game in Peoria is not something a resident
 * can go to, and listing it would make the calendar less trustworthy, not more
 * complete.
 */

const ORIGIN = "https://godrakebulldogs.com";

/**
 * Where Drake plays at home. Used to tell a home fixture from a road trip,
 * since the schedule feed labels both the same way.
 */
const HOME_VENUES = [
  "Knapp Center",
  "Drake Stadium",
  "Cownie Soccer",
  "Buel Field",
  "Roger Knapp Tennis",
  "Bell Center",
  "Ron Buel",
  "Des Moines Golf",
  "Blank Golf",
  "Principal Park",
];

/** Turn "womens-basketball" into "Women's Basketball". */
export function sportLabel(slug: string): string {
  return slug
    .replace(/^womens-/, "women's ")
    .replace(/^mens-/, "men's ")
    .replace(/-/g, " ")
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase())
    .replace(/Women'S/g, "Women's")
    .replace(/Men'S/g, "Men's");
}

/**
 * Read the sport list off the site rather than hardcoding it.
 *
 * Programmes come and go, and a hardcoded list quietly stops covering a sport
 * the day Drake adds one.
 */
export function parseSportSlugs(html: string): string[] {
  const found = new Set<string>();
  const pattern = /\/sports\/([a-z][a-z-]*)\/schedule\b/gi;
  for (let match = pattern.exec(html); match; match = pattern.exec(html)) {
    found.add(match[1]);
  }
  return Array.from(found).sort();
}

/** How many sport pages to fetch at once. Polite to one host, still quick. */
const SPORT_CONCURRENCY = 3;

export const drakeAthletics: EventSource = {
  name: "Drake Bulldogs Athletics",
  defaultCategory: "Sports",
  venueSlug: "knapp-center",
  sourcePriority: SOURCE_PRIORITY.DIRECT_VENUE,
  async scrape(): Promise<ScrapedEvent[]> {
    const now = new Date();
    const slugs = parseSportSlugs(await fetchHtml(`${ORIGIN}/calendar`, 30_000));
    if (slugs.length === 0) {
      throw new Error("No sport schedules linked from the Drake athletics calendar");
    }

    const events: ScrapedEvent[] = [];
    const seen = new Set<string>();
    let cursor = 0;

    async function worker(): Promise<void> {
      while (cursor < slugs.length) {
        const slug = slugs[cursor];
        cursor += 1;
        const pageUrl = `${ORIGIN}/sports/${slug}/schedule`;
        try {
          const games = parseSidearmSchedule(
            await fetchHtml(pageUrl, 30_000),
            {
              homeTeamName: "Drake",
              sportLabel: sportLabel(slug),
              pageUrl,
              category: "Sports",
              location: "Des Moines, IA",
            },
            now,
          );

          for (const game of games) {
            if (!isHomeInDesMoines(game, HOME_VENUES)) continue;
            const key = `${game.title}|${game.date.toISOString()}`;
            if (seen.has(key)) continue;
            seen.add(key);
            events.push(game);
          }
        } catch (error) {
          // One sport's page failing should not lose the other thirteen.
          console.warn(
            `[scrapers] Drake ${slug} schedule failed:`,
            error instanceof Error ? error.message : error,
          );
        }
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(SPORT_CONCURRENCY, slugs.length) }, () => worker()),
    );

    return events;
  },
};
