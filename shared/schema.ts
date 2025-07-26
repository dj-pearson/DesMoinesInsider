import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, jsonb, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const events = pgTable("events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  originalDescription: text("original_description"),
  enhancedDescription: text("enhanced_description"),
  date: timestamp("date").notNull(),
  location: text("location").notNull(),
  category: text("category").notNull(),
  source: text("source").notNull(), // 'google' or 'catch-des-moines'
  sourceUrl: text("source_url"),
  imageUrl: text("image_url"),
  venue: text("venue"),
  price: text("price"),
  isEnhanced: boolean("is_enhanced").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const restaurants = pgTable("restaurants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  cuisine: text("cuisine").notNull(),
  rating: integer("rating").notNull(), // 1-5 scale
  imageUrl: text("image_url"),
  description: text("description"),
  location: text("location"),
  priceRange: text("price_range"),
  searchCount: integer("search_count").default(0),
});

export const attractions = pgTable("attractions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: text("type").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  location: text("location"),
  searchCount: integer("search_count").default(0),
});

export const playgrounds = pgTable("playgrounds", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  features: text("features").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  location: text("location"),
  ageRange: text("age_range"),
  searchCount: integer("search_count").default(0),
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
});

export const restaurantOpenings = pgTable("restaurant_openings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  location: text("location"),
  cuisine: text("cuisine"),
  openingDate: timestamp("opening_date"),
  status: text("status").notNull(), // 'opening_soon' | 'newly_opened' | 'announced'
  sourceUrl: text("source_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas
export const insertEventSchema = createInsertSchema(events).omit({
  id: true,
  createdAt: true,
});

export const insertRestaurantSchema = createInsertSchema(restaurants).omit({
  id: true,
});

export const insertAttractionSchema = createInsertSchema(attractions).omit({
  id: true,
});

export const insertPlaygroundSchema = createInsertSchema(playgrounds).omit({
  id: true,
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
});

export const insertNewsletterSchema = createInsertSchema(newsletterSubscriptions).omit({
  id: true,
  subscribedAt: true,
});

export const insertRestaurantOpeningSchema = createInsertSchema(restaurantOpenings).omit({
  id: true,
  createdAt: true,
});

// Types
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
