import { enhanceEventDescription } from './openai.js';
import { ScrapedEvent } from './scraper.js';
import { InsertEvent } from '@shared/schema.js';

export async function enhanceEvents(scrapedEvents: ScrapedEvent[], source: string): Promise<InsertEvent[]> {
  const enhancedEvents: InsertEvent[] = [];

  for (const event of scrapedEvents) {
    try {
      const enhancedDescription = await enhanceEventDescription(
        event.title,
        event.description,
        event.location,
        event.category
      );

      const enhancedEvent: InsertEvent = {
        title: event.title,
        originalDescription: event.description,
        enhancedDescription,
        date: event.date,
        location: event.location,
        category: event.category,
        source,
        sourceUrl: event.sourceUrl,
        imageUrl: event.imageUrl,
        venue: event.venue,
        price: event.price,
        isEnhanced: true,
      };

      enhancedEvents.push(enhancedEvent);
    } catch (error) {
      console.error(`Failed to enhance event: ${event.title}`, error);
      
      // Add unenhanced event as fallback
      const fallbackEvent: InsertEvent = {
        title: event.title,
        originalDescription: event.description,
        enhancedDescription: event.description,
        date: event.date,
        location: event.location,
        category: event.category,
        source,
        sourceUrl: event.sourceUrl,
        imageUrl: event.imageUrl,
        venue: event.venue,
        price: event.price,
        isEnhanced: false,
      };

      enhancedEvents.push(fallbackEvent);
    }
  }

  return enhancedEvents;
}
