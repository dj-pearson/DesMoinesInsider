import { sql } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
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

/**
 * Curated local knowledge about the places events happen.
 *
 * This exists so the AI never has to guess. A model can rewrite a description,
 * but it cannot know that the ramp on Second Street empties faster than the one
 * on Court, or that the Civic Center has no parking of its own. Those facts are
 * the difference between a listing and a recommendation, and they are fed to
 * the model as context rather than invented by it.
 */
export const venues = pgTable("venues", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  address: text("address"),
  neighborhoodId: varchar("neighborhood_id").references(() => neighborhoods.id),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  /** Where to actually park, and what to avoid. */
  parkingNotes: text("parking_notes"),
  /** Array of { name, note }: walkable places to eat before or after. */
  nearbyEats: jsonb("nearby_eats"),
  /** What a parent needs to know before bringing children. */
  kidNotes: text("kid_notes"),
  isIndoor: boolean("is_indoor"),
  isSkywalkAccessible: boolean("is_skywalk_accessible"),
  websiteUrl: text("website_url"),
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
  venueId: varchar("venue_id").references(() => venues.id),
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
  /** One sentence of local advice, written from curated venue facts. */
  insiderTip: text("insider_tip"),
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
  email: text("email").notNull().unique(),
  /** bcrypt hash. Never the password itself, and never returned by the API. */
  passwordHash: text("password_hash").notNull(),
  homeNeighborhoodId: varchar("home_neighborhood_id").references(() => neighborhoods.id),
  createdAt: timestamp("created_at").defaultNow(),
});

/** Events a reader has kept. One row per user per event. */
export const savedEvents = pgTable(
  "saved_events",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id),
    eventId: varchar("event_id")
      .notNull()
      .references(() => events.id),
    savedAt: timestamp("saved_at").defaultNow(),
  },
  (table) => ({
    // Saving twice is a no-op rather than a duplicate row.
    userEvent: unique("saved_events_user_event").on(table.userId, table.eventId),
  }),
);

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

/**
 * Events submitted by venues, organizers and residents.
 *
 * Held separately from `events` and reviewed before publication. This is the
 * table that lets in the taco truck and the block party, which a
 * membership-based listing never carries, without letting anyone write directly
 * to the public site.
 */
export const SUBMISSION_STATUSES = ["pending", "approved", "rejected"] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

export const eventSubmissions = pgTable("event_submissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description").notNull(),
  date: timestamp("date").notNull(),
  location: text("location").notNull(),
  venue: text("venue"),
  category: text("category").notNull(),
  price: text("price"),
  sourceUrl: text("source_url"),
  imageUrl: text("image_url"),
  submitterName: text("submitter_name").notNull(),
  submitterEmail: text("submitter_email").notNull(),
  status: text("status").notNull().default("pending"),
  reviewedAt: timestamp("reviewed_at"),
  /** Set when approved, so a reviewer can find what it became. */
  publishedEventId: varchar("published_event_id").references(() => events.id),
  createdAt: timestamp("created_at").defaultNow(),
});

/**
 * Short pieces of advice left by residents.
 *
 * A single table across every content type, because a tip is the same shape
 * whatever it is attached to and one polymorphic table beats five near-identical
 * ones. It is the layer no aggregator has: the person who has actually parked
 * there telling you which ramp to use.
 */
export const TIP_TARGET_TYPES = [
  "event",
  "restaurant",
  "attraction",
  "playground",
  "venue",
] as const;
export type TipTargetType = (typeof TIP_TARGET_TYPES)[number];

export const TIP_STATUSES = ["visible", "hidden"] as const;
export type TipStatus = (typeof TIP_STATUSES)[number];

export const tips = pgTable(
  "tips",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    targetType: text("target_type").notNull(),
    targetId: varchar("target_id").notNull(),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id),
    body: text("body").notNull(),
    status: text("status").notNull().default("visible"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    // One tip per person per thing, so a single voice cannot fill a page.
    userTarget: unique("tips_user_target").on(
      table.userId,
      table.targetType,
      table.targetId,
    ),
  }),
);

// Insert schemas
export const insertEventSchema = createInsertSchema(events)
  .omit({
    id: true,
    createdAt: true,
    slug: true,
  })
  .omit({ venueId: true })
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

/**
 * Registration input.
 *
 * The password is accepted here and hashed before it reaches the database; the
 * table stores only `passwordHash`, which no API response ever includes.
 */
export const registerUserSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3)
    .max(30)
    .regex(/^[a-zA-Z0-9_-]+$/, "Letters, numbers, hyphens and underscores only"),
  email: z.string().trim().email().max(320),
  // Length is the property that actually matters; composition rules mostly
  // push people towards predictable substitutions.
  password: z.string().min(10).max(200),
  homeNeighborhoodId: z.string().uuid().optional().nullable(),
});

export const loginSchema = z.object({
  username: z.string().trim().min(1).max(320),
  password: z.string().min(1).max(200),
});

export const insertTipSchema = z.object({
  targetType: z.enum(TIP_TARGET_TYPES),
  targetId: z.string().uuid(),
  // 280 characters keeps a tip a tip. Anything longer is a review.
  body: z.string().trim().min(4).max(280),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
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

export const insertVenueSchema = createInsertSchema(venues).omit({
  id: true,
});

/**
 * What the public form accepts.
 *
 * Only http and https URLs: a submitted `javascript:` link would become a
 * clickable anchor on a published page.
 */
const submittedUrl = z
  .string()
  .trim()
  .max(2048)
  .url()
  .refine((value) => /^https?:\/\//i.test(value), {
    message: "Links must start with http:// or https://",
  });

export const insertEventSubmissionSchema = createInsertSchema(eventSubmissions)
  .omit({
    id: true,
    status: true,
    reviewedAt: true,
    publishedEventId: true,
    createdAt: true,
  })
  .extend({
    title: z.string().trim().min(3).max(200),
    description: z.string().trim().min(10).max(2000),
    location: z.string().trim().min(2).max(200),
    venue: z.string().trim().max(200).optional().nullable(),
    price: z.string().trim().max(100).optional().nullable(),
    category: z.enum(EVENT_CATEGORIES),
    sourceUrl: submittedUrl.optional().nullable(),
    imageUrl: submittedUrl.optional().nullable(),
    submitterName: z.string().trim().min(2).max(120),
    submitterEmail: z.string().trim().email().max(320),
    date: z.coerce.date(),
  });

// Types
export type Neighborhood = typeof neighborhoods.$inferSelect;

/** One practical tip on a tentpole guide. */
export interface InsiderTip {
  title: string;
  body: string;
}

/** One walkable option near a venue. */
export interface NearbyEat {
  name: string;
  note: string;
}

export type EventSubmission = typeof eventSubmissions.$inferSelect;
export type InsertEventSubmission = z.infer<typeof insertEventSubmissionSchema>;

export type Venue = typeof venues.$inferSelect;
export type InsertVenue = z.infer<typeof insertVenueSchema>;

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

/**
 * One source's result on one scrape run.
 *
 * Scrapers fail quietly: a venue changes its markup and that source returns
 * zero events while every other source keeps working, so the totals still look
 * healthy. Recording every attempt — including the successful ones with a count
 * of zero — is what makes "Wooly's has returned nothing for nine days" a
 * question someone can actually ask.
 */
export const scrapeRuns = pgTable("scrape_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  source: text("source").notNull(),
  ok: boolean("ok").notNull(),
  eventCount: integer("event_count").notNull().default(0),
  durationMs: integer("duration_ms").notNull().default(0),
  /** Null on success. The message only, never a stack. */
  error: text("error"),
  startedAt: timestamp("started_at").defaultNow(),
});

/**
 * An event on its way into the database, with the one field that is resolved
 * rather than stored: a source that knows its own neighborhood passes the slug,
 * and storage turns it into an id. Without this the keyword classifier would
 * re-guess something the source already stated.
 */
export type EventToCreate = InsertEvent & { neighborhoodSlug?: string };

export type ScrapeRun = typeof scrapeRuns.$inferSelect;

export interface InsertScrapeRun {
  source: string;
  ok: boolean;
  eventCount: number;
  durationMs: number;
  error?: string;
}

/** What the API returns for a user. Never includes the hash. */
export type PublicUser = Pick<
  User,
  "id" | "username" | "email" | "homeNeighborhoodId" | "createdAt"
>;

export type SavedEvent = typeof savedEvents.$inferSelect;

export type Tip = typeof tips.$inferSelect;
export type InsertTip = z.infer<typeof insertTipSchema>;

/** A tip as the API returns it: the author's name, never their email. */
export interface TipWithAuthor {
  id: string;
  body: string;
  createdAt: Date | null;
  authorUsername: string;
}
export type InsertUser = z.infer<typeof insertUserSchema>;

export type NewsletterSubscription = typeof newsletterSubscriptions.$inferSelect;
export type InsertNewsletterSubscription = z.infer<typeof insertNewsletterSchema>;

export type RestaurantOpening = typeof restaurantOpenings.$inferSelect;
export type InsertRestaurantOpening = z.infer<typeof insertRestaurantOpeningSchema>;
