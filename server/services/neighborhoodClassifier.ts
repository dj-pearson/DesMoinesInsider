/**
 * Work out which part of the metro a piece of content belongs to.
 *
 * Two signals, in order of trust:
 *  1. Keywords in the venue name, location text or address. A venue name is the
 *     strongest signal we have, so venues are matched before street names.
 *  2. A bounding box around coordinates, when we have them.
 *
 * When neither is confident the answer is null. A wrong neighborhood is worse
 * than no neighborhood: it puts an East Village show on the Ankeny page, and
 * the reader stops trusting every other listing on it.
 */

interface KeywordRule {
  /** Slug of the neighborhood these keywords indicate. */
  slug: string;
  /**
   * Lower-case phrases to look for. Matched on word boundaries so "clive"
   * cannot match inside another word.
   */
  keywords: string[];
  /**
   * Higher wins when several rules match. Venue names outrank street names,
   * and specific districts outrank the suburb that contains them.
   */
  priority: number;
}

/**
 * Rules are ordered by how specific the signal is, not alphabetically.
 *
 * Priority tiers:
 *   30  a named venue or landmark, which pins a location exactly
 *   20  a district inside a larger city, checked before that city
 *   10  a street or corridor name
 *    5  a bare city name
 */
const KEYWORD_RULES: KeywordRule[] = [
  // ---- named venues and landmarks (priority 30) ----------------------------
  { slug: "downtown", priority: 30, keywords: [
    "wells fargo arena", "iowa events center", "hy-vee hall", "community choice credit union convention center",
    "civic center", "des moines civic center", "cowles commons", "temple for performing arts",
    "principal park", "des moines performing arts", "stoner theater",
  ]},
  { slug: "western-gateway", priority: 30, keywords: [
    "pappajohn sculpture park", "science center of iowa", "central library", "world food prize",
    "kum & go theater", "brenton skating plaza",
  ]},
  { slug: "east-village", priority: 30, keywords: [
    "wooly's", "woolys", "iowa state capitol", "state capitol", "state historical museum",
    "franklin junior high", "east village",
  ]},
  { slug: "court-avenue", priority: 30, keywords: [
    "historic court district", "court avenue district", "downtown farmers' market",
    "downtown farmers market", "el bait shop",
  ]},
  { slug: "sherman-hill", priority: 30, keywords: ["hoyt sherman", "hoyt sherman place"] },
  { slug: "drake", priority: 30, keywords: [
    "drake university", "knapp center", "drake stadium", "drake relays", "xbk", "xbk live",
    "mars cafe", "des moines playhouse",
  ]},
  { slug: "grays-lake", priority: 30, keywords: [
    "gray's lake", "grays lake", "water works park", "lauridsen amphitheater", "kruidenier trail",
  ]},
  { slug: "south-side", priority: 30, keywords: ["blank park zoo", "ewing park"] },
  { slug: "ingersoll", priority: 30, keywords: [
    "des moines art center", "greenwood park", "ashworth pool", "salisbury house",
  ]},
  { slug: "valley-junction", priority: 30, keywords: [
    "valley junction", "historic valley junction", "valley junction farmers market",
  ]},
  { slug: "west-des-moines", priority: 30, keywords: [
    "val air ballroom", "val aire ballroom", "jordan creek", "raccoon river park",
    "walnut creek park", "rollins park",
  ]},
  { slug: "waukee", priority: 30, keywords: ["vibrant music hall", "centennial park"] },
  { slug: "altoona", priority: 30, keywords: ["adventureland", "prairie meadows", "outlets of des moines"] },
  { slug: "urbandale", priority: 30, keywords: ["living history farms", "walker johnston park"] },
  { slug: "clive", priority: 30, keywords: ["clive greenbelt", "clive aquatic center"] },
  { slug: "indianola", priority: 30, keywords: [
    "simpson college", "national balloon classic", "des moines metro opera",
  ]},
  { slug: "pleasant-hill", priority: 30, keywords: ["copper creek", "chichaqua"] },
  { slug: "beaverdale", priority: 30, keywords: ["beaverdale fall festival", "ashby park"] },
  { slug: "highland-park", priority: 30, keywords: ["union park", "heritage carousel"] },
  { slug: "merle-hay", priority: 30, keywords: ["merle hay mall"] },

  // ---- districts inside a larger city (priority 20) ------------------------
  // These must be checked before the city that contains them.
  { slug: "valley-junction", priority: 20, keywords: ["5th street", "fifth street"] },
  { slug: "downtown", priority: 20, keywords: ["downtown des moines", "skywalk"] },

  // ---- streets and corridors (priority 10) --------------------------------
  { slug: "court-avenue", priority: 10, keywords: ["court ave", "court avenue"] },
  { slug: "ingersoll", priority: 10, keywords: ["ingersoll ave", "ingersoll avenue"] },
  { slug: "beaverdale", priority: 10, keywords: ["beaver ave", "beaver avenue", "beaverdale"] },
  { slug: "highland-park", priority: 10, keywords: ["6th ave", "sixth avenue", "euclid ave"] },
  { slug: "merle-hay", priority: 10, keywords: ["merle hay road", "merle hay rd"] },
  { slug: "sherman-hill", priority: 10, keywords: ["woodland ave", "center street"] },
  { slug: "east-village", priority: 10, keywords: ["east locust", "e locust", "east grand"] },

  // ---- bare city names (priority 5) ---------------------------------------
  { slug: "west-des-moines", priority: 5, keywords: ["west des moines", "wdm"] },
  { slug: "ankeny", priority: 5, keywords: ["ankeny"] },
  { slug: "johnston", priority: 5, keywords: ["johnston"] },
  { slug: "urbandale", priority: 5, keywords: ["urbandale"] },
  { slug: "waukee", priority: 5, keywords: ["waukee"] },
  { slug: "altoona", priority: 5, keywords: ["altoona"] },
  { slug: "clive", priority: 5, keywords: ["clive"] },
  { slug: "grimes", priority: 5, keywords: ["grimes"] },
  { slug: "pleasant-hill", priority: 5, keywords: ["pleasant hill"] },
  { slug: "norwalk", priority: 5, keywords: ["norwalk"] },
  { slug: "indianola", priority: 5, keywords: ["indianola"] },
  { slug: "downtown", priority: 5, keywords: ["downtown"] },
];

/** Rough boxes used only when text gives us nothing. */
interface BoundingBox {
  slug: string;
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

const BOUNDING_BOXES: BoundingBox[] = [
  { slug: "east-village", minLat: 41.583, maxLat: 41.596, minLng: -93.62, maxLng: -93.605 },
  { slug: "court-avenue", minLat: 41.582, maxLat: 41.588, minLng: -93.629, maxLng: -93.62 },
  { slug: "western-gateway", minLat: 41.582, maxLat: 41.592, minLng: -93.642, maxLng: -93.629 },
  { slug: "downtown", minLat: 41.578, maxLat: 41.598, minLng: -93.642, maxLng: -93.605 },
  { slug: "sherman-hill", minLat: 41.586, maxLat: 41.596, minLng: -93.648, maxLng: -93.634 },
  { slug: "drake", minLat: 41.594, maxLat: 41.61, minLng: -93.665, maxLng: -93.645 },
  { slug: "grays-lake", minLat: 41.558, maxLat: 41.575, minLng: -93.645, maxLng: -93.62 },
  { slug: "beaverdale", minLat: 41.605, maxLat: 41.628, minLng: -93.695, maxLng: -93.668 },
  { slug: "highland-park", minLat: 41.618, maxLat: 41.64, minLng: -93.632, maxLng: -93.605 },
  { slug: "merle-hay", minLat: 41.612, maxLat: 41.638, minLng: -93.705, maxLng: -93.678 },
  { slug: "south-side", minLat: 41.52, maxLat: 41.565, minLng: -93.65, maxLng: -93.58 },
  { slug: "valley-junction", minLat: 41.566, maxLat: 41.58, minLng: -93.722, maxLng: -93.705 },
  { slug: "west-des-moines", minLat: 41.53, maxLat: 41.6, minLng: -93.79, maxLng: -93.7 },
  { slug: "clive", minLat: 41.59, maxLat: 41.62, minLng: -93.79, maxLng: -93.71 },
  { slug: "urbandale", minLat: 41.61, maxLat: 41.66, minLng: -93.79, maxLng: -93.69 },
  { slug: "johnston", minLat: 41.65, maxLat: 41.71, minLng: -93.74, maxLng: -93.66 },
  { slug: "ankeny", minLat: 41.69, maxLat: 41.78, minLng: -93.65, maxLng: -93.55 },
  { slug: "grimes", minLat: 41.66, maxLat: 41.72, minLng: -93.83, maxLng: -93.75 },
  { slug: "waukee", minLat: 41.58, maxLat: 41.64, minLng: -93.93, maxLng: -93.85 },
  { slug: "altoona", minLat: 41.62, maxLat: 41.68, minLng: -93.51, maxLng: -93.42 },
  { slug: "pleasant-hill", minLat: 41.56, maxLat: 41.61, minLng: -93.56, maxLng: -93.48 },
  { slug: "norwalk", minLat: 41.45, maxLat: 41.5, minLng: -93.72, maxLng: -93.64 },
  { slug: "indianola", minLat: 41.33, maxLat: 41.39, minLng: -93.6, maxLng: -93.52 },
];

/** Escape a phrase for use inside a regular expression. */
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Match on word boundaries so "clive" does not fire inside "Cliveden" and
 * "grimes" does not fire inside a surname. Phrases containing punctuation
 * (like "wooly's") still work because we only anchor the outer edges.
 */
function containsKeyword(haystack: string, keyword: string): boolean {
  const pattern = new RegExp(`(^|[^a-z0-9])${escapeRegExp(keyword)}([^a-z0-9]|$)`, "i");
  return pattern.test(haystack);
}

export interface ClassifyInput {
  venue?: string | null;
  location?: string | null;
  address?: string | null;
  title?: string | null;
  lat?: number | null;
  lng?: number | null;
}

/**
 * Return the slug of the best-matching neighborhood, or null when nothing
 * matches confidently.
 */
export function classifyNeighborhoodSlug(input: ClassifyInput): string | null {
  // Venue is the most reliable field, so weight matches found there above the
  // same keyword appearing in free-text location or title.
  const fields: Array<{ text: string; weight: number }> = [
    { text: input.venue ?? "", weight: 3 },
    { text: input.address ?? "", weight: 2 },
    { text: input.location ?? "", weight: 2 },
    { text: input.title ?? "", weight: 1 },
  ].filter((field) => field.text.trim().length > 0);

  let best: { slug: string; score: number } | null = null;

  for (const rule of KEYWORD_RULES) {
    for (const field of fields) {
      for (const keyword of rule.keywords) {
        if (!containsKeyword(field.text, keyword)) continue;

        // Longer keywords are more specific, so let length break ties between
        // rules of equal priority ("west des moines" beats "downtown").
        const score = rule.priority * 10 + field.weight * 2 + keyword.length / 100;
        if (!best || score > best.score) {
          best = { slug: rule.slug, score };
        }
      }
    }
  }

  if (best) return best.slug;

  // Fall back to coordinates. Smaller boxes are checked first so a district
  // inside downtown wins over downtown itself.
  if (typeof input.lat === "number" && typeof input.lng === "number") {
    const area = (box: BoundingBox) =>
      (box.maxLat - box.minLat) * (box.maxLng - box.minLng);

    const matches = BOUNDING_BOXES.filter(
      (box) =>
        input.lat! >= box.minLat &&
        input.lat! <= box.maxLat &&
        input.lng! >= box.minLng &&
        input.lng! <= box.maxLng,
    ).sort((a, b) => area(a) - area(b));

    if (matches.length > 0) return matches[0].slug;
  }

  return null;
}

/**
 * Convenience wrapper that resolves the slug to an id using a lookup map.
 * Returns null when unmatched or when the slug is not in the map.
 */
export function classifyNeighborhoodId(
  input: ClassifyInput,
  slugToId: Map<string, string>,
): string | null {
  const slug = classifyNeighborhoodSlug(input);
  if (!slug) return null;
  return slugToId.get(slug) ?? null;
}
