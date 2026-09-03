import { createRevizeSource } from "./revize.js";
import type { EventSource } from "./types.js";

/**
 * Des Moines Parks and Recreation.
 *
 * Parks programming lives on the city's own calendar alongside every board
 * agenda, so this keeps only the calendars that are actually parks and
 * recreation. The administrative filter in `civic.ts` catches the rest.
 */
export const desMoinesParks: EventSource = createRevizeSource({
  origin: "https://www.dsm.city",
  calendarPage: "https://www.dsm.city/calendar.php",
  sourceName: "Des Moines Parks and Recreation",
  location: "Des Moines, IA",
  category: "Community",
  calendarFilter: (name) => /park|recreation|event|program|pool|aquatic|golf/i.test(name),
});
