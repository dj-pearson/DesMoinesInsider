import { OPENING_STATUSES, type OpeningStatus } from "./schema";

/** Display metadata for each lifecycle stage, shared by the list, map and detail views. */
export const OPENING_STATUS_META: Record<
  OpeningStatus,
  { label: string; tabLabel: string; description: string; pinColor: string; badgeClass: string }
> = {
  announced: {
    label: "Announced",
    tabLabel: "Announced",
    description: "Confirmed but without an opening date yet.",
    pinColor: "#3b82f6",
    badgeClass: "bg-blue-500 text-white",
  },
  opening_soon: {
    label: "Opening soon",
    tabLabel: "Opening soon",
    description: "Has a date and is close.",
    pinColor: "#eab308",
    badgeClass: "bg-yellow-500 text-white",
  },
  newly_opened: {
    label: "Just opened",
    tabLabel: "Just opened",
    description: "Open now and worth a first look.",
    pinColor: "#22c55e",
    badgeClass: "bg-green-600 text-white",
  },
  closing_soon: {
    label: "Closing soon",
    tabLabel: "Closing soon",
    description: "Last chance to go.",
    pinColor: "#f97316",
    badgeClass: "bg-orange-500 text-white",
  },
  closed: {
    label: "Closed",
    tabLabel: "Closed",
    description: "No longer open.",
    pinColor: "#71717a",
    badgeClass: "bg-neutral-500 text-white",
  },
};

/** Tab order, most actionable first. */
export const OPENING_TAB_ORDER: OpeningStatus[] = [
  "opening_soon",
  "newly_opened",
  "announced",
  "closing_soon",
  "closed",
];

export function isOpeningStatus(value: string): value is OpeningStatus {
  return (OPENING_STATUSES as readonly string[]).includes(value);
}

/**
 * Work out where a restaurant is in its lifecycle from a news headline.
 *
 * Local food coverage is formulaic enough that this is reliable: headlines say
 * "has closed", "will close", "opens Friday" or "is coming to". Closing
 * language is checked first because "the space that opened in 2019 has closed"
 * contains both, and the closing is the news.
 */
const CLOSED_PATTERNS = [
  /\b(has|have) closed\b/i,
  /\bclosed (its|their) doors\b/i,
  /\bshuts? down\b/i,
  /\bshuttered\b/i,
  /\bserved its last\b/i,
  /\bis no longer open\b/i,
  /\bpermanently closed\b/i,
];

const CLOSING_SOON_PATTERNS = [
  /\b(will|to) close\b/i,
  /\bclosing (soon|this|next|after|at the end)\b/i,
  /\blast day\b/i,
  /\bfinal (service|day|week)\b/i,
  /\bannounces? (its )?clos/i,
];

const NEWLY_OPENED_PATTERNS = [
  /\b(has|have) opened\b/i,
  /\bnow open\b/i,
  /\bopened (its|their) doors\b/i,
  /\bopens? (today|this week)\b/i,
  /\bfirst look\b/i,
  /\bis open\b/i,
];

const OPENING_SOON_PATTERNS = [
  /\bopens? (soon|next|in|on|this (spring|summer|fall|winter|month))\b/i,
  /\bopening (soon|next|this)\b/i,
  /\bset to open\b/i,
  /\bwill open\b/i,
  /\bslated to open\b/i,
  /\btargets? (a )?(spring|summer|fall|winter|\w+) opening\b/i,
];

const ANNOUNCED_PATTERNS = [
  /\bis coming to\b/i,
  /\bplans to (open|bring)\b/i,
  /\bannounced?\b/i,
  /\bin the works\b/i,
  /\bnew (restaurant|concept|spot)\b/i,
];

/**
 * Classify a headline. Returns null when nothing matches, so callers can decide
 * whether to keep the item at all rather than filing it under a wrong status.
 */
export function classifyOpeningStatus(
  ...text: Array<string | null | undefined>
): OpeningStatus | null {
  const haystack = text.filter(Boolean).join(". ");
  if (!haystack.trim()) return null;

  // Closings first: a closing headline often mentions when the place opened.
  if (CLOSED_PATTERNS.some((p) => p.test(haystack))) return "closed";
  if (CLOSING_SOON_PATTERNS.some((p) => p.test(haystack))) return "closing_soon";
  if (NEWLY_OPENED_PATTERNS.some((p) => p.test(haystack))) return "newly_opened";
  if (OPENING_SOON_PATTERNS.some((p) => p.test(haystack))) return "opening_soon";
  if (ANNOUNCED_PATTERNS.some((p) => p.test(haystack))) return "announced";

  return null;
}
