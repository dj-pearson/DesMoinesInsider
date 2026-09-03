import { altoona } from "./altoona.js";
import { ankeny, johnston, urbandale, waukee, westDesMoines } from "./cities.js";
import { artCenter } from "./artCenter.js";
import { desMoinesLibrary } from "./dsmLibrary.js";
import { desMoinesParks } from "./dsmParks.js";
import { polkCountyConservation } from "./polkConservation.js";
import { valleyJunction } from "./valleyJunction.js";
import { adventureland } from "./adventureland.js";
import { blankParkZoo } from "./blankParkZoo.js";
import { botanicalGarden } from "./botanicalGarden.js";
import { desMoinesPerformingArts } from "./dmpa.js";
import { iowaStateFairgrounds } from "./fairgrounds.js";
import { jasperWinery } from "./jasperWinery.js";
import { lauridsenAmphitheater } from "./lauridsen.js";
import { livingHistoryFarms } from "./livingHistoryFarms.js";
import { scienceCenter } from "./scienceCenter.js";
import { woolys } from "./woolys.js";
import { xbkLive } from "./xbk.js";
import type { EventSource, ScrapedEvent, SourceRunResult } from "./types.js";

export type { EventSource, SourceRunResult };

/**
 * Every venue we pull events from.
 *
 * These are the rooms and attractions residents actually go to, which is a
 * different list from the one a visitor bureau publishes: it includes the
 * 200-capacity listening room and the fairgrounds' year-round horse sales, and
 * it does not depend on anyone paying for membership.
 */
export const SOURCES: EventSource[] = [
  // Performing arts
  desMoinesPerformingArts,
  artCenter,
  // Music rooms
  woolys,
  xbkLive,
  lauridsenAmphitheater,
  jasperWinery,
  // Attractions and family
  blankParkZoo,
  scienceCenter,
  botanicalGarden,
  livingHistoryFarms,
  adventureland,
  // Year-round civic calendar
  iowaStateFairgrounds,
  // Free and civic: libraries, parks, and the suburbs' own calendars. This is
  // the half of the metro no regional calendar covers, and almost all of it is
  // free, so it is where the site is most useful to someone who lives here.
  desMoinesLibrary,
  desMoinesParks,
  polkCountyConservation,
  valleyJunction,
  ankeny,
  urbandale,
  johnston,
  waukee,
  westDesMoines,
  altoona,
];

/**
 * How many sources run at once.
 *
 * Three is a deliberate ceiling rather than a tuning knob. Every source is a
 * different host, so the limit is not politeness to any one of them — it is
 * that each scrape holds a response body in memory, and letting a dozen run at
 * once turns a slow venue site into a memory spike on a small box. Three keeps
 * a full run under a minute while leaving the web server responsive.
 */
export const SOURCE_CONCURRENCY = 3;

export interface ScrapeSourcesResult {
  events: ScrapedEvent[];
  runs: SourceRunResult[];
}

async function runOne(source: EventSource): Promise<{ events: ScrapedEvent[]; run: SourceRunResult }> {
  const startedAt = Date.now();
  try {
    const events = await source.scrape();
    const run: SourceRunResult = {
      source: source.name,
      ok: true,
      count: events.length,
      durationMs: Date.now() - startedAt,
    };
    console.log(`[scrapers] ${source.name}: ${events.length} events in ${run.durationMs}ms`);
    return { events, run };
  } catch (error) {
    // One venue's outage must never cost us the other eleven, so every failure
    // is recorded and swallowed here rather than thrown to the caller.
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[scrapers] ${source.name} failed: ${message}`);
    return {
      events: [],
      run: {
        source: source.name,
        ok: false,
        count: 0,
        durationMs: Date.now() - startedAt,
        error: message.slice(0, 500),
      },
    };
  }
}

/**
 * Run every source, at most `SOURCE_CONCURRENCY` at a time.
 *
 * Workers pull from a shared cursor rather than the run being split into fixed
 * batches: a batch waits for its slowest member before the next one starts, so
 * one venue that takes thirty seconds would idle two workers for that whole
 * time.
 */
export async function scrapeSources(
  sources: EventSource[] = SOURCES,
): Promise<ScrapeSourcesResult> {
  const events: ScrapedEvent[] = [];
  const runs: SourceRunResult[] = [];
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < sources.length) {
      const source = sources[cursor];
      cursor += 1;
      const result = await runOne(source);
      events.push(...result.events);
      runs.push(result.run);
    }
  }

  const workers = Array.from(
    { length: Math.min(SOURCE_CONCURRENCY, sources.length) },
    () => worker(),
  );
  await Promise.all(workers);

  const failed = runs.filter((run) => !run.ok);
  console.log(
    `[scrapers] ${runs.length - failed.length}/${runs.length} sources ok, ${events.length} events` +
      (failed.length ? `; failed: ${failed.map((run) => run.source).join(", ")}` : ""),
  );

  return { events, runs };
}
