import { useEffect } from "react";

/**
 * Document head management for a single-page app.
 *
 * Every page owns its title, description, canonical URL, and optional
 * structured data. Tags are created on demand and removed on unmount so
 * navigating between pages never leaves another page's metadata behind.
 */

export interface SeoOptions {
  title: string;
  description?: string;
  /** Path or absolute URL. Relative paths resolve against the current origin. */
  canonicalPath?: string;
  imageUrl?: string;
  /** JSON-LD object emitted as application/ld+json. */
  structuredData?: Record<string, unknown>;
  /** Set to true for pages that should not be indexed. */
  noIndex?: boolean;
}

const SITE_NAME = "Des Moines Insider";

/**
 * Shown when a page has no image of its own. Social platforms fall back to
 * whatever they can scrape without one, which is usually nothing useful, so a
 * branded default is better than an empty card.
 */
const DEFAULT_OG_IMAGE = "/og-default.svg";

/** Find an existing tag or create one, marking ours so cleanup is unambiguous. */
function upsertMeta(selector: string, attributes: Record<string, string>): HTMLMetaElement {
  let tag = document.head.querySelector<HTMLMetaElement>(selector);
  if (!tag) {
    tag = document.createElement("meta");
    tag.dataset.managed = "seo";
    document.head.appendChild(tag);
  }
  for (const [key, value] of Object.entries(attributes)) {
    tag.setAttribute(key, value);
  }
  return tag;
}

function upsertLink(rel: string, href: string): HTMLLinkElement {
  let tag = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!tag) {
    tag = document.createElement("link");
    tag.rel = rel;
    tag.dataset.managed = "seo";
    document.head.appendChild(tag);
  }
  tag.href = href;
  return tag;
}

export function useSeo({
  title,
  description,
  canonicalPath,
  imageUrl,
  structuredData,
  noIndex,
}: SeoOptions): void {
  useEffect(() => {
    const previousTitle = document.title;
    const fullTitle = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;
    document.title = fullTitle;

    const canonicalUrl = canonicalPath
      ? new URL(canonicalPath, window.location.origin).toString()
      : window.location.href;

    upsertMeta('meta[property="og:title"]', { property: "og:title", content: fullTitle });
    upsertMeta('meta[property="og:type"]', { property: "og:type", content: "website" });
    upsertMeta('meta[property="og:site_name"]', {
      property: "og:site_name",
      content: SITE_NAME,
    });
    upsertMeta('meta[property="og:url"]', { property: "og:url", content: canonicalUrl });
    const socialImage = new URL(
      imageUrl ?? DEFAULT_OG_IMAGE,
      window.location.origin,
    ).toString();

    upsertMeta('meta[name="twitter:card"]', {
      name: "twitter:card",
      content: "summary_large_image",
    });

    if (description) {
      upsertMeta('meta[name="description"]', { name: "description", content: description });
      upsertMeta('meta[property="og:description"]', {
        property: "og:description",
        content: description,
      });
    }

    upsertMeta('meta[property="og:image"]', {
      property: "og:image",
      content: socialImage,
    });
    upsertMeta('meta[name="twitter:image"]', {
      name: "twitter:image",
      content: socialImage,
    });

    upsertMeta('meta[name="robots"]', {
      name: "robots",
      content: noIndex ? "noindex, nofollow" : "index, follow",
    });

    upsertLink("canonical", canonicalUrl);

    // Structured data gets a dedicated script tag we fully own, so replacing it
    // on navigation cannot strip anything the page did not add.
    let script: HTMLScriptElement | null = null;
    if (structuredData) {
      script = document.createElement("script");
      script.type = "application/ld+json";
      script.dataset.managed = "seo";
      script.textContent = JSON.stringify(structuredData);
      document.head.appendChild(script);
    }

    return () => {
      document.title = previousTitle;
      script?.remove();
    };
    // structuredData is an object literal at call sites, so compare by value to
    // avoid re-running the effect on every render.
  }, [
    title,
    description,
    canonicalPath,
    imageUrl,
    noIndex,
    JSON.stringify(structuredData ?? null),
  ]);
}

/** Trim text to a length search engines will actually display. */
export function toMetaDescription(text: string | null | undefined, max = 160): string {
  if (!text) return "";
  const collapsed = text.replace(/\s+/g, " ").trim();
  if (collapsed.length <= max) return collapsed;
  // Cut at a word boundary so the ellipsis does not land mid-word.
  return `${collapsed.slice(0, max - 1).replace(/\s+\S*$/, "")}…`;
}
