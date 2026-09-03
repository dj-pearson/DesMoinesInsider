import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage.js";
import { scrapeAllSources, deduplicateEvents } from "./services/scraper.js";
import { enhanceEvents } from "./services/eventEnhancer.js";
import {
  insertEventSubmissionSchema,
  insertNewsletterSchema,
  insertRestaurantOpeningSchema,
} from "@shared/schema.js";
import cron from "node-cron";
import {
  getTonightRange,
  getWeekendRange,
  getZonedParts,
  weekendDayFor,
} from "@shared/weekend.js";
import { requireAdmin } from "./middleware/auth.js";
import { buildRobotsTxt, buildSitemap } from "./services/sitemap.js";
import {
  createToken,
  sendConfirmationEmail,
  sendTestIssue,
  sendWeeklyIssue,
} from "./services/newsletter.js";
import {
  apiWriteLimiter,
  expensiveOperationLimiter,
  newsletterLimiter,
  submissionLimiter,
} from "./middleware/rateLimit.js";

/**
 * Scrape every configured source, deduplicate against what we already have,
 * enhance the new events with AI, and persist the results.
 *
 * Shared by the admin endpoint and the cron schedule so the two paths can never
 * drift apart.
 */
async function runComprehensiveScrape(): Promise<{
  events: Awaited<ReturnType<typeof storage.createEvents>>;
  restaurants: Awaited<ReturnType<typeof storage.createRestaurantOpenings>>;
}> {
  const startedAt = Date.now();
  console.log("Starting comprehensive scraping from all sources...");

  const existingEvents = await storage.getEvents();
  const { events: newEvents, restaurants: newRestaurants } = await scrapeAllSources();

  console.log(`Scraped ${newEvents.length} events from all sources`);
  console.log(`Found ${newRestaurants.length} restaurant openings from news sources`);

  // deduplicateEvents compares against the ScrapedEvent shape, so map stored
  // rows into it before checking.
  const existingScrapedEvents = existingEvents.map((e) => ({
    title: e.title,
    description: e.enhancedDescription || e.originalDescription || e.title,
    date: e.date,
    location: e.location,
    category: e.category,
    sourceUrl: e.sourceUrl || "",
    imageUrl: e.imageUrl || undefined,
    venue: e.venue || undefined,
    price: e.price || undefined,
  }));

  const uniqueEvents = deduplicateEvents(existingScrapedEvents, newEvents);
  console.log(`After deduplication: ${uniqueEvents.length} unique events to add`);

  const enhancedEvents = await enhanceEvents(uniqueEvents, "comprehensive");

  const [storedEvents, storedRestaurants] = await Promise.all([
    storage.createEvents(enhancedEvents),
    storage.createRestaurantOpenings(
      newRestaurants.map((r) => ({
        name: r.name,
        description: r.description,
        location: r.location,
        cuisine: r.cuisine,
        openingDate: r.openingDate,
        status: r.status,
        sourceUrl: r.sourceUrl,
      })),
    ),
  ]);

  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(
    `Scrape complete in ${seconds}s: stored ${storedEvents.length} events and ${storedRestaurants.length} restaurant openings`,
  );

  return { events: storedEvents, restaurants: storedRestaurants };
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Rate limit every state-changing API request per IP. Reads stay unmetered so
  // ordinary browsing and crawling are unaffected.
  app.use("/api", (req, res, next) => {
    if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
      return next();
    }
    return apiWriteLimiter(req, res, next);
  });

  // Crawler files. These sit outside /api because that is where crawlers look,
  // and they are registered here so the SPA catch-all never swallows them.
  app.get("/sitemap.xml", async (_req, res) => {
    try {
      res.type("application/xml").send(await buildSitemap());
    } catch (error) {
      console.error("Failed to build sitemap:", error);
      res.status(500).type("text/plain").send("Could not build sitemap");
    }
  });

  app.get("/robots.txt", (_req, res) => {
    res.type("text/plain").send(buildRobotsTxt());
  });

  // Tentpole guide endpoints
  app.get("/api/tentpoles", async (req, res) => {
    try {
      const upcomingOnly = req.query.upcoming === "true";
      const limit = Number.parseInt(req.query.limit as string, 10);
      res.json(
        upcomingOnly
          ? await storage.getUpcomingTentpoles(Number.isFinite(limit) ? limit : 3)
          : await storage.getTentpoles(),
      );
    } catch (error) {
      console.error("Failed to get tentpoles:", error);
      res.status(500).json({ message: "Failed to fetch guides" });
    }
  });

  app.get("/api/tentpoles/:slug", async (req, res) => {
    try {
      const guide = await storage.getTentpoleBySlug(req.params.slug);
      if (!guide) {
        return res.status(404).json({ message: "Guide not found" });
      }
      res.json(guide);
    } catch (error) {
      console.error("Failed to get tentpole:", error);
      res.status(500).json({ message: "Failed to fetch guide" });
    }
  });

  // Neighborhoods endpoints
  app.get("/api/neighborhoods", async (_req, res) => {
    try {
      res.json(await storage.getNeighborhoods());
    } catch (error) {
      console.error("Failed to get neighborhoods:", error);
      res.status(500).json({ message: "Failed to fetch neighborhoods" });
    }
  });

  // Returns the neighborhood plus everything its landing page shows, so the
  // page needs one request rather than five.
  app.get("/api/neighborhoods/:slug", async (req, res) => {
    try {
      const content = await storage.getNeighborhoodContent(req.params.slug);
      if (!content) {
        return res.status(404).json({ message: "Neighborhood not found" });
      }
      res.json(content);
    } catch (error) {
      console.error("Failed to get neighborhood:", error);
      res.status(500).json({ message: "Failed to fetch neighborhood" });
    }
  });

  // Events endpoints
  app.get("/api/events", async (req, res) => {
    try {
      const { category, date, location, neighborhood } = req.query;
      /** Only the literal string "true" enables a flag filter. */
      const flag = (value: unknown) => value === "true";

      const filters = {
        category: category as string,
        date: date as string,
        location: location as string,
        neighborhood: neighborhood as string,
        free: flag(req.query.free),
        kids: flag(req.query.kids),
        indoor: flag(req.query.indoor),
        skywalk: flag(req.query.skywalk),
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

  // Registered before /api/events/:id so the literal path segment is not read
  // as an id. All windows are computed in Des Moines time, not the server's.
  app.get("/api/events/this-weekend", async (_req, res) => {
    try {
      const now = new Date();
      const weekend = getWeekendRange(now);
      const tonight = getTonightRange(now);

      const [weekendEvents, tonightEvents] = await Promise.all([
        storage.getEventsBetween(weekend.start, weekend.end),
        storage.getEventsBetween(tonight.start, tonight.end),
      ]);

      const days = weekend.days.map((day) => ({
        label: day.label,
        date: day.date,
        events: weekendEvents.filter(
          (event) => weekendDayFor(new Date(event.date), weekend)?.date === day.date,
        ),
      }));

      res.json({
        weekendInProgress: weekend.inProgress,
        range: { start: weekend.start, end: weekend.end },
        tonight: { range: tonight, events: tonightEvents },
        days,
      });
    } catch (error) {
      console.error("Failed to get this weekend:", error);
      res.status(500).json({ message: "Failed to fetch this weekend" });
    }
  });

  // Registered before /api/events/:id so the literal "slug" segment is never
  // swallowed by the id route.
  app.get("/api/events/slug/:slug", async (req, res) => {
    try {
      const event = await storage.getEventBySlug(req.params.slug);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      res.json(event);
    } catch (error) {
      console.error("Failed to get event by slug:", error);
      res.status(500).json({ message: "Failed to fetch event" });
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

  // Comprehensive scraping endpoint for all sources.
  // Admin only: this drives a headless browser across a dozen sites and spends
  // OpenAI credits, so it must never be reachable anonymously.
  app.post(
    "/api/events/scrape",
    requireAdmin,
    expensiveOperationLimiter,
    async (_req, res) => {
      try {
        const { events: storedEvents, restaurants: storedRestaurants } =
          await runComprehensiveScrape();

        res.json({
          message: `Successfully scraped and enhanced ${storedEvents.length} events and ${storedRestaurants.length} restaurant openings`,
          events: storedEvents,
          restaurants: storedRestaurants,
        });
      } catch (error) {
        console.error("Failed to comprehensively scrape:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ message: "Failed to scrape: " + errorMessage });
      }
    },
  );

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

  // Registered alongside /top so neither literal segment is read as a slug.
  app.get("/api/restaurants/slug/:slug", async (req, res) => {
    try {
      const record = await storage.getRestaurantBySlug(req.params.slug);
      if (!record) {
        return res.status(404).json({ message: "Restaurant not found" });
      }
      res.json(record);
    } catch (error) {
      console.error("Failed to get restaurant by slug:", error);
      res.status(500).json({ message: "Failed to fetch restaurant" });
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

  // Registered alongside /top so neither literal segment is read as a slug.
  app.get("/api/attractions/slug/:slug", async (req, res) => {
    try {
      const record = await storage.getAttractionBySlug(req.params.slug);
      if (!record) {
        return res.status(404).json({ message: "Attraction not found" });
      }
      res.json(record);
    } catch (error) {
      console.error("Failed to get attraction by slug:", error);
      res.status(500).json({ message: "Failed to fetch attraction" });
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

  // Registered alongside /top so neither literal segment is read as a slug.
  app.get("/api/playgrounds/slug/:slug", async (req, res) => {
    try {
      const record = await storage.getPlaygroundBySlug(req.params.slug);
      if (!record) {
        return res.status(404).json({ message: "Playground not found" });
      }
      res.json(record);
    } catch (error) {
      console.error("Failed to get playground by slug:", error);
      res.status(500).json({ message: "Failed to fetch playground" });
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

  // Everything the family hub needs, in one request: kid-friendly free events
  // for the coming weekend plus the curated destinations grouped by kind.
  app.get("/api/family", async (_req, res) => {
    try {
      const now = new Date();
      const weekend = getWeekendRange(now);

      const [weekendEvents, places, neighborhoods] = await Promise.all([
        storage.getEventsBetween(weekend.start, weekend.end),
        storage.getPlaygrounds(),
        storage.getNeighborhoods(),
      ]);

      // Both flags must be positively true. An event with unknown
      // kid-friendliness is not something to send a family to.
      const freeThisWeekend = weekendEvents.filter(
        (event) => event.isFree === true && event.isKidFriendly === true,
      );

      res.json({
        // The Des Moines month, so the seasonal sections do not flip a day
        // early or late for a server running elsewhere.
        month: getZonedParts(now).month,
        freeThisWeekend,
        places,
        neighborhoods,
      });
    } catch (error) {
      console.error("Failed to build family hub:", error);
      res.status(500).json({ message: "Failed to fetch family content" });
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

  // Admin only: this inserts arbitrary content that renders on the public site.
  app.get("/api/restaurant-openings/slug/:slug", async (req, res) => {
    try {
      const opening = await storage.getRestaurantOpeningBySlug(req.params.slug);
      if (!opening) {
        return res.status(404).json({ message: "Not found" });
      }
      res.json(opening);
    } catch (error) {
      console.error("Failed to get restaurant opening:", error);
      res.status(500).json({ message: "Failed to fetch" });
    }
  });

  app.post("/api/restaurant-openings", requireAdmin, async (req, res) => {
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

  // Community submissions
  app.post("/api/submissions", submissionLimiter, async (req, res) => {
    try {
      // Honeypot: a field hidden from people but filled in by naive bots.
      // Answer 200 so a bot cannot tell it was caught and retry differently.
      if (typeof req.body?.website === "string" && req.body.website.trim() !== "") {
        console.warn("[submissions] Honeypot triggered; discarding.");
        return res.json({ message: "Thanks. We will take a look." });
      }

      const result = insertEventSubmissionSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({
          message: "Please check the form",
          issues: result.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        });
      }

      // Nothing here is published. A reviewer decides.
      await storage.createSubmission(result.data);
      res.json({ message: "Thanks. We will take a look." });
    } catch (error) {
      console.error("Failed to record submission:", error);
      res.status(500).json({ message: "Could not record your submission" });
    }
  });

  app.get("/api/submissions", requireAdmin, async (req, res) => {
    try {
      const status = typeof req.query.status === "string" ? req.query.status : undefined;
      res.json(await storage.getSubmissions(status));
    } catch (error) {
      console.error("Failed to list submissions:", error);
      res.status(500).json({ message: "Could not list submissions" });
    }
  });

  app.post("/api/submissions/:id/approve", requireAdmin, async (req, res) => {
    try {
      const submission = await storage.getSubmission(req.params.id);
      if (!submission) return res.status(404).json({ message: "Not found" });
      if (submission.status !== "pending") {
        return res.status(409).json({ message: `Already ${submission.status}` });
      }

      // Approved submissions go through the same enhancement path as scraped
      // events, so they get the same categories, flags and venue linking.
      const [enhanced] = await enhanceEvents(
        [
          {
            title: submission.title,
            description: submission.description,
            date: submission.date,
            location: submission.location,
            category: submission.category,
            sourceUrl: submission.sourceUrl ?? "",
            imageUrl: submission.imageUrl ?? undefined,
            venue: submission.venue ?? undefined,
            price: submission.price ?? undefined,
          },
        ],
        "community",
      );

      const [published] = await storage.createEvents([enhanced]);
      await storage.markSubmissionReviewed(submission.id, "approved", published.id);

      res.json({ message: "Published", event: published });
    } catch (error) {
      console.error("Failed to approve submission:", error);
      res.status(500).json({ message: "Could not approve submission" });
    }
  });

  app.post("/api/submissions/:id/reject", requireAdmin, async (req, res) => {
    try {
      const submission = await storage.markSubmissionReviewed(req.params.id, "rejected");
      if (!submission) return res.status(404).json({ message: "Not found" });
      res.json({ message: "Rejected" });
    } catch (error) {
      console.error("Failed to reject submission:", error);
      res.status(500).json({ message: "Could not reject submission" });
    }
  });

  // Newsletter endpoints
  app.post("/api/newsletter/subscribe", newsletterLimiter, async (req, res) => {
    try {
      const result = insertNewsletterSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid email format" });
      }

      const token = createToken();
      const subscription = await storage.subscribeNewsletter(result.data, token);

      // Double opt-in: nothing is sent to this address until the link is
      // clicked, so a typo or a malicious signup cannot subscribe someone else.
      await sendConfirmationEmail(subscription);

      res.json({
        message: "Check your email to confirm your subscription",
        subscription: { email: subscription.email },
      });
    } catch (error) {
      console.error("Failed to subscribe to newsletter:", error);
      res.status(500).json({ message: "Failed to subscribe to newsletter" });
    }
  });

  app.get("/api/newsletter/confirm", async (req, res) => {
    const token = typeof req.query.token === "string" ? req.query.token : "";
    if (!token) return res.status(400).send("Missing token");

    try {
      const subscription = await storage.confirmSubscription(token);
      if (!subscription) {
        return res.status(404).send("That confirmation link is not valid.");
      }
      // Clicked from an email client, so answer with a page rather than JSON.
      res.redirect("/?subscribed=1");
    } catch (error) {
      console.error("Failed to confirm subscription:", error);
      res.status(500).send("Could not confirm your subscription.");
    }
  });

  /** Both GET and POST: mail clients use POST for one-click unsubscribe. */
  const handleUnsubscribe = async (req: Request, res: Response) => {
    const token =
      (typeof req.query.token === "string" && req.query.token) ||
      (typeof req.body?.token === "string" && req.body.token) ||
      "";
    if (!token) return res.status(400).send("Missing token");

    try {
      const subscription = await storage.unsubscribe(token);
      if (!subscription) {
        return res.status(404).send("That unsubscribe link is not valid.");
      }
      res.send(
        "You have been unsubscribed from Des Moines Insider. Nothing further will be sent.",
      );
    } catch (error) {
      console.error("Failed to unsubscribe:", error);
      res.status(500).send("Could not unsubscribe.");
    }
  };

  app.get("/api/newsletter/unsubscribe", handleUnsubscribe);
  app.post("/api/newsletter/unsubscribe", handleUnsubscribe);

  // Admin only: sends the current issue to one address for a look before the
  // Thursday run.
  app.post(
    "/api/newsletter/send-test",
    requireAdmin,
    expensiveOperationLimiter,
    async (req, res) => {
      const to = typeof req.body?.email === "string" ? req.body.email : "";
      if (!to) return res.status(400).json({ message: "An email address is required" });

      try {
        res.json(await sendTestIssue(to));
      } catch (error) {
        console.error("Failed to send test issue:", error);
        res.status(500).json({ message: "Failed to send test issue" });
      }
    },
  );

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
      
      const categoryFilter =
        typeof category === "string" && category && category !== "All Categories"
          ? category
          : undefined;

      const filteredEvents = events.filter((event) => {
        const matchesText =
          event.title.toLowerCase().includes(searchLower) ||
          event.enhancedDescription?.toLowerCase().includes(searchLower) ||
          event.location.toLowerCase().includes(searchLower);
        if (!matchesText) return false;

        // The dropdown lists event categories, so it narrows events only. A
        // secondary category counts: a free outdoor concert should appear
        // under Free as well as under Music.
        if (!categoryFilter) return true;
        return (
          event.category === categoryFilter ||
          (event.secondaryCategories ?? []).includes(categoryFilter)
        );
      });

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

  // Scheduled scraping every 6 hours. Uses the same code path as the admin
  // endpoint so behaviour cannot drift between them.
  cron.schedule("0 */6 * * *", async () => {
    console.log("Running scheduled comprehensive scraping...");
    try {
      const { events, restaurants } = await runComprehensiveScrape();
      console.log(
        `Scheduled scraping completed: ${events.length} events and ${restaurants.length} restaurant openings processed`,
      );
    } catch (error) {
      console.error("Scheduled comprehensive scraping failed:", error);
    }
  });

  // Thursday at 4pm Des Moines time: late enough that weekend plans are being
  // made, early enough to still influence them.
  cron.schedule(
    "0 16 * * 4",
    async () => {
      console.log("Sending the weekly newsletter...");
      try {
        const report = await sendWeeklyIssue();
        console.log(
          report.skipped
            ? `Newsletter skipped: ${report.skipped}`
            : `Newsletter sent to ${report.sent} of ${report.attempted} subscriber(s)`,
        );
      } catch (error) {
        console.error("Weekly newsletter send failed:", error);
      }
    },
    { timezone: "America/Chicago" },
  );

  const httpServer = createServer(app);
  return httpServer;
}
