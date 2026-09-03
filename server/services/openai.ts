import OpenAI from "openai";
import { EVENT_CATEGORIES } from "@shared/schema.js";
import {
  normalizeCategory,
  normalizeSecondaryCategories,
} from "@shared/categories.js";
import type { EventCategory } from "@shared/schema.js";

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key"
});

export async function enhanceEventDescription(
  title: string,
  originalDescription: string,
  location: string,
  category: string
): Promise<string> {
  try {
    const prompt = `
You are a local Des Moines event expert. Enhance the following event description to be more engaging and informative for locals and visitors. Include relevant details about what to expect, who might enjoy it, and any local context that would be helpful.

Event Title: ${title}
Original Description: ${originalDescription}
Location: ${location}
Category: ${category}

Please provide an enhanced description that is:
- More engaging and descriptive
- Includes practical information
- Highlights what makes this event special
- Maintains accuracy to the original content
- Is 2-3 sentences long

Respond with only the enhanced description text.
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [{ role: "user", content: prompt }],
      max_tokens: 200,
    });

    return response.choices[0].message.content?.trim() || originalDescription;
  } catch (error) {
    console.error("Failed to enhance event description:", error);
    return originalDescription;
  }
}

export async function generateLocalRecommendations(category: string): Promise<{
  restaurants: Array<{ name: string; cuisine: string; rating: number; description: string }>;
  attractions: Array<{ name: string; type: string; description: string }>;
  playgrounds: Array<{ name: string; features: string; description: string; ageRange: string }>;
}> {
  try {
    const prompt = `
Generate authentic recommendations for Des Moines, Iowa in the category of ${category}. 
Provide real, well-known establishments and locations that actually exist in Des Moines.

Respond with JSON in this exact format:
{
  "restaurants": [
    { "name": "Restaurant Name", "cuisine": "Cuisine Type", "rating": 4, "description": "Brief description" }
  ],
  "attractions": [
    { "name": "Attraction Name", "type": "Type", "description": "Brief description" }
  ],
  "playgrounds": [
    { "name": "Playground Name", "features": "Key features", "description": "Brief description", "ageRange": "Age range" }
  ]
}

Include 3-5 items per category. Only include real places that exist in Des Moines.
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: "You are a Des Moines local expert. Only provide information about real, existing places in Des Moines, Iowa."
        },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    return result;
  } catch (error) {
    console.error("Failed to generate local recommendations:", error);
    return { restaurants: [], attractions: [], playgrounds: [] };
  }
}


export interface EnhancedEventContent {
  description: string;
  category: EventCategory;
  secondaryCategories: EventCategory[];
}

/**
 * Enhance an event's description and categorize it in a single call.
 *
 * One request rather than two: the model needs the same context for both jobs,
 * and event ingestion runs over every scraped item on a schedule, so the saved
 * call is real money.
 *
 * Every failure path falls back to the deterministic normalizer, so a missing
 * API key or a rate limit degrades the copy rather than breaking ingestion.
 */
export async function enhanceAndCategorizeEvent(input: {
  title: string;
  description: string;
  location: string;
  venue?: string | null;
  price?: string | null;
  rawCategory?: string | null;
}): Promise<EnhancedEventContent> {
  const fallbackCategory = normalizeCategory(input.rawCategory, input.title);

  const fallback: EnhancedEventContent = {
    description: input.description,
    category: fallbackCategory,
    secondaryCategories: [],
  };

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content:
            "You write for Des Moines Insider, a guide for people who live in the Des Moines metro. " +
            "You write for residents, not tourists. Never invent details that are not in the input: " +
            "no made-up prices, times, parking advice or lineups.",
        },
        {
          role: "user",
          content: `Rewrite this event description and categorize it.

Title: ${input.title}
Original description: ${input.description}
Location: ${input.location}
Venue: ${input.venue ?? "unknown"}
Price: ${input.price ?? "unknown"}
Source category: ${input.rawCategory ?? "unknown"}

Rules for the description:
- 2 to 3 sentences, written for a local
- Only use facts present above
- No marketing language and no "nestled in the heart of"

Rules for the categories:
- "category" must be exactly one of: ${EVENT_CATEGORIES.join(", ")}
- "secondaryCategories" is 0 to 2 more from that same list, never repeating the primary
- Use "Free" as a secondary category when the price is clearly free
- Use "High School Sports" rather than "Sports" for high school events

Respond as JSON: {"description": string, "category": string, "secondaryCategories": string[]}`,
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 400,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return fallback;

    const parsed = JSON.parse(content) as {
      description?: unknown;
      category?: unknown;
      secondaryCategories?: unknown;
    };

    // Re-normalize whatever came back: the model is asked for exact values but
    // is not trusted to have produced them.
    const category = normalizeCategory(
      typeof parsed.category === "string" ? parsed.category : null,
      input.title,
    );

    return {
      description:
        typeof parsed.description === "string" && parsed.description.trim().length > 0
          ? parsed.description.trim()
          : input.description,
      category,
      secondaryCategories: normalizeSecondaryCategories(
        parsed.secondaryCategories,
        category,
      ),
    };
  } catch (error) {
    console.error(`Failed to enhance and categorize "${input.title}":`, error);
    return fallback;
  }
}
