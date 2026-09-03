import { isPlausibleEventDate, parseEventDate, parseTimeOfDay } from "./dates.js";
import { elementsByClass, firstHref, firstImage, textByClass } from "./html.js";
import { getZonedParts, zonedTimeToUtc } from "@shared/weekend.js";
import type { ScrapedEvent } from "./types.js";

/**
 * Adapter for the See Tickets white-label listing widget.
 *
 * Several independent Des Moines music rooms sell through See Tickets, and the
 * widget renders into the venue's own page server-side, so the markup is the
 * same everywhere it appears. Keeping it here means adding another See Tickets
 * venue later is a five-line file.
 *
 * The date and the time are in separate elements ("Wed Sep 2" and a show time
 * of "6:30PM"), so they are combined rather than parsed from one string. Door
 * time is deliberately ignored: what belongs on a listing is when the music
 * starts.
 */

export interface SeeTicketsConfig {
  /** Page the widget is embedded in; used to resolve relative links. */
  listingUrl: string;
  venueName: string;
  location: string;
  category: string;
}

export function parseSeeTicketsEvents(
  html: string,
  config: SeeTicketsConfig,
  now: Date = new Date(),
): ScrapedEvent[] {
  const events: ScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const card of elementsByClass(html, "seetickets-list-event-container")) {
    const title = textByClass(card, "title");
    const dateText = textByClass(card, "date");
    if (!title || !dateText) continue;

    const day = parseEventDate(dateText, now);
    if (!day) continue;

    const showTime = parseTimeOfDay(textByClass(card, "see-showtime"));
    const parts = getZonedParts(day.date);
    const date = showTime
      ? zonedTimeToUtc(parts.year, parts.month, parts.day, showTime.hour, showTime.minute)
      : day.date;
    if (!isPlausibleEventDate(date, now)) continue;

    const key = `${title}|${date.toISOString()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    // The widget writes the venue as "at xBk Live"; strip the preposition.
    const widgetVenue = textByClass(card, "venue").replace(/^at\s+/i, "").trim();
    const presenter = textByClass(card, "header");
    const support = textByClass(card, "supporting-talent");
    const genre = textByClass(card, "genre");

    const description = [presenter, support ? `With ${support}.` : "", genre]
      .filter(Boolean)
      .join(" ")
      .trim();

    events.push({
      title,
      description: description || title,
      date,
      location: config.location,
      category: config.category,
      sourceUrl: firstHref(card) ?? config.listingUrl,
      imageUrl: firstImage(card),
      venue: widgetVenue || config.venueName,
      price: textByClass(card, "price") || undefined,
    });
  }

  return events;
}
