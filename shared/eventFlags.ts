/**
 * Deterministic extraction of the practical flags from an event's own text.
 *
 * Runs before and independently of the AI. Price text in particular is far more
 * reliable read with a regex than inferred by a model: "Free admission" is not
 * a judgement call.
 *
 * Every function returns `null` for "unknown" rather than `false`. A confident
 * "not kid-friendly" that nobody actually checked is worse than saying nothing,
 * because a reader will act on it.
 */

/** Price text that means no money changes hands. */
const FREE_PATTERNS = [
  /\bfree\b/i,
  /\bno (?:charge|cost|admission fee)\b/i,
  /^\s*\$?0(?:\.00)?\s*$/,
  /\bcomplimentary\b/i,
  /\bdonation[- ]based\b/i,
];

/** Price text that clearly means money is required, even if "free" appears. */
const NOT_FREE_PATTERNS = [
  /\$\s?[1-9]/, // any dollar amount from $1 up
  /\bticket(?:s|ed)? (?:required|start|from)\b/i,
  /\bpaid (?:admission|entry|parking only)\b/i,
];

/** Phrases that indicate an event is for adults only. */
const ADULTS_ONLY_PATTERNS = [
  /\b21\+|\b21 and over|\b21 & over|\btwenty-one and over\b/i,
  /\b18\+|\b18 and over\b/i,
  /\badults? only\b/i,
  /\bno minors\b/i,
  /\bbar crawl|pub crawl\b/i,
  /\bburlesque|\bdrag brunch\b/i,
];

/** Phrases that indicate an event welcomes children. */
const KID_FRIENDLY_PATTERNS = [
  /\ball ages\b/i,
  /\bfamily[- ]friendly\b/i,
  /\bkid[- ]friendly\b/i,
  /\bfor (?:kids|children|families)\b/i,
  /\bstorytime|story time\b/i,
  /\bchildren'?s\b/i,
  /\bpetting zoo|bounce house|face painting\b/i,
];

/** Phrases that place an event indoors. */
const INDOOR_PATTERNS = [
  /\bindoors?\b/i,
  /\btheater|theatre|auditorium|ballroom|gymnasium|arena\b/i,
  /\bgallery|museum\b/i,
];

/** Phrases that place an event outdoors. */
const OUTDOOR_PATTERNS = [
  /\boutdoors?\b/i,
  /\bopen[- ]air\b/i,
  /\brain or shine\b/i,
  /\bpark|trail|lawn|patio|beach|campground\b/i,
  /\bweather permitting\b/i,
  /\bparade|street fair|block party\b/i,
];

/** Age range phrasings we can read directly out of the text. */
const AGE_RANGE_PATTERNS: Array<[RegExp, (match: RegExpMatchArray) => string]> = [
  [/\bages?\s+(\d{1,2})\s*(?:-|–|to)\s*(\d{1,2})\b/i, (m) => `Ages ${m[1]}-${m[2]}`],
  // No trailing \b after the "+" alternative: "+" and whatever follows it are
  // both non-word characters, so a boundary there can never match.
  [/\bages?\s+(\d{1,2})\s*(?:\+|\band up\b|\band older\b)/i, (m) => `Ages ${m[1]}+`],
  [/\b(\d{1,2})\s*(?:-|–|to)\s*(\d{1,2})\s*years?\s*old\b/i, (m) => `Ages ${m[1]}-${m[2]}`],
  [/\ball ages\b/i, () => "All ages"],
  [/\b21\s*(?:\+|\band over\b|\band older\b)/i, () => "21+"],
  [/\b18\s*(?:\+|\band over\b|\band older\b)/i, () => "18+"],
];

function matchesAny(patterns: RegExp[], text: string): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

export interface EventFlagInput {
  title?: string | null;
  description?: string | null;
  price?: string | null;
  venue?: string | null;
  location?: string | null;
}

export interface EventFlags {
  isFree: boolean | null;
  isKidFriendly: boolean | null;
  ageRange: string | null;
  isIndoor: boolean | null;
}

/**
 * Read whatever the event text states outright. Anything not stated stays null
 * for the AI or curated venue data to fill in.
 */
export function extractEventFlags(input: EventFlagInput): EventFlags {
  const price = input.price ?? "";
  const body = [input.title, input.description].filter(Boolean).join(". ");
  const all = [price, body].filter(Boolean).join(". ");

  // Price first, and an explicit dollar amount beats the word "free" appearing
  // elsewhere ("free parking, tickets $25").
  let isFree: boolean | null = null;
  if (price.trim()) {
    if (matchesAny(NOT_FREE_PATTERNS, price)) isFree = false;
    else if (matchesAny(FREE_PATTERNS, price)) isFree = true;
  }
  if (isFree === null && body) {
    if (matchesAny(NOT_FREE_PATTERNS, body)) isFree = false;
    else if (matchesAny(FREE_PATTERNS, body)) isFree = true;
  }

  // Adults-only wins over a generic family phrase: "family style seating" in a
  // 21+ bar event does not make it kid-friendly.
  let isKidFriendly: boolean | null = null;
  if (matchesAny(ADULTS_ONLY_PATTERNS, all)) isKidFriendly = false;
  else if (matchesAny(KID_FRIENDLY_PATTERNS, all)) isKidFriendly = true;

  let ageRange: string | null = null;
  for (const [pattern, format] of AGE_RANGE_PATTERNS) {
    const match = all.match(pattern);
    if (match) {
      ageRange = format(match);
      break;
    }
  }

  // Outdoor cues are checked first: "arena" appears inside plenty of outdoor
  // fairground text, while "rain or shine" is unambiguous.
  let isIndoor: boolean | null = null;
  if (matchesAny(OUTDOOR_PATTERNS, all)) isIndoor = false;
  else if (matchesAny(INDOOR_PATTERNS, all)) isIndoor = true;

  return { isFree, isKidFriendly, ageRange, isIndoor };
}

/**
 * Merge flag sources by confidence: curated venue data beats text extraction,
 * which beats the AI's guess. Only fills gaps; never overwrites a known value
 * with a less trusted one.
 */
export function mergeFlags(
  ...sources: Array<Partial<EventFlags> | null | undefined>
): EventFlags {
  const merged: EventFlags = {
    isFree: null,
    isKidFriendly: null,
    ageRange: null,
    isIndoor: null,
  };

  // Later sources are lower confidence, so the first non-null value wins.
  for (const source of sources) {
    if (!source) continue;
    for (const key of Object.keys(merged) as Array<keyof EventFlags>) {
      if (merged[key] !== null) continue;
      const value = source[key];
      if (value === null || value === undefined) continue;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (merged as any)[key] = value;
    }
  }

  return merged;
}
