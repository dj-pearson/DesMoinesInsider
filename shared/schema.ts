import { sql } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

/**
 * The categories Des Moines events actually fall into.
 *
 * Deliberately not a generic events taxonomy. Farmers markets, high school
 * sports and free events each get their own category because they are how
 * people here decide what to do, and none of them are visible in a list that
 * stops at "Music, Food, Art, Outdoor, Family".
 */
export const EVENT_CATEGORIES = [
  "Music",
  "Food & Drink",
  "Farmers Markets",
  "Festivals",
  "Arts & Theater",
  "Sports",
  "High School Sports",
  "Family & Kids",
  "Outdoor & Parks",
  "Nightlife",
  "Community & Civic",
  "Fitness & Races",
  "Holiday & Seasonal",
  "Free",
] as const;

export type EventCategory = (typeof EVENT_CATEGORIES)[number];

/**
 * The metro as locals actually describe it: named neighborhoods and districts
 * inside Des Moines, plus the surrounding suburbs people live in. Everything
 * else in the schema hangs off this so content can be browsed by place.
 */
export const neighborhoods = pgTable("neighborhoods", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  // 'district' is a compact commercial area (Court Avenue, East Village),
  // 'neighborhood' a residential area of Des Moines proper, 'suburb' a
  // separate incorporated city in the metro.
  kind: text("kind").notNull(),
  description: text("description"),
  centerLat: doublePrecision("center_lat"),
  centerLng: doublePrecision("center_lng"),
  heroImageUrl: text("hero_image_url"),
});

export const NEIGHBORHOOD_KINDS = ["district", "neighborhood", "suburb"] as const;
export type NeighborhoodKind = (typeof NEIGHBORHOOD_KINDS)[number];

/**
 * The dozen or so events locals plan their year around.
 *
 * These are modelled separately from scraped events because they behave
 * differently: they recur annually, people search for them by name months in
 * advance, and what a reader wants is a guide rather than a calendar entry.
 * Scraped events for the same festival still appear, linked from the guide.
 */
export const tentpoles = pgTable("tentpoles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  /** Human label for when it usually happens, e.g. "Mid-August". */
  typicalMonth: text("typical_month"),
  // Recomputed to the next occurrence each time the app boots, so a guide is
  // never showing a date that has already passed.
  nextStartDate: timestamp("next_start_date"),
  nextEndDate: timestamp("next_end_date"),
  officialUrl: text("official_url"),
  neighborhoodId: varchar("neighborhood_id").references(() => neighborhoods.id),
  heroImageUrl: text("hero_image_url"),
  /** Array of { title, body }: the things a first-timer gets wrong. */
  insiderTips: jsonb("insider_tips"),
  whatsNewThisYear: text("whats_new_this_year"),
  isFree: boolean("is_free"),
  isKidFriendly: boolean("is_kid_friendly"),
});

export const events = pgTable("events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // URL identity for the event's own page. Nullable at the database level so
  // the column can be added to a table that already holds rows; application
  // code always populates it on insert and backfills any gaps at boot.
  slug: text("slug").unique(),
  title: text("title").notNull(),
  // Which part of the metro this belongs to. Null when the classifier could
  // not place it confidently; a wrong neighborhood is worse than none.
  neighborhoodId: varchar("neighborhood_id").references(() => neighborhoods.id),

  originalDescription: text("original_description"),
  enhancedDescription: text("enhanced_description"),
  date: timestamp("date").notNull(),
  location: text("location").notNull(),
  category: text("category").notNull(),
  // Up to two extra categories, so a free outdoor concert can be found under
  // Music, Free and Outdoor & Parks without needing duplicate rows.
  secondaryCategories: text("secondary_categories").array(),
  source: text("source").notNull(), // 'google' or 'catch-des-moines'
  sourceUrl: text("source_url"),
  imageUrl: text("image_url"),
  venue: text("venue"),
  price: text("price"),
  isEnhanced: boolean("is_enhanced").default(false),
  // Practical flags. Every one is nullable because "we do not know" is a real
  // answer and must not be rendered as a confident "no": telling a parent an
  // event is not kid-friendly when nobody checked is worse than staying quiet.
  isFree: boolean("is_free"),
  isKidFriendly: boolean("is_kid_friendly"),
  ageRange: text("age_range"),
  isIndoor: boolean("is_indoor"),
  isSkywalkAccessible: boolean("is_skywalk_accessible"),
  weatherBackup: text("weather_backup"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const restaurants = pgTable("restaurants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // URL identity for this place's own page. Nullable so the column can be
  // added to a populated table; application code always sets it.
  slug: text("slug").unique(),
  name: text("name").notNull(),
  cuisine: text("cuisine").notNull(),
  // Which part of the metro this belongs to. Null when the classifier could
  // not place it confidently; a wrong neighborhood is worse than none.
  neighborhoodId: varchar("neighborhood_id").references(() => neighborhoods.id),

  rating: integer("rating").notNull(), // 1-5 scale
  imageUrl: text("image_url"),
  description: text("description"),
  location: text("location"),
  priceRange: text("price_range"),
  searchCount: integer("search_count").default(0),
});

export const attractions = pgTable("attractions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // URL identity for this place's own page. Nullable so the column can be
  // added to a populated table; application code always sets it.
  slug: text("slug").unique(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  // Which part of the metro this belongs to. Null when the classifier could
  // not place it confidently; a wrong neighborhood is worse than none.
  neighborhoodId: varchar("neighborhood_id").references(() => neighborhoods.id),

  description: text("description"),
  imageUrl: text("image_url"),
  location: text("location"),
  searchCount: integer("search_count").default(0),
  isIndoor: boolean("is_indoor"),
  isSkywalkAccessible: boolean("is_skywalk_accessible"),
});

/**
 * Kinds of family destination. Grouped in one table because a parent deciding
 * where to take a four-year-old on a Saturday is choosing between all of them,
 * not browsing separate categories.
 */
export const PLAYGROUND_KINDS = [
  "playground",
  "splash_pad",
  "indoor_play",
  "library",
  "nature_center",
] as const;

export type PlaygroundKind = (typeof PLAYGROUND_KINDS)[number];

export const playgrounds = pgTable("playgrounds", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // URL identity for this place's own page. Nullable so the column can be
  // added to a populated table; application code always sets it.
  slug: text("slug").unique(),
  name: text("name").notNull(),
  features: text("features").notNull(),
  // Which part of the metro this belongs to. Null when the classifier could
  // not place it confidently; a wrong neighborhood is worse than none.
  neighborhoodId: varchar("neighborhood_id").references(() => neighborhoods.id),

  description: text("description"),
  imageUrl: text("image_url"),
  location: text("location"),
  ageRange: text("age_range"),
  searchCount: integer("search_count").default(0),
  isIndoor: boolean("is_indoor"),
  isSkywalkAccessible: boolean("is_skywalk_accessible"),
  // The details that decide whether a trip is worth it with small children.
  hasSplashPad: boolean("has_splash_pad"),
  hasShade: boolean("has_shade"),
  hasRestrooms: boolean("has_restrooms"),
  isFenced: boolean("is_fenced"),
  kind: text("kind").notNull().default("playground"),
  /** When it is actually open, for the seasonal ones. */
  seasonOpen: text("season_open"),
});

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const newsletterSubscriptions = pgTable("newsletter_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  subscribedAt: timestamp("subscribed_at").defaultNow(),
  // Double opt-in: an address receives nothing until it confirms. The token
  // also authorises unsubscribing, so a link cannot be used to unsubscribe
  // someone else by guessing their address.
  confirmToken: text("confirm_token"),
  confirmedAt: timestamp("confirmed_at"),
  unsubscribedAt: timestamp("unsubscribed_at"),
  /** Optional: which part of the metro they care about most. */
  neighborhoodId: varchar("neighborhood_id").references(() => neighborhoods.id),
});

/**
 * Lifecycle of a restaurant, opening through closing.
 *
 * Closings are tracked alongside openings because locals care about them just
 * as much, and no one else in this market publishes them.
 */
export const OPENING_STATUSES = [
  "announced",
  "opening_soon",
  "newly_opened",
  "closing_soon",
  "closed",
] as const;

export type OpeningStatus = (typeof OPENING_STATUSES)[number];

export const restaurantOpenings = pgTable("restaurant_openings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  // Which part of the metro this belongs to. Null when the classifier could
  // not place it confidently; a wrong neighborhood is worse than none.
  neighborhoodId: varchar("neighborhood_id").references(() => neighborhoods.id),

  description: text("description"),
  location: text("location"),
  cuisine: text("cuisine"),
  openingDate: timestamp("opening_date"),
  status: text("status").notNull(),
  sourceUrl: text("source_url"),
  slug: text("slug").unique(),
  address: text("address"),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  /** One line of first-hand context: what to order, when to avoid. */
  firstLookTip: text("first_look_tip"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas
export const insertEventSchema = createInsertSchema(events)
  .omit({
    id: true,
    createdAt: true,
    slug: true,
  })
  .extend({
    // Anything reaching the database must already be one of our categories.
    // Callers normalize scraped text with normalizeCategory() first.
    category: z.enum(EVENT_CATEGORIES),
    secondaryCategories: z.array(z.enum(EVENT_CATEGORIES)).max(2).optional().nullable(),
  });

export const insertRestaurantSchema = createInsertSchema(restaurants).omit({
  id: true,
  slug: true,
});

export const insertAttractionSchema = createInsertSchema(attractions).omit({
  id: true,
  slug: true,
});

export const insertPlaygroundSchema = createInsertSchema(playgrounds)
  .omit({
    id: true,
    slug: true,
  })
  .extend({
    kind: z.enum(PLAYGROUND_KINDS).optional(),
  });

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
});

export const insertNewsletterSchema = createInsertSchema(newsletterSubscriptions)
  .omit({
    id: true,
    subscribedAt: true,
    confirmToken: true,
    confirmedAt: true,
    unsubscribedAt: true,
  })
  .extend({
    email: z.string().email().max(320),
    neighborhoodId: z.string().uuid().optional().nullable(),
  });

export const insertRestaurantOpeningSchema = createInsertSchema(restaurantOpenings)
  .omit({
    id: true,
    createdAt: true,
    neighborhoodId: true,
    slug: true,
  })
  .extend({
    status: z.enum(OPENING_STATUSES),
  });

export const insertNeighborhoodSchema = createInsertSchema(neighborhoods).omit({
  id: true,
});

export const insertTentpoleSchema = createInsertSchema(tentpoles).omit({
  id: true,
});

// Types
export type Neighborhood = typeof neighborhoods.$inferSelect;

/** One practical tip on a tentpole guide. */
export interface InsiderTip {
  title: string;
  body: string;
}

export type Tentpole = typeof tentpoles.$inferSelect;
export type InsertTentpole = z.infer<typeof insertTentpoleSchema>;
export type InsertNeighborhood = z.infer<typeof insertNeighborhoodSchema>;

export type Event = typeof events.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;

export type Restaurant = typeof restaurants.$inferSelect;
export type InsertRestaurant = z.infer<typeof insertRestaurantSchema>;

export type Attraction = typeof attractions.$inferSelect;
export type InsertAttraction = z.infer<typeof insertAttractionSchema>;

export type Playground = typeof playgrounds.$inferSelect;
export type InsertPlayground = z.infer<typeof insertPlaygroundSchema>;

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type NewsletterSubscription = typeof newsletterSubscriptions.$inferSelect;
export type InsertNewsletterSubscription = z.infer<typeof insertNewsletterSchema>;

export type RestaurantOpening = typeof restaurantOpenings.$inferSelect;
export type InsertRestaurantOpening = z.infer<typeof insertRestaurantOpeningSchema>;
