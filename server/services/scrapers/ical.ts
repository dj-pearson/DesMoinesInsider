import { zonedTimeToUtc } from "@shared/weekend.js";

/**
 * A small iCalendar (RFC 5545) reader, enough for municipal calendar feeds.
 *
 * Cities publish real .ics feeds, and consuming one beats parsing their
 * calendar page in every way: the fields are named, the times are unambiguous,
 * and a site redesign does not touch it.
 *
 * Three details in the format actually matter here and are easy to get wrong:
 *
 *  - Long lines are folded, continuing on the next line after a space or tab.
 *    Not unfolding them truncates every description at 75 characters.
 *  - DTSTART comes in three flavours: a UTC instant ("...Z"), a local time with
 *    a TZID, and a date with no time at all. They mean different things and the
 *    third is an all-day event, not midnight.
 *  - Text values escape commas, semicolons and newlines with a backslash, so a
 *    raw value shows "Ankeny\, Iowa".
 */

export interface IcalEvent {
  uid?: string;
  summary?: string;
  description?: string;
  location?: string;
  url?: string;
  start: Date;
  /** True when DTSTART carried a date but no time. */
  allDay: boolean;
}

/** Rejoin folded lines: a leading space or tab continues the line before it. */
function unfold(text: string): string[] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const joined: string[] = [];

  for (const line of lines) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && joined.length > 0) {
      joined[joined.length - 1] += line.slice(1);
    } else {
      joined.push(line);
    }
  }

  return joined;
}

function unescapeText(value: string): string {
  return value
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();
}

/**
 * Read a DTSTART value.
 *
 * A floating or TZID-qualified local time is resolved against Des Moines rather
 * than the server's zone. These are municipal feeds for one city, so that is
 * the right assumption; honouring an arbitrary TZID would mean shipping the
 * whole zone database for a case that does not arise.
 */
function parseDateValue(value: string, params: string): { date: Date; allDay: boolean } | null {
  const utc = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(value);
  if (utc) {
    return {
      date: new Date(
        Date.UTC(
          Number(utc[1]),
          Number(utc[2]) - 1,
          Number(utc[3]),
          Number(utc[4]),
          Number(utc[5]),
          Number(utc[6]),
        ),
      ),
      allDay: false,
    };
  }

  const local = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/.exec(value);
  if (local) {
    return {
      date: zonedTimeToUtc(
        Number(local[1]),
        Number(local[2]),
        Number(local[3]),
        Number(local[4]),
        Number(local[5]),
        Number(local[6]),
      ),
      allDay: false,
    };
  }

  const dateOnly = /^(\d{4})(\d{2})(\d{2})$/.exec(value);
  if (dateOnly || /VALUE=DATE/i.test(params)) {
    const match = dateOnly ?? /^(\d{4})(\d{2})(\d{2})/.exec(value);
    if (!match) return null;
    // Noon, not midnight: an all-day event pinned to 00:00 slides to the
    // previous day in any display that shifts by even an hour.
    return {
      date: zonedTimeToUtc(Number(match[1]), Number(match[2]), Number(match[3]), 12),
      allDay: true,
    };
  }

  return null;
}

/** Parse every VEVENT in a VCALENDAR document. */
export function parseIcal(text: string): IcalEvent[] {
  const events: IcalEvent[] = [];
  let current: Partial<IcalEvent> | null = null;

  for (const line of unfold(text)) {
    if (line.startsWith("BEGIN:VEVENT")) {
      current = {};
      continue;
    }

    if (line.startsWith("END:VEVENT")) {
      if (current?.start && current.summary) {
        events.push(current as IcalEvent);
      }
      current = null;
      continue;
    }

    if (!current) continue;

    const separator = line.indexOf(":");
    if (separator < 0) continue;

    const rawName = line.slice(0, separator);
    const value = line.slice(separator + 1);
    const [name, ...paramParts] = rawName.split(";");
    const params = paramParts.join(";");

    switch (name.toUpperCase()) {
      case "UID":
        current.uid = value.trim();
        break;
      case "SUMMARY":
        current.summary = unescapeText(value);
        break;
      case "DESCRIPTION":
        current.description = unescapeText(value);
        break;
      case "LOCATION":
        current.location = unescapeText(value);
        break;
      case "URL":
        current.url = value.trim();
        break;
      case "DTSTART": {
        const parsed = parseDateValue(value.trim(), params);
        if (parsed) {
          current.start = parsed.date;
          current.allDay = parsed.allDay;
        }
        break;
      }
      default:
        break;
    }
  }

  return events;
}
