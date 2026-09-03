import { resolveDirectUrl } from "./catchDesMoines.js";
import type { IStorage } from "../../storage.js";

/**
 * Replace aggregator links on stored events with the organiser's own.
 *
 * Events stored before the direct sources existed still point at the tourism
 * bureau. Deduplication fixes this going forward but cannot reach backwards, so
 * this walks the rows that are still wrong and repairs the ones it can.
 *
 * Only upcoming events are touched. A past event's link is nobody's problem,
 * and the point of a good link is that someone can still act on it.
 */

const HOST = "catchdesmoines.com";

/** Cap per run: this is one request per event, and it is not urgent work. */
const MAX_PER_RUN = 40;

export interface LinkRepairResult {
  checked: number;
  repaired: number;
}

export async function repairAggregatorLinks(
  storage: IStorage,
  limit = MAX_PER_RUN,
): Promise<LinkRepairResult> {
  const stale = await storage.getEventsBySourceHost(HOST, limit);
  let repaired = 0;

  for (const event of stale) {
    if (!event.sourceUrl) continue;
    try {
      const direct = await resolveDirectUrl(event.sourceUrl);
      // No organiser link on the page is the normal case for a bureau-only
      // listing; leaving theirs is better than leaving nothing.
      if (!direct) continue;
      await storage.setEventSourceUrl(event.id, direct);
      repaired += 1;
    } catch (error) {
      // A dead bureau page should not stop the rest being repaired.
      console.warn(
        `[links] Could not resolve a direct URL for "${event.title}":`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  if (stale.length > 0) {
    console.log(`[links] Repaired ${repaired} of ${stale.length} aggregator links`);
  }

  return { checked: stale.length, repaired };
}
