/**
 * Weekend and "tonight" windows, computed in Des Moines' own timezone.
 *
 * The server runs in UTC, so every boundary here has to be expressed as a UTC
 * instant that corresponds to a Des Moines wall-clock time. Doing this with
 * local Date methods would put Friday's cutoff five or six hours off, which in
 * practice means Friday evening events vanish from the Friday column.
 *
 * Central time shifts between UTC-6 and UTC-5, so the offset is resolved at the
 * specific instant rather than assumed.
 */

export const DES_MOINES_TIME_ZONE = "America/Chicago";

const PARTS_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: DES_MOINES_TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

export interface ZonedParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** 0 = Sunday. */
  weekday: number;
}

const WEEKDAY_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: DES_MOINES_TIME_ZONE,
  weekday: "short",
});

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/** What the clock in Des Moines reads at a given instant. */
export function getZonedParts(instant: Date): ZonedParts {
  const parts = PARTS_FORMATTER.formatToParts(instant);
  const lookup = (type: string): number =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");

  return {
    year: lookup("year"),
    month: lookup("month"),
    day: lookup("day"),
    hour: lookup("hour"),
    minute: lookup("minute"),
    second: lookup("second"),
    weekday: WEEKDAY_INDEX[WEEKDAY_FORMATTER.format(instant)] ?? 0,
  };
}

/**
 * Convert a Des Moines wall-clock time into the UTC instant it refers to.
 *
 * Resolves the offset by asking what the Des Moines clock reads at a first
 * guess, then correcting. A second pass handles the two hours a year where the
 * offset changes between the guess and the corrected instant.
 */
export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
): Date {
  const naive = Date.UTC(year, month - 1, day, hour, minute, second);

  let instant = naive;
  for (let pass = 0; pass < 2; pass += 1) {
    const parts = getZonedParts(new Date(instant));
    const asIfUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    const offset = asIfUtc - instant;
    const corrected = naive - offset;
    if (corrected === instant) break;
    instant = corrected;
  }

  return new Date(instant);
}

/** Shift a calendar date by whole days, staying in Des Moines' calendar. */
function addDays(
  parts: Pick<ZonedParts, "year" | "month" | "day">,
  days: number,
): { year: number; month: number; day: number } {
  // UTC arithmetic is safe here because we only care about the calendar date,
  // not the instant it maps to.
  const shifted = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

export interface WeekendDay {
  /** ISO calendar date in Des Moines, e.g. "2026-09-04". */
  date: string;
  label: "Friday" | "Saturday" | "Sunday";
  /** Local midnight, as a UTC instant. */
  start: Date;
  /** The following local midnight, exclusive. */
  end: Date;
}

export interface WeekendRange {
  days: WeekendDay[];
  start: Date;
  end: Date;
  /** True when the weekend has already begun, so "this weekend" means now. */
  inProgress: boolean;
}

function isoDate(parts: { year: number; month: number; day: number }): string {
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

/**
 * The upcoming weekend, Friday 00:00 through Sunday 23:59:59 Des Moines time.
 *
 * On Saturday or Sunday this returns the weekend already under way rather than
 * the next one: someone checking on Saturday morning wants today, not six days
 * out. Friday is treated the same way, since the weekend starts that evening.
 */
export function getWeekendRange(now: Date = new Date()): WeekendRange {
  const today = getZonedParts(now);

  // Days back to the most recent Friday (0 on Fri, 1 on Sat, 2 on Sun),
  // otherwise days forward to the coming Friday.
  const weekendUnderWay = today.weekday === 5 || today.weekday === 6 || today.weekday === 0;
  const offsetToFriday = weekendUnderWay
    ? today.weekday === 5
      ? 0
      : today.weekday === 6
        ? -1
        : -2
    : 5 - today.weekday;

  const fridayDate = addDays(today, offsetToFriday);
  const labels: Array<WeekendDay["label"]> = ["Friday", "Saturday", "Sunday"];

  const days: WeekendDay[] = labels.map((label, index) => {
    const dayParts = addDays(fridayDate, index);
    const next = addDays(dayParts, 1);
    return {
      date: isoDate(dayParts),
      label,
      start: zonedTimeToUtc(dayParts.year, dayParts.month, dayParts.day, 0, 0, 0),
      end: zonedTimeToUtc(next.year, next.month, next.day, 0, 0, 0),
    };
  });

  return {
    days,
    start: days[0].start,
    end: days[2].end,
    inProgress: weekendUnderWay,
  };
}

/**
 * Tonight: from 4pm Des Moines time today until local midnight.
 *
 * After midnight but before 4pm the window is still today's evening, so the
 * strip shows what is on later rather than nothing at all.
 */
export function getTonightRange(now: Date = new Date()): { start: Date; end: Date } {
  const today = getZonedParts(now);
  const tomorrow = addDays(today, 1);

  const eveningStart = zonedTimeToUtc(today.year, today.month, today.day, 16, 0, 0);
  const midnight = zonedTimeToUtc(tomorrow.year, tomorrow.month, tomorrow.day, 0, 0, 0);

  // Once it is past 4pm, "tonight" starts now: an event that began an hour ago
  // is not something to send someone to.
  return { start: now > eveningStart ? now : eveningStart, end: midnight };
}

/** Which weekend day an instant falls on, or null if outside the range. */
export function weekendDayFor(instant: Date, range: WeekendRange): WeekendDay | null {
  return (
    range.days.find((day) => instant >= day.start && instant < day.end) ?? null
  );
}
