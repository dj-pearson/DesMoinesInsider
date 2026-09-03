import { enhanceAndCategorizeEvent } from './openai.js';
import { ScrapedEvent } from './scraper.js';
import { InsertEvent } from '@shared/schema.js';
import { normalizeCategory } from '@shared/categories.js';

/**
 * Turn scraped events into rows ready for the database.
 *
 * Categories are always normalized, whether or not the AI call succeeds, since
 * the insert schema only accepts exact members of our category list.
 */
export async function enhanceEvents(
  scrapedEvents: ScrapedEvent[],
  source: string,
): Promise<InsertEvent[]> {
  const enhancedEvents: InsertEvent[] = [];

  for (const event of scrapedEvents) {
    const base = {
      title: event.title,
      originalDescription: event.description,
      date: event.date,
      location: event.location,
      source,
      sourceUrl: event.sourceUrl,
      imageUrl: event.imageUrl,
      venue: event.venue,
      price: event.price,
    };

    try {
      const result = await enhanceAndCategorizeEvent({
        title: event.title,
        description: event.description,
        location: event.location,
        venue: event.venue,
        price: event.price,
        rawCategory: event.category,
      });

      enhancedEvents.push({
        ...base,
        enhancedDescription: result.description,
        category: result.category,
        secondaryCategories: result.secondaryCategories,
        // Only claim AI enhancement when the copy actually changed.
        isEnhanced: result.description !== event.description,
      });
    } catch (error) {
      console.error(`Failed to enhance event: ${event.title}`, error);

      enhancedEvents.push({
        ...base,
        enhancedDescription: event.description,
        category: normalizeCategory(event.category, event.title),
        secondaryCategories: [],
        isEnhanced: false,
      });
    }
  }

  return enhancedEvents;
}
