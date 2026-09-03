/**
 * Curated facts about the venues we list most often.
 *
 * The AI can guess whether an event is indoors from its description, but it
 * cannot know that Wells Fargo Arena connects to the skywalk. That is local
 * knowledge, and getting it wrong in January is the difference between a
 * reader trusting this site and not.
 *
 * The skywalk is downtown Des Moines' four-mile enclosed second-storey walkway.
 * A venue counts as skywalk-accessible only if you can reach it from a skywalk
 * link without going outside. Being downtown is not enough: Cowles Commons and
 * the Pappajohn Sculpture Park are both central and both fully exposed.
 */

export interface VenueFacts {
  /** Canonical display name. */
  name: string;
  /** Lower-case names and abbreviations that should resolve to this venue. */
  aliases: string[];
  isIndoor: boolean;
  isSkywalkAccessible: boolean;
  /** Neighborhood slug, kept here so venue data has one home. */
  neighborhoodSlug?: string;
}

export const VENUES: VenueFacts[] = [
  // ---- downtown, on the skywalk -------------------------------------------
  {
    name: "Wells Fargo Arena",
    aliases: ["wells fargo arena", "iowa events center arena"],
    isIndoor: true,
    isSkywalkAccessible: true,
    neighborhoodSlug: "downtown",
  },
  {
    name: "Iowa Events Center",
    aliases: ["iowa events center", "hy-vee hall", "community choice credit union convention center"],
    isIndoor: true,
    isSkywalkAccessible: true,
    neighborhoodSlug: "downtown",
  },
  {
    name: "Des Moines Civic Center",
    aliases: ["civic center", "des moines civic center", "des moines performing arts", "stoner theater"],
    isIndoor: true,
    isSkywalkAccessible: true,
    neighborhoodSlug: "downtown",
  },
  {
    name: "Capital Square",
    aliases: ["capital square", "capitol square"],
    isIndoor: true,
    isSkywalkAccessible: true,
    neighborhoodSlug: "downtown",
  },
  {
    name: "Science Center of Iowa",
    aliases: ["science center of iowa", "sciowa", "science center"],
    isIndoor: true,
    isSkywalkAccessible: true,
    neighborhoodSlug: "western-gateway",
  },
  {
    name: "Des Moines Central Library",
    aliases: ["central library", "des moines public library central"],
    isIndoor: true,
    isSkywalkAccessible: true,
    neighborhoodSlug: "western-gateway",
  },

  // ---- downtown, indoors but off the skywalk -------------------------------
  {
    name: "Temple for Performing Arts",
    aliases: ["temple for performing arts", "temple theater"],
    isIndoor: true,
    isSkywalkAccessible: false,
    neighborhoodSlug: "downtown",
  },
  {
    name: "Wooly's",
    aliases: ["wooly's", "woolys", "wooly s"],
    isIndoor: true,
    isSkywalkAccessible: false,
    neighborhoodSlug: "east-village",
  },
  {
    name: "Hoyt Sherman Place",
    aliases: ["hoyt sherman place", "hoyt sherman"],
    isIndoor: true,
    isSkywalkAccessible: false,
    neighborhoodSlug: "sherman-hill",
  },
  {
    name: "Iowa State Capitol",
    aliases: ["iowa state capitol", "state capitol"],
    isIndoor: true,
    isSkywalkAccessible: false,
    neighborhoodSlug: "east-village",
  },

  // ---- indoor venues elsewhere in the metro --------------------------------
  {
    name: "Des Moines Art Center",
    aliases: ["des moines art center", "art center"],
    isIndoor: true,
    isSkywalkAccessible: false,
    neighborhoodSlug: "ingersoll",
  },
  {
    name: "xBk Live",
    aliases: ["xbk", "xbk live"],
    isIndoor: true,
    isSkywalkAccessible: false,
    neighborhoodSlug: "drake",
  },
  {
    name: "Vibrant Music Hall",
    aliases: ["vibrant music hall"],
    isIndoor: true,
    isSkywalkAccessible: false,
    neighborhoodSlug: "waukee",
  },
  {
    name: "Val Air Ballroom",
    aliases: ["val air ballroom", "val aire ballroom"],
    isIndoor: true,
    isSkywalkAccessible: false,
    neighborhoodSlug: "west-des-moines",
  },
  {
    name: "Knapp Center",
    aliases: ["knapp center"],
    isIndoor: true,
    isSkywalkAccessible: false,
    neighborhoodSlug: "drake",
  },
  {
    name: "Des Moines Playhouse",
    aliases: ["des moines playhouse", "the playhouse"],
    isIndoor: true,
    isSkywalkAccessible: false,
    neighborhoodSlug: "drake",
  },
  {
    name: "State Historical Museum of Iowa",
    aliases: ["state historical museum", "state historical building"],
    isIndoor: true,
    isSkywalkAccessible: false,
    neighborhoodSlug: "east-village",
  },
  {
    name: "Prairie Meadows",
    aliases: ["prairie meadows"],
    isIndoor: true,
    isSkywalkAccessible: false,
    neighborhoodSlug: "altoona",
  },

  // ---- outdoor venues ------------------------------------------------------
  {
    name: "Principal Park",
    aliases: ["principal park"],
    isIndoor: false,
    isSkywalkAccessible: false,
    neighborhoodSlug: "downtown",
  },
  {
    name: "Cowles Commons",
    aliases: ["cowles commons"],
    isIndoor: false,
    isSkywalkAccessible: false,
    neighborhoodSlug: "downtown",
  },
  {
    name: "Pappajohn Sculpture Park",
    aliases: ["pappajohn sculpture park", "sculpture park"],
    isIndoor: false,
    isSkywalkAccessible: false,
    neighborhoodSlug: "western-gateway",
  },
  {
    name: "Historic Court District",
    aliases: ["historic court district", "court avenue district"],
    isIndoor: false,
    isSkywalkAccessible: false,
    neighborhoodSlug: "court-avenue",
  },
  {
    name: "Gray's Lake Park",
    aliases: ["gray's lake park", "grays lake park", "gray's lake", "grays lake"],
    isIndoor: false,
    isSkywalkAccessible: false,
    neighborhoodSlug: "grays-lake",
  },
  {
    name: "Lauridsen Amphitheater at Water Works Park",
    aliases: ["lauridsen amphitheater", "water works park", "water works"],
    isIndoor: false,
    isSkywalkAccessible: false,
    neighborhoodSlug: "grays-lake",
  },
  {
    name: "Iowa State Fairgrounds",
    aliases: ["iowa state fairgrounds", "state fairgrounds", "iowa state fair"],
    isIndoor: false,
    isSkywalkAccessible: false,
  },
  {
    name: "Blank Park Zoo",
    aliases: ["blank park zoo"],
    isIndoor: false,
    isSkywalkAccessible: false,
    neighborhoodSlug: "south-side",
  },
  {
    name: "Adventureland",
    aliases: ["adventureland"],
    isIndoor: false,
    isSkywalkAccessible: false,
    neighborhoodSlug: "altoona",
  },
  {
    name: "Historic Valley Junction",
    aliases: ["historic valley junction", "valley junction"],
    isIndoor: false,
    isSkywalkAccessible: false,
    neighborhoodSlug: "valley-junction",
  },
  {
    name: "Raccoon River Park",
    aliases: ["raccoon river park"],
    isIndoor: false,
    isSkywalkAccessible: false,
    neighborhoodSlug: "west-des-moines",
  },
  {
    name: "Living History Farms",
    aliases: ["living history farms"],
    isIndoor: false,
    isSkywalkAccessible: false,
    neighborhoodSlug: "urbandale",
  },
  {
    name: "Drake Stadium",
    aliases: ["drake stadium"],
    isIndoor: false,
    isSkywalkAccessible: false,
    neighborhoodSlug: "drake",
  },
];

/** Alias lookup built once at module load. */
const BY_ALIAS = new Map<string, VenueFacts>();
for (const venue of VENUES) {
  BY_ALIAS.set(venue.name.toLowerCase(), venue);
  for (const alias of venue.aliases) {
    BY_ALIAS.set(alias.toLowerCase(), venue);
  }
}

/**
 * Look up curated facts for a venue.
 *
 * Tries an exact alias match first, then checks whether any alias appears
 * inside the given text, so "Des Moines Civic Center - Main Stage" still
 * resolves. Longer aliases are preferred so a specific match is not lost to a
 * shorter substring.
 */
export function findVenueFacts(
  ...candidates: Array<string | null | undefined>
): VenueFacts | undefined {
  const texts = candidates
    .filter((text): text is string => Boolean(text && text.trim()))
    .map((text) => text.toLowerCase().trim());

  for (const text of texts) {
    const exact = BY_ALIAS.get(text);
    if (exact) return exact;
  }

  const aliases = Array.from(BY_ALIAS.keys()).sort((a, b) => b.length - a.length);
  for (const text of texts) {
    for (const alias of aliases) {
      if (text.includes(alias)) return BY_ALIAS.get(alias);
    }
  }

  return undefined;
}
