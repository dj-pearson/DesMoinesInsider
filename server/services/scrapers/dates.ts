import { getZonedParts, zonedTimeToUtc } from "@shared/weekend.js";

/**
 * Turning venue date strings into instants.
 *
 * Two things make this more than `new Date(text)`. First, venues write dates in
 * house style — "Wednesday, Sept. 9 · 10 a.m. - 1 p.m." is AP style, and
 * `new Date` returns Invalid Date for it. Second, and worse, the strings almost
 * never carry a timezone: "September 9 at 7pm" means 7pm in Des Moines, but
 * `new Date` reads it in whatever zone the server happens to run in. A
 * production box on UTC would shift every event five hours and quietly move
 * some of them to the wrong day.
 *
 * So we pull the fields out ourselves and hand them to `zonedTimeToUtc`, which
 * resolves them against America/Chicago.
 */

const MONTHS: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

const MONTH_PATTERN = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join("|");

export interface ParsedDate {
  date: Date;
  /** True when the text carried a time of day; false when we defaulted it. */
  hasTime: boolean;
}

/**
 * Pull a time of day out of free text.
 *
 * Handles "7pm", "7:30 PM", "10 a.m.", and 24-hour "19:30". Returns null rather
 * than guessing, so the caller can decide what a missing time means.
 */
export function parseTimeOfDay(text: string): { hour: number; minute: number } | null {
  const meridiem = /(\d{1,2})(?::(\d{2}))?\s*([ap])\.?\s*m\.?/i.exec(text);
  if (meridiem) {
    let hour = Number(meridiem[1]) % 12;
    if (meridiem[3].toLowerCase() === "p") hour += 12;
    return { hour, minute: Number(meridiem[2] ?? 0) };
  }

  const military = /\b([01]?\d|2[0-3]):([0-5]\d)\b/.exec(text);
  if (military) {
    return { hour: Number(military[1]), minute: Number(military[2]) };
  }

  return null;
}

/**
 * Choose the year for a date that did not state one.
 *
 * Venue listings only ever show upcoming events, so a month/day that has
 * already passed this year means next year's. The 31-day grace period keeps an
 * event that started yesterday from jumping twelve months into the future.
 */
function inferYear(month: number, day: number, now: Date): number {
  const today = getZonedParts(now);
  const candidate = zonedTimeToUtc(today.year, month, day, 12);
  const graceMs = 31 * 24 * 60 * 60 * 1000;
  return candidate.getTime() < now.getTime() - graceMs ? today.year + 1 : today.year;
}

/**
 * Parse a date out of a venue's free text, read as Des Moines local time.
 *
 * Recognises "September 9, 2026", "Sept. 9", "Wednesday, Sept. 9 · 7 p.m.",
 * "9/14/2026" and ISO "2026-09-14". Returns null when there is no date in the
 * text at all, which is the honest answer — an event with a made-up date is
 * worse than one we skipped.
 */
export function parseEventDate(text: string, now: Date = new Date()): ParsedDate | null {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return null;

  const time = parseTimeOfDay(cleaned);
  const hour = time?.hour ?? 12; // noon, so a missing time cannot land on the wrong day
  const minute = time?.minute ?? 0;

  const iso = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(cleaned);
  if (iso) {
    return {
      date: zonedTimeToUtc(Number(iso[1]), Number(iso[2]), Number(iso[3]), hour, minute),
      hasTime: time !== null,
    };
  }

  const monthFirst = new RegExp(
    `\\b(${MONTH_PATTERN})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?!\\d)(?:\\s*,?\\s*(\\d{4})(?!\\d))?`,
    "i",
  ).exec(cleaned);
  if (monthFirst) {
    const month = MONTHS[monthFirst[1].toLowerCase()];
    const day = Number(monthFirst[2]);
    const year = monthFirst[3] ? Number(monthFirst[3]) : inferYear(month, day, now);
    return { date: zonedTimeToUtc(year, month, day, hour, minute), hasTime: time !== null };
  }

  const dayFirst = new RegExp(
    `\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH_PATTERN})\\.?(?:\\s*,?\\s*(\\d{4})(?!\\d))?`,
    "i",
  ).exec(cleaned);
  if (dayFirst) {
    const month = MONTHS[dayFirst[2].toLowerCase()];
    const day = Number(dayFirst[1]);
    const year = dayFirst[3] ? Number(dayFirst[3]) : inferYear(month, day, now);
    return { date: zonedTimeToUtc(year, month, day, hour, minute), hasTime: time !== null };
  }

  const numeric = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/.exec(cleaned);
  if (numeric) {
    const month = Number(numeric[1]);
    const day = Number(numeric[2]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      let year: number;
      if (numeric[3]) {
        year = Number(numeric[3]);
        if (year < 100) year += 2000;
      } else {
        year = inferYear(month, day, now);
      }
      return { date: zonedTimeToUtc(year, month, day, hour, minute), hasTime: time !== null };
    }
  }

  return null;
}

/**
 * Parse a wall-clock timestamp that is already known to be Des Moines time,
 * such as The Events Calendar's "2026-09-05 19:00:00".
 */
export function parseLocalTimestamp(value: string | undefined): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/.exec(value.trim());
  if (!match) return null;
  return zonedTimeToUtc(
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6] ?? 0),
  );
}

/** Drop events in the past and anything absurdly far out (usually a parse slip). */
export function isPlausibleEventDate(date: Date, now: Date = new Date()): boolean {
  const dayMs = 24 * 60 * 60 * 1000;
  return (
    !Number.isNaN(date.getTime()) &&
    date.getTime() > now.getTime() - dayMs &&
    date.getTime() < now.getTime() + 550 * dayMs
  );
}
