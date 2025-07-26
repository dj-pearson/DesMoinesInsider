import { 
  type Event, 
  type InsertEvent,
  type Restaurant,
  type InsertRestaurant,
  type Attraction,
  type InsertAttraction,
  type Playground,
  type InsertPlayground,
  type User, 
  type InsertUser,
  type NewsletterSubscription,
  type InsertNewsletterSubscription,
  type RestaurantOpening,
  type InsertRestaurantOpening
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Events
  getEvents(filters?: { category?: string; date?: string; location?: string }): Promise<Event[]>;
  getEvent(id: string): Promise<Event | undefined>;
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
}

export class MemStorage implements IStorage {
  private events: Map<string, Event> = new Map();
  private restaurants: Map<string, Restaurant> = new Map();
  private attractions: Map<string, Attraction> = new Map();
  private playgrounds: Map<string, Playground> = new Map();
  private users: Map<string, User> = new Map();
  private newsletterSubscriptions: Map<string, NewsletterSubscription> = new Map();
  private restaurantOpenings: Map<string, RestaurantOpening> = new Map();

  constructor() {
    this.initializeData();
    this.initializeSampleEvents();
  }

  private initializeData() {
    // Initialize with some basic data
    const sampleRestaurants: InsertRestaurant[] = [
      {
        name: "The Continental",
        cuisine: "Modern American",
        rating: 5,
        description: "Upscale dining with contemporary American cuisine",
        location: "Downtown Des Moines",
        priceRange: "$$$",
        searchCount: 150,
        imageUrl: "https://images.unsplash.com/photo-1514933651103-005eec06c04b?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=400"
      },
      {
        name: "Mars Cafe",
        cuisine: "Coffee & Light Bites",
        rating: 5,
        description: "Local coffee shop with fresh pastries and light meals",
        location: "Downtown Des Moines",
        priceRange: "$",
        searchCount: 120,
        imageUrl: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=400"
      },
      {
        name: "El Bait Shop",
        cuisine: "Mexican",
        rating: 5,
        description: "Authentic Mexican cuisine with extensive beer selection",
        location: "Des Moines",
        priceRange: "$$",
        searchCount: 100,
        imageUrl: "https://images.unsplash.com/photo-1615141982883-c7ad0e69fd62?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=400"
      }
    ];

    const sampleAttractions: InsertAttraction[] = [
      {
        name: "Pappajohn Sculpture Park",
        type: "Outdoor Art",
        description: "Beautiful outdoor sculpture garden in downtown Des Moines",
        location: "Downtown Des Moines",
        searchCount: 200,
        imageUrl: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=400"
      },
      {
        name: "Iowa State Capitol",
        type: "Historic Building",
        description: "Historic state capitol building with guided tours",
        location: "Des Moines",
        searchCount: 180,
        imageUrl: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=400"
      },
      {
        name: "High Trestle Trail",
        type: "Outdoor Recreation",
        description: "Scenic trail connecting multiple Iowa communities",
        location: "Des Moines Metro",
        searchCount: 160,
        imageUrl: "https://images.unsplash.com/photo-1503435980610-a51f3ddfee50?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=400"
      }
    ];

    const samplePlaygrounds: InsertPlayground[] = [
      {
        name: "Gray's Lake Park",
        features: "Lake views, trails",
        description: "Beautiful park with playground equipment and lake access",
        location: "Des Moines",
        ageRange: "All ages",
        searchCount: 90,
        imageUrl: "https://images.unsplash.com/photo-1576671081837-49000212a370?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=400"
      },
      {
        name: "Raccoon River Park",
        features: "Beach, water play",
        description: "Large park with beach area and water playground",
        location: "West Des Moines",
        ageRange: "All ages",
        searchCount: 80,
        imageUrl: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=400"
      },
      {
        name: "Walnut Creek Park",
        features: "Adventure course",
        description: "Adventure playground with climbing structures",
        location: "West Des Moines",
        ageRange: "5-12 years",
        searchCount: 70,
        imageUrl: "https://images.unsplash.com/photo-1567653418876-5bb0e566e1c2?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=400"
      }
    ];

    // Add sample data
    sampleRestaurants.forEach(restaurant => this.createRestaurant(restaurant));
    sampleAttractions.forEach(attraction => this.createAttraction(attraction));
    samplePlaygrounds.forEach(playground => this.createPlayground(playground));
  }

  private async initializeSampleEvents() {
    const sampleEvents: InsertEvent[] = [
      {
        title: "Des Moines Farmers Market",
        originalDescription: "Weekly farmers market with local vendors",
        enhancedDescription: "Experience the vibrant Des Moines Farmers Market, where local farmers and artisans gather every Saturday to offer fresh produce, handcrafted goods, and delicious prepared foods. This community favorite showcases the best of Iowa agriculture and provides a perfect weekend activity for families seeking fresh, locally-sourced ingredients and unique handmade items.",
        date: new Date("2025-08-02T10:00:00Z"),
        location: "Downtown Des Moines",
        category: "Food",
        source: "manual",
        sourceUrl: "https://www.catchdesmoines.com/events/farmers-market",
        imageUrl: "https://images.unsplash.com/photo-1488459716781-31db52582fe9?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=400",
        venue: "Historic Court District",
        price: "Free admission",
        isEnhanced: true
      },
      {
        title: "Iowa State Capitol Tour",
        originalDescription: "Guided tour of the Iowa State Capitol building",
        enhancedDescription: "Discover Iowa's rich political history with a comprehensive guided tour of the magnificent Iowa State Capitol. Marvel at the stunning architecture, learn about the legislative process, and explore the beautiful chambers where state decisions are made. Perfect for visitors and locals alike who want to understand more about Iowa's government and heritage.",
        date: new Date("2025-08-03T14:00:00Z"),
        location: "Des Moines",
        category: "Tourism",
        source: "manual",
        sourceUrl: "https://www.legis.iowa.gov/tours",
        imageUrl: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=400",
        venue: "Iowa State Capitol",
        price: "Free",
        isEnhanced: true
      },
      {
        title: "Downtown Des Moines Art Walk",
        originalDescription: "Monthly art walk featuring local galleries and artists",
        enhancedDescription: "Join the monthly Downtown Des Moines Art Walk, a cultural celebration that transforms the city center into an open-air gallery. Explore diverse local galleries, meet talented artists, and discover unique artworks while enjoying complimentary refreshments. This free community event showcases Des Moines' thriving arts scene and provides an excellent opportunity to support local creators.",
        date: new Date("2025-08-04T18:00:00Z"),
        location: "Downtown Des Moines",
        category: "Art",
        source: "manual",
        sourceUrl: "https://www.desmoinesartwalk.com",
        imageUrl: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=400",
        venue: "Various Downtown Galleries",
        price: "Free",
        isEnhanced: true
      },
      {
        title: "Gray's Lake Trail Walk",
        originalDescription: "Nature walk around Gray's Lake",
        enhancedDescription: "Enjoy a peaceful nature walk around the scenic Gray's Lake Trail, one of Des Moines' most beloved outdoor destinations. This family-friendly trail offers stunning lake views, diverse wildlife spotting opportunities, and a perfect escape from city life. Whether you're looking for exercise, relaxation, or quality time with family, this trail provides a beautiful setting for outdoor recreation.",
        date: new Date("2025-08-05T09:00:00Z"),
        location: "Gray's Lake Park",
        category: "Outdoor",
        source: "manual",
        sourceUrl: "https://www.dsm.city/departments/parks-and-recreation/grays-lake",
        imageUrl: "https://images.unsplash.com/photo-1576671081837-49000212a370?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=400",
        venue: "Gray's Lake Park",
        price: "Free",
        isEnhanced: true
      },
      {
        title: "West Des Moines Jazz Night",
        originalDescription: "Live jazz music performance",
        enhancedDescription: "Immerse yourself in the smooth sounds of live jazz at West Des Moines Jazz Night, featuring talented local musicians and visiting artists. This intimate venue provides the perfect atmosphere for jazz enthusiasts and newcomers alike, with expertly crafted cocktails and a sophisticated ambiance that celebrates the timeless art of jazz music.",
        date: new Date("2025-08-06T20:00:00Z"),
        location: "West Des Moines",
        category: "Music",
        source: "manual",
        sourceUrl: "https://www.westdesmoines.org/events",
        imageUrl: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=400",
        venue: "Historic Valley Junction",
        price: "$15-25",
        isEnhanced: true
      },
      {
        title: "Family Fun Day at Science Center",
        originalDescription: "Interactive science activities for families",
        enhancedDescription: "Bring your curiosity to Family Fun Day at the Science Center of Iowa, where hands-on exhibits and interactive demonstrations make learning an adventure. Children and adults will explore fascinating scientific concepts through engaging activities, planetarium shows, and live experiments that spark imagination and foster a love for discovery.",
        date: new Date("2025-08-07T10:00:00Z"),
        location: "Des Moines",
        category: "Family",
        source: "manual",
        sourceUrl: "https://www.sciowa.org",
        imageUrl: "https://images.unsplash.com/photo-1581833971358-2c8b550f87b3?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=400",
        venue: "Science Center of Iowa",
        price: "$12-18",
        isEnhanced: true
      }
    ];

    // Add sample events
    for (const event of sampleEvents) {
      await this.createEvent(event);
    }
  }

  // Events
  async getEvents(filters?: { category?: string; date?: string; location?: string }): Promise<Event[]> {
    let events = Array.from(this.events.values());
    
    if (filters) {
      if (filters.category && filters.category !== 'All Categories') {
        events = events.filter(event => event.category.toLowerCase().includes(filters.category!.toLowerCase()));
      }
      if (filters.location && filters.location !== 'All Locations') {
        events = events.filter(event => event.location.toLowerCase().includes(filters.location!.toLowerCase()));
      }
      if (filters.date) {
        const filterDate = new Date(filters.date);
        events = events.filter(event => {
          const eventDate = new Date(event.date);
          return eventDate >= filterDate;
        });
      }
    }
    
    return events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  async getEvent(id: string): Promise<Event | undefined> {
    return this.events.get(id);
  }

  async createEvent(insertEvent: InsertEvent): Promise<Event> {
    const id = randomUUID();
    const event: Event = { 
      ...insertEvent,
      originalDescription: insertEvent.originalDescription ?? null,
      enhancedDescription: insertEvent.enhancedDescription ?? null,
      sourceUrl: insertEvent.sourceUrl ?? null,
      imageUrl: insertEvent.imageUrl ?? null,
      venue: insertEvent.venue ?? null,
      price: insertEvent.price ?? null,
      isEnhanced: insertEvent.isEnhanced ?? false,
      id,
      createdAt: new Date()
    };
    this.events.set(id, event);
    return event;
  }

  async createEvents(events: InsertEvent[]): Promise<Event[]> {
    const createdEvents: Event[] = [];
    for (const event of events) {
      const created = await this.createEvent(event);
      createdEvents.push(created);
    }
    return createdEvents;
  }

  async getFeaturedEvents(limit: number = 6): Promise<Event[]> {
    const events = Array.from(this.events.values())
      .filter(event => new Date(event.date) >= new Date())
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, limit);
    return events;
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
      id 
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
      id 
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
      id 
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
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Newsletter
  async subscribeNewsletter(subscription: InsertNewsletterSubscription): Promise<NewsletterSubscription> {
    const id = randomUUID();
    const newsletterSub: NewsletterSubscription = { 
      ...subscription, 
      id,
      subscribedAt: new Date()
    };
    this.newsletterSubscriptions.set(id, newsletterSub);
    return newsletterSub;
  }

  async getNewsletterSubscriptions(): Promise<NewsletterSubscription[]> {
    return Array.from(this.newsletterSubscriptions.values());
  }

  // Restaurant Openings
  async getRestaurantOpenings(): Promise<RestaurantOpening[]> {
    return Array.from(this.restaurantOpenings.values())
      .sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      });
  }

  async createRestaurantOpening(insertOpening: InsertRestaurantOpening): Promise<RestaurantOpening> {
    const id = randomUUID();
    const opening: RestaurantOpening = { 
      ...insertOpening,
      description: insertOpening.description ?? null,
      location: insertOpening.location ?? null,
      cuisine: insertOpening.cuisine ?? null,
      openingDate: insertOpening.openingDate ?? null,
      sourceUrl: insertOpening.sourceUrl ?? null,
      id,
      createdAt: new Date()
    };
    this.restaurantOpenings.set(id, opening);
    return opening;
  }

  async createRestaurantOpenings(openings: InsertRestaurantOpening[]): Promise<RestaurantOpening[]> {
    const createdOpenings: RestaurantOpening[] = [];
    for (const opening of openings) {
      const created = await this.createRestaurantOpening(opening);
      createdOpenings.push(created);
    }
    return createdOpenings;
  }
}

export const storage = new MemStorage();
