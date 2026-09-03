import type { PlaygroundKind } from "./schema";

/**
 * Which family sections lead, by month.
 *
 * Extracted from the page so it can be tested across all twelve months rather
 * than only whichever one happens to be current.
 */

/** Splash pads are only worth showing when they are open. */
export function isSplashSeason(month: number): boolean {
  return month >= 5 && month <= 9;
}

/** October through March is when indoor options are the answer. */
export function isIndoorSeason(month: number): boolean {
  return month >= 10 || month <= 3;
}

/**
 * Section order for a given month. Out-of-season sections still render, just
 * lower down: a splash pad list in January is worth keeping for planning, but
 * it should not be the first thing a parent sees.
 */
export function familySectionOrder(month: number): PlaygroundKind[] {
  if (isSplashSeason(month)) {
    return ["splash_pad", "playground", "nature_center", "indoor_play", "library"];
  }
  if (isIndoorSeason(month)) {
    return ["indoor_play", "library", "playground", "nature_center", "splash_pad"];
  }
  // April: neither clearly. Playgrounds lead.
  return ["playground", "indoor_play", "library", "nature_center", "splash_pad"];
}
