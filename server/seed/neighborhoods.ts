import type { InsertNeighborhood } from "@shared/schema";

/**
 * The Des Moines metro as residents describe it.
 *
 * Three kinds:
 *  - district: a compact commercial area people name when making plans
 *    ("meet in the East Village"), usually walkable and inside Des Moines.
 *  - neighborhood: a residential area of Des Moines proper.
 *  - suburb: a separate incorporated city in the metro.
 *
 * Coordinates are approximate centers, used by the classifier's bounding-box
 * fallback and by future map views.
 */
export const seedNeighborhoods: InsertNeighborhood[] = [
  // ---------------------------------------------------------------- districts
  {
    slug: "downtown",
    name: "Downtown",
    kind: "district",
    description:
      "The core: Wells Fargo Arena, the Civic Center, the skywalk system and the weekday lunch crowd. Most big-ticket events happen here.",
    centerLat: 41.5868,
    centerLng: -93.625,
  },
  {
    slug: "east-village",
    name: "East Village",
    kind: "district",
    description:
      "Independent shops, bars and restaurants in the blocks between the river and the Capitol. Walkable, and the easiest downtown parking to actually find.",
    centerLat: 41.5885,
    centerLng: -93.6134,
  },
  {
    slug: "court-avenue",
    name: "Court Avenue",
    kind: "district",
    description:
      "The nightlife strip, and home of the Downtown Farmers' Market on summer Saturdays. Loud late, quiet early.",
    centerLat: 41.5856,
    centerLng: -93.6244,
  },
  {
    slug: "western-gateway",
    name: "Western Gateway",
    kind: "district",
    description:
      "The Pappajohn Sculpture Park, the central library and the Science Center sit along this green corridor on downtown's west edge.",
    centerLat: 41.5866,
    centerLng: -93.635,
  },
  {
    slug: "ingersoll",
    name: "Ingersoll",
    kind: "district",
    description:
      "A restaurant and bar corridor running west from downtown, anchored by long-standing neighborhood spots rather than chains.",
    centerLat: 41.586,
    centerLng: -93.66,
  },
  {
    slug: "valley-junction",
    name: "Historic Valley Junction",
    kind: "district",
    description:
      "Fifth Street in West Des Moines: antique shops, a summer farmers market and live music on warm evenings.",
    centerLat: 41.573,
    centerLng: -93.713,
  },
  {
    slug: "merle-hay",
    name: "Merle Hay",
    kind: "district",
    description:
      "The mall and the retail corridor around it on the northwest side, plus a growing set of family-run restaurants.",
    centerLat: 41.625,
    centerLng: -93.69,
  },

  // ------------------------------------------------------------ neighborhoods
  {
    slug: "sherman-hill",
    name: "Sherman Hill",
    kind: "neighborhood",
    description:
      "Victorian houses on the hill just west of downtown, with Hoyt Sherman Place and its theater at the center.",
    centerLat: 41.5905,
    centerLng: -93.639,
  },
  {
    slug: "drake",
    name: "Drake",
    kind: "neighborhood",
    description:
      "The blocks around Drake University. Student-priced food, the Drake Relays every April, and live music at xBk.",
    centerLat: 41.6019,
    centerLng: -93.6533,
  },
  {
    slug: "beaverdale",
    name: "Beaverdale",
    kind: "neighborhood",
    description:
      "Brick Tudors, a tight-knit main street on Beaver Avenue, and the Beaverdale Fall Festival every September.",
    centerLat: 41.6156,
    centerLng: -93.682,
  },
  {
    slug: "highland-park",
    name: "Highland Park",
    kind: "neighborhood",
    description:
      "A north-side neighborhood along Sixth Avenue with a revived small business strip and Union Park nearby.",
    centerLat: 41.628,
    centerLng: -93.618,
  },
  {
    slug: "grays-lake",
    name: "Gray's Lake",
    kind: "neighborhood",
    description:
      "The lake, the lit Kruidenier Trail bridge and Water Works Park. The metro's default place for a walk with a skyline view.",
    centerLat: 41.567,
    centerLng: -93.632,
  },
  {
    slug: "south-side",
    name: "South Side",
    kind: "neighborhood",
    description:
      "Des Moines' Italian-American heart, with Blank Park Zoo, long-standing family restaurants and the SW Ninth corridor.",
    centerLat: 41.55,
    centerLng: -93.61,
  },

  // ------------------------------------------------------------------ suburbs
  {
    slug: "west-des-moines",
    name: "West Des Moines",
    kind: "suburb",
    description:
      "The metro's largest suburb: Jordan Creek, Raccoon River Park, the Val Air Ballroom and Historic Valley Junction.",
    centerLat: 41.5772,
    centerLng: -93.7113,
  },
  {
    slug: "ankeny",
    name: "Ankeny",
    kind: "suburb",
    description:
      "Fast-growing northern suburb with a dense calendar of city-run festivals, parks and youth sports.",
    centerLat: 41.7317,
    centerLng: -93.6001,
  },
  {
    slug: "johnston",
    name: "Johnston",
    kind: "suburb",
    description:
      "Northwest suburb along the Saylorville corridor, with trail access and a busy parks and recreation calendar.",
    centerLat: 41.673,
    centerLng: -93.6977,
  },
  {
    slug: "urbandale",
    name: "Urbandale",
    kind: "suburb",
    description:
      "Home to Living History Farms and Walnut Creek trail access, plus a long stretch of Douglas Avenue restaurants.",
    centerLat: 41.6266,
    centerLng: -93.7122,
  },
  {
    slug: "waukee",
    name: "Waukee",
    kind: "suburb",
    description:
      "Western edge of the metro and one of Iowa's fastest-growing cities. Vibrant Music Hall draws touring acts here.",
    centerLat: 41.6122,
    centerLng: -93.8858,
  },
  {
    slug: "altoona",
    name: "Altoona",
    kind: "suburb",
    description:
      "East metro suburb with Adventureland and Prairie Meadows, so most of its calendar is day-trip scale.",
    centerLat: 41.6444,
    centerLng: -93.4646,
  },
  {
    slug: "clive",
    name: "Clive",
    kind: "suburb",
    description:
      "Quiet western suburb built around the Clive Greenbelt Trail and its stretch of Walnut Creek.",
    centerLat: 41.6031,
    centerLng: -93.7241,
  },
  {
    slug: "grimes",
    name: "Grimes",
    kind: "suburb",
    description:
      "Northwest suburb growing fast along Highway 141, with a well-used community complex and summer festival.",
    centerLat: 41.6883,
    centerLng: -93.7913,
  },
  {
    slug: "pleasant-hill",
    name: "Pleasant Hill",
    kind: "suburb",
    description:
      "East metro suburb bordering Copper Creek Lake and the Chichaqua Valley Trail.",
    centerLat: 41.5836,
    centerLng: -93.5152,
  },
  {
    slug: "norwalk",
    name: "Norwalk",
    kind: "suburb",
    description:
      "Southern suburb just past the Raccoon River, with a fast-growing school district and summer festival.",
    centerLat: 41.4747,
    centerLng: -93.6791,
  },
  {
    slug: "indianola",
    name: "Indianola",
    kind: "suburb",
    description:
      "South of the metro, home to Simpson College, the Des Moines Metro Opera and the National Balloon Classic.",
    centerLat: 41.3581,
    centerLng: -93.5574,
  },
];
