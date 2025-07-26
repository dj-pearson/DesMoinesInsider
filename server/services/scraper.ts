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
