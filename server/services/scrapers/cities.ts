import { createCivicPlusSource } from "./civicplus.js";
import type { EventSource } from "./types.js";

/**
 * The suburbs, all on CivicPlus.
 *
 * This is the half of the metro that no regional calendar covers: the free
 * concert in Ankeny's Wagner Park, Johnston's movie nights, Waukee's summer
 * festival. Someone living in Ankeny is far more likely to go to those than to
 * anything downtown on a Tuesday, and the neighborhood on each event is what
 * lets the site show them that.
 *
 * West Des Moines is the one CivicPlus site that refuses automated clients from
 * some networks; it is configured identically and either works or records a
 * clean 403 in the run log.
 */

export const ankeny: EventSource = createCivicPlusSource({
  origin: "https://www.ankenyiowa.gov",
  cityName: "City of Ankeny",
  neighborhoodSlug: "ankeny",
  location: "Ankeny, IA",
});

export const urbandale: EventSource = createCivicPlusSource({
  origin: "https://www.urbandale.org",
  cityName: "City of Urbandale",
  neighborhoodSlug: "urbandale",
  location: "Urbandale, IA",
});

export const johnston: EventSource = createCivicPlusSource({
  origin: "https://www.cityofjohnston.com",
  cityName: "City of Johnston",
  neighborhoodSlug: "johnston",
  location: "Johnston, IA",
});

export const waukee: EventSource = createCivicPlusSource({
  origin: "https://www.waukee.org",
  cityName: "City of Waukee",
  neighborhoodSlug: "waukee",
  location: "Waukee, IA",
});

export const westDesMoines: EventSource = createCivicPlusSource({
  origin: "https://www.wdm.iowa.gov",
  cityName: "City of West Des Moines",
  neighborhoodSlug: "west-des-moines",
  location: "West Des Moines, IA",
});
