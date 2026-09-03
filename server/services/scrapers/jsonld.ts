import { isPlausibleEventDate, parseEventDate } from "./dates.js";
import { textOf } from "./html.js";
import type { ScrapedEvent } from "./types.js";

/**
 * schema.org Event extraction.
 *
 * Any site that wants its events in Google's rich results publishes them as
 * JSON-LD, which makes this the one parser that is not specific to a single
 * venue's markup: when a site has it, it is authoritative and survives redesigns.
 * Sources that cannot be read any other way try this first.
 */

interface JsonLdEvent {
  "@type"?: string | string[];
  name?: string;
  description?: string;
  startDate?: string;
  url?: string;
  image?: string | string[] | { url?: string };
  location?: { name?: string; address?: { addressLocality?: string } | string };
  offers?: { price?: string; priceCurrency?: string } | Array<{ price?: string }>;
}

function isEvent(node: JsonLdEvent): boolean {
  const type = node["@type"];
  const types = Array.isArray(type) ? type : [type];
  // "Event" itself plus its subtypes: MusicEvent, TheaterEvent, Festival, …
  return types.some((value) => typeof value === "string" && /Event|Festival$/i.test(value));
}

/** Walk the whole document; JSON-LD nests events under @graph, arrays, and itemListElement. */
function collectEvents(node: unknown, found: JsonLdEvent[], depth = 0): void {
  if (depth > 8 || node === null || typeof node !== "object") return;

  if (Array.isArray(node)) {
    for (const child of node) collectEvents(child, found, depth + 1);
    return;
  }

  const record = node as Record<string, unknown>;
  if (isEvent(record as JsonLdEvent)) found.push(record as JsonLdEvent);

  for (const key of ["@graph", "itemListElement", "item", "subEvent", "event"]) {
    if (key in record) collectEvents(record[key], found, depth + 1);
  }
}

function firstImageUrl(image: JsonLdEvent["image"]): string | undefined {
  if (!image) return undefined;
  if (typeof image === "string") return image;
  if (Array.isArray(image)) return typeof image[0] === "string" ? image[0] : undefined;
  return image.url;
}

export interface JsonLdOptions {
  venueName: string;
  location: string;
  category: string;
  pageUrl: string;
}

export function parseJsonLdEvents(
  html: string,
  options: JsonLdOptions,
  now: Date = new Date(),
): ScrapedEvent[] {
  const blockPattern =
    /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const nodes: JsonLdEvent[] = [];

  for (let match = blockPattern.exec(html); match; match = blockPattern.exec(html)) {
    try {
      collectEvents(JSON.parse(match[1].trim()), nodes);
    } catch {
      // A single malformed block is normal on ad-heavy pages; keep reading.
    }
  }

  const events: ScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const node of nodes) {
    const title = textOf(node.name);
    if (!title || !node.startDate) continue;

    // startDate is usually ISO 8601 with an offset, which Date reads correctly.
    // parseEventDate is the fallback for sites that write it in prose.
    const iso = new Date(node.startDate);
    const date = Number.isNaN(iso.getTime()) ? parseEventDate(node.startDate, now)?.date : iso;
    if (!date || !isPlausibleEventDate(date, now)) continue;

    const key = `${title}|${date.toISOString()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const offer = Array.isArray(node.offers) ? node.offers[0] : node.offers;
    const address = node.location?.address;
    const locality = typeof address === "string" ? address : address?.addressLocality;

    events.push({
      title,
      description: textOf(node.description) || title,
      date,
      location: locality ? `${locality}, IA` : options.location,
      category: options.category,
      sourceUrl: node.url ?? options.pageUrl,
      imageUrl: firstImageUrl(node.image),
      venue: node.location?.name ?? options.venueName,
      price: offer?.price ? String(offer.price) : undefined,
    });
  }

  return events;
}
