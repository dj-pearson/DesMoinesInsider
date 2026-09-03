import { storage } from "../storage.js";
import { siteUrl } from "./newsletter.js";

/**
 * Sitemap generation.
 *
 * Built on request rather than cached to a file: the content changes every time
 * the scraper runs, and a stale sitemap is worse than none because it points
 * crawlers at events that have passed.
 */

export interface SitemapEntry {
  path: string;
  /** Only set where we genuinely know it. See buildSitemap. */
  lastmod?: Date | null;
  changefreq?: "daily" | "weekly" | "monthly" | "yearly";
  priority?: number;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** W3C date format, which is what the sitemap protocol expects. */
function isoDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

export async function collectSitemapEntries(): Promise<SitemapEntry[]> {
  const [events, restaurants, attractions, playgrounds, neighborhoods, tentpoles, openings] =
    await Promise.all([
      storage.getEvents(),
      storage.getRestaurants(),
      storage.getAttractions(),
      storage.getPlaygrounds(),
      storage.getNeighborhoods(),
      storage.getTentpoles(),
      storage.getRestaurantOpenings(),
    ]);

  const entries: SitemapEntry[] = [
    { path: "/", changefreq: "daily", priority: 1.0 },
    { path: "/this-weekend", changefreq: "daily", priority: 0.9 },
    { path: "/neighborhoods", changefreq: "weekly", priority: 0.8 },
    { path: "/guides", changefreq: "weekly", priority: 0.8 },
    { path: "/openings", changefreq: "daily", priority: 0.8 },
    { path: "/family", changefreq: "weekly", priority: 0.8 },
  ];

  const now = new Date();

  for (const event of events) {
    if (!event.slug) continue;
    // Past events stay listed but rank lower; they still hold links and search
    // traffic for recurring titles.
    const past = new Date(event.date) < now;
    entries.push({
      path: `/events/${event.slug}`,
      lastmod: event.createdAt,
      changefreq: past ? "yearly" : "daily",
      priority: past ? 0.3 : 0.7,
    });
  }

  for (const restaurant of restaurants) {
    if (!restaurant.slug) continue;
    entries.push({ path: `/restaurants/${restaurant.slug}`, changefreq: "monthly", priority: 0.6 });
  }

  for (const attraction of attractions) {
    if (!attraction.slug) continue;
    entries.push({ path: `/attractions/${attraction.slug}`, changefreq: "monthly", priority: 0.6 });
  }

  for (const playground of playgrounds) {
    if (!playground.slug) continue;
    entries.push({ path: `/playgrounds/${playground.slug}`, changefreq: "monthly", priority: 0.6 });
  }

  for (const neighborhood of neighborhoods) {
    entries.push({
      path: `/neighborhoods/${neighborhood.slug}`,
      changefreq: "weekly",
      priority: 0.7,
    });
  }

  for (const tentpole of tentpoles) {
    entries.push({ path: `/guides/${tentpole.slug}`, changefreq: "weekly", priority: 0.7 });
  }

  for (const opening of openings) {
    if (!opening.slug) continue;
    entries.push({
      path: `/openings/${opening.slug}`,
      lastmod: opening.createdAt,
      changefreq: "monthly",
      priority: 0.5,
    });
  }

  return entries;
}

/**
 * Render the sitemap XML.
 *
 * `lastmod` appears only where the record actually carries a timestamp. Filling
 * the rest in with the build time would tell crawlers every page changed on
 * every deploy, which wastes their budget and teaches them to distrust the
 * signal.
 */
export async function buildSitemap(): Promise<string> {
  const base = siteUrl();
  const entries = await collectSitemapEntries();

  const urls = entries
    .map((entry) => {
      const parts = [`    <loc>${escapeXml(base + entry.path)}</loc>`];
      if (entry.lastmod) parts.push(`    <lastmod>${isoDate(new Date(entry.lastmod))}</lastmod>`);
      if (entry.changefreq) parts.push(`    <changefreq>${entry.changefreq}</changefreq>`);
      if (entry.priority !== undefined) {
        parts.push(`    <priority>${entry.priority.toFixed(1)}</priority>`);
      }
      return `  <url>\n${parts.join("\n")}\n  </url>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
}

/**
 * robots.txt.
 *
 * The API is disallowed because it returns JSON that would compete with the
 * real pages in search results.
 */
export function buildRobotsTxt(): string {
  return [
    "User-agent: *",
    "Allow: /",
    "Disallow: /api/",
    "",
    `Sitemap: ${siteUrl()}/sitemap.xml`,
    "",
  ].join("\n");
}
