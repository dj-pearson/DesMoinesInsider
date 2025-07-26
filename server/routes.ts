import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage.js";
import { scrapeAllSources, deduplicateEvents } from "./services/scraper.js";
import { enhanceEvents } from "./services/eventEnhancer.js";
import { insertNewsletterSchema, insertRestaurantOpeningSchema } from "@shared/schema.js";
import cron from "node-cron";

export async function registerRoutes(app: Express): Promise<Server> {
  // Events endpoints
  app.get("/api/events", async (req, res) => {
    try {
      const { category, date, location } = req.query;
      const filters = {
        category: category as string,
        date: date as string,
        location: location as string,
      };
      
      const events = await storage.getEvents(filters);
      res.json(events);
    } catch (error) {
      console.error("Failed to get events:", error);
      res.status(500).json({ message: "Failed to fetch events" });
    }
  });

  app.get("/api/events/featured", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 6;
      const events = await storage.getFeaturedEvents(limit);
      res.json(events);
    } catch (error) {
      console.error("Failed to get featured events:", error);
      res.status(500).json({ message: "Failed to fetch featured events" });
    }
  });

  app.get("/api/events/:id", async (req, res) => {
    try {
      const event = await storage.getEvent(req.params.id);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      res.json(event);
    } catch (error) {
      console.error("Failed to get event:", error);
      res.status(500).json({ message: "Failed to fetch event" });
    }
  });

  // Comprehensive scraping endpoint for all sources
  app.post("/api/events/scrape", async (req, res) => {
    try {
      console.log("Starting comprehensive scraping from all sources...");
      
      // Get existing events for deduplication
      const existingEvents = await storage.getEvents();
      
      // Scrape from all sources
      const { events: newEvents, restaurants: newRestaurants } = await scrapeAllSources();
      
      console.log(`Scraped ${newEvents.length} new events from all sources`);
      console.log(`Found ${newRestaurants.length} restaurant openings from news sources`);

      // Deduplicate events against existing ones - map existing events to match ScrapedEvent interface
      const existingScrapedEvents = existingEvents.map(e => ({
        title: e.title,
        description: e.enhancedDescription || e.originalDescription || e.title,
        date: e.date,
        location: e.location,
        category: e.category,
        sourceUrl: e.sourceUrl || '',
        imageUrl: e.imageUrl || undefined,
        venue: e.venue || undefined,
        price: e.price || undefined
      }));
      const uniqueEvents = deduplicateEvents(existingScrapedEvents, newEvents);
      console.log(`After deduplication: ${uniqueEvents.length} unique events to add`);

      // Enhance events with AI
      const enhancedEvents = await enhanceEvents(uniqueEvents, 'comprehensive');

      // Store enhanced events and restaurant openings
      const [storedEvents, storedRestaurants] = await Promise.all([
        storage.createEvents(enhancedEvents),
        storage.createRestaurantOpenings(newRestaurants.map(r => ({
          name: r.name,
          description: r.description,
          location: r.location,
          cuisine: r.cuisine,
          openingDate: r.openingDate,
          status: r.status,
          sourceUrl: r.sourceUrl
        })))
      ]);

      console.log(`Enhanced and stored ${storedEvents.length} events`);
      console.log(`Stored ${storedRestaurants.length} restaurant openings`);
      
      res.json({
        message: `Successfully scraped and enhanced ${storedEvents.length} events and ${storedRestaurants.length} restaurant openings`,
        events: storedEvents,
        restaurants: storedRestaurants
      });
    } catch (error) {
      console.error("Failed to comprehensively scrape:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message: "Failed to scrape: " + errorMessage });
    }
  });

  // Restaurants endpoints
  app.get("/api/restaurants", async (req, res) => {
    try {
      const restaurants = await storage.getRestaurants();
      res.json(restaurants);
    } catch (error) {
      console.error("Failed to get restaurants:", error);
      res.status(500).json({ message: "Failed to fetch restaurants" });
    }
  });

  app.get("/api/restaurants/top", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 5;
      const restaurants = await storage.getTopRestaurants(limit);
      res.json(restaurants);
    } catch (error) {
      console.error("Failed to get top restaurants:", error);
      res.status(500).json({ message: "Failed to fetch top restaurants" });
    }
  });

  app.post("/api/restaurants/:id/search", async (req, res) => {
    try {
      await storage.incrementRestaurantSearch(req.params.id);
      res.json({ message: "Search count updated" });
    } catch (error) {
      console.error("Failed to update restaurant search:", error);
      res.status(500).json({ message: "Failed to update search count" });
    }
  });

  // Attractions endpoints
  app.get("/api/attractions", async (req, res) => {
    try {
      const attractions = await storage.getAttractions();
      res.json(attractions);
    } catch (error) {
      console.error("Failed to get attractions:", error);
      res.status(500).json({ message: "Failed to fetch attractions" });
    }
  });

  app.get("/api/attractions/top", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 5;
      const attractions = await storage.getTopAttractions(limit);
      res.json(attractions);
    } catch (error) {
      console.error("Failed to get top attractions:", error);
      res.status(500).json({ message: "Failed to fetch top attractions" });
    }
  });

  app.post("/api/attractions/:id/search", async (req, res) => {
    try {
      await storage.incrementAttractionSearch(req.params.id);
      res.json({ message: "Search count updated" });
    } catch (error) {
      console.error("Failed to update attraction search:", error);
      res.status(500).json({ message: "Failed to update search count" });
    }
  });

  // Playgrounds endpoints
  app.get("/api/playgrounds", async (req, res) => {
    try {
      const playgrounds = await storage.getPlaygrounds();
      res.json(playgrounds);
    } catch (error) {
      console.error("Failed to get playgrounds:", error);
      res.status(500).json({ message: "Failed to fetch playgrounds" });
    }
  });

  app.get("/api/playgrounds/top", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 5;
      const playgrounds = await storage.getTopPlaygrounds(limit);
      res.json(playgrounds);
    } catch (error) {
      console.error("Failed to get top playgrounds:", error);
      res.status(500).json({ message: "Failed to fetch top playgrounds" });
    }
  });

  app.post("/api/playgrounds/:id/search", async (req, res) => {
    try {
      await storage.incrementPlaygroundSearch(req.params.id);
      res.json({ message: "Search count updated" });
    } catch (error) {
      console.error("Failed to update playground search:", error);
      res.status(500).json({ message: "Failed to update search count" });
    }
  });

  // Restaurant Openings endpoints
  app.get("/api/restaurant-openings", async (req, res) => {
    try {
      const openings = await storage.getRestaurantOpenings();
      res.json(openings);
    } catch (error) {
      console.error("Failed to get restaurant openings:", error);
      res.status(500).json({ message: "Failed to fetch restaurant openings" });
    }
  });

  app.post("/api/restaurant-openings", async (req, res) => {
    try {
      const result = insertRestaurantOpeningSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid restaurant opening data" });
      }

      const opening = await storage.createRestaurantOpening(result.data);
      res.json(opening);
    } catch (error) {
      console.error("Failed to create restaurant opening:", error);
      res.status(500).json({ message: "Failed to create restaurant opening" });
    }
  });

  // Newsletter endpoint
  app.post("/api/newsletter/subscribe", async (req, res) => {
    try {
      const result = insertNewsletterSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid email format" });
      }

      const subscription = await storage.subscribeNewsletter(result.data);
      res.json({ 
        message: "Successfully subscribed to newsletter",
        subscription: { email: subscription.email }
      });
    } catch (error) {
      console.error("Failed to subscribe to newsletter:", error);
      const errorMessage = error instanceof Error ? error.message : "";
      if (errorMessage?.includes('unique')) {
        res.status(400).json({ message: "Email already subscribed" });
      } else {
        res.status(500).json({ message: "Failed to subscribe to newsletter" });
      }
    }
  });

  // Search endpoint
  app.get("/api/search", async (req, res) => {
    try {
      const { q, category } = req.query;
      const query = q as string;

      if (!query) {
        return res.status(400).json({ message: "Search query required" });
      }

      // Search across events, restaurants, attractions, and playgrounds
      const [events, restaurants, attractions, playgrounds] = await Promise.all([
        storage.getEvents(),
        storage.getRestaurants(),
        storage.getAttractions(),
        storage.getPlaygrounds()
      ]);

      const searchLower = query.toLowerCase();
      
      const filteredEvents = events.filter(event => 
        event.title.toLowerCase().includes(searchLower) ||
        event.enhancedDescription?.toLowerCase().includes(searchLower) ||
        event.location.toLowerCase().includes(searchLower)
      );

      const filteredRestaurants = restaurants.filter(restaurant =>
        restaurant.name.toLowerCase().includes(searchLower) ||
        restaurant.cuisine.toLowerCase().includes(searchLower)
      );

      const filteredAttractions = attractions.filter(attraction =>
        attraction.name.toLowerCase().includes(searchLower) ||
        attraction.type.toLowerCase().includes(searchLower)
      );

      const filteredPlaygrounds = playgrounds.filter(playground =>
        playground.name.toLowerCase().includes(searchLower) ||
        playground.features.toLowerCase().includes(searchLower)
      );

      res.json({
        events: filteredEvents,
        restaurants: filteredRestaurants,
        attractions: filteredAttractions,
        playgrounds: filteredPlaygrounds
      });
    } catch (error) {
      console.error("Failed to search:", error);
      res.status(500).json({ message: "Search failed" });
    }
  });

  // Schedule automatic comprehensive scraping every 6 hours
  cron.schedule('0 */6 * * *', async () => {
    console.log('Running scheduled comprehensive scraping...');
    try {
      // Get existing events for deduplication
      const existingEvents = await storage.getEvents();
      
      // Scrape from all sources
      const { events: newEvents, restaurants: newRestaurants } = await scrapeAllSources();
      
      // Deduplicate events against existing ones
      const existingScrapedEvents = existingEvents.map(e => ({
        title: e.title,
        description: e.enhancedDescription || e.originalDescription || e.title,
        date: e.date,
        location: e.location,
        category: e.category,
        sourceUrl: e.sourceUrl || '',
        imageUrl: e.imageUrl || undefined,
        venue: e.venue || undefined,
        price: e.price || undefined
      }));
      const uniqueEvents = deduplicateEvents(existingScrapedEvents, newEvents);

      // Enhance events with AI
      const enhancedEvents = await enhanceEvents(uniqueEvents, 'comprehensive');

      // Store enhanced events and restaurant openings
      const [storedEvents, storedRestaurants] = await Promise.all([
        storage.createEvents(enhancedEvents),
        storage.createRestaurantOpenings(newRestaurants.map(r => ({
          name: r.name,
          description: r.description,
          location: r.location,
          cuisine: r.cuisine,
          openingDate: r.openingDate,
          status: r.status,
          sourceUrl: r.sourceUrl
        })))
      ]);
      
      console.log(`Scheduled scraping completed: ${storedEvents.length} events and ${storedRestaurants.length} restaurant openings processed`);
    } catch (error) {
      console.error('Scheduled comprehensive scraping failed:', error);
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
