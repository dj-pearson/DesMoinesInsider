import { createRevizeSource } from "./revize.js";
import type { EventSource } from "./types.js";

export const altoona: EventSource = createRevizeSource({
  origin: "https://www.altoona-iowa.com",
  calendarPage: "https://www.altoona-iowa.com/calendar.php",
  sourceName: "City of Altoona",
  location: "Altoona, IA",
  neighborhoodSlug: "altoona",
  category: "Community",
});
