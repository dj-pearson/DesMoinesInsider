/**
 * Shared rules for civic calendars.
 *
 * City, library and parks calendars behave differently from ticketed venues in
 * two ways worth encoding once rather than in ten files.
 */

/**
 * Council meetings, board agendas and public hearings are the bulk of a city's
 * calendar and none of it is a plan for a Saturday. They are dropped by title,
 * not by which feed they arrived on, because the "all events" feed most cities
 * publish mixes them in with the concerts.
 */
const ADMINISTRATIVE = new RegExp(
  [
    "\\bmeeting\\b",
    "\\bagenda\\b",
    "\\bwork session\\b",
    "\\bpublic hearing\\b",
    "\\bcity council\\b",
    "\\bboard of\\b",
    "\\bcommission\\b",
    "\\bcaucus\\b",
    "\\bcanvass\\b",
    "\\bcouncil workshop\\b",
    "\\bplan and zoning\\b",
    "\\bzoning board\\b",
    "\\bboard meeting\\b",
    "\\btrustees\\b",
    "\\bclosed session\\b",
    "\\bbudget hearing\\b",
  ].join("|"),
  "i",
);

/**
 * Holidays and office closures.
 *
 * City feeds carry "Christmas", "Veterans Day" and "All City offices CLOSED"
 * as calendar entries. They are facts about the city, not things to do, and one
 * suburb's feed is nothing but these — publishing them would fill a
 * neighborhood page with days the pool is shut.
 */
const CLOSURE = new RegExp(
  [
    "\\bclosed\\b",
    "\\bclosure\\b",
    "\\bno (?:service|collection|pickup)\\b",
    "\\bholiday (?:hours|schedule)\\b",
    "\\boffices? closed\\b",
  ].join("|"),
  "i",
);

/**
 * Bare holiday names, which appear with no other text at all. Matched only as
 * a whole title, so "Fourth of July Fireworks" and "Christmas Tree Lighting"
 * — which are events — are kept.
 */
const BARE_HOLIDAY =
  /^(new year'?s?(?: day| eve)?|christmas(?: day| eve)?|thanksgiving(?: day)?|veterans? day|memorial day|labor day|independence day|fourth of july|juneteenth|martin luther king,? jr\.? day|mlk day|presidents'? day|easter|good friday)$/i;

export function isAdministrativeEvent(title: string, calendarName?: string): boolean {
  const trimmed = title.trim();
  if (BARE_HOLIDAY.test(trimmed)) return true;
  if (CLOSURE.test(trimmed)) return true;
  return ADMINISTRATIVE.test(trimmed) || (calendarName ? ADMINISTRATIVE.test(calendarName) : false);
}

/**
 * Does this text mention a price?
 *
 * Used to decide whether a civic event keeps its free-by-default assumption. It
 * only has to be right about the presence of a cost, not the amount: a hit here
 * means "do not assert free", and the flag is left for the text extractor and
 * the model to settle.
 */
const COST = /\$\s?\d|\bfee\b|\bcost\b|\btickets?\b|\badmission\b|\bregistration fee\b|\bper person\b/i;

export function mentionsCost(...parts: Array<string | undefined>): boolean {
  return parts.some((part) => (part ? COST.test(part) : false));
}

/**
 * Free unless the listing says otherwise.
 *
 * A library story time, a park concert and a city fireworks display are free,
 * and saying so is most of what makes this calendar useful to someone deciding
 * what to do with a Saturday and no money. Returning undefined rather than
 * false where a cost is mentioned matters: undefined means "we do not know", so
 * the text extractor and the model still get their turn, whereas false would
 * assert the event is paid on the strength of the word "tickets".
 */
export function freeUnlessPriced(...parts: Array<string | undefined>): boolean | undefined {
  return mentionsCost(...parts) ? undefined : true;
}
