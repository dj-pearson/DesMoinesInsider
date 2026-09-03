import { EVENT_CATEGORIES, type EventCategory } from "./schema";

/**
 * Map arbitrary category text onto our canonical list.
 *
 * Three sources feed this:
 *  - legacy rows written before the taxonomy existed ("Art", "Outdoor")
 *  - scrapers, which emit whatever the source site calls things, plus their own
 *    placeholders like "General" and "Tourism"
 *  - the AI categorizer, when it returns something slightly off-list
 *
 * Nothing reaches the database without passing through here, because the insert
 * schema rejects anything that is not an exact category.
 */

/** Exact and near-exact aliases, checked before any keyword matching. */
const ALIASES: Record<string, EventCategory> = {
  // Legacy values already in the database.
  art: "Arts & Theater",
  arts: "Arts & Theater",
  food: "Food & Drink",
  outdoor: "Outdoor & Parks",
  family: "Family & Kids",
  music: "Music",
  sports: "Sports",

  // Common phrasings from source sites.
  "food and drink": "Food & Drink",
  "food & drink": "Food & Drink",
  dining: "Food & Drink",
  restaurants: "Food & Drink",
  "farmers market": "Farmers Markets",
  "farmers markets": "Farmers Markets",
  "farmer's market": "Farmers Markets",
  market: "Farmers Markets",
  festival: "Festivals",
  festivals: "Festivals",
  fair: "Festivals",
  theater: "Arts & Theater",
  theatre: "Arts & Theater",
  "performing arts": "Arts & Theater",
  gallery: "Arts & Theater",
  museum: "Arts & Theater",
  comedy: "Nightlife",
  nightlife: "Nightlife",
  bar: "Nightlife",
  kids: "Family & Kids",
  "family & kids": "Family & Kids",
  children: "Family & Kids",
  parks: "Outdoor & Parks",
  "outdoor & parks": "Outdoor & Parks",
  nature: "Outdoor & Parks",
  hiking: "Outdoor & Parks",
  civic: "Community & Civic",
  community: "Community & Civic",
  "community & civic": "Community & Civic",
  government: "Community & Civic",
  library: "Community & Civic",
  fitness: "Fitness & Races",
  "fitness & races": "Fitness & Races",
  race: "Fitness & Races",
  running: "Fitness & Races",
  marathon: "Fitness & Races",
  holiday: "Holiday & Seasonal",
  "holiday & seasonal": "Holiday & Seasonal",
  seasonal: "Holiday & Seasonal",
  christmas: "Holiday & Seasonal",
  halloween: "Holiday & Seasonal",
  "high school sports": "High School Sports",
  "high school": "High School Sports",
  prep: "High School Sports",
  free: "Free",
  concert: "Music",
  concerts: "Music",
  "live music": "Music",
};

/**
 * Keyword fallbacks, tried in order when no alias matches. Order matters:
 * "high school" must beat the plain "sport" rule beneath it.
 */
const KEYWORD_RULES: Array<[RegExp, EventCategory]> = [
  [/\b(high school|iahsaa|ighsau|state tournament|prep)\b/i, "High School Sports"],
  [/\b(farmers?[' ]?\s?market)\b/i, "Farmers Markets"],
  [/\b(festival|fest|fair|parade)\b/i, "Festivals"],
  [/\b(5k|10k|half marathon|marathon|fun run|race|ride|yoga|workout)\b/i, "Fitness & Races"],
  [/\b(concert|band|dj|orchestra|symphony|live music|tour)\b/i, "Music"],
  [/\b(theater|theatre|play|musical|ballet|opera|gallery|exhibit|museum|art)\b/i, "Arts & Theater"],
  [/\b(brunch|dinner|tasting|brewery|winery|beer|wine|food truck|restaurant)\b/i, "Food & Drink"],
  [/\b(kids?|children|toddler|storytime|family)\b/i, "Family & Kids"],
  [/\b(trail|park|hike|garden|zoo|lake|outdoor)\b/i, "Outdoor & Parks"],
  [/\b(bar|club|nightlife|late night|comedy|trivia)\b/i, "Nightlife"],
  [/\b(holiday|christmas|halloween|thanksgiving|new year|pumpkin|santa)\b/i, "Holiday & Seasonal"],
  [/\b(game|match|tournament|vs\.?|basketball|hockey|baseball|football|soccer)\b/i, "Sports"],
  [/\b(meeting|council|volunteer|fundraiser|library|civic)\b/i, "Community & Civic"],
];

/**
 * Values that carry no information. Scrapers emit these constantly, so they
 * must not short-circuit the keyword pass: an event labelled "General" but
 * titled "Downtown Farmers' Market" is a farmers market.
 */
const PLACEHOLDERS = new Set([
  "",
  "general",
  "tourism",
  "other",
  "misc",
  "miscellaneous",
  "uncategorized",
  "uncategorised",
  "event",
  "events",
  "all",
]);

/**
 * Broader categories that a more specific context can refine. High school
 * sport is the case that matters here: sources label it "Sports", but locals
 * treat it as its own thing entirely.
 */
const REFINEMENTS: Array<{ from: EventCategory; pattern: RegExp; to: EventCategory }> = [
  {
    from: "Sports",
    pattern: /\b(high school|iahsaa|ighsau|prep|state (tournament|wrestling|basketball))\b/i,
    to: "High School Sports",
  },
];

/** Categories that are exact members of the canonical list, keyed lower-case. */
const CANONICAL_BY_LOWER = new Map<string, EventCategory>(
  EVENT_CATEGORIES.map((category) => [category.toLowerCase(), category]),
);

export function isEventCategory(value: string): value is EventCategory {
  return CANONICAL_BY_LOWER.has(value.trim().toLowerCase());
}

/**
 * Best-effort mapping of free text to a category.
 *
 * `context` lets callers pass the event title so a source that says only
 * "General" can still be placed by what the event is actually called.
 */
export function normalizeCategory(
  raw: string | null | undefined,
  context?: string | null,
): EventCategory {
  const value = (raw ?? "").trim().toLowerCase();
  const haystacks = [raw ?? "", context ?? ""].filter((text) => text.trim().length > 0);

  /** Apply any refinement whose pattern appears in the raw value or context. */
  const refine = (category: EventCategory): EventCategory => {
    for (const rule of REFINEMENTS) {
      if (rule.from !== category) continue;
      if (haystacks.some((text) => rule.pattern.test(text))) return rule.to;
    }
    return category;
  };

  // A placeholder tells us nothing, so skip straight to the keyword pass.
  if (!PLACEHOLDERS.has(value)) {
    const exact = CANONICAL_BY_LOWER.get(value);
    if (exact) return refine(exact);

    const alias = ALIASES[value];
    if (alias) return refine(alias);
  }

  for (const haystack of haystacks) {
    for (const [pattern, category] of KEYWORD_RULES) {
      if (pattern.test(haystack)) return refine(category);
    }
  }

  // Nothing matched. "Community & Civic" is the least-wrong bucket: it is where
  // a reader looks for "something happening locally" without implying music,
  // sport or a price.
  return "Community & Civic";
}

/**
 * Clean a list of AI-proposed secondary categories: normalize, drop anything
 * equal to the primary, de-duplicate, and cap at two.
 */
export function normalizeSecondaryCategories(
  raw: unknown,
  primary: EventCategory,
): EventCategory[] {
  if (!Array.isArray(raw)) return [];

  const seen = new Set<EventCategory>();
  for (const entry of raw) {
    if (typeof entry !== "string") continue;
    const canonical = CANONICAL_BY_LOWER.get(entry.trim().toLowerCase());
    // Only accept exact list members here. Guessing on a secondary label adds
    // noise without adding a way to find anything.
    if (!canonical || canonical === primary) continue;
    seen.add(canonical);
    if (seen.size === 2) break;
  }

  return Array.from(seen);
}
