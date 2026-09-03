import type { ScrapedEvent } from "./types.js";

/**
 * Where Iowa's state high school tournaments are actually played.
 *
 * State tournament week is a genuine Des Moines institution — Wells Fargo Arena
 * fills for a week of basketball in March, and the Drake Relays share a track
 * with the state meet in May. But the associations run tournaments across the
 * whole state, and only some come here: volleyball is in Coralville, softball
 * in Fort Dodge, football at the UNI-Dome. Listing those on a Des Moines
 * calendar would be worse than listing nothing.
 *
 * So this is a curated map, in the same spirit as the venue seed: facts a
 * scraper cannot infer, kept in one place where they can be corrected. A sport
 * that is not here is not held in Des Moines, and its events are dropped.
 */

export interface TournamentVenue {
  venue: string;
  location: string;
  neighborhoodSlug?: string;
}

const DES_MOINES_TOURNAMENTS: Array<{ match: RegExp; venue: TournamentVenue }> = [
  {
    match: /basketball/i,
    venue: { venue: "Wells Fargo Arena", location: "Des Moines, IA", neighborhoodSlug: "downtown" },
  },
  {
    match: /wrestling/i,
    venue: { venue: "Wells Fargo Arena", location: "Des Moines, IA", neighborhoodSlug: "downtown" },
  },
  {
    match: /track|relays/i,
    venue: { venue: "Drake Stadium", location: "Des Moines, IA", neighborhoodSlug: "drake" },
  },
  {
    match: /baseball/i,
    venue: { venue: "Principal Park", location: "Des Moines, IA", neighborhoodSlug: "downtown" },
  },
  {
    match: /soccer/i,
    venue: { venue: "Cownie Soccer Complex", location: "Des Moines, IA" },
  },
];

/** The Des Moines venue for a tournament title, or null if it is played elsewhere. */
export function tournamentVenue(title: string): TournamentVenue | null {
  return DES_MOINES_TOURNAMENTS.find((entry) => entry.match.test(title))?.venue ?? null;
}

/**
 * Is this a state-level tournament, rather than a district or regional round?
 *
 * Districts and regionals are played at member schools all over Iowa, so they
 * are not Des Moines events even for a sport whose final is held here.
 */
export function isStateTournament(title: string): boolean {
  if (/\b(district|regional|substate|sub-state|sectional)\b/i.test(title)) return false;
  return (
    /\bstate\b/i.test(title) &&
    /\b(tournaments?|championships?|meets?|finals?|duals?|relays)\b/i.test(title)
  );
}

/**
 * Turn a state tournament listing into an event, or null when it is not one we
 * should publish.
 */
export function toStateTournamentEvent(
  title: string,
  date: Date,
  options: { organization: string; sourceUrl: string },
): ScrapedEvent | null {
  if (!isStateTournament(title)) return null;
  const place = tournamentVenue(title);
  if (!place) return null;

  return {
    title,
    description: `${options.organization} state tournament at ${place.venue}.`,
    date,
    location: place.location,
    category: "High School Sports",
    sourceUrl: options.sourceUrl,
    venue: place.venue,
    neighborhoodSlug: place.neighborhoodSlug,
  };
}
