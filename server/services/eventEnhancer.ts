import { enhanceAndCategorizeEvent } from './openai.js';
import { ScrapedEvent } from './scraper.js';
import { InsertEvent } from '@shared/schema.js';
import { normalizeCategory } from '@shared/categories.js';
import { extractEventFlags, mergeFlags } from '@shared/eventFlags.js';
import { findVenueFacts } from '../data/venues.js';

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
    // Flags come from three sources, most trusted first: curated venue facts,
    // then what the event text states outright, then the AI's inference.
    const venueFacts = findVenueFacts(event.venue, event.location, event.title);
    const textFlags = extractEventFlags({
      title: event.title,
      description: event.description,
      price: event.price,
      venue: event.venue,
      location: event.location,
    });

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
      // Only a curated venue can assert skywalk access; nothing else knows.
      isSkywalkAccessible: venueFacts?.isSkywalkAccessible ?? null,
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

      const flags = mergeFlags(
        venueFacts ? { isIndoor: venueFacts.isIndoor } : null,
        textFlags,
        result.flags,
      );

      enhancedEvents.push({
        ...base,
        ...flags,
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
        ...mergeFlags(venueFacts ? { isIndoor: venueFacts.isIndoor } : null, textFlags),
        enhancedDescription: event.description,
        category: normalizeCategory(event.category, event.title),
        secondaryCategories: [],
        isEnhanced: false,
      });
    }
  }

  return enhancedEvents;
}
