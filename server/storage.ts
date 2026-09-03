import {
  attractions,
  events,
  newsletterSubscriptions,
  playgrounds,
  restaurantOpenings,
  restaurants,
  users,
  type Attraction,
  type Event,
  type InsertAttraction,
  type InsertEvent,
  type InsertNewsletterSubscription,
  type InsertPlayground,
  type InsertRestaurant,
  type InsertRestaurantOpening,
  type InsertUser,
  type NewsletterSubscription,
  type Playground,
  type Restaurant,
  type RestaurantOpening,
  type User,
} from "@shared/schema";
import { and, asc, desc, eq, gte, ilike, isNull, or, sql } from "drizzle-orm";
import { buildEventSlug, ensureUniqueSlug } from "@shared/slug";
import { randomUUID } from "crypto";
import { getDb, isDatabaseConfigured } from "./db";
import {
  buildSeedEvents,
  seedAttractions,
  seedPlaygrounds,
  seedRestaurants,
} from "./seed/data";

export interface IStorage {
  // Events
  getEvents(filters?: { category?: string; date?: string; location?: string }): Promise<Event[]>;
  getEvent(id: string): Promise<Event | undefined>;
  getEventBySlug(slug: string): Promise<Event | undefined>;
  createEvent(event: InsertEvent): Promise<Event>;
  createEvents(events: InsertEvent[]): Promise<Event[]>;
  getFeaturedEvents(limit?: number): Promise<Event[]>;

  // Restaurants
  getRestaurants(): Promise<Restaurant[]>;
  getTopRestaurants(limit?: number): Promise<Restaurant[]>;
  createRestaurant(restaurant: InsertRestaurant): Promise<Restaurant>;
  incrementRestaurantSearch(id: string): Promise<void>;

  // Attractions
  getAttractions(): Promise<Attraction[]>;
  getTopAttractions(limit?: number): Promise<Attraction[]>;
  createAttraction(attraction: InsertAttraction): Promise<Attraction>;
  incrementAttractionSearch(id: string): Promise<void>;

  // Playgrounds
  getPlaygrounds(): Promise<Playground[]>;
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

  // Events
  async getEvents(filters?: {
    category?: string;
    date?: string;
    location?: string;
  }): Promise<Event[]> {
    const conditions = [];

    if (filters?.category && filters.category !== ALL_CATEGORIES) {
      conditions.push(ilike(events.category, `%${filters.category}%`));
    }
    if (filters?.location && filters.location !== ALL_LOCATIONS) {
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
    const withSlugs = newEvents.map((event) => {
      const slug = ensureUniqueSlug(buildEventSlug(event.title, event.date), taken);
      taken.add(slug);
      return { ...event, slug };
    });

    return this.db.insert(events).values(withSlugs).returning();
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

  async createRestaurant(restaurant: InsertRestaurant): Promise<Restaurant> {
    const [created] = await this.db.insert(restaurants).values(restaurant).returning();
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

  async createAttraction(attraction: InsertAttraction): Promise<Attraction> {
    const [created] = await this.db.insert(attractions).values(attraction).returning();
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

  async createPlayground(playground: InsertPlayground): Promise<Playground> {
    const [created] = await this.db.insert(playgrounds).values(playground).returning();
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
    const [created] = await this.db
      .insert(restaurantOpenings)
      .values(opening)
      .returning();
    return created;
  }

  async createRestaurantOpenings(
    openings: InsertRestaurantOpening[],
  ): Promise<RestaurantOpening[]> {
    if (openings.length === 0) return [];
    return this.db.insert(restaurantOpenings).values(openings).returning();
  }

  async seedIfEmpty(): Promise<void> {
    const [{ count } = { count: 0 }] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(events);

    if (count > 0) {
      return;
    }

    console.log("Database is empty, seeding baseline content...");
    await Promise.all([
      this.createEvents(buildSeedEvents()),
      this.db.insert(restaurants).values(seedRestaurants),
      this.db.insert(attractions).values(seedAttractions),
      this.db.insert(playgrounds).values(seedPlaygrounds),
    ]);
    console.log("Seeding complete.");
  }
}

/* -------------------------------------------------------------------------- */
/*                     In-memory fallback (development only)                    */
/* -------------------------------------------------------------------------- */

export class MemStorage implements IStorage {
  private events: Map<string, Event> = new Map();
  private restaurants: Map<string, Restaurant> = new Map();
  private attractions: Map<string, Attraction> = new Map();
  private playgrounds: Map<string, Playground> = new Map();
  private users: Map<string, User> = new Map();
  private newsletterSubscriptions: Map<string, NewsletterSubscription> = new Map();
  private restaurantOpenings: Map<string, RestaurantOpening> = new Map();

  // Events
  async getEvents(filters?: {
    category?: string;
    date?: string;
    location?: string;
  }): Promise<Event[]> {
    let results = Array.from(this.events.values());

    if (filters) {
      if (filters.category && filters.category !== ALL_CATEGORIES) {
        results = results.filter((event) =>
          event.category.toLowerCase().includes(filters.category!.toLowerCase()),
        );
      }
      if (filters.location && filters.location !== ALL_LOCATIONS) {
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

  async createRestaurant(insertRestaurant: InsertRestaurant): Promise<Restaurant> {
    const id = randomUUID();
    const restaurant: Restaurant = {
      ...insertRestaurant,
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

  async createAttraction(insertAttraction: InsertAttraction): Promise<Attraction> {
    const id = randomUUID();
    const attraction: Attraction = {
      ...insertAttraction,
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

  async createPlayground(insertPlayground: InsertPlayground): Promise<Playground> {
    const id = randomUUID();
    const playground: Playground = {
      ...insertPlayground,
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
    if (this.events.size > 0) return;

    for (const restaurant of seedRestaurants) await this.createRestaurant(restaurant);
    for (const attraction of seedAttractions) await this.createAttraction(attraction);
    for (const playground of seedPlaygrounds) await this.createPlayground(playground);
    for (const event of buildSeedEvents()) await this.createEvent(event);
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

    // Rows written before the slug column existed still need a URL.
    const filled = await storage.backfillEventSlugs();
    if (filled > 0) {
      console.log(`[storage] Backfilled slugs for ${filled} event(s).`);
    }
  } catch (error) {
    console.error("Failed to initialize storage:", error);
  }
}
