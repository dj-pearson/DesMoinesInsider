import {
  attractions,
  events,
  neighborhoods,
  newsletterSubscriptions,
  playgrounds,
  restaurantOpenings,
  restaurants,
  users,
  type Attraction,
  type Event,
  type InsertAttraction,
  type InsertEvent,
  type InsertNeighborhood,
  type InsertNewsletterSubscription,
  type InsertPlayground,
  type InsertRestaurant,
  type InsertRestaurantOpening,
  type InsertUser,
  type Neighborhood,
  type NewsletterSubscription,
  type Playground,
  type Restaurant,
  type RestaurantOpening,
  type User,
} from "@shared/schema";
import { and, asc, desc, eq, gte, ilike, isNull, or, sql } from "drizzle-orm";
import { buildEventSlug, buildPlaceSlug, ensureUniqueSlug } from "@shared/slug";
import { randomUUID } from "crypto";
import { getDb, isDatabaseConfigured } from "./db";
import {
  classifyNeighborhoodSlug,
  type ClassifyInput,
} from "./services/neighborhoodClassifier";
import { seedNeighborhoods } from "./seed/neighborhoods";
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

export interface IStorage {
  // Neighborhoods
  getNeighborhoods(): Promise<Neighborhood[]>;
  getNeighborhoodBySlug(slug: string): Promise<NeighborhoodWithCounts | undefined>;

  // Events
  getEvents(filters?: {
    category?: string;
    date?: string;
    location?: string;
    /** Neighborhood slug. Filters on the foreign key, not on location text. */
    neighborhood?: string;
  }): Promise<Event[]>;
  getEvent(id: string): Promise<Event | undefined>;
  getEventBySlug(slug: string): Promise<Event | undefined>;
  createEvent(event: InsertEvent): Promise<Event>;
  createEvents(events: InsertEvent[]): Promise<Event[]>;
  getFeaturedEvents(limit?: number): Promise<Event[]>;

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
  createUser(user: InsertUser): Promise<User>;

  // Newsletter
  subscribeNewsletter(subscription: InsertNewsletterSubscription): Promise<NewsletterSubscription>;
  getNewsletterSubscriptions(): Promise<NewsletterSubscription[]>;

  // Restaurant Openings
  getRestaurantOpenings(): Promise<RestaurantOpening[]>;
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

  // Neighborhoods
  async getNeighborhoods(): Promise<Neighborhood[]> {
    return this.db.select().from(neighborhoods).orderBy(asc(neighborhoods.name));
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
  }): Promise<Event[]> {
    const conditions = [];

    if (filters?.category && filters.category !== ALL_CATEGORIES) {
      conditions.push(ilike(events.category, `%${filters.category}%`));
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

  async createEvents(newEvents: InsertEvent[]): Promise<Event[]> {
    if (newEvents.length === 0) return [];

    // Resolve collisions against both the stored slugs and the ones this batch
    // is about to claim, so a batch containing two same-day duplicates of a
    // title still produces two distinct URLs.
    const taken = await this.takenSlugs();
    const prepared = await Promise.all(
      newEvents.map(async (event) => {
        const slug = ensureUniqueSlug(buildEventSlug(event.title, event.date), taken);
        taken.add(slug);
        return {
          ...event,
          slug,
          neighborhoodId: await this.classify({
            venue: event.venue,
            location: event.location,
            title: event.title,
          }),
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

  async createUser(user: InsertUser): Promise<User> {
    const [created] = await this.db.insert(users).values(user).returning();
    return created;
  }

  // Newsletter
  async subscribeNewsletter(
    subscription: InsertNewsletterSubscription,
  ): Promise<NewsletterSubscription> {
    const [created] = await this.db
      .insert(newsletterSubscriptions)
      .values(subscription)
      .returning();
    return created;
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

  async createRestaurantOpenings(
    openings: InsertRestaurantOpening[],
  ): Promise<RestaurantOpening[]> {
    if (openings.length === 0) return [];

    const prepared = await Promise.all(
      openings.map(async (opening) => ({
        ...opening,
        neighborhoodId: await this.classify({
          venue: opening.name,
          location: opening.location,
        }),
      })),
    );

    return this.db.insert(restaurantOpenings).values(prepared).returning();
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

  async seedIfEmpty(): Promise<void> {
    await this.seedNeighborhoodsIfEmpty();

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
      })
      .from(restaurantOpenings)
      .where(isNull(restaurantOpenings.neighborhoodId));

    for (const row of openingRows) {
      const neighborhoodId = await this.classify({
        venue: row.name,
        location: row.location,
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

  // Neighborhoods
  async getNeighborhoods(): Promise<Neighborhood[]> {
    return Array.from(this.neighborhoods.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
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
  private classify(input: ClassifyInput): string | null {
    const slug = classifyNeighborhoodSlug(input);
    if (!slug) return null;
    return (
      Array.from(this.neighborhoods.values()).find((n) => n.slug === slug)?.id ?? null
    );
  }

  // Events
  async getEvents(filters?: {
    category?: string;
    date?: string;
    location?: string;
    neighborhood?: string;
  }): Promise<Event[]> {
    let results = Array.from(this.events.values());

    if (filters) {
      if (filters.category && filters.category !== ALL_CATEGORIES) {
        results = results.filter((event) =>
          event.category.toLowerCase().includes(filters.category!.toLowerCase()),
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
      id,
      createdAt: new Date(),
    };
    this.events.set(id, event);
    return event;
  }

  async createEvents(newEvents: InsertEvent[]): Promise<Event[]> {
    const created: Event[] = [];
    for (const event of newEvents) {
      created.push(await this.createEvent(event));
    }
    return created;
  }

  async getFeaturedEvents(limit: number = 6): Promise<Event[]> {
    return Array.from(this.events.values())
      .filter((event) => new Date(event.date) >= new Date())
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, limit);
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

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Newsletter
  async subscribeNewsletter(
    subscription: InsertNewsletterSubscription,
  ): Promise<NewsletterSubscription> {
    const existing = Array.from(this.newsletterSubscriptions.values()).find(
      (sub) => sub.email === subscription.email,
    );
    if (existing) {
      throw new Error("duplicate key value violates unique constraint");
    }

    const id = randomUUID();
    const newsletterSub: NewsletterSubscription = {
      ...subscription,
      id,
      subscribedAt: new Date(),
    };
    this.newsletterSubscriptions.set(id, newsletterSub);
    return newsletterSub;
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

  async createRestaurantOpening(
    insertOpening: InsertRestaurantOpening,
  ): Promise<RestaurantOpening> {
    const id = randomUUID();
    const opening: RestaurantOpening = {
      ...insertOpening,
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

    const classified = await storage.backfillNeighborhoods();
    if (classified > 0) {
      console.log(`[storage] Assigned neighborhoods to ${classified} row(s).`);
    }
  } catch (error) {
    console.error("Failed to initialize storage:", error);
  }
}
