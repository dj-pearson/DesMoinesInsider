/**
 * Countdown text for tentpole guides.
 *
 * These are annual events, so the useful unit is days and months, not hours.
 * Anything under way says so rather than showing a negative number.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days between two instants, counted by calendar date rather than by
 * elapsed milliseconds, so "tomorrow" reads as 1 even at 11pm. */
function daysBetween(from: Date, to: Date): number {
  const startOfDay = (d: Date) =>
    Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((startOfDay(to) - startOfDay(from)) / DAY_MS);
}

export interface Countdown {
  label: string;
  /** True while the event is running. */
  inProgress: boolean;
  days: number;
}

export function getCountdown(
  start: Date | string | null,
  end: Date | string | null,
  now: Date = new Date(),
): Countdown | null {
  if (!start) return null;

  const startsAt = start instanceof Date ? start : new Date(start);
  if (Number.isNaN(startsAt.getTime())) return null;

  const endsAt = end ? (end instanceof Date ? end : new Date(end)) : startsAt;

  if (now >= startsAt && now <= endsAt) {
    return { label: "On now", inProgress: true, days: 0 };
  }

  const days = daysBetween(now, startsAt);

  if (days < 0) return { label: "Finished", inProgress: false, days };
  if (days === 0) return { label: "Today", inProgress: false, days };
  if (days === 1) return { label: "Tomorrow", inProgress: false, days };
  if (days < 30) return { label: `In ${days} days`, inProgress: false, days };

  const months = Math.round(days / 30);
  return {
    label: months === 1 ? "In about a month" : `In about ${months} months`,
    inProgress: false,
    days,
  };
}
