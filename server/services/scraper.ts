import { classifyOpeningStatus } from '@shared/openingStatus.js';
import type { OpeningStatus } from '@shared/schema.js';
import puppeteer from "puppeteer";

export interface ScrapedEvent {
  title: string;
  description: string;
  date: Date;
  location: string;
  category: string;
  sourceUrl: string;
  imageUrl?: string;
  venue?: string;
  price?: string;
}

export interface ScrapedRestaurant {
  name: string;
  description: string;
  location: string;
  openingDate?: Date;
  sourceUrl: string;
  cuisine?: string;
  status: OpeningStatus;
}

export async function scrapeGoogleEvents(query: string = "events in Des Moines Iowa"): Promise<ScrapedEvent[]> {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox', 
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-dev-shm-usage'
      ]
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&tbm=evn`;
    await page.goto(searchUrl, { waitUntil: 'networkidle2' });

    const events = await page.evaluate(() => {
      const eventElements = document.querySelectorAll('[data-ved]');
      const scrapedEvents: any[] = [];

      eventElements.forEach((element) => {
        try {
          const titleElement = element.querySelector('h3, [role="heading"]');
          const dateElement = element.querySelector('[data-date], .date, time');
          const locationElement = element.querySelector('.location, [data-location]');
          const linkElement = element.querySelector('a[href]');

          if (titleElement && dateElement) {
            const title = titleElement.textContent?.trim();
            const dateText = dateElement.textContent?.trim();
            const location = locationElement?.textContent?.trim() || 'Des Moines, IA';
            const url = linkElement?.getAttribute('href');

            if (title && dateText) {
              scrapedEvents.push({
                title,
                description: title, // Will be enhanced by AI
                date: new Date(dateText),
                location,
                category: 'General',
                sourceUrl: url || '',
                venue: location,
              });
            }
          }
        } catch (error) {
          console.error('Error parsing event element:', error);
        }
      });

      return scrapedEvents;
    });

    return events.filter(event => event.title && !isNaN(event.date.getTime()));
  } catch (error) {
    console.error('Failed to scrape Google events:', error);
    return [];
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

export async function scrapeCatchDesMoines(): Promise<ScrapedEvent[]> {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox', 
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-dev-shm-usage'
      ]
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    await page.goto('https://www.catchdesmoines.com/events/', { waitUntil: 'networkidle2' });

    const events = await page.evaluate(() => {
      const eventElements = document.querySelectorAll('.event-item, .event-card, article');
      const scrapedEvents: any[] = [];

      eventElements.forEach((element) => {
        try {
          const titleElement = element.querySelector('h1, h2, h3, .title, .event-title');
          const dateElement = element.querySelector('.date, .event-date, time');
          const locationElement = element.querySelector('.location, .venue, .event-location');
          const descriptionElement = element.querySelector('.description, .content, .excerpt, p');
          const linkElement = element.querySelector('a[href]');
          const imageElement = element.querySelector('img');

          if (titleElement) {
            const title = titleElement.textContent?.trim();
            const dateText = dateElement?.textContent?.trim();
            const location = locationElement?.textContent?.trim() || 'Des Moines, IA';
            const description = descriptionElement?.textContent?.trim() || title;
            const url = linkElement?.getAttribute('href');
            const imageUrl = imageElement?.getAttribute('src');

            if (title) {
              let eventDate = new Date();
              if (dateText) {
                const parsedDate = new Date(dateText);
                if (!isNaN(parsedDate.getTime())) {
                  eventDate = parsedDate;
                }
              }

              scrapedEvents.push({
                title,
                description: description || title,
                date: eventDate,
                location,
                category: 'Tourism',
                sourceUrl: url ? (url.startsWith('http') ? url : `https://www.catchdesmoines.com${url}`) : '',
                imageUrl: imageUrl ? (imageUrl.startsWith('http') ? imageUrl : `https://www.catchdesmoines.com${imageUrl}`) : undefined,
                venue: location,
              });
            }
          }
        } catch (error) {
          console.error('Error parsing Catch Des Moines event:', error);
        }
      });

      return scrapedEvents;
    });

    return events.filter(event => event.title);
  } catch (error) {
    console.error('Failed to scrape Catch Des Moines:', error);
    return [];
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Enhanced Catch Des Moines scraper that extracts direct event URLs
export async function scrapeCatchDesMoinesWithDirectLinks(): Promise<ScrapedEvent[]> {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security', '--disable-features=VizDisplayCompositor', '--disable-dev-shm-usage']
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    await page.goto('https://www.catchdesmoines.com/events/', { waitUntil: 'networkidle2' });

    // Get event links from listing page
    const eventLinks = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href*="/events/"]'));
      return links.map(link => link.getAttribute('href')).filter(href => href);
    });

    const events: ScrapedEvent[] = [];
    
    for (const link of eventLinks.slice(0, 10)) { // Limit to avoid overwhelming
      if (!link) continue;
      try {
        const fullUrl = link.startsWith('http') ? link : `https://www.catchdesmoines.com${link}`;
        await page.goto(fullUrl, { waitUntil: 'networkidle2' });
        
        const eventData = await page.evaluate(() => {
          // Try to find external event website link
          const externalLinks = Array.from(document.querySelectorAll('a[href]'))
            .map(a => a.getAttribute('href'))
            .filter(href => href && !href.includes('catchdesmoines.com') && (href.includes('http') || href.startsWith('//')));
          
          const title = document.querySelector('h1, .event-title')?.textContent?.trim();
          const description = document.querySelector('.description, .content, .summary, p')?.textContent?.trim();
          const venue = document.querySelector('.venue, .location')?.textContent?.trim();
          const date = document.querySelector('.date, time')?.textContent?.trim();
          const image = document.querySelector('.event-image img, .hero-image img')?.getAttribute('src');
          
          return {
            title,
            description,
            venue,
            date,
            image,
            externalUrl: externalLinks[0] || null
          };
        });

        if (eventData.title) {
          let eventDate = new Date();
          if (eventData.date) {
            const parsedDate = new Date(eventData.date);
            if (!isNaN(parsedDate.getTime())) {
              eventDate = parsedDate;
            }
          }

          events.push({
            title: eventData.title,
            description: eventData.description || eventData.title,
            date: eventDate,
            location: eventData.venue || 'Des Moines, IA',
            category: 'Tourism',
            sourceUrl: eventData.externalUrl || fullUrl, // Use direct event URL if found
            imageUrl: eventData.image ? (eventData.image.startsWith('http') ? eventData.image : `https://www.catchdesmoines.com${eventData.image}`) : undefined,
            venue: eventData.venue || 'Des Moines, IA',
          });
        }
      } catch (error) {
        console.error(`Error scraping event ${link}:`, error);
      }
    }

    return events;
  } catch (error) {
    console.error('Failed to scrape Catch Des Moines with direct links:', error);
    return [];
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Eventbrite scraper
export async function scrapeEventbrite(): Promise<ScrapedEvent[]> {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security', '--disable-features=VizDisplayCompositor', '--disable-dev-shm-usage']
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    const searchUrl = 'https://www.eventbrite.com/d/ia--des-moines/events/';
    await page.goto(searchUrl, { waitUntil: 'networkidle2' });

    const events = await page.evaluate(() => {
      const eventElements = document.querySelectorAll('[data-testid="event-card"], .search-event-card');
      const scrapedEvents: any[] = [];

      eventElements.forEach((element) => {
        try {
          const titleElement = element.querySelector('h2, h3, .event-card__title');
          const dateElement = element.querySelector('.event-card__date, .date-info');
          const locationElement = element.querySelector('.event-card__location, .location-info');
          const linkElement = element.querySelector('a[href]');
          const imageElement = element.querySelector('img');
          const priceElement = element.querySelector('.event-card__price, .price-info');

          if (titleElement && linkElement) {
            const title = titleElement.textContent?.trim();
            const dateText = dateElement?.textContent?.trim();
            const location = locationElement?.textContent?.trim() || 'Des Moines, IA';
            const url = linkElement.getAttribute('href');
            const imageUrl = imageElement?.getAttribute('src');
            const price = priceElement?.textContent?.trim();

            if (title && url) {
              let eventDate = new Date();
              if (dateText) {
                const parsedDate = new Date(dateText);
                if (!isNaN(parsedDate.getTime())) {
                  eventDate = parsedDate;
                }
              }

              scrapedEvents.push({
                title,
                description: title,
                date: eventDate,
                location,
                category: 'General',
                sourceUrl: url.startsWith('http') ? url : `https://www.eventbrite.com${url}`,
                imageUrl: imageUrl || undefined,
                venue: location,
                price: price || undefined,
              });
            }
          }
        } catch (error) {
          console.error('Error parsing Eventbrite event:', error);
        }
      });

      return scrapedEvents;
    });

    return events.filter(event => event.title);
  } catch (error) {
    console.error('Failed to scrape Eventbrite:', error);
    return [];
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Music venue scrapers
export async function scrapeVibrantMusicHall(): Promise<ScrapedEvent[]> {
  return scrapeGenericVenue('https://www.vibrantmusichall.com/events', 'Vibrant Music Hall', 'Music');
}

export async function scrapeHoytSherman(): Promise<ScrapedEvent[]> {
  return scrapeGenericVenue('https://hoytsherman.org/events/', 'Hoyt Sherman Place', 'Music');
}

export async function scrapeValAireBallroom(): Promise<ScrapedEvent[]> {
  return scrapeGenericVenue('https://valaireballroom.com/events/', 'Val Aire Ballroom', 'Music');
}

// Sports venue scrapers
export async function scrapeIowaWild(): Promise<ScrapedEvent[]> {
  return scrapeGenericVenue('https://www.iowawild.com/schedule', 'Wells Fargo Arena', 'Sports');
}

export async function scrapeIowaWolves(): Promise<ScrapedEvent[]> {
  return scrapeGenericVenue('https://www.iowawolves.com/schedule', 'Wells Fargo Arena', 'Sports');
}

export async function scrapeIowaCubs(): Promise<ScrapedEvent[]> {
  return scrapeGenericVenue('https://www.milb.com/iowa/schedule', 'Principal Park', 'Sports');
}

export async function scrapeIowaBarnstormers(): Promise<ScrapedEvent[]> {
  return scrapeGenericVenue('https://www.iowabarnstormers.com/schedule/', 'Wells Fargo Arena', 'Sports');
}

export async function scrapeIowaEventsCenter(): Promise<ScrapedEvent[]> {
  return scrapeGenericVenue('https://www.iowaeventscenter.com/events', 'Iowa Events Center', 'General');
}

// Generic venue scraper
async function scrapeGenericVenue(url: string, venueName: string, category: string): Promise<ScrapedEvent[]> {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security', '--disable-features=VizDisplayCompositor', '--disable-dev-shm-usage']
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    await page.goto(url, { waitUntil: 'networkidle2' });

    const events = await page.evaluate((venueName, category) => {
      const eventElements = document.querySelectorAll('.event, .game, .show, .concert, article, .event-item, .schedule-item');
      const scrapedEvents: any[] = [];

      eventElements.forEach((element) => {
        try {
          const titleElement = element.querySelector('h1, h2, h3, h4, .title, .event-title, .game-title, .opponent');
          const dateElement = element.querySelector('.date, .event-date, .game-date, time, .datetime');
          const linkElement = element.querySelector('a[href]');
          const imageElement = element.querySelector('img');
          const priceElement = element.querySelector('.price, .ticket-price, .cost');

          if (titleElement) {
            const title = titleElement.textContent?.trim();
            const dateText = dateElement?.textContent?.trim();
            const url = linkElement?.getAttribute('href');
            const imageUrl = imageElement?.getAttribute('src');
            const price = priceElement?.textContent?.trim();

            if (title) {
              let eventDate = new Date();
              if (dateText) {
                const parsedDate = new Date(dateText);
                if (!isNaN(parsedDate.getTime())) {
                  eventDate = parsedDate;
                }
              }

              scrapedEvents.push({
                title,
                description: title,
                date: eventDate,
                location: 'Des Moines, IA',
                category,
                sourceUrl: url ? (url.startsWith('http') ? url : `${new URL(window.location.href).origin}${url}`) : window.location.href,
                imageUrl: imageUrl || undefined,
                venue: venueName,
                price: price || undefined,
              });
            }
          }
        } catch (error) {
          console.error(`Error parsing ${venueName} event:`, error);
        }
      });

      return scrapedEvents;
    }, venueName, category);

    return events.filter(event => event.title);
  } catch (error) {
    console.error(`Failed to scrape ${venueName}:`, error);
    return [];
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Restaurant scraper for DSM Magazine
async function scrapeDSMMagazineSearch(searchUrl: string): Promise<ScrapedRestaurant[]> {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security', '--disable-features=VizDisplayCompositor', '--disable-dev-shm-usage']
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    // Search for recent restaurant articles
    await page.goto(searchUrl, { waitUntil: 'networkidle2' });

    const restaurants = await page.evaluate(() => {
      const articles = document.querySelectorAll('article, .post, .entry');
      const scrapedRestaurants: any[] = [];

      articles.forEach((article) => {
        try {
          const titleElement = article.querySelector('h1, h2, h3, .entry-title, .post-title');
          const contentElement = article.querySelector('.entry-content, .post-content, .content, p');
          const linkElement = article.querySelector('a[href]');
          const dateElement = article.querySelector('.date, .post-date, time');

          if (titleElement && titleElement.textContent?.toLowerCase().includes('restaurant')) {
            const title = titleElement.textContent?.trim();
            const content = contentElement?.textContent?.trim();
            const url = linkElement?.getAttribute('href');
            const dateText = dateElement?.textContent?.trim();

            // Extract restaurant name from title
            const restaurantMatch = title?.match(/([A-Z][a-z\s]+(?:Restaurant|Café|Cafe|Bar|Grill|Kitchen|Eatery|Diner))/i);
            const restaurantName = restaurantMatch?.[1] || title;

            if (restaurantName) {
              let openingDate = new Date();
              if (dateText) {
                const parsedDate = new Date(dateText);
                if (!isNaN(parsedDate.getTime())) {
                  openingDate = parsedDate;
                }
              }

              scrapedRestaurants.push({
                name: restaurantName,
                description: content || title || '',
                location: 'Des Moines, IA',
                openingDate,
                sourceUrl: url ? (url.startsWith('http') ? url : `https://dsmmagazine.com${url}`) : '',
                status: 'newly_opened' // refined from the headline after extraction
              });
            }
          }
        } catch (error) {
          console.error('Error parsing DSM Magazine restaurant:', error);
        }
      });

      return scrapedRestaurants;
    });

    return restaurants.filter(restaurant => restaurant.name);
  } catch (error) {
    console.error('Failed to scrape DSM Magazine restaurants:', error);
    return [];
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Restaurant scraper for Des Moines Register
async function scrapeRegisterSearch(searchUrl: string): Promise<ScrapedRestaurant[]> {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security', '--disable-features=VizDisplayCompositor', '--disable-dev-shm-usage']
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    // Search for recent restaurant articles
    await page.goto(searchUrl, { waitUntil: 'networkidle2' });

    const restaurants = await page.evaluate(() => {
      const articles = document.querySelectorAll('article, .gnt_se_a, .search-result');
      const scrapedRestaurants: any[] = [];

      articles.forEach((article) => {
        try {
          const titleElement = article.querySelector('h1, h2, h3, .gnt_se_a_ht, .headline');
          const contentElement = article.querySelector('.gnt_se_a_sb, .summary, .description');
          const linkElement = article.querySelector('a[href]');

          if (titleElement && titleElement.textContent?.toLowerCase().includes('restaurant')) {
            const title = titleElement.textContent?.trim();
            const content = contentElement?.textContent?.trim();
            const url = linkElement?.getAttribute('href');

            // Extract restaurant name from title
            const restaurantMatch = title?.match(/([A-Z][a-z\s]+(?:Restaurant|Café|Cafe|Bar|Grill|Kitchen|Eatery|Diner))/i);
            const restaurantName = restaurantMatch?.[1] || title;

            if (restaurantName) {
              scrapedRestaurants.push({
                name: restaurantName,
                description: content || title || '',
                location: 'Des Moines, IA',
                openingDate: new Date(),
                sourceUrl: url ? (url.startsWith('http') ? url : `https://www.desmoinesregister.com${url}`) : '',
                status: 'newly_opened' // refined from the headline after extraction
              });
            }
          }
        } catch (error) {
          console.error('Error parsing Des Moines Register restaurant:', error);
        }
      });

      return scrapedRestaurants;
    });

    return restaurants.filter(restaurant => restaurant.name);
  } catch (error) {
    console.error('Failed to scrape Des Moines Register restaurants:', error);
    return [];
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Event deduplication utility
export function deduplicateEvents(existingEvents: ScrapedEvent[], newEvents: ScrapedEvent[]): ScrapedEvent[] {
  const uniqueEvents: ScrapedEvent[] = [];
  
  for (const newEvent of newEvents) {
    const isDuplicate = existingEvents.some(existing => 
      existing.title.toLowerCase() === newEvent.title.toLowerCase() &&
      Math.abs(existing.date.getTime() - newEvent.date.getTime()) < 24 * 60 * 60 * 1000 && // Same day
      existing.venue?.toLowerCase() === newEvent.venue?.toLowerCase()
    );
    
    if (!isDuplicate) {
      uniqueEvents.push(newEvent);
    }
  }
  
  return uniqueEvents;
}

// Master scraping function
/**
 * Search a source for both openings and closings.
 *
 * Two passes rather than one because the sites index them under different
 * language. Each item's status is then read from its own headline, since a
 * single search returns a mix: a "new restaurants" page still surfaces
 * "X has closed" stories.
 */
async function searchBoth(
  scrape: (url: string) => Promise<ScrapedRestaurant[]>,
  openingUrl: string,
  closingUrl: string,
): Promise<ScrapedRestaurant[]> {
  const results: ScrapedRestaurant[] = [];

  for (const url of [openingUrl, closingUrl]) {
    try {
      const batch = await scrape(url);
      for (const item of batch) {
        const status = classifyOpeningStatus(item.name, item.description);
        // An item whose headline says nothing useful is dropped rather than
        // filed under a status we guessed.
        if (!status) continue;
        results.push({ ...item, status });
      }
    } catch (error) {
      console.error(`Restaurant search failed for ${url}:`, error);
    }
  }

  return results;
}

export async function scrapeDSMMagazineRestaurants(): Promise<ScrapedRestaurant[]> {
  return searchBoth(
    scrapeDSMMagazineSearch,
    'https://dsmmagazine.com/?s=new+restaurant+opening',
    'https://dsmmagazine.com/?s=restaurant+closing',
  );
}

export async function scrapeDesMoinesRegisterRestaurants(): Promise<ScrapedRestaurant[]> {
  return searchBoth(
    scrapeRegisterSearch,
    'https://www.desmoinesregister.com/search/?q=new%20restaurant%20des%20moines',
    'https://www.desmoinesregister.com/search/?q=restaurant%20closing%20des%20moines',
  );
}

export async function scrapeAllSources(): Promise<{
  events: ScrapedEvent[];
  restaurants: ScrapedRestaurant[];
}> {
  console.log('Starting comprehensive scraping of all sources...');
  
  const allEvents: ScrapedEvent[] = [];
  const allRestaurants: ScrapedRestaurant[] = [];
  
  try {
    // Scrape events from all sources
    const eventSources = [
      { name: 'Google Events', scraper: () => scrapeGoogleEvents() },
      { name: 'Catch Des Moines', scraper: () => scrapeCatchDesMoinesWithDirectLinks() },
      { name: 'Eventbrite', scraper: () => scrapeEventbrite() },
      { name: 'Vibrant Music Hall', scraper: () => scrapeVibrantMusicHall() },
      { name: 'Hoyt Sherman', scraper: () => scrapeHoytSherman() },
      { name: 'Val Aire Ballroom', scraper: () => scrapeValAireBallroom() },
      { name: 'Iowa Wild', scraper: () => scrapeIowaWild() },
      { name: 'Iowa Wolves', scraper: () => scrapeIowaWolves() },
      { name: 'Iowa Cubs', scraper: () => scrapeIowaCubs() },
      { name: 'Iowa Barnstormers', scraper: () => scrapeIowaBarnstormers() },
      { name: 'Iowa Events Center', scraper: () => scrapeIowaEventsCenter() },
    ];
    
    for (const source of eventSources) {
      try {
        console.log(`Scraping ${source.name}...`);
        const events = await source.scraper();
        allEvents.push(...events);
        console.log(`Found ${events.length} events from ${source.name}`);
      } catch (error) {
        console.error(`Failed to scrape ${source.name}:`, error);
      }
    }
    
    // Scrape restaurants
    try {
      console.log('Scraping DSM Magazine restaurants...');
      const dsmRestaurants = await scrapeDSMMagazineRestaurants();
      allRestaurants.push(...dsmRestaurants);
      console.log(`Found ${dsmRestaurants.length} restaurants from DSM Magazine`);
    } catch (error) {
      console.error('Failed to scrape DSM Magazine restaurants:', error);
    }
    
    try {
      console.log('Scraping Des Moines Register restaurants...');
      const registerRestaurants = await scrapeDesMoinesRegisterRestaurants();
      allRestaurants.push(...registerRestaurants);
      console.log(`Found ${registerRestaurants.length} restaurants from Des Moines Register`);
    } catch (error) {
      console.error('Failed to scrape Des Moines Register restaurants:', error);
    }
    
  } catch (error) {
    console.error('Error during comprehensive scraping:', error);
  }
  
  console.log(`Comprehensive scraping complete. Found ${allEvents.length} total events and ${allRestaurants.length} restaurants.`);
  
  return {
    events: allEvents,
    restaurants: allRestaurants
  };
}
