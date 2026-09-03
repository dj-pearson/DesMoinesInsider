/**
 * Small HTML helpers for the scrapers that have to read markup.
 *
 * This is deliberately not a DOM. Every source here is one known page whose
 * shape we have looked at, and the alternative — pulling in a parser and a
 * headless browser — costs a dependency and a lot of memory to answer questions
 * as simple as "the text inside the element with class event-item__title".
 *
 * The one thing worth doing properly is finding where an element ends, so
 * `elementsByClass` counts nested opening tags rather than stopping at the
 * first closing tag it sees. Getting that wrong truncates every event whose
 * title happens to contain a nested span.
 */

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  middot: "·",
  bull: "•",
};

export function decodeEntities(input: string): string {
  return input
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replace(/&([a-z]+);/gi, (match, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? match);
}

/** Visible text of a fragment: tags out, entities decoded, whitespace collapsed. */
export function textOf(fragment: string | undefined): string {
  if (!fragment) return "";
  return decodeEntities(
    fragment
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

/** Value of an attribute on the first tag in the fragment that carries it. */
export function attrOf(fragment: string | undefined, name: string): string | undefined {
  if (!fragment) return undefined;
  const match = new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i").exec(fragment);
  const value = match?.[2] ?? match?.[3];
  return value ? decodeEntities(value).trim() : undefined;
}

/** Where does the element opening at `openIndex` end? Returns the index after it. */
function findElementEnd(html: string, openIndex: number, tag: string): number {
  const open = new RegExp(`<${tag}\\b`, "gi");
  const close = new RegExp(`</${tag}\\s*>`, "gi");
  let depth = 1;
  let cursor = html.indexOf(">", openIndex) + 1;

  while (cursor < html.length && depth > 0) {
    open.lastIndex = cursor;
    close.lastIndex = cursor;
    const nextOpen = open.exec(html);
    const nextClose = close.exec(html);

    // An unclosed element means malformed markup; take the rest of the document
    // rather than returning nothing, so one bad event does not lose the page.
    if (!nextClose) return html.length;

    if (nextOpen && nextOpen.index < nextClose.index) {
      depth += 1;
      cursor = nextOpen.index + nextOpen[0].length;
    } else {
      depth -= 1;
      cursor = nextClose.index + nextClose[0].length;
    }
  }

  return cursor;
}

/**
 * Every element carrying `className` in its class list, as raw HTML.
 *
 * Matches on a whole class name, so "event" does not also match "event-header".
 */
export function elementsByClass(html: string, className: string): string[] {
  const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `<([a-z][a-z0-9]*)\\b[^>]*\\bclass\\s*=\\s*("[^"]*"|'[^']*')[^>]*>`,
    "gi",
  );
  const classPattern = new RegExp(`(^|\\s)${escaped}(\\s|$)`);
  const found: string[] = [];

  for (let match = pattern.exec(html); match; match = pattern.exec(html)) {
    const classList = match[2].slice(1, -1);
    if (!classPattern.test(classList)) continue;

    const end = findElementEnd(html, match.index, match[1]);
    found.push(html.slice(match.index, end));
    // Skip past this element so a nested match is not reported twice.
    pattern.lastIndex = end;
  }

  return found;
}

/** Text of the first element with `className` inside the fragment. */
export function textByClass(fragment: string, className: string): string {
  return textOf(elementsByClass(fragment, className)[0]);
}

/** Text of the first `<h1>`…`<h6>` in the fragment. */
export function headingText(fragment: string): string {
  const match = /<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/i.exec(fragment);
  return textOf(match?.[1]);
}

/** First href in the fragment. */
export function firstHref(fragment: string): string | undefined {
  const match = /<a\b[^>]*\bhref\s*=\s*("([^"]*)"|'([^']*)')/i.exec(fragment);
  const href = match?.[2] ?? match?.[3];
  return href ? decodeEntities(href).trim() : undefined;
}

/**
 * First image source in the fragment.
 *
 * Prefers `data-src` because these sites lazy-load: the real image is in the
 * data attribute and `src` holds a placeholder.
 */
export function firstImage(fragment: string): string | undefined {
  const tag = /<img\b[^>]*>/i.exec(fragment)?.[0];
  if (!tag) return undefined;
  return attrOf(tag, "data-src") ?? attrOf(tag, "src");
}
