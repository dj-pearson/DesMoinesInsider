/**
 * Fetching for scrapers.
 *
 * Everything here goes over plain HTTP rather than a headless browser. A
 * browser costs about a second of CPU and 300MB per page; most of these venues
 * either render their calendar server-side or expose the JSON their own widget
 * calls, so a browser buys nothing. The two sources that genuinely need one say
 * so in their own file.
 */

/**
 * Venue sites are behind CDNs that reject obvious bots. A real browser's
 * user-agent is the difference between a 200 and a 403 on several of them.
 */
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const DEFAULT_TIMEOUT_MS = 20_000;

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
  ) {
    super(`${status} from ${url}`);
    this.name = "HttpError";
  }
}

const MAX_REDIRECTS = 5;

/**
 * Follow redirects ourselves, carrying cookies forward.
 *
 * `fetch` follows redirects but drops Set-Cookie, and some platforms — college
 * athletics sites among them — set a session cookie and redirect back to the
 * same URL to check it came back. Without the cookie that is an infinite loop,
 * which surfaces as "redirect count exceeded" rather than anything that hints
 * at cookies. Only the cookie name and value are kept, which is all a session
 * handshake needs and avoids storing anything else the site sends.
 */
async function request(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const cookies = new Map<string, string>();
  let target = url;

  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      const headers: Record<string, string> = {
        "user-agent": USER_AGENT,
        accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
      };
      if (cookies.size > 0) {
        headers.cookie = Array.from(cookies, ([name, value]) => `${name}=${value}`).join("; ");
      }

      const response = await fetch(target, {
        signal: controller.signal,
        redirect: "manual",
        headers,
      });

      for (const raw of response.headers.getSetCookie?.() ?? []) {
        const [pair] = raw.split(";");
        const separator = pair.indexOf("=");
        if (separator > 0) {
          cookies.set(pair.slice(0, separator).trim(), pair.slice(separator + 1).trim());
        }
      }

      const location = response.headers.get("location");
      if (response.status >= 300 && response.status < 400 && location) {
        target = new URL(location, target).toString();
        continue;
      }

      return response;
    }

    throw new Error(`Too many redirects fetching ${url}`);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch with a single retry.
 *
 * One retry, not three: a venue site that is down stays down for minutes, and
 * hammering it makes us the problem. A 4xx is not retried at all — the URL is
 * wrong or we are blocked, and repeating it changes neither.
 */
async function fetchWithRetry(url: string, timeoutMs: number): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await request(url, timeoutMs);
      if (response.ok) return response;
      if (response.status < 500) throw new HttpError(response.status, url);
      lastError = new HttpError(response.status, url);
    } catch (error) {
      if (error instanceof HttpError && error.status < 500) throw error;
      lastError = error;
    }
    if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 1_500));
  }
  throw lastError instanceof Error ? lastError : new Error(`Failed to fetch ${url}`);
}

export async function fetchHtml(
  url: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<string> {
  return (await fetchWithRetry(url, timeoutMs)).text();
}

export async function fetchJson<T>(
  url: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  return (await fetchWithRetry(url, timeoutMs)).json() as Promise<T>;
}

/** Resolve a possibly-relative href against the page it was found on. */
export function absoluteUrl(href: string | undefined, base: string): string | undefined {
  if (!href) return undefined;
  try {
    return new URL(href, base).toString();
  } catch {
    return undefined;
  }
}
