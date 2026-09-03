import type {
  InsertAttraction,
  InsertEvent,
  InsertRestaurant,
} from "@shared/schema";

/**
 * Baseline content used to bootstrap an empty database (and to populate the
 * in-memory fallback store in development).
 *
 * Two rules apply to everything in this file:
 *  1. Every `sourceUrl` points at the venue or organizer that actually runs the
 *     thing. We never send a reader to an aggregator we are competing with.
 *  2. Seed events are dated relative to "now" so a fresh install always has
 *     upcoming events to show. Hard-coded dates go stale and leave the home
 *     page empty.
 */

/** Returns a date `days` from today, at the given local hour and minute. */
function daysFromNow(days: number, hour: number, minute = 0): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, minute, 0, 0);
  return date;
}

export const seedRestaurants: InsertRestaurant[] = [
  {
    name: "The Continental",
    cuisine: "Modern American",
    rating: 5,
    description: "Upscale dining with contemporary American cuisine",
    location: "Downtown Des Moines",
    priceRange: "$$$",
    searchCount: 150,
    imageUrl:
      "https://images.unsplash.com/photo-1514933651103-005eec06c04b?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=400",
  },
  {
    name: "Mars Cafe",
    cuisine: "Coffee & Light Bites",
    rating: 5,
    description: "Local coffee shop with fresh pastries and light meals",
    location: "Drake Neighborhood",
    priceRange: "$",
    searchCount: 120,
    imageUrl:
      "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=400",
  },
  {
    name: "El Bait Shop",
    cuisine: "American & Craft Beer",
    rating: 5,
    description:
      "Court Avenue mainstay with one of the largest draft beer lists in the country",
    location: "Court Avenue, Des Moines",
    priceRange: "$$",
    searchCount: 100,
    imageUrl:
      "https://images.unsplash.com/photo-1615141982883-c7ad0e69fd62?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=400",
  },
];

export const seedAttractions: InsertAttraction[] = [
  {
    name: "Pappajohn Sculpture Park",
    type: "Outdoor Art",
    description: "Beautiful outdoor sculpture garden in downtown Des Moines",
    location: "Western Gateway, Des Moines",
    searchCount: 200,
    isIndoor: false,
    imageUrl:
      "https://images.unsplash.com/photo-1578662996442-48f60103fc96?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=400",
  },
  {
    name: "Iowa State Capitol",
    type: "Historic Building",
    description: "Historic state capitol building with free guided tours",
    location: "East Side, Des Moines",
    searchCount: 180,
    isIndoor: true,
    imageUrl:
      "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=400",
  },
  {
    name: "High Trestle Trail",
    type: "Outdoor Recreation",
    description:
      "Scenic rail trail with the landmark lighted bridge over the Des Moines River valley",
    location: "Madrid / Woodward",
    searchCount: 160,
    isIndoor: false,
    imageUrl:
      "https://images.unsplash.com/photo-1503435980610-a51f3ddfee50?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=400",
  },
];

// Playgrounds and the other family destinations now live in ./family.ts, which
// covers splash pads, indoor play, libraries and nature centers alongside them.
export { seedFamilyPlaces as seedPlaygrounds } from "./family";

/**
 * Built as a function so the dates are computed at seed time rather than at
 * module load, and so repeated seeding of a long-running process stays fresh.
 */
export function buildSeedEvents(): InsertEvent[] {
  return [
    {
      title: "Downtown Farmers' Market",
      originalDescription: "Weekly farmers market with local vendors",
      enhancedDescription:
        "The Downtown Farmers' Market takes over the Historic Court District every Saturday morning from May through October, with hundreds of Iowa growers, bakers, and makers spread across several blocks. Come early if you want parking anywhere close, and bring cash for the stands that still prefer it.",
      date: daysFromNow(2, 7),
      location: "Historic Court District, Des Moines",
      category: "Farmers Markets",
      secondaryCategories: ["Food & Drink", "Free"],
      source: "manual",
      sourceUrl:
        "https://www.desmoinesfarmersmarket.com/",
      imageUrl:
        "https://images.unsplash.com/photo-1488459716781-31db52582fe9?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=400",
      venue: "Historic Court District",
      price: "Free admission",
      isFree: true,
      isKidFriendly: true,
      ageRange: "All ages",
      isIndoor: false,
      weatherBackup: "Runs rain or shine; the Court Avenue bars open early if it pours.",
      isEnhanced: true,
    },
    {
      title: "Iowa State Capitol Tour",
      originalDescription: "Guided tour of the Iowa State Capitol building",
      enhancedDescription:
        "Free guided tours of the Iowa State Capitol run on the hour most weekdays and cover the law library, the rotunda, and the gold dome. It is one of the better free hours in the metro, and the hill outside is a good sledding spot once there is snow.",
      date: daysFromNow(3, 14),
      location: "East Side, Des Moines",
      category: "Community & Civic",
      secondaryCategories: ["Free", "Family & Kids"],
      source: "manual",
      sourceUrl: "https://www.legis.iowa.gov/resources/tourGuide",
      imageUrl:
        "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=400",
      venue: "Iowa State Capitol",
      price: "Free",
      isFree: true,
      isKidFriendly: true,
      ageRange: "All ages",
      isIndoor: true,
      isEnhanced: true,
    },
    {
      title: "Des Moines Art Center Free Admission Day",
      originalDescription: "Gallery admission at the Des Moines Art Center",
      enhancedDescription:
        "Admission to the Des Moines Art Center is always free, which makes it the reliable answer to a cold or rainy Saturday. The building itself is worth the trip, with wings by Eliel Saarinen, I. M. Pei, and Richard Meier, and there is a small cafe if you need to bribe anyone into staying longer.",
      date: daysFromNow(4, 11),
      location: "Greenwood Park, Des Moines",
      category: "Arts & Theater",
      secondaryCategories: ["Free", "Family & Kids"],
      source: "manual",
      sourceUrl: "https://www.desmoinesartcenter.org/",
      imageUrl:
        "https://images.unsplash.com/photo-1578662996442-48f60103fc96?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=400",
      venue: "Des Moines Art Center",
      price: "Free",
      isFree: true,
      isKidFriendly: true,
      ageRange: "All ages",
      isIndoor: true,
      isEnhanced: true,
    },
    {
      title: "Gray's Lake Trail Walk",
      originalDescription: "Nature walk around Gray's Lake",
      enhancedDescription:
        "The loop around Gray's Lake is just under two miles on flat paved trail, which makes it stroller and scooter friendly. The Kruidenier Trail bridge is lit after dark and is the reason half the city's skyline photos exist.",
      date: daysFromNow(5, 9),
      location: "Gray's Lake Park, Des Moines",
      category: "Outdoor & Parks",
      secondaryCategories: ["Free", "Family & Kids"],
      source: "manual",
      sourceUrl:
        "https://www.dsm.city/departments/parks_and_recreation_division/places/grays_lake_park.php",
      imageUrl:
        "https://images.unsplash.com/photo-1576671081837-49000212a370?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=400",
      venue: "Gray's Lake Park",
      price: "Free",
      isFree: true,
      isKidFriendly: true,
      ageRange: "All ages",
      isIndoor: false,
      weatherBackup: "Nothing sheltered nearby; the Art Center is the usual wet-weather swap.",
      isEnhanced: true,
    },
    {
      title: "Live Music in Historic Valley Junction",
      originalDescription: "Live music performance in Valley Junction",
      enhancedDescription:
        "Fifth Street in Valley Junction runs live music through the warm months, with the stage set up near the shops and plenty of patio seating within earshot. Street parking fills up fast, but the lots a block off Fifth usually have room.",
      date: daysFromNow(6, 19),
      location: "Historic Valley Junction, West Des Moines",
      category: "Music",
      secondaryCategories: ["Free", "Festivals"],
      source: "manual",
      sourceUrl: "https://www.valleyjunction.com/events/",
      imageUrl:
        "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=400",
      venue: "Historic Valley Junction",
      price: "Free",
      isFree: true,
      isKidFriendly: true,
      ageRange: "All ages",
      isIndoor: false,
      isEnhanced: true,
    },
    {
      title: "Family Day at the Science Center of Iowa",
      originalDescription: "Interactive science activities for families",
      enhancedDescription:
        "The Science Center of Iowa is the standard rainy-day and deep-winter answer for families downtown. Hands-on exhibits run across three floors, the domed theater shows are included with admission, and it connects to the skywalk so you can get there without a coat.",
      date: daysFromNow(7, 10),
      location: "Western Gateway, Des Moines",
      category: "Family & Kids",
      secondaryCategories: ["Arts & Theater"],
      source: "manual",
      sourceUrl: "https://www.sciowa.org/",
      imageUrl:
        "https://images.unsplash.com/photo-1581833971358-2c8b550f87b3?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=400",
      venue: "Science Center of Iowa",
      price: "$12-18",
      isFree: false,
      isKidFriendly: true,
      ageRange: "All ages",
      isIndoor: true,
      isSkywalkAccessible: true,
      isEnhanced: true,
    },
  ];
}
