/**
 * URL slug generation, shared by client and server so a link built in the
 * browser always matches what the database stored.
 */

/**
 * Convert arbitrary text into a URL-safe slug fragment.
 *
 * Accents are folded to ASCII first, so "Café" becomes "cafe" rather than
 * losing the word entirely. Ampersands become "and" because event titles use
 * them constantly ("Food & Drink") and dropping them reads badly.
 */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    // Strip combining marks left behind by the decomposition above.
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    // The truncation above can leave a trailing hyphen.
    .replace(/-+$/g, "");
}

/** Format a date as YYYY-MM-DD in local time. */
function toDateStamp(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Build the canonical slug for an event: title plus date.
 *
 * The date matters because recurring events share a title. Without it, every
 * week of the farmers market would collide on one URL.
 */
export function buildEventSlug(title: string, date: Date | string): string {
  const parsed = date instanceof Date ? date : new Date(date);
  const titlePart = slugify(title) || "event";

  if (Number.isNaN(parsed.getTime())) {
    return titlePart;
  }

  return `${titlePart}-${toDateStamp(parsed)}`;
}

/**
 * Given a desired slug and the set already in use, return a free one by
 * appending a numeric suffix. Keeps URLs stable and readable rather than
 * falling back to a random id.
 */
export function ensureUniqueSlug(desired: string, taken: Set<string>): string {
  if (!taken.has(desired)) return desired;

  let suffix = 2;
  while (taken.has(`${desired}-${suffix}`)) {
    suffix += 1;
  }
  return `${desired}-${suffix}`;
}

/**
 * Build the slug for a place (restaurant, attraction, playground).
 *
 * Unlike events these are not dated: a restaurant has one page that stays at
 * one URL, so the name alone is the identity.
 */
export function buildPlaceSlug(name: string): string {
  return slugify(name) || "place";
}
