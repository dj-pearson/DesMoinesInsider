import { isPlausibleEventDate, parseLocalTimestamp } from "./dates.js";
import { textOf } from "./html.js";
import { getZonedParts, zonedTimeToUtc } from "@shared/weekend.js";
import type { ScrapedEvent } from "./types.js";

/**
 * Adapter for SIDEARM Sports, the platform nearly every college athletics
 * department runs, Drake included.
 *
 * Each sport's schedule page carries the whole season as JSON-LD: teams, venue,
 * and start time. It is not quite schema.org — the entries carry no `@type`, so
 * the generic reader in jsonld.ts skips them — but the fields are the real
 * ones, which beats parsing the schedule table.
 */

interface SidearmGame {
  name?: string;
  url?: string;
  startDate?: string;
  description?: string;
  homeTeam?: { name?: string };
  awayTeam?: { name?: string };
  location?: { name?: string; address?: { streetAddress?: string } };
  image?: { url?: string };
}

export interface SidearmConfig {
  /** The team whose site this is, used to tell home from away. */
  homeTeamName: string;
  /** Sport label for the description, e.g. "Women's Basketball". */
  sportLabel: string;
  pageUrl: string;
  category: string;
  location: string;
}

/**
 * SIDEARM writes an unannounced tip-off as midnight. Midnight is a real time,
 * so keeping it would show "12:00 AM" on the listing — wrong rather than merely
 * vague — and would put a Saturday game on Friday night in any view that shifts
 * by an hour. Those are moved to noon, the same neutral hour the date parser
 * uses when a listing gives a day and no time.
 *
 * The check has to be on the Des Moines clock, not UTC: midnight Central is
 * 05:00 or 06:00 UTC, so testing the UTC hour would never match.
 */
const NEUTRAL_HOUR = 12;

export function parseSidearmSchedule(
  html: string,
  config: SidearmConfig,
  now: Date = new Date(),
): ScrapedEvent[] {
  const blockPattern =
    /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const games: SidearmGame[] = [];

  for (let match = blockPattern.exec(html); match; match = blockPattern.exec(html)) {
    try {
      const parsed: unknown = JSON.parse(match[1].trim());
      if (Array.isArray(parsed)) games.push(...(parsed as SidearmGame[]));
    } catch {
      // Ad scripts on these pages sometimes emit invalid JSON-LD; keep reading.
    }
  }

  const events: ScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const game of games) {
    const title = textOf(game.name);
    let date = parseLocalTimestamp(game.startDate);
    if (!title || !date) continue;

    const local = getZonedParts(date);
    if (local.hour === 0 && local.minute === 0) {
      date = zonedTimeToUtc(local.year, local.month, local.day, NEUTRAL_HOUR);
    }
    if (!isPlausibleEventDate(date, now)) continue;

    const venue = textOf(game.location?.name);
    const address = textOf(game.location?.address?.streetAddress);

    const key = `${title}|${date.toISOString()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const opponent = textOf(game.awayTeam?.name) || textOf(game.homeTeam?.name);

    events.push({
      // The platform's own name is "Drake University  Vs Opponent", double
      // space and all. Rebuild it so the listing reads like a listing.
      title: `${config.homeTeamName} ${config.sportLabel} vs ${opponent}`,
      description: `${config.sportLabel}: ${config.homeTeamName} host ${opponent}${
        venue ? ` at ${venue}` : ""
      }.`,
      date,
      location: address || config.location,
      category: config.category,
      sourceUrl: game.url ?? config.pageUrl,
      imageUrl: game.image?.url,
      venue: venue || undefined,
    });
  }

  return events;
}

/** Is this game actually in Des Moines, or is it an away trip? */
export function isHomeInDesMoines(event: ScrapedEvent, homeVenues: string[]): boolean {
  const venue = (event.venue ?? "").toLowerCase();
  if (homeVenues.some((name) => venue.includes(name.toLowerCase()))) return true;
  return /des moines/i.test(event.location);
}
