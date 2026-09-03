import {
  attractions,
  events,
  eventSubmissions,
  neighborhoods,
  tentpoles,
  venues,
  newsletterSubscriptions,
  playgrounds,
  restaurantOpenings,
  restaurants,
  users,
  savedEvents,
  tips,
  type Attraction,
  type Event,
  type EventSubmission,
  type InsertAttraction,
  type InsertEvent,
  type InsertEventSubmission,
  type InsertNeighborhood,
  type InsertNewsletterSubscription,
  type InsertPlayground,
  type InsertRestaurant,
  type InsertRestaurantOpening,
  type InsertUser,
  type Neighborhood,
  type Tentpole,
  type Venue,
  type NewsletterSubscription,
  type Playground,
  type Restaurant,
  type RestaurantOpening,
  type User,
  type PublicUser,
  type InsertTip,
  type Tip,
  type TipWithAuthor,
  scrapeRuns,
  type ScrapeRun,
  type InsertScrapeRun,
  type EventToCreate,
} from "@shared/schema";
import {
  and,
  arrayContains,
  asc,
  desc,
  eq,
  gte,
  ilike,
  isNotNull,
  isNull,
  lt,
  lte,
  or,
  sql,
} from "drizzle-orm";
import { buildEventSlug, buildPlaceSlug, ensureUniqueSlug } from "@shared/slug";
import { isEventCategory, normalizeCategory } from "@shared/categories";
import { extractEventFlags, mergeFlags } from "@shared/eventFlags";
import { findVenueFacts } from "./data/venues";
import { randomUUID } from "crypto";
import { getDb, isDatabaseConfigured } from "./db";
import {
  classifyNeighborhoodSlug,
  type ClassifyInput,
} from "./services/neighborhoodClassifier";
import { seedNeighborhoods } from "./seed/neighborhoods";
import { seedVenues } from "./seed/venues";
import { resolveNextOccurrence, seedTentpoles } from "./seed/tentpoles";
import {
  buildSeedEvents,
  seedAttractions,
  seedPlaygrounds,
  seedRestaurants,
} from "./seed/data";

/** A neighborhood plus how much content currently sits in it. */
export interface NeighborhoodWithCounts extends Neighborhood {
  upcomingEventCount: number;
  restaurantOpeningCount: number;
  playgroundCount: number;
  restaurantCount: number;
  attractionCount: number;
}

/** Everything shown on a neighborhood's landing page. */
export interface NeighborhoodContent {
  neighborhood: NeighborhoodWithCounts;
  upcomingEvents: Event[];
  restaurantOpenings: RestaurantOpening[];
  restaurants: Restaurant[];
  attractions: Attraction[];
  playgrounds: Playground[];
}

/** A tentpole guide plus the scraped events that belong to it. */
export interface TentpoleWithEvents {
  tentpole: Tentpole;
  neighborhood: Neighborhood | null;
  relatedEvents: Event[];
}

export interface IStorage {
  // Community submissions
  createSubmission(submission: InsertEventSubmission): Promise<EventSubmission>;
  getSubmissions(status?: string): Promise<EventSubmission[]>;
  getSubmission(id: string): Promise<EventSubmission | undefined>;
  markSubmissionReviewed(
    id: string,
    status: "approved" | "rejected",
    publishedEventId?: string | null,
  ): Promise<EventSubmission | undefined>;

  // Venues
  getVenueById(id: string): Promise<Venue | undefined>;

  // Tentpoles
  getTentpoles(): Promise<Tentpole[]>;
  getUpcomingTentpoles(limit?: number): Promise<Tentpole[]>;
  getTentpoleBySlug(slug: string): Promise<TentpoleWithEvents | undefined>;

  // Neighborhoods
  getNeighborhoods(): Promise<NeighborhoodWithCounts[]>;
  getNeighborhoodBySlug(slug: string): Promise<NeighborhoodWithCounts | undefined>;
  getNeighborhoodContent(slug: string): Promise<NeighborhoodContent | undefined>;

  // Events
  getEvents(filters?: {
    category?: string;
    date?: string;
    location?: string;
    /** Neighborhood slug. Filters on the foreign key, not on location text. */
    neighborhood?: string;
    /** Practical flags. Only true narrows; unknown rows are excluded. */
    free?: boolean;
    kids?: boolean;
    indoor?: boolean;
    skywalk?: boolean;
  }): Promise<Event[]>;
  getEvent(id: string): Promise<Event | undefined>;
  getEventBySlug(slug: string): Promise<Event | undefined>;
  createEvent(event: InsertEvent): Promise<Event>;
  createEvents(events: InsertEvent[]): Promise<Event[]>;
  getFeaturedEvents(limit?: number): Promise<Event[]>;
  /** Events starting within a window, ascending. Used by the weekend view. */
  getEventsBetween(start: Date, end: Date): Promise<Event[]>;

  // Restaurants
  getRestaurants(): Promise<Restaurant[]>;
  getRestaurantBySlug(slug: string): Promise<Restaurant | undefined>;
  getTopRestaurants(limit?: number): Promise<Restaurant[]>;
  createRestaurant(restaurant: InsertRestaurant): Promise<Restaurant>;
  incrementRestaurantSearch(id: string): Promise<void>;

  // Attractions
  getAttractions(): Promise<Attraction[]>;
  getAttractionBySlug(slug: string): Promise<Attraction | undefined>;
  getTopAttractions(limit?: number): Promise<Attraction[]>;
  createAttraction(attraction: InsertAttraction): Promise<Attraction>;
  incrementAttractionSearch(id: string): Promise<void>;

  // Playgrounds
  getPlaygrounds(): Promise<Playground[]>;
  getPlaygroundBySlug(slug: string): Promise<Playground | undefined>;
  getTopPlaygrounds(limit?: number): Promise<Playground[]>;
  createPlayground(playground: InsertPlayground): Promise<Playground>;
  incrementPlaygroundSearch(id: string): Promise<void>;

  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  /** Login accepts either, so both are looked up the same way. */
  getUserByUsernameOrEmail(identifier: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  setHomeNeighborhood(userId: string, neighborhoodId: string | null): Promise<PublicUser | undefined>;

  // Tips
  createTip(userId: string, tip: InsertTip): Promise<Tip>;
  /** Visible tips only. Hidden ones never reach a reader. */
  getTips(targetType: string, targetId: string): Promise<TipWithAuthor[]>;
  setTipStatus(id: string, status: "visible" | "hidden"): Promise<Tip | undefined>;
  getUserTipFor(userId: string, targetType: string, targetId: string): Promise<Tip | undefined>;

  // Scrape health
  recordScrapeRuns(runs: InsertScrapeRun[]): Promise<void>;
  /** Most recent run per source, newest first. */
  getRecentScrapeRuns(limit?: number): Promise<ScrapeRun[]>;

  // Saved events
  saveEvent(userId: string, eventId: string): Promise<void>;
  unsaveEvent(userId: string, eventId: string): Promise<void>;
  getSavedEvents(userId: string): Promise<Event[]>;
  isEventSaved(userId: string, eventId: string): Promise<boolean>;

  // Newsletter
  subscribeNewsletter(
    subscription: InsertNewsletterSubscription,
    confirmToken: string,
  ): Promise<NewsletterSubscription>;
  getNewsletterSubscriptions(): Promise<NewsletterSubscription[]>;
  /** Only confirmed, still-subscribed addresses. The send list. */
  getConfirmedSubscribers(): Promise<NewsletterSubscription[]>;
  getSubscriptionByToken(token: string): Promise<NewsletterSubscription | undefined>;
  confirmSubscription(token: string): Promise<NewsletterSubscription | undefined>;
  unsubscribe(token: string): Promise<NewsletterSubscription | undefined>;

  // Restaurant Openings
  getRestaurantOpenings(): Promise<RestaurantOpening[]>;
  getRestaurantOpeningBySlug(slug: string): Promise<RestaurantOpening | undefined>;
  createRestaurantOpening(opening: InsertRestaurantOpening): Promise<RestaurantOpening>;
  createRestaurantOpenings(openings: InsertRestaurantOpening[]): Promise<RestaurantOpening[]>;

  /** Populate baseline content if the store is empty. Safe to call repeatedly. */
  seedIfEmpty(): Promise<void>;

  /** Give any event still missing a slug one. Safe to call repeatedly. */
  backfillEventSlugs(): Promise<number>;

  /** Give any restaurant, attraction or playground missing a slug one. */
  backfillPlaceSlugs(): Promise<number>;

  /** Assign neighborhoods to rows that do not have one yet. */
  backfillNeighborhoods(): Promise<number>;

  /** Rewrite legacy category values onto the current taxonomy. */
  backfillCategories(): Promise<number>;

  /** Fill in practical flags for rows that predate them. */
  backfillEventFlags(): Promise<number>;

  /** Link events to curated venues where the text identifies one. */
  backfillVenueLinks(): Promise<number>;

  /** Give any restaurant opening still missing a slug one. */
  backfillOpeningSlugs(): Promise<number>;

  /** Add any family destinations not already present. Safe to call repeatedly. */
  topUpFamilyPlaces(): Promise<number>;
}

/** Filter sentinels the client sends when a dropdown is left on its default. */
const ALL_CATEGORIES = "All Categories";
const ALL_LOCATIONS = "All Locations";

/* -------------------------------------------------------------------------- */
/*                          Drizzle / PostgreSQL storage                        */
/* -------------------------------------------------------------------------- */

export class DatabaseStorage implements IStorage {
  private get db() {
    return getDb();
  }

  /**
   * Cached slug -> id map for neighborhoods. The table is tiny and changes
   * only when we deploy new seed data, so re-reading it on every insert would
   * be pure overhead.
   */
  private neighborhoodIdCache: Map<string, string> | undefined;

  private async neighborhoodIds(): Promise<Map<string, string>> {
    if (!this.neighborhoodIdCache) {
      const rows = await this.db
        .select({ id: neighborhoods.id, slug: neighborhoods.slug })
        .from(neighborhoods);
      this.neighborhoodIdCache = new Map(rows.map((row) => [row.slug, row.id]));
    }
    return this.neighborhoodIdCache;
  }

  /** Resolve content details to a neighborhood id, or null when unsure. */
  private async classify(input: ClassifyInput): Promise<string | null> {
    const slug = classifyNeighborhoodSlug(input);
    if (!slug) return null;
    return (await this.neighborhoodIds()).get(slug) ?? null;
  }

  // Community submissions
  async createSubmission(submission: InsertEventSubmission): Promise<EventSubmission> {
    const [created] = await this.db
      .insert(eventSubmissions)
      .values(submission)
      .returning();
    return created;
  }

  async getSubmissions(status?: string): Promise<EventSubmission[]> {
    const query = this.db
      .select()
      .from(eventSubmissions)
      .orderBy(desc(eventSubmissions.createdAt));
    return status
      ? query.where(eq(eventSubmissions.status, status))
      : query;
  }

  async getSubmission(id: string): Promise<EventSubmission | undefined> {
    const [row] = await this.db
      .select()
      .from(eventSubmissions)
      .where(eq(eventSubmissions.id, id))
      .limit(1);
    return row;
  }

  async markSubmissionReviewed(
    id: string,
    status: "approved" | "rejected",
    publishedEventId?: string | null,
  ): Promise<EventSubmission | undefined> {
    const [row] = await this.db
      .update(eventSubmissions)
      .set({ status, reviewedAt: new Date(), publishedEventId: publishedEventId ?? null })
      .where(eq(eventSubmissions.id, id))
      .returning();
    return row;
  }

  // Venues
  async getVenueById(id: string): Promise<Venue | undefined> {
    const [row] = await this.db.select().from(venues).where(eq(venues.id, id)).limit(1);
    return row;
  }

  /** Slug -> id for venues, cached like the neighborhood map. */
  private venueIdCache: Map<string, string> | undefined;

  private async venueIds(): Promise<Map<string, string>> {
    if (!this.venueIdCache) {
      const rows = await this.db.select({ id: venues.id, slug: venues.slug }).from(venues);
      this.venueIdCache = new Map(rows.map((row) => [row.slug, row.id]));
    }
    return this.venueIdCache;
  }

  /**
   * Venues are reference data. Seeded once and then left alone, since an
   * operator may have edited the curated notes since the last deploy.
   */
  private async seedVenuesIfMissing(): Promise<void> {
    const existing = await this.db.select({ slug: venues.slug }).from(venues);
    const known = new Set(existing.map((row) => row.slug));
    const neighborhoodIds = await this.neighborhoodIds();

    let added = 0;
    for (const venue of seedVenues) {
      if (known.has(venue.slug)) continue;
      await this.db.insert(venues).values({
        slug: venue.slug,
        name: venue.name,
        address: venue.address ?? null,
        neighborhoodId: venue.neighborhoodSlug
          ? (neighborhoodIds.get(venue.neighborhoodSlug) ?? null)
          : null,
        lat: venue.lat ?? null,
        lng: venue.lng ?? null,
        parkingNotes: venue.parkingNotes ?? null,
        nearbyEats: venue.nearbyEats ?? null,
        kidNotes: venue.kidNotes ?? null,
        isIndoor: venue.isIndoor,
        isSkywalkAccessible: venue.isSkywalkAccessible,
        websiteUrl: venue.websiteUrl ?? null,
      });
      added += 1;
    }

    if (added > 0) {
      console.log(`[storage] Seeded ${added} venue(s).`);
      this.venueIdCache = undefined;
    }
  }

  // Tentpoles
  async getTentpoles(): Promise<Tentpole[]> {
    return this.db.select().from(tentpoles).orderBy(asc(tentpoles.nextStartDate));
  }

  async getUpcomingTentpoles(limit: number = 3): Promise<Tentpole[]> {
    // Compare against the end date so something under way still counts as
    // upcoming: the State Fair is very much "on" on its fifth day.
    return this.db
      .select()
      .from(tentpoles)
      .where(gte(tentpoles.nextEndDate, new Date()))
      .orderBy(asc(tentpoles.nextStartDate))
      .limit(limit);
  }

  async getTentpoleBySlug(slug: string): Promise<TentpoleWithEvents | undefined> {
    const [tentpole] = await this.db
      .select()
      .from(tentpoles)
      .where(eq(tentpoles.slug, slug))
      .limit(1);

    if (!tentpole) return undefined;

    const [neighborhood] = tentpole.neighborhoodId
      ? await this.db
          .select()
          .from(neighborhoods)
          .where(eq(neighborhoods.id, tentpole.neighborhoodId))
          .limit(1)
      : [];

    // Scraped events for the festival are matched by name. Titles vary
    // ("Iowa State Fair 2027", "State Fair Parade"), so this is a contains
    // match on the tentpole's name rather than an exact one.
    const relatedEvents = await this.db
      .select()
      .from(events)
      .where(and(ilike(events.title, `%${tentpole.name}%`), gte(events.date, new Date())))
      .orderBy(asc(events.date))
      .limit(20);

    return { tentpole, neighborhood: neighborhood ?? null, relatedEvents };
  }

  // Neighborhoods
  async getNeighborhoods(): Promise<NeighborhoodWithCounts[]> {
    const rows = await this.db
      .select()
      .from(neighborhoods)
      .orderBy(asc(neighborhoods.name));

    // Five grouped queries rather than five per neighborhood: at 24
    // neighborhoods the per-row version would be 120 round trips.
    const tally = async (
      table: typeof restaurants | typeof attractions | typeof playgrounds,
    ) => {
      const counts = await this.db
        .select({ id: table.neighborhoodId, count: sql<number>`count(*)::int` })
        .from(table)
        .where(isNotNull(table.neighborhoodId))
        .groupBy(table.neighborhoodId);
      return new Map(counts.map((row) => [row.id, row.count]));
    };

    const [eventCounts, openingCounts, restaurantCounts, attractionCounts, playgroundCounts] =
      await Promise.all([
        this.db
          .select({ id: events.neighborhoodId, count: sql<number>`count(*)::int` })
          .from(events)
          .where(and(isNotNull(events.neighborhoodId), gte(events.date, new Date())))
          .groupBy(events.neighborhoodId)
          .then((counts) => new Map(counts.map((row) => [row.id, row.count]))),
        this.db
          .select({
            id: restaurantOpenings.neighborhoodId,
            count: sql<number>`count(*)::int`,
          })
          .from(restaurantOpenings)
          .where(isNotNull(restaurantOpenings.neighborhoodId))
          .groupBy(restaurantOpenings.neighborhoodId)
          .then((counts) => new Map(counts.map((row) => [row.id, row.count]))),
        tally(restaurants),
        tally(attractions),
        tally(playgrounds),
      ]);

    return rows.map((row) => ({
      ...row,
      upcomingEventCount: eventCounts.get(row.id) ?? 0,
      restaurantOpeningCount: openingCounts.get(row.id) ?? 0,
      restaurantCount: restaurantCounts.get(row.id) ?? 0,
      attractionCount: attractionCounts.get(row.id) ?? 0,
      playgroundCount: playgroundCounts.get(row.id) ?? 0,
    }));
  }

  async getNeighborhoodContent(
    slug: string,
  ): Promise<NeighborhoodContent | undefined> {
    const neighborhood = await this.getNeighborhoodBySlug(slug);
    if (!neighborhood) return undefined;

    const now = new Date();
    // A month ahead is what people actually plan around; beyond that a
    // neighborhood page turns into an undifferentiated calendar dump.
    const horizon = new Date(now);
    horizon.setDate(horizon.getDate() + 30);

    const [upcomingEvents, openings, restaurantRows, attractionRows, playgroundRows] =
      await Promise.all([
        this.db
          .select()
          .from(events)
          .where(
            and(
              eq(events.neighborhoodId, neighborhood.id),
              gte(events.date, now),
              lte(events.date, horizon),
            ),
          )
          .orderBy(asc(events.date)),
        this.db
          .select()
          .from(restaurantOpenings)
          .where(eq(restaurantOpenings.neighborhoodId, neighborhood.id))
          .orderBy(desc(restaurantOpenings.createdAt))
          .limit(12),
        this.db
          .select()
          .from(restaurants)
          .where(eq(restaurants.neighborhoodId, neighborhood.id))
          .orderBy(desc(restaurants.searchCount))
          .limit(12),
        this.db
          .select()
          .from(attractions)
          .where(eq(attractions.neighborhoodId, neighborhood.id))
          .orderBy(desc(attractions.searchCount))
          .limit(12),
        this.db
          .select()
          .from(playgrounds)
          .where(eq(playgrounds.neighborhoodId, neighborhood.id))
          .orderBy(desc(playgrounds.searchCount))
          .limit(12),
      ]);

    return {
      neighborhood,
      upcomingEvents,
      restaurantOpenings: openings,
      restaurants: restaurantRows,
      attractions: attractionRows,
      playgrounds: playgroundRows,
    };
  }

  async getNeighborhoodBySlug(
    slug: string,
  ): Promise<NeighborhoodWithCounts | undefined> {
    const [row] = await this.db
      .select()
      .from(neighborhoods)
      .where(eq(neighborhoods.slug, slug))
      .limit(1);

    if (!row) return undefined;

    const countIn = async (
      table: typeof restaurants | typeof attractions | typeof playgrounds,
    ): Promise<number> => {
      const [result] = await this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(table)
        .where(eq(table.neighborhoodId, row.id));
      return result?.count ?? 0;
    };

    const [upcoming, openings, playgroundCount, restaurantCount, attractionCount] =
      await Promise.all([
        this.db
          .select({ count: sql<number>`count(*)::int` })
          .from(events)
          .where(and(eq(events.neighborhoodId, row.id), gte(events.date, new Date())))
          .then((rows) => rows[0]?.count ?? 0),
        this.db
          .select({ count: sql<number>`count(*)::int` })
          .from(restaurantOpenings)
          .where(eq(restaurantOpenings.neighborhoodId, row.id))
          .then((rows) => rows[0]?.count ?? 0),
        countIn(playgrounds),
        countIn(restaurants),
        countIn(attractions),
      ]);

    return {
      ...row,
      upcomingEventCount: upcoming,
      restaurantOpeningCount: openings,
      playgroundCount,
      restaurantCount,
      attractionCount,
    };
  }

  // Events
  async getEvents(filters?: {
    category?: string;
    date?: string;
    location?: string;
    neighborhood?: string;
    free?: boolean;
    kids?: boolean;
    indoor?: boolean;
    skywalk?: boolean;
  }): Promise<Event[]> {
    const conditions = [];

    // These filters answer "show me only things I know are X". A row where the
    // flag is unknown is excluded rather than assumed, so a parent filtering
    // for kid-friendly never gets an unverified listing.
    if (filters?.free) conditions.push(eq(events.isFree, true));
    if (filters?.kids) conditions.push(eq(events.isKidFriendly, true));
    if (filters?.indoor) conditions.push(eq(events.isIndoor, true));
    if (filters?.skywalk) conditions.push(eq(events.isSkywalkAccessible, true));

    if (filters?.category && filters.category !== ALL_CATEGORIES) {
      // Match the primary category or either secondary one. "Free" is almost
      // always a secondary label, so a primary-only match would make that
      // filter look broken.
      conditions.push(
        isEventCategory(filters.category)
          ? or(
              eq(events.category, filters.category),
              arrayContains(events.secondaryCategories, [filters.category]),
            )
          : ilike(events.category, `%${filters.category}%`),
      );
    }
    // Prefer the neighborhood foreign key when we have it. Matching on the raw
    // location string misses everything whose text does not happen to name the
    // neighborhood, which is most of it.
    if (filters?.neighborhood) {
      const id = (await this.neighborhoodIds()).get(filters.neighborhood);
      // An unknown slug must return nothing rather than silently ignoring the
      // filter and showing the whole metro.
      conditions.push(id ? eq(events.neighborhoodId, id) : sql`false`);
    } else if (filters?.location && filters.location !== ALL_LOCATIONS) {
      conditions.push(ilike(events.location, `%${filters.location}%`));
    }
    if (filters?.date) {
      const filterDate = new Date(filters.date);
      if (!Number.isNaN(filterDate.getTime())) {
        conditions.push(gte(events.date, filterDate));
      }
    }

    const query = this.db.select().from(events).orderBy(asc(events.date));
    return conditions.length > 0 ? query.where(and(...conditions)) : query;
  }

  async getEvent(id: string): Promise<Event | undefined> {
    const [event] = await this.db.select().from(events).where(eq(events.id, id)).limit(1);
    return event;
  }

  async getEventBySlug(slug: string): Promise<Event | undefined> {
    const [event] = await this.db
      .select()
      .from(events)
      .where(eq(events.slug, slug))
      .limit(1);
    return event;
  }

  /** Every slug currently taken, used to resolve collisions before inserting. */
  private async takenSlugs(): Promise<Set<string>> {
    const rows = await this.db.select({ slug: events.slug }).from(events);
    return new Set(rows.map((row) => row.slug).filter((slug): slug is string => Boolean(slug)));
  }

  /**
   * Reserve a free slug for a place. The three place tables are structurally
   * identical for this purpose, so one helper serves all of them.
   */
  private async freePlaceSlug(
    table: typeof restaurants | typeof attractions | typeof playgrounds,
    name: string,
  ): Promise<string> {
    const rows = await this.db.select({ slug: table.slug }).from(table);
    const taken = new Set(
      rows.map((row) => row.slug).filter((slug): slug is string => Boolean(slug)),
    );
    return ensureUniqueSlug(buildPlaceSlug(name), taken);
  }

  /** Fill in slugs for one place table. Returns how many rows were updated. */
  private async backfillPlaceTable(
    table: typeof restaurants | typeof attractions | typeof playgrounds,
  ): Promise<number> {
    const missing = await this.db
      .select({ id: table.id, name: table.name })
      .from(table)
      .where(or(isNull(table.slug), eq(table.slug, "")));

    if (missing.length === 0) return 0;

    const rows = await this.db.select({ slug: table.slug }).from(table);
    const taken = new Set(
      rows.map((row) => row.slug).filter((slug): slug is string => Boolean(slug)),
    );

    for (const row of missing) {
      const slug = ensureUniqueSlug(buildPlaceSlug(row.name), taken);
      taken.add(slug);
      await this.db.update(table).set({ slug }).where(eq(table.id, row.id));
    }

    return missing.length;
  }

  async backfillPlaceSlugs(): Promise<number> {
    const counts = await Promise.all([
      this.backfillPlaceTable(restaurants),
      this.backfillPlaceTable(attractions),
      this.backfillPlaceTable(playgrounds),
    ]);
    return counts.reduce((total, count) => total + count, 0);
  }

  async createEvent(event: InsertEvent): Promise<Event> {
    const [created] = await this.createEvents([event]);
    return created;
  }

  async createEvents(newEvents: EventToCreate[]): Promise<Event[]> {
    if (newEvents.length === 0) return [];

    // Resolve collisions against both the stored slugs and the ones this batch
    // is about to claim, so a batch containing two same-day duplicates of a
    // title still produces two distinct URLs.
    const taken = await this.takenSlugs();
    const prepared = await Promise.all(
      newEvents.map(async ({ neighborhoodSlug, ...event }) => {
        const slug = ensureUniqueSlug(buildEventSlug(event.title, event.date), taken);
        taken.add(slug);
        const facts = findVenueFacts(event.venue, event.location, event.title);
        // A source that named its neighborhood is trusted over the keyword
        // classifier; the classifier is the fallback, not the override.
        const statedNeighborhoodId = neighborhoodSlug
          ? ((await this.neighborhoodIds()).get(neighborhoodSlug) ?? null)
          : null;
        return {
          ...event,
          slug,
          venueId: facts ? ((await this.venueIds()).get(facts.slug) ?? null) : null,
          neighborhoodId:
            statedNeighborhoodId ??
            (await this.classify({
              venue: event.venue,
              location: event.location,
              title: event.title,
            })),
        };
      }),
    );

    return this.db.insert(events).values(prepared).returning();
  }

  async backfillEventSlugs(): Promise<number> {
    const missing = await this.db
      .select({ id: events.id, title: events.title, date: events.date })
      .from(events)
      .where(or(isNull(events.slug), eq(events.slug, "")));

    if (missing.length === 0) return 0;

    const taken = await this.takenSlugs();
    for (const event of missing) {
      const slug = ensureUniqueSlug(buildEventSlug(event.title, event.date), taken);
      taken.add(slug);
      await this.db.update(events).set({ slug }).where(eq(events.id, event.id));
    }

    return missing.length;
  }

  async getFeaturedEvents(limit: number = 6): Promise<Event[]> {
    return this.db
      .select()
      .from(events)
      .where(gte(events.date, new Date()))
      .orderBy(asc(events.date))
      .limit(limit);
  }

  async getEventsBetween(start: Date, end: Date): Promise<Event[]> {
    return this.db
      .select()
      .from(events)
      // End is exclusive: the window's end is the next day's midnight, and an
      // event starting exactly then belongs to that day, not this one.
      .where(and(gte(events.date, start), lt(events.date, end)))
      .orderBy(asc(events.date));
  }

  // Restaurants
  async getRestaurants(): Promise<Restaurant[]> {
    return this.db.select().from(restaurants).orderBy(asc(restaurants.name));
  }

  async getTopRestaurants(limit: number = 5): Promise<Restaurant[]> {
    return this.db
      .select()
      .from(restaurants)
      .orderBy(desc(restaurants.searchCount))
      .limit(limit);
  }

  async getRestaurantBySlug(slug: string): Promise<Restaurant | undefined> {
    const [row] = await this.db
      .select()
      .from(restaurants)
      .where(eq(restaurants.slug, slug))
      .limit(1);
    return row;
  }

  async createRestaurant(restaurant: InsertRestaurant): Promise<Restaurant> {
    const slug = await this.freePlaceSlug(restaurants, restaurant.name);
    const neighborhoodId = await this.classify({
      venue: restaurant.name,
      location: restaurant.location,
    });
    const [created] = await this.db
      .insert(restaurants)
      .values({ ...restaurant, slug, neighborhoodId })
      .returning();
    return created;
  }

  async incrementRestaurantSearch(id: string): Promise<void> {
    await this.db
      .update(restaurants)
      .set({ searchCount: sql`COALESCE(${restaurants.searchCount}, 0) + 1` })
      .where(eq(restaurants.id, id));
  }

  // Attractions
  async getAttractions(): Promise<Attraction[]> {
    return this.db.select().from(attractions).orderBy(asc(attractions.name));
  }

  async getTopAttractions(limit: number = 5): Promise<Attraction[]> {
    return this.db
      .select()
      .from(attractions)
      .orderBy(desc(attractions.searchCount))
      .limit(limit);
  }

  async getAttractionBySlug(slug: string): Promise<Attraction | undefined> {
    const [row] = await this.db
      .select()
      .from(attractions)
      .where(eq(attractions.slug, slug))
      .limit(1);
    return row;
  }

  async createAttraction(attraction: InsertAttraction): Promise<Attraction> {
    const slug = await this.freePlaceSlug(attractions, attraction.name);
    const neighborhoodId = await this.classify({
      venue: attraction.name,
      location: attraction.location,
    });
    const [created] = await this.db
      .insert(attractions)
      .values({ ...attraction, slug, neighborhoodId })
      .returning();
    return created;
  }

  async incrementAttractionSearch(id: string): Promise<void> {
    await this.db
      .update(attractions)
      .set({ searchCount: sql`COALESCE(${attractions.searchCount}, 0) + 1` })
      .where(eq(attractions.id, id));
  }

  // Playgrounds
  async getPlaygrounds(): Promise<Playground[]> {
    return this.db.select().from(playgrounds).orderBy(asc(playgrounds.name));
  }

  async getTopPlaygrounds(limit: number = 5): Promise<Playground[]> {
    return this.db
      .select()
      .from(playgrounds)
      .orderBy(desc(playgrounds.searchCount))
      .limit(limit);
  }

  async getPlaygroundBySlug(slug: string): Promise<Playground | undefined> {
    const [row] = await this.db
      .select()
      .from(playgrounds)
      .where(eq(playgrounds.slug, slug))
      .limit(1);
    return row;
  }

  async createPlayground(playground: InsertPlayground): Promise<Playground> {
    const slug = await this.freePlaceSlug(playgrounds, playground.name);
    const neighborhoodId = await this.classify({
      venue: playground.name,
      location: playground.location,
    });
    const [created] = await this.db
      .insert(playgrounds)
      .values({ ...playground, slug, neighborhoodId })
      .returning();
    return created;
  }

  async incrementPlaygroundSearch(id: string): Promise<void> {
    await this.db
      .update(playgrounds)
      .set({ searchCount: sql`COALESCE(${playgrounds.searchCount}, 0) + 1` })
      .where(eq(playgrounds.id, id));
  }

  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);
    return user;
  }

  async getUserByUsernameOrEmail(identifier: string): Promise<User | undefined> {
    const value = identifier.trim().toLowerCase();
    const [row] = await this.db
      .select()
      .from(users)
      .where(or(eq(users.username, value), eq(users.email, value)))
      .limit(1);
    return row;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [created] = await this.db.insert(users).values(user).returning();
    return created;
  }

  async setHomeNeighborhood(
    userId: string,
    neighborhoodId: string | null,
  ): Promise<PublicUser | undefined> {
    const [row] = await this.db
      .update(users)
      .set({ homeNeighborhoodId: neighborhoodId })
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        username: users.username,
        email: users.email,
        homeNeighborhoodId: users.homeNeighborhoodId,
        createdAt: users.createdAt,
      });
    return row;
  }

  // Tips
  async createTip(userId: string, tip: InsertTip): Promise<Tip> {
    const [created] = await this.db
      .insert(tips)
      .values({ ...tip, userId })
      .returning();
    return created;
  }

  async getTips(targetType: string, targetId: string): Promise<TipWithAuthor[]> {
    const rows = await this.db
      .select({
        id: tips.id,
        body: tips.body,
        createdAt: tips.createdAt,
        authorUsername: users.username,
      })
      .from(tips)
      .innerJoin(users, eq(users.id, tips.userId))
      .where(
        and(
          eq(tips.targetType, targetType),
          eq(tips.targetId, targetId),
          // Hidden tips are excluded here rather than filtered in the caller,
          // so no route can accidentally publish moderated content.
          eq(tips.status, "visible"),
        ),
      )
      .orderBy(desc(tips.createdAt));
    return rows;
  }

  async setTipStatus(
    id: string,
    status: "visible" | "hidden",
  ): Promise<Tip | undefined> {
    const [row] = await this.db
      .update(tips)
      .set({ status })
      .where(eq(tips.id, id))
      .returning();
    return row;
  }

  async getUserTipFor(
    userId: string,
    targetType: string,
    targetId: string,
  ): Promise<Tip | undefined> {
    const [row] = await this.db
      .select()
      .from(tips)
      .where(
        and(
          eq(tips.userId, userId),
          eq(tips.targetType, targetType),
          eq(tips.targetId, targetId),
        ),
      )
      .limit(1);
    return row;
  }

  // Scrape health
  async recordScrapeRuns(runs: InsertScrapeRun[]): Promise<void> {
    if (runs.length === 0) return;
    await this.db.insert(scrapeRuns).values(
      runs.map((run) => ({
        source: run.source,
        ok: run.ok,
        eventCount: run.eventCount,
        durationMs: run.durationMs,
        error: run.error ?? null,
      })),
    );
  }

  async getRecentScrapeRuns(limit = 50): Promise<ScrapeRun[]> {
    return this.db
      .select()
      .from(scrapeRuns)
      .orderBy(desc(scrapeRuns.startedAt))
      .limit(limit);
  }

  // Saved events
  async saveEvent(userId: string, eventId: string): Promise<void> {
    // Saving something already saved is a no-op, not an error.
    await this.db
      .insert(savedEvents)
      .values({ userId, eventId })
      .onConflictDoNothing();
  }

  async unsaveEvent(userId: string, eventId: string): Promise<void> {
    await this.db
      .delete(savedEvents)
      .where(and(eq(savedEvents.userId, userId), eq(savedEvents.eventId, eventId)));
  }

  async getSavedEvents(userId: string): Promise<Event[]> {
    const rows = await this.db
      .select({ event: events })
      .from(savedEvents)
      .innerJoin(events, eq(events.id, savedEvents.eventId))
      .where(eq(savedEvents.userId, userId))
      .orderBy(asc(events.date));
    return rows.map((row) => row.event);
  }

  async isEventSaved(userId: string, eventId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: savedEvents.id })
      .from(savedEvents)
      .where(and(eq(savedEvents.userId, userId), eq(savedEvents.eventId, eventId)))
      .limit(1);
    return Boolean(row);
  }

  // Newsletter
  async subscribeNewsletter(
    subscription: InsertNewsletterSubscription,
    confirmToken: string,
  ): Promise<NewsletterSubscription> {
    // Re-subscribing after unsubscribing should work, and a second signup
    // before confirming should re-send rather than fail on the unique email.
    const [created] = await this.db
      .insert(newsletterSubscriptions)
      .values({ ...subscription, confirmToken })
      .onConflictDoUpdate({
        target: newsletterSubscriptions.email,
        set: {
          confirmToken,
          unsubscribedAt: null,
          neighborhoodId: subscription.neighborhoodId ?? null,
        },
      })
      .returning();
    return created;
  }

  async getConfirmedSubscribers(): Promise<NewsletterSubscription[]> {
    return this.db
      .select()
      .from(newsletterSubscriptions)
      .where(
        and(
          isNotNull(newsletterSubscriptions.confirmedAt),
          isNull(newsletterSubscriptions.unsubscribedAt),
        ),
      );
  }

  async getSubscriptionByToken(
    token: string,
  ): Promise<NewsletterSubscription | undefined> {
    const [row] = await this.db
      .select()
      .from(newsletterSubscriptions)
      .where(eq(newsletterSubscriptions.confirmToken, token))
      .limit(1);
    return row;
  }

  async confirmSubscription(
    token: string,
  ): Promise<NewsletterSubscription | undefined> {
    const [row] = await this.db
      .update(newsletterSubscriptions)
      .set({ confirmedAt: new Date(), unsubscribedAt: null })
      .where(eq(newsletterSubscriptions.confirmToken, token))
      .returning();
    return row;
  }

  async unsubscribe(token: string): Promise<NewsletterSubscription | undefined> {
    const [row] = await this.db
      .update(newsletterSubscriptions)
      .set({ unsubscribedAt: new Date() })
      .where(eq(newsletterSubscriptions.confirmToken, token))
      .returning();
    return row;
  }

  async getNewsletterSubscriptions(): Promise<NewsletterSubscription[]> {
    return this.db
      .select()
      .from(newsletterSubscriptions)
      .orderBy(desc(newsletterSubscriptions.subscribedAt));
  }

  // Restaurant Openings
  async getRestaurantOpenings(): Promise<RestaurantOpening[]> {
    return this.db
      .select()
      .from(restaurantOpenings)
      .orderBy(desc(restaurantOpenings.createdAt));
  }

  async createRestaurantOpening(
    opening: InsertRestaurantOpening,
  ): Promise<RestaurantOpening> {
    const [created] = await this.createRestaurantOpenings([opening]);
    return created;
  }

  async getRestaurantOpeningBySlug(
    slug: string,
  ): Promise<RestaurantOpening | undefined> {
    const [row] = await this.db
      .select()
      .from(restaurantOpenings)
      .where(eq(restaurantOpenings.slug, slug))
      .limit(1);
    return row;
  }

  async createRestaurantOpenings(
    openings: InsertRestaurantOpening[],
  ): Promise<RestaurantOpening[]> {
    if (openings.length === 0) return [];

    const existing = await this.db
      .select({ slug: restaurantOpenings.slug })
      .from(restaurantOpenings);
    const taken = new Set(
      existing.map((row) => row.slug).filter((slug): slug is string => Boolean(slug)),
    );

    const prepared = await Promise.all(
      openings.map(async (opening) => {
        const slug = ensureUniqueSlug(buildPlaceSlug(opening.name), taken);
        taken.add(slug);
        return {
          ...opening,
          slug,
          neighborhoodId: await this.classify({
            venue: opening.name,
            location: opening.location,
            address: opening.address,
            lat: opening.lat,
            lng: opening.lng,
          }),
        };
      }),
    );

    return this.db.insert(restaurantOpenings).values(prepared).returning();
  }

  async backfillOpeningSlugs(): Promise<number> {
    const missing = await this.db
      .select({ id: restaurantOpenings.id, name: restaurantOpenings.name })
      .from(restaurantOpenings)
      .where(or(isNull(restaurantOpenings.slug), eq(restaurantOpenings.slug, "")));

    if (missing.length === 0) return 0;

    const rows = await this.db
      .select({ slug: restaurantOpenings.slug })
      .from(restaurantOpenings);
    const taken = new Set(
      rows.map((row) => row.slug).filter((slug): slug is string => Boolean(slug)),
    );

    for (const row of missing) {
      const slug = ensureUniqueSlug(buildPlaceSlug(row.name), taken);
      taken.add(slug);
      await this.db
        .update(restaurantOpenings)
        .set({ slug })
        .where(eq(restaurantOpenings.id, row.id));
    }

    return missing.length;
  }

  /**
   * Neighborhoods are reference data rather than content, so they are seeded
   * independently of whether any events exist yet. Content classification
   * depends on them being present.
   */
  private async seedNeighborhoodsIfEmpty(): Promise<void> {
    const [{ count } = { count: 0 }] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(neighborhoods);

    if (count > 0) return;

    console.log(`Seeding ${seedNeighborhoods.length} neighborhoods...`);
    await this.db.insert(neighborhoods).values(seedNeighborhoods);
    this.neighborhoodIdCache = undefined;
  }

  /**
   * Tentpoles are reference data, and their dates are recomputed on every boot
   * so a guide never shows an occurrence that has already finished.
   */
  private async seedTentpolesAndRefreshDates(): Promise<void> {
    const ids = await this.neighborhoodIds();
    const existing = await this.db
      .select({ slug: tentpoles.slug })
      .from(tentpoles);
    const known = new Set(existing.map((row) => row.slug));

    for (const seed of seedTentpoles) {
      const { start, end } = resolveNextOccurrence(seed);
      const neighborhoodId = seed.neighborhoodSlug
        ? (ids.get(seed.neighborhoodSlug) ?? null)
        : null;

      if (known.has(seed.slug)) {
        // Refresh only the dates; editorial fields may have been changed since.
        await this.db
          .update(tentpoles)
          .set({ nextStartDate: start, nextEndDate: end })
          .where(eq(tentpoles.slug, seed.slug));
        continue;
      }

      await this.db.insert(tentpoles).values({
        slug: seed.slug,
        name: seed.name,
        description: seed.description,
        typicalMonth: seed.typicalMonth,
        nextStartDate: start,
        nextEndDate: end,
        officialUrl: seed.officialUrl,
        neighborhoodId,
        insiderTips: seed.insiderTips,
        whatsNewThisYear: seed.whatsNewThisYear ?? null,
        isFree: seed.isFree,
        isKidFriendly: seed.isKidFriendly,
      });
    }
  }

  /**
   * Add family destinations that are not in the table yet.
   *
   * Unlike the one-shot content seed this runs on every boot, so expanding the
   * curated list reaches existing installs rather than only fresh ones.
   */
  async topUpFamilyPlaces(): Promise<number> {
    const rows = await this.db.select({ slug: playgrounds.slug }).from(playgrounds);
    const known = new Set(
      rows.map((row) => row.slug).filter((slug): slug is string => Boolean(slug)),
    );

    let added = 0;
    for (const place of seedPlaygrounds) {
      if (known.has(buildPlaceSlug(place.name))) continue;
      await this.createPlayground(place);
      added += 1;
    }

    return added;
  }

  async seedIfEmpty(): Promise<void> {
    await this.seedNeighborhoodsIfEmpty();
    await this.seedVenuesIfMissing();
    await this.seedTentpolesAndRefreshDates();

    const [{ count } = { count: 0 }] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(events);

    if (count > 0) {
      return;
    }

    console.log("Database is empty, seeding baseline content...");
    // Sequential rather than parallel: each create path classifies against the
    // neighborhood cache, and the places share the slug-uniqueness check.
    await this.createEvents(buildSeedEvents());
    for (const restaurant of seedRestaurants) await this.createRestaurant(restaurant);
    for (const attraction of seedAttractions) await this.createAttraction(attraction);
    for (const playground of seedPlaygrounds) await this.createPlayground(playground);
    console.log("Seeding complete.");
  }

  async backfillCategories(): Promise<number> {
    const rows = await this.db
      .select({ id: events.id, title: events.title, category: events.category })
      .from(events);

    let updated = 0;
    for (const row of rows) {
      if (isEventCategory(row.category)) continue;
      const category = normalizeCategory(row.category, row.title);
      await this.db.update(events).set({ category }).where(eq(events.id, row.id));
      updated += 1;
    }

    return updated;
  }

  async backfillEventFlags(): Promise<number> {
    const rows = await this.db
      .select({
        id: events.id,
        title: events.title,
        originalDescription: events.originalDescription,
        enhancedDescription: events.enhancedDescription,
        price: events.price,
        venue: events.venue,
        location: events.location,
        isFree: events.isFree,
        isKidFriendly: events.isKidFriendly,
        ageRange: events.ageRange,
        isIndoor: events.isIndoor,
        isSkywalkAccessible: events.isSkywalkAccessible,
      })
      .from(events);

    let updated = 0;
    for (const row of rows) {
      const venueFacts = findVenueFacts(row.venue, row.location, row.title);
      const textFlags = extractEventFlags({
        title: row.title,
        description: row.enhancedDescription || row.originalDescription,
        price: row.price,
        venue: row.venue,
        location: row.location,
      });

      // Existing values are treated as the most trusted source, so a rerun
      // never overwrites anything already established.
      const merged = mergeFlags(
        {
          isFree: row.isFree,
          isKidFriendly: row.isKidFriendly,
          ageRange: row.ageRange,
          isIndoor: row.isIndoor,
        },
        venueFacts ? { isIndoor: venueFacts.isIndoor } : null,
        textFlags,
      );

      const skywalk =
        row.isSkywalkAccessible ?? venueFacts?.isSkywalkAccessible ?? null;

      const changed =
        merged.isFree !== row.isFree ||
        merged.isKidFriendly !== row.isKidFriendly ||
        merged.ageRange !== row.ageRange ||
        merged.isIndoor !== row.isIndoor ||
        skywalk !== row.isSkywalkAccessible;

      if (!changed) continue;

      await this.db
        .update(events)
        .set({ ...merged, isSkywalkAccessible: skywalk })
        .where(eq(events.id, row.id));
      updated += 1;
    }

    return updated;
  }

  /** Link events to curated venues where the text identifies one. */
  async backfillVenueLinks(): Promise<number> {
    const rows = await this.db
      .select({
        id: events.id,
        title: events.title,
        venue: events.venue,
        location: events.location,
      })
      .from(events)
      .where(isNull(events.venueId));

    const ids = await this.venueIds();
    let linked = 0;

    for (const row of rows) {
      const facts = findVenueFacts(row.venue, row.location, row.title);
      if (!facts) continue;
      const venueId = ids.get(facts.slug);
      if (!venueId) continue;
      await this.db.update(events).set({ venueId }).where(eq(events.id, row.id));
      linked += 1;
    }

    return linked;
  }

  async backfillNeighborhoods(): Promise<number> {
    let filled = 0;

    const eventRows = await this.db
      .select({
        id: events.id,
        title: events.title,
        venue: events.venue,
        location: events.location,
      })
      .from(events)
      .where(isNull(events.neighborhoodId));

    for (const row of eventRows) {
      const neighborhoodId = await this.classify({
        venue: row.venue,
        location: row.location,
        title: row.title,
      });
      if (!neighborhoodId) continue;
      await this.db.update(events).set({ neighborhoodId }).where(eq(events.id, row.id));
      filled += 1;
    }

    for (const table of [restaurants, attractions, playgrounds] as const) {
      const rows = await this.db
        .select({ id: table.id, name: table.name, location: table.location })
        .from(table)
        .where(isNull(table.neighborhoodId));

      for (const row of rows) {
        const neighborhoodId = await this.classify({
          venue: row.name,
          location: row.location,
        });
        if (!neighborhoodId) continue;
        await this.db.update(table).set({ neighborhoodId }).where(eq(table.id, row.id));
        filled += 1;
      }
    }

    const openingRows = await this.db
      .select({
        id: restaurantOpenings.id,
        name: restaurantOpenings.name,
        location: restaurantOpenings.location,
        address: restaurantOpenings.address,
        lat: restaurantOpenings.lat,
        lng: restaurantOpenings.lng,
      })
      .from(restaurantOpenings)
      .where(isNull(restaurantOpenings.neighborhoodId));

    for (const row of openingRows) {
      const neighborhoodId = await this.classify({
        venue: row.name,
        location: row.location,
        address: row.address,
        lat: row.lat,
        lng: row.lng,
      });
      if (!neighborhoodId) continue;
      await this.db
        .update(restaurantOpenings)
        .set({ neighborhoodId })
        .where(eq(restaurantOpenings.id, row.id));
      filled += 1;
    }

    return filled;
  }
}

/* -------------------------------------------------------------------------- */
/*                     In-memory fallback (development only)                    */
/* -------------------------------------------------------------------------- */

export class MemStorage implements IStorage {
  private neighborhoods: Map<string, Neighborhood> = new Map();
  private events: Map<string, Event> = new Map();
  private restaurants: Map<string, Restaurant> = new Map();
  private attractions: Map<string, Attraction> = new Map();
  private playgrounds: Map<string, Playground> = new Map();
  private users: Map<string, User> = new Map();
  private newsletterSubscriptions: Map<string, NewsletterSubscription> = new Map();
  private restaurantOpenings: Map<string, RestaurantOpening> = new Map();

  private tentpoles: Map<string, Tentpole> = new Map();
  private venues: Map<string, Venue> = new Map();
  private submissions: Map<string, EventSubmission> = new Map();

  // Community submissions
  async createSubmission(submission: InsertEventSubmission): Promise<EventSubmission> {
    const id = randomUUID();
    const row: EventSubmission = {
      ...submission,
      id,
      venue: submission.venue ?? null,
      price: submission.price ?? null,
      sourceUrl: submission.sourceUrl ?? null,
      imageUrl: submission.imageUrl ?? null,
      status: "pending",
      reviewedAt: null,
      publishedEventId: null,
      createdAt: new Date(),
    };
    this.submissions.set(id, row);
    return row;
  }

  async getSubmissions(status?: string): Promise<EventSubmission[]> {
    return Array.from(this.submissions.values())
      .filter((row) => !status || row.status === status)
      .sort(
        (a, b) =>
          (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0),
      );
  }

  async getSubmission(id: string): Promise<EventSubmission | undefined> {
    return this.submissions.get(id);
  }

  async markSubmissionReviewed(
    id: string,
    status: "approved" | "rejected",
    publishedEventId?: string | null,
  ): Promise<EventSubmission | undefined> {
    const row = this.submissions.get(id);
    if (!row) return undefined;
    const updated: EventSubmission = {
      ...row,
      status,
      reviewedAt: new Date(),
      publishedEventId: publishedEventId ?? null,
    };
    this.submissions.set(id, updated);
    return updated;
  }

  // Venues
  async getVenueById(id: string): Promise<Venue | undefined> {
    return this.venues.get(id);
  }

  /** Resolve curated facts to a stored venue id, seeding the map on demand. */
  private venueIdForSlug(slug: string): string | null {
    const existing = Array.from(this.venues.values()).find((v) => v.slug === slug);
    return existing?.id ?? null;
  }

  async backfillVenueLinks(): Promise<number> {
    let linked = 0;

    for (const [id, event] of Array.from(this.events.entries())) {
      if (event.venueId) continue;
      const facts = findVenueFacts(event.venue, event.location, event.title);
      if (!facts) continue;
      const venueId = this.venueIdForSlug(facts.slug);
      if (!venueId) continue;
      this.events.set(id, { ...event, venueId });
      linked += 1;
    }

    return linked;
  }

  // Tentpoles
  async getTentpoles(): Promise<Tentpole[]> {
    return Array.from(this.tentpoles.values()).sort(
      (a, b) =>
        (a.nextStartDate?.getTime() ?? 0) - (b.nextStartDate?.getTime() ?? 0),
    );
  }

  async getUpcomingTentpoles(limit: number = 3): Promise<Tentpole[]> {
    const now = new Date();
    // End date, not start: something under way still counts as upcoming.
    return (await this.getTentpoles())
      .filter((t) => (t.nextEndDate ? t.nextEndDate >= now : false))
      .slice(0, limit);
  }

  async getTentpoleBySlug(slug: string): Promise<TentpoleWithEvents | undefined> {
    const tentpole = Array.from(this.tentpoles.values()).find((t) => t.slug === slug);
    if (!tentpole) return undefined;

    const neighborhood = tentpole.neighborhoodId
      ? (this.neighborhoods.get(tentpole.neighborhoodId) ?? null)
      : null;

    const now = new Date();
    const needle = tentpole.name.toLowerCase();
    const relatedEvents = Array.from(this.events.values())
      .filter(
        (event) =>
          event.title.toLowerCase().includes(needle) && new Date(event.date) >= now,
      )
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 20);

    return { tentpole, neighborhood, relatedEvents };
  }

  // Neighborhoods
  async getNeighborhoods(): Promise<NeighborhoodWithCounts[]> {
    const rows = Array.from(this.neighborhoods.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );

    const now = new Date();
    const countFor = (
      items: Iterable<{ neighborhoodId: string | null }>,
      id: string,
    ) => Array.from(items).filter((item) => item.neighborhoodId === id).length;

    return rows.map((row) => ({
      ...row,
      upcomingEventCount: Array.from(this.events.values()).filter(
        (e) => e.neighborhoodId === row.id && new Date(e.date) >= now,
      ).length,
      restaurantOpeningCount: countFor(this.restaurantOpenings.values(), row.id),
      restaurantCount: countFor(this.restaurants.values(), row.id),
      attractionCount: countFor(this.attractions.values(), row.id),
      playgroundCount: countFor(this.playgrounds.values(), row.id),
    }));
  }

  async getNeighborhoodContent(
    slug: string,
  ): Promise<NeighborhoodContent | undefined> {
    const neighborhood = await this.getNeighborhoodBySlug(slug);
    if (!neighborhood) return undefined;

    const now = new Date();
    const horizon = new Date(now);
    horizon.setDate(horizon.getDate() + 30);

    const inArea = <T extends { neighborhoodId: string | null }>(
      items: Iterable<T>,
    ): T[] => Array.from(items).filter((item) => item.neighborhoodId === neighborhood.id);

    const bySearch = <T extends { searchCount: number | null }>(rows: T[]): T[] =>
      rows.sort((a, b) => (b.searchCount ?? 0) - (a.searchCount ?? 0)).slice(0, 12);

    return {
      neighborhood,
      upcomingEvents: inArea(this.events.values())
        .filter((e) => new Date(e.date) >= now && new Date(e.date) <= horizon)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
      restaurantOpenings: inArea(this.restaurantOpenings.values())
        .sort((a, b) => {
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bTime - aTime;
        })
        .slice(0, 12),
      restaurants: bySearch(inArea(this.restaurants.values())),
      attractions: bySearch(inArea(this.attractions.values())),
      playgrounds: bySearch(inArea(this.playgrounds.values())),
    };
  }

  async getNeighborhoodBySlug(
    slug: string,
  ): Promise<NeighborhoodWithCounts | undefined> {
    const row = Array.from(this.neighborhoods.values()).find((n) => n.slug === slug);
    if (!row) return undefined;

    const now = new Date();
    const countIn = (items: Iterable<{ neighborhoodId: string | null }>) =>
      Array.from(items).filter((item) => item.neighborhoodId === row.id).length;

    return {
      ...row,
      upcomingEventCount: Array.from(this.events.values()).filter(
        (e) => e.neighborhoodId === row.id && new Date(e.date) >= now,
      ).length,
      restaurantOpeningCount: countIn(this.restaurantOpenings.values()),
      playgroundCount: countIn(this.playgrounds.values()),
      restaurantCount: countIn(this.restaurants.values()),
      attractionCount: countIn(this.attractions.values()),
    };
  }

  /** Resolve content details to a neighborhood id, or null when unsure. */
  private neighborhoodBySlug(slug: string): string | null {
    return (
      Array.from(this.neighborhoods.values()).find((n) => n.slug === slug)?.id ?? null
    );
  }

  private classify(input: ClassifyInput): string | null {
    const slug = classifyNeighborhoodSlug(input);
    if (!slug) return null;
    return this.neighborhoodBySlug(slug);
  }

  // Events
  async getEvents(filters?: {
    category?: string;
    date?: string;
    location?: string;
    neighborhood?: string;
    free?: boolean;
    kids?: boolean;
    indoor?: boolean;
    skywalk?: boolean;
  }): Promise<Event[]> {
    let results = Array.from(this.events.values());

    if (filters) {
      if (filters.free) results = results.filter((e) => e.isFree === true);
      if (filters.kids) results = results.filter((e) => e.isKidFriendly === true);
      if (filters.indoor) results = results.filter((e) => e.isIndoor === true);
      if (filters.skywalk) {
        results = results.filter((e) => e.isSkywalkAccessible === true);
      }
      if (filters.category && filters.category !== ALL_CATEGORIES) {
        const wanted = filters.category;
        results = results.filter(
          (event) =>
            event.category === wanted ||
            (event.secondaryCategories ?? []).includes(wanted) ||
            event.category.toLowerCase().includes(wanted.toLowerCase()),
        );
      }
      if (filters.neighborhood) {
        const match = Array.from(this.neighborhoods.values()).find(
          (n) => n.slug === filters.neighborhood,
        );
        results = match
          ? results.filter((event) => event.neighborhoodId === match.id)
          : [];
      } else if (filters.location && filters.location !== ALL_LOCATIONS) {
        results = results.filter((event) =>
          event.location.toLowerCase().includes(filters.location!.toLowerCase()),
        );
      }
      if (filters.date) {
        const filterDate = new Date(filters.date);
        if (!Number.isNaN(filterDate.getTime())) {
          results = results.filter((event) => new Date(event.date) >= filterDate);
        }
      }
    }

    return results.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
  }

  async getEvent(id: string): Promise<Event | undefined> {
    return this.events.get(id);
  }

  async getEventBySlug(slug: string): Promise<Event | undefined> {
    return Array.from(this.events.values()).find((event) => event.slug === slug);
  }

  private takenSlugs(): Set<string> {
    return new Set(
      Array.from(this.events.values())
        .map((event) => event.slug)
        .filter((slug): slug is string => Boolean(slug)),
    );
  }

  async createEvent(insertEvent: InsertEvent): Promise<Event> {
    const id = randomUUID();
    const slug = ensureUniqueSlug(
      buildEventSlug(insertEvent.title, insertEvent.date),
      this.takenSlugs(),
    );
    const event: Event = {
      ...insertEvent,
      slug,
      neighborhoodId: this.classify({
        venue: insertEvent.venue,
        location: insertEvent.location,
        title: insertEvent.title,
      }),
      originalDescription: insertEvent.originalDescription ?? null,
      enhancedDescription: insertEvent.enhancedDescription ?? null,
      sourceUrl: insertEvent.sourceUrl ?? null,
      imageUrl: insertEvent.imageUrl ?? null,
      venue: insertEvent.venue ?? null,
      price: insertEvent.price ?? null,
      isEnhanced: insertEvent.isEnhanced ?? false,
      secondaryCategories: insertEvent.secondaryCategories ?? null,
      isFree: insertEvent.isFree ?? null,
      isKidFriendly: insertEvent.isKidFriendly ?? null,
      ageRange: insertEvent.ageRange ?? null,
      isIndoor: insertEvent.isIndoor ?? null,
      isSkywalkAccessible: insertEvent.isSkywalkAccessible ?? null,
      weatherBackup: insertEvent.weatherBackup ?? null,
      insiderTip: insertEvent.insiderTip ?? null,
      venueId: (() => {
        const facts = findVenueFacts(
          insertEvent.venue,
          insertEvent.location,
          insertEvent.title,
        );
        return facts ? this.venueIdForSlug(facts.slug) : null;
      })(),
      id,
      createdAt: new Date(),
    };
    this.events.set(id, event);
    return event;
  }

  async createEvents(newEvents: EventToCreate[]): Promise<Event[]> {
    const created: Event[] = [];
    for (const { neighborhoodSlug, ...event } of newEvents) {
      const stored = await this.createEvent(event);
      // Same rule as the database store: a stated neighborhood wins over the
      // classifier's guess, so the two implementations cannot disagree.
      if (neighborhoodSlug) {
        const id = this.neighborhoodBySlug(neighborhoodSlug);
        if (id) {
          const withNeighborhood = { ...stored, neighborhoodId: id };
          this.events.set(stored.id, withNeighborhood);
          created.push(withNeighborhood);
          continue;
        }
      }
      created.push(stored);
    }
    return created;
  }

  async getFeaturedEvents(limit: number = 6): Promise<Event[]> {
    return Array.from(this.events.values())
      .filter((event) => new Date(event.date) >= new Date())
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, limit);
  }

  async getEventsBetween(start: Date, end: Date): Promise<Event[]> {
    return Array.from(this.events.values())
      .filter((event) => {
        const at = new Date(event.date);
        return at >= start && at < end;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  // Restaurants
  async getRestaurants(): Promise<Restaurant[]> {
    return Array.from(this.restaurants.values());
  }

  async getTopRestaurants(limit: number = 5): Promise<Restaurant[]> {
    return Array.from(this.restaurants.values())
      .sort((a, b) => (b.searchCount || 0) - (a.searchCount || 0))
      .slice(0, limit);
  }

  async getRestaurantBySlug(slug: string): Promise<Restaurant | undefined> {
    return Array.from(this.restaurants.values()).find((row) => row.slug === slug);
  }

  /** Free slug for a place, checked against the names already in that map. */
  private freePlaceSlug(
    existing: Iterable<{ slug: string | null }>,
    name: string,
  ): string {
    const taken = new Set(
      Array.from(existing)
        .map((row) => row.slug)
        .filter((slug): slug is string => Boolean(slug)),
    );
    return ensureUniqueSlug(buildPlaceSlug(name), taken);
  }

  async createRestaurant(insertRestaurant: InsertRestaurant): Promise<Restaurant> {
    const id = randomUUID();
    const restaurant: Restaurant = {
      ...insertRestaurant,
      slug: this.freePlaceSlug(this.restaurants.values(), insertRestaurant.name),
      neighborhoodId: this.classify({
        venue: insertRestaurant.name,
        location: insertRestaurant.location,
      }),
      description: insertRestaurant.description ?? null,
      location: insertRestaurant.location ?? null,
      imageUrl: insertRestaurant.imageUrl ?? null,
      priceRange: insertRestaurant.priceRange ?? null,
      searchCount: insertRestaurant.searchCount ?? 0,
      id,
    };
    this.restaurants.set(id, restaurant);
    return restaurant;
  }

  async incrementRestaurantSearch(id: string): Promise<void> {
    const restaurant = this.restaurants.get(id);
    if (restaurant) {
      restaurant.searchCount = (restaurant.searchCount || 0) + 1;
      this.restaurants.set(id, restaurant);
    }
  }

  // Attractions
  async getAttractions(): Promise<Attraction[]> {
    return Array.from(this.attractions.values());
  }

  async getTopAttractions(limit: number = 5): Promise<Attraction[]> {
    return Array.from(this.attractions.values())
      .sort((a, b) => (b.searchCount || 0) - (a.searchCount || 0))
      .slice(0, limit);
  }

  async getAttractionBySlug(slug: string): Promise<Attraction | undefined> {
    return Array.from(this.attractions.values()).find((row) => row.slug === slug);
  }

  async createAttraction(insertAttraction: InsertAttraction): Promise<Attraction> {
    const id = randomUUID();
    const attraction: Attraction = {
      ...insertAttraction,
      slug: this.freePlaceSlug(this.attractions.values(), insertAttraction.name),
      neighborhoodId: this.classify({
        venue: insertAttraction.name,
        location: insertAttraction.location,
      }),
      description: insertAttraction.description ?? null,
      location: insertAttraction.location ?? null,
      imageUrl: insertAttraction.imageUrl ?? null,
      searchCount: insertAttraction.searchCount ?? 0,
      isIndoor: insertAttraction.isIndoor ?? null,
      isSkywalkAccessible: insertAttraction.isSkywalkAccessible ?? null,
      id,
    };
    this.attractions.set(id, attraction);
    return attraction;
  }

  async incrementAttractionSearch(id: string): Promise<void> {
    const attraction = this.attractions.get(id);
    if (attraction) {
      attraction.searchCount = (attraction.searchCount || 0) + 1;
      this.attractions.set(id, attraction);
    }
  }

  // Playgrounds
  async getPlaygrounds(): Promise<Playground[]> {
    return Array.from(this.playgrounds.values());
  }

  async getTopPlaygrounds(limit: number = 5): Promise<Playground[]> {
    return Array.from(this.playgrounds.values())
      .sort((a, b) => (b.searchCount || 0) - (a.searchCount || 0))
      .slice(0, limit);
  }

  async getPlaygroundBySlug(slug: string): Promise<Playground | undefined> {
    return Array.from(this.playgrounds.values()).find((row) => row.slug === slug);
  }

  async createPlayground(insertPlayground: InsertPlayground): Promise<Playground> {
    const id = randomUUID();
    const playground: Playground = {
      ...insertPlayground,
      slug: this.freePlaceSlug(this.playgrounds.values(), insertPlayground.name),
      neighborhoodId: this.classify({
        venue: insertPlayground.name,
        location: insertPlayground.location,
      }),
      description: insertPlayground.description ?? null,
      location: insertPlayground.location ?? null,
      imageUrl: insertPlayground.imageUrl ?? null,
      ageRange: insertPlayground.ageRange ?? null,
      searchCount: insertPlayground.searchCount ?? 0,
      isIndoor: insertPlayground.isIndoor ?? null,
      isSkywalkAccessible: insertPlayground.isSkywalkAccessible ?? null,
      hasSplashPad: insertPlayground.hasSplashPad ?? null,
      hasShade: insertPlayground.hasShade ?? null,
      hasRestrooms: insertPlayground.hasRestrooms ?? null,
      isFenced: insertPlayground.isFenced ?? null,
      kind: insertPlayground.kind ?? "playground",
      seasonOpen: insertPlayground.seasonOpen ?? null,
      id,
    };
    this.playgrounds.set(id, playground);
    return playground;
  }

  async incrementPlaygroundSearch(id: string): Promise<void> {
    const playground = this.playgrounds.get(id);
    if (playground) {
      playground.searchCount = (playground.searchCount || 0) + 1;
      this.playgrounds.set(id, playground);
    }
  }

  // Users
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find((user) => user.username === username);
  }

  async getUserByUsernameOrEmail(identifier: string): Promise<User | undefined> {
    const value = identifier.trim().toLowerCase();
    return Array.from(this.users.values()).find(
      (user) => user.username === value || user.email === value,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = {
      ...insertUser,
      id,
      homeNeighborhoodId: insertUser.homeNeighborhoodId ?? null,
      createdAt: new Date(),
    };
    this.users.set(id, user);
    return user;
  }

  async setHomeNeighborhood(
    userId: string,
    neighborhoodId: string | null,
  ): Promise<PublicUser | undefined> {
    const user = this.users.get(userId);
    if (!user) return undefined;
    const updated = { ...user, homeNeighborhoodId: neighborhoodId };
    this.users.set(userId, updated);
    const { passwordHash: _hash, ...rest } = updated;
    return rest;
  }

  // Tips
  private tips: Map<string, Tip> = new Map();

  async createTip(userId: string, tip: InsertTip): Promise<Tip> {
    const id = randomUUID();
    const row: Tip = {
      ...tip,
      id,
      userId,
      status: "visible",
      createdAt: new Date(),
    };
    this.tips.set(id, row);
    return row;
  }

  async getTips(targetType: string, targetId: string): Promise<TipWithAuthor[]> {
    return Array.from(this.tips.values())
      .filter(
        (tip) =>
          tip.targetType === targetType &&
          tip.targetId === targetId &&
          tip.status === "visible",
      )
      .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
      .map((tip) => ({
        id: tip.id,
        body: tip.body,
        createdAt: tip.createdAt,
        authorUsername: this.users.get(tip.userId)?.username ?? "someone",
      }));
  }

  async setTipStatus(
    id: string,
    status: "visible" | "hidden",
  ): Promise<Tip | undefined> {
    const tip = this.tips.get(id);
    if (!tip) return undefined;
    const updated = { ...tip, status };
    this.tips.set(id, updated);
    return updated;
  }

  async getUserTipFor(
    userId: string,
    targetType: string,
    targetId: string,
  ): Promise<Tip | undefined> {
    return Array.from(this.tips.values()).find(
      (tip) =>
        tip.userId === userId &&
        tip.targetType === targetType &&
        tip.targetId === targetId,
    );
  }

  // Scrape health
  private scrapeRunLog: ScrapeRun[] = [];

  async recordScrapeRuns(runs: InsertScrapeRun[]): Promise<void> {
    for (const run of runs) {
      this.scrapeRunLog.unshift({
        id: randomUUID(),
        source: run.source,
        ok: run.ok,
        eventCount: run.eventCount,
        durationMs: run.durationMs,
        error: run.error ?? null,
        startedAt: new Date(),
      });
    }
    // Development store: keep it bounded so a long-running dev server does not
    // accumulate every run it has ever made.
    this.scrapeRunLog = this.scrapeRunLog.slice(0, 500);
  }

  async getRecentScrapeRuns(limit = 50): Promise<ScrapeRun[]> {
    return this.scrapeRunLog.slice(0, limit);
  }

  // Saved events
  private saved: Map<string, Set<string>> = new Map();

  async saveEvent(userId: string, eventId: string): Promise<void> {
    const set = this.saved.get(userId) ?? new Set<string>();
    set.add(eventId);
    this.saved.set(userId, set);
  }

  async unsaveEvent(userId: string, eventId: string): Promise<void> {
    this.saved.get(userId)?.delete(eventId);
  }

  async getSavedEvents(userId: string): Promise<Event[]> {
    const ids = this.saved.get(userId) ?? new Set<string>();
    return Array.from(this.events.values())
      .filter((event) => ids.has(event.id))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  async isEventSaved(userId: string, eventId: string): Promise<boolean> {
    return this.saved.get(userId)?.has(eventId) ?? false;
  }

  // Newsletter
  async subscribeNewsletter(
    subscription: InsertNewsletterSubscription,
    confirmToken: string,
  ): Promise<NewsletterSubscription> {
    const existing = Array.from(this.newsletterSubscriptions.entries()).find(
      ([, sub]) => sub.email === subscription.email,
    );

    if (existing) {
      const [existingId, sub] = existing;
      const updated: NewsletterSubscription = {
        ...sub,
        confirmToken,
        unsubscribedAt: null,
        neighborhoodId: subscription.neighborhoodId ?? null,
      };
      this.newsletterSubscriptions.set(existingId, updated);
      return updated;
    }

    const id = randomUUID();
    const newsletterSub: NewsletterSubscription = {
      ...subscription,
      id,
      subscribedAt: new Date(),
      confirmToken,
      confirmedAt: null,
      unsubscribedAt: null,
      neighborhoodId: subscription.neighborhoodId ?? null,
    };
    this.newsletterSubscriptions.set(id, newsletterSub);
    return newsletterSub;
  }

  async getConfirmedSubscribers(): Promise<NewsletterSubscription[]> {
    return Array.from(this.newsletterSubscriptions.values()).filter(
      (sub) => sub.confirmedAt && !sub.unsubscribedAt,
    );
  }

  async getSubscriptionByToken(
    token: string,
  ): Promise<NewsletterSubscription | undefined> {
    return Array.from(this.newsletterSubscriptions.values()).find(
      (sub) => sub.confirmToken === token,
    );
  }

  async confirmSubscription(
    token: string,
  ): Promise<NewsletterSubscription | undefined> {
    for (const [id, sub] of Array.from(this.newsletterSubscriptions.entries())) {
      if (sub.confirmToken !== token) continue;
      const updated = { ...sub, confirmedAt: new Date(), unsubscribedAt: null };
      this.newsletterSubscriptions.set(id, updated);
      return updated;
    }
    return undefined;
  }

  async unsubscribe(token: string): Promise<NewsletterSubscription | undefined> {
    for (const [id, sub] of Array.from(this.newsletterSubscriptions.entries())) {
      if (sub.confirmToken !== token) continue;
      const updated = { ...sub, unsubscribedAt: new Date() };
      this.newsletterSubscriptions.set(id, updated);
      return updated;
    }
    return undefined;
  }

  async getNewsletterSubscriptions(): Promise<NewsletterSubscription[]> {
    return Array.from(this.newsletterSubscriptions.values());
  }

  // Restaurant Openings
  async getRestaurantOpenings(): Promise<RestaurantOpening[]> {
    return Array.from(this.restaurantOpenings.values()).sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });
  }

  async getRestaurantOpeningBySlug(
    slug: string,
  ): Promise<RestaurantOpening | undefined> {
    return Array.from(this.restaurantOpenings.values()).find(
      (row) => row.slug === slug,
    );
  }

  async backfillOpeningSlugs(): Promise<number> {
    return this.backfillPlaceMap(this.restaurantOpenings);
  }

  async topUpFamilyPlaces(): Promise<number> {
    const known = new Set(
      Array.from(this.playgrounds.values())
        .map((row) => row.slug)
        .filter((slug): slug is string => Boolean(slug)),
    );

    let added = 0;
    for (const place of seedPlaygrounds) {
      if (known.has(buildPlaceSlug(place.name))) continue;
      await this.createPlayground(place);
      added += 1;
    }

    return added;
  }

  async createRestaurantOpening(
    insertOpening: InsertRestaurantOpening,
  ): Promise<RestaurantOpening> {
    const id = randomUUID();
    const opening: RestaurantOpening = {
      ...insertOpening,
      slug: this.freePlaceSlug(this.restaurantOpenings.values(), insertOpening.name),
      address: insertOpening.address ?? null,
      lat: insertOpening.lat ?? null,
      lng: insertOpening.lng ?? null,
      firstLookTip: insertOpening.firstLookTip ?? null,
      neighborhoodId: this.classify({
        venue: insertOpening.name,
        location: insertOpening.location,
      }),
      description: insertOpening.description ?? null,
      location: insertOpening.location ?? null,
      cuisine: insertOpening.cuisine ?? null,
      openingDate: insertOpening.openingDate ?? null,
      sourceUrl: insertOpening.sourceUrl ?? null,
      id,
      createdAt: new Date(),
    };
    this.restaurantOpenings.set(id, opening);
    return opening;
  }

  async createRestaurantOpenings(
    openings: InsertRestaurantOpening[],
  ): Promise<RestaurantOpening[]> {
    const created: RestaurantOpening[] = [];
    for (const opening of openings) {
      created.push(await this.createRestaurantOpening(opening));
    }
    return created;
  }

  async seedIfEmpty(): Promise<void> {
    if (this.neighborhoods.size === 0) {
      for (const neighborhood of seedNeighborhoods) {
        const id = randomUUID();
        this.neighborhoods.set(id, {
          ...neighborhood,
          id,
          description: neighborhood.description ?? null,
          centerLat: neighborhood.centerLat ?? null,
          centerLng: neighborhood.centerLng ?? null,
          heroImageUrl: neighborhood.heroImageUrl ?? null,
        });
      }
    }

    if (this.venues.size === 0) {
      const bySlug = new Map(
        Array.from(this.neighborhoods.values()).map((n) => [n.slug, n.id]),
      );
      for (const venue of seedVenues) {
        const id = randomUUID();
        this.venues.set(id, {
          id,
          slug: venue.slug,
          name: venue.name,
          address: venue.address ?? null,
          neighborhoodId: venue.neighborhoodSlug
            ? (bySlug.get(venue.neighborhoodSlug) ?? null)
            : null,
          lat: venue.lat ?? null,
          lng: venue.lng ?? null,
          parkingNotes: venue.parkingNotes ?? null,
          nearbyEats: venue.nearbyEats ?? null,
          kidNotes: venue.kidNotes ?? null,
          isIndoor: venue.isIndoor,
          isSkywalkAccessible: venue.isSkywalkAccessible,
          websiteUrl: venue.websiteUrl ?? null,
        });
      }
    }

    if (this.tentpoles.size === 0) {
      const bySlug = new Map(
        Array.from(this.neighborhoods.values()).map((n) => [n.slug, n.id]),
      );
      for (const seed of seedTentpoles) {
        const id = randomUUID();
        const { start, end } = resolveNextOccurrence(seed);
        this.tentpoles.set(id, {
          id,
          slug: seed.slug,
          name: seed.name,
          description: seed.description,
          typicalMonth: seed.typicalMonth,
          nextStartDate: start,
          nextEndDate: end,
          officialUrl: seed.officialUrl,
          neighborhoodId: seed.neighborhoodSlug
            ? (bySlug.get(seed.neighborhoodSlug) ?? null)
            : null,
          heroImageUrl: null,
          insiderTips: seed.insiderTips,
          whatsNewThisYear: seed.whatsNewThisYear ?? null,
          isFree: seed.isFree,
          isKidFriendly: seed.isKidFriendly,
        });
      }
    }

    if (this.events.size > 0) return;

    for (const restaurant of seedRestaurants) await this.createRestaurant(restaurant);
    for (const attraction of seedAttractions) await this.createAttraction(attraction);
    for (const playground of seedPlaygrounds) await this.createPlayground(playground);
    for (const event of buildSeedEvents()) await this.createEvent(event);
  }

  /**
   * Fill in slugs for one place map. Generic over the row type so each of the
   * three maps keeps its own element type instead of collapsing to a union.
   */
  private backfillPlaceMap<T extends { slug: string | null; name: string }>(
    map: Map<string, T>,
  ): number {
    let filled = 0;

    for (const [id, row] of Array.from(map.entries())) {
      if (row.slug) continue;
      const slug = this.freePlaceSlug(map.values(), row.name);
      map.set(id, { ...row, slug });
      filled += 1;
    }

    return filled;
  }

  async backfillPlaceSlugs(): Promise<number> {
    return (
      this.backfillPlaceMap(this.restaurants) +
      this.backfillPlaceMap(this.attractions) +
      this.backfillPlaceMap(this.playgrounds)
    );
  }

  async backfillCategories(): Promise<number> {
    let updated = 0;

    for (const [id, event] of Array.from(this.events.entries())) {
      if (isEventCategory(event.category)) continue;
      this.events.set(id, {
        ...event,
        category: normalizeCategory(event.category, event.title),
      });
      updated += 1;
    }

    return updated;
  }

  async backfillEventFlags(): Promise<number> {
    let updated = 0;

    for (const [id, event] of Array.from(this.events.entries())) {
      const venueFacts = findVenueFacts(event.venue, event.location, event.title);
      const merged = mergeFlags(
        {
          isFree: event.isFree,
          isKidFriendly: event.isKidFriendly,
          ageRange: event.ageRange,
          isIndoor: event.isIndoor,
        },
        venueFacts ? { isIndoor: venueFacts.isIndoor } : null,
        extractEventFlags({
          title: event.title,
          description: event.enhancedDescription || event.originalDescription,
          price: event.price,
          venue: event.venue,
          location: event.location,
        }),
      );
      const skywalk =
        event.isSkywalkAccessible ?? venueFacts?.isSkywalkAccessible ?? null;

      const changed =
        merged.isFree !== event.isFree ||
        merged.isKidFriendly !== event.isKidFriendly ||
        merged.ageRange !== event.ageRange ||
        merged.isIndoor !== event.isIndoor ||
        skywalk !== event.isSkywalkAccessible;

      if (!changed) continue;
      this.events.set(id, { ...event, ...merged, isSkywalkAccessible: skywalk });
      updated += 1;
    }

    return updated;
  }

  async backfillNeighborhoods(): Promise<number> {
    let filled = 0;

    for (const [id, event] of Array.from(this.events.entries())) {
      if (event.neighborhoodId) continue;
      const neighborhoodId = this.classify({
        venue: event.venue,
        location: event.location,
        title: event.title,
      });
      if (!neighborhoodId) continue;
      this.events.set(id, { ...event, neighborhoodId });
      filled += 1;
    }

    const fillPlaces = <T extends { neighborhoodId: string | null; name: string; location: string | null }>(
      map: Map<string, T>,
    ): number => {
      let count = 0;
      for (const [id, row] of Array.from(map.entries())) {
        if (row.neighborhoodId) continue;
        const neighborhoodId = this.classify({ venue: row.name, location: row.location });
        if (!neighborhoodId) continue;
        map.set(id, { ...row, neighborhoodId });
        count += 1;
      }
      return count;
    };

    filled += fillPlaces(this.restaurants);
    filled += fillPlaces(this.attractions);
    filled += fillPlaces(this.playgrounds);
    filled += fillPlaces(this.restaurantOpenings);

    return filled;
  }

  async backfillEventSlugs(): Promise<number> {
    const taken = this.takenSlugs();
    let filled = 0;

    for (const [id, event] of Array.from(this.events.entries())) {
      if (event.slug) continue;
      const slug = ensureUniqueSlug(buildEventSlug(event.title, event.date), taken);
      taken.add(slug);
      this.events.set(id, { ...event, slug });
      filled += 1;
    }

    return filled;
  }
}

/* -------------------------------------------------------------------------- */
/*                              Storage selection                               */
/* -------------------------------------------------------------------------- */

/**
 * Use PostgreSQL whenever DATABASE_URL is set. Fall back to the in-memory store
 * only in development, so a production deploy can never silently run on storage
 * that is wiped on every restart.
 */
function createStorage(): IStorage {
  if (isDatabaseConfigured) {
    return new DatabaseStorage();
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "DATABASE_URL is required in production. Refusing to start with in-memory storage, which loses all data on restart.",
    );
  }

  console.warn(
    "[storage] DATABASE_URL is not set. Falling back to in-memory storage; all data will be lost on restart.",
  );
  return new MemStorage();
}

export const storage: IStorage = createStorage();

/** Called once at boot to populate an empty store with baseline content. */
export async function initializeStorage(): Promise<void> {
  try {
    await storage.seedIfEmpty();

    // Rows written before the slug columns existed still need URLs.
    const filledEvents = await storage.backfillEventSlugs();
    if (filledEvents > 0) {
      console.log(`[storage] Backfilled slugs for ${filledEvents} event(s).`);
    }

    const filledPlaces = await storage.backfillPlaceSlugs();
    if (filledPlaces > 0) {
      console.log(`[storage] Backfilled slugs for ${filledPlaces} place(s).`);
    }

    const addedPlaces = await storage.topUpFamilyPlaces();
    if (addedPlaces > 0) {
      console.log(`[storage] Added ${addedPlaces} family destination(s).`);
    }

    const filledOpenings = await storage.backfillOpeningSlugs();
    if (filledOpenings > 0) {
      console.log(`[storage] Backfilled slugs for ${filledOpenings} opening(s).`);
    }

    const recategorized = await storage.backfillCategories();
    if (recategorized > 0) {
      console.log(`[storage] Migrated ${recategorized} event(s) to the current categories.`);
    }

    const flagged = await storage.backfillEventFlags();
    if (flagged > 0) {
      console.log(`[storage] Filled practical flags on ${flagged} event(s).`);
    }

    const linked = await storage.backfillVenueLinks();
    if (linked > 0) {
      console.log(`[storage] Linked ${linked} event(s) to a curated venue.`);
    }

    const classified = await storage.backfillNeighborhoods();
    if (classified > 0) {
      console.log(`[storage] Assigned neighborhoods to ${classified} row(s).`);
    }
  } catch (error) {
    console.error("Failed to initialize storage:", error);
  }
}
