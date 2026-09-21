import dns from "node:dns/promises";
import { Readable } from "node:stream";
import { Agent, fetch as undiciFetch, type Response } from "undici";
import * as cheerio from "cheerio";
import { isPrivateIp } from "./isPrivateIp.js";

const USER_AGENT = "PrepMe-Bot/1.0 (+https://github.com/prepme)";
const MAX_REDIRECTS = 5;
const TIMEOUT_MS = 10_000;
const MAX_BODY_BYTES = 1.5 * 1024 * 1024; // 1.5 MB
const MAX_TEXT_CHARS = 6_000;             // per-page prompt cap

// Error codes returned in the result object. Never thrown.
export type FetchErrorCode =
  | "BLOCKED_HOST"
  | "BAD_SCHEME"
  | "EMBEDDED_CREDENTIALS"
  | "BAD_CONTENT_TYPE"
  | "TOO_LARGE"
  | "TIMEOUT"
  | "TOO_MANY_REDIRECTS"
  | "HTTP_4XX"
  | "HTTP_404"
  | "HTTP_5XX"
  | "NETWORK_ERROR"
  | "ROBOTS_DISALLOWED";

export type PageKind = "html" | "sitemap" | "text";

export interface FetchResult {
  ok: boolean;
  url: string;       // final URL after redirects
  status: number | null;
  text: string;      // cleaned, truncated to MAX_TEXT_CHARS
  title: string;
  links: string[];   // absolute URLs found on the page
  error: FetchErrorCode | null;
}

const ALLOWED_PAGE_TYPES = new Set([
  "text/html",
  "application/xhtml+xml",
  "text/plain",
]);
const ALLOWED_SITEMAP_TYPES = new Set([
  "application/xml",
  "text/xml",
]);

function parseContentType(raw: string | null): string {
  if (!raw) return "";
  return raw.split(";")[0].trim().toLowerCase();
}

function allowPrivateHosts(): boolean {
  return process.env["ALLOW_PRIVATE_HOSTS"] === "true";
}

// Validate a URL and resolve its hostname.
// Returns { ip } on success, or throws a FetchErrorCode string on error.
async function resolveAndCheck(url: URL): Promise<{ ip: string; hostname: string }> {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw "BAD_SCHEME" as FetchErrorCode;
  }
  if (url.username || url.password) {
    throw "EMBEDDED_CREDENTIALS" as FetchErrorCode;
  }

  const hostname = url.hostname.toLowerCase();

  if (!allowPrivateHosts()) {
    if (hostname === "localhost" || hostname.endsWith(".localhost") || isPrivateIp(hostname)) {
      throw "BLOCKED_HOST" as FetchErrorCode;
    }
  }

  // dns.lookup handles both hostnames and literal IPs.
  let resolvedIp: string;
  try {
    const { address } = await dns.lookup(url.hostname, { all: false });
    resolvedIp = address;
  } catch {
    resolvedIp = url.hostname;
  }

  if (allowPrivateHosts()) {
    return { ip: resolvedIp, hostname: url.hostname };
  }

  if (isPrivateIp(resolvedIp)) throw "BLOCKED_HOST" as FetchErrorCode;

  return { ip: resolvedIp, hostname: url.hostname };
}


// Make a single HTTP request using undici with the resolved IP pinned.
// This prevents TOCTOU: the DNS answer used for the check is the same one used to connect.
async function rawRequest(
  url: URL,
  ip: string,
  signal: AbortSignal
): Promise<Response> {
  // Build an undici Agent that overrides DNS lookup to always return the pre-resolved IP.
  const agent = new Agent({
    connect: {
      lookup(_hostname, _opts, callback) {
        // Pin to the address we already validated.
        callback(null, ip, ip.includes(":") ? 6 : 4);
      },
    },
  });

  return undiciFetch(url.toString(), {
    dispatcher: agent,
    redirect: "manual",   // handle redirects ourselves so we can re-validate each hop
    signal,
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml,text/plain,application/xml,text/xml;q=0.9,*/*;q=0.5",
      "Accept-Language": "en",
    },
  });
}

// Read the response body up to MAX_BODY_BYTES, streaming.
async function readBody(response: Response): Promise<{ body: string; tooLarge: boolean }> {
  if (!response.body) return { body: "", tooLarge: false };

  let total = 0;
  const chunks: Uint8Array[] = [];
  const reader = response.body.getReader();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      reader.cancel().catch(() => {});
      return { body: new TextDecoder().decode(Buffer.concat(chunks)), tooLarge: true };
    }
    chunks.push(value);
  }

  return { body: new TextDecoder().decode(Buffer.concat(chunks)), tooLarge: false };
}

// Extract text, title, and links from HTML using Cheerio.
function parseHtml(html: string, baseUrl: string): { text: string; title: string; links: string[] } {
  const $ = cheerio.load(html);

  // Remove noise elements.
  $("script, style, nav, footer, header, [class*='cookie'], [id*='cookie'], [class*='banner'], noscript, aside").remove();

  const title = $("title").first().text().trim();

  // Collect links before text extraction.
  const links: string[] = [];
  $("a[href]").each((_i, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    try {
      const abs = new URL(href, baseUrl).toString();
      links.push(abs);
    } catch {
      // relative or malformed link — skip
    }
  });

  // Extract readable text: headings + paragraphs + list items.
  const parts: string[] = [];
  $("h1, h2, h3, h4, p, li").each((_i, el) => {
    const t = $(el).text().replace(/\s+/g, " ").trim();
    if (t) parts.push(t);
  });

  const raw = parts.join("\n");
  const text = raw.slice(0, MAX_TEXT_CHARS);

  return { text, title, links };
}

// Retry wrapper — retries on timeout, network error, or 5xx (not 4xx).
async function fetchWithRetry(
  url: URL,
  ip: string,
  maxAttempts: number,
  signal: AbortSignal
): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      // Exponential backoff with ±25% jitter.
      const base = 500 * 2 ** (attempt - 1);
      const jitter = base * 0.25 * (Math.random() * 2 - 1);
      await new Promise((r) => setTimeout(r, Math.max(0, base + jitter)));
    }
    try {
      const res = await rawRequest(url, ip, signal);
      // Don't retry 4xx.
      if (res.status >= 400 && res.status < 500) return res;
      // Honour Retry-After for 429/503.
      if (res.status === 429 || res.status === 503) {
        const retryAfter = res.headers.get("retry-after");
        if (retryAfter) {
          const secs = parseInt(retryAfter, 10);
          if (!isNaN(secs) && secs < 60 && attempt < maxAttempts - 1) {
            await new Promise((r) => setTimeout(r, secs * 1000));
          }
        }
        if (attempt < maxAttempts - 1) continue;
      }
      if (res.status >= 500 && attempt < maxAttempts - 1) continue;
      return res;
    } catch (err) {
      lastErr = err;
      if (signal.aborted) throw err;
    }
  }
  throw lastErr;
}

function err(code: FetchErrorCode, url: string, status: number | null = null): FetchResult {
  return { ok: false, url, status, text: "", title: "", links: [], error: code };
}

export async function safeFetch(
  rawUrl: string,
  options: { forSitemap?: boolean } = {}
): Promise<FetchResult> {
  let currentUrl: URL;
  try {
    currentUrl = new URL(rawUrl);
  } catch {
    return err("BAD_SCHEME", rawUrl);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      // Validate and resolve the current URL.
      let resolved: { ip: string; hostname: string };
      try {
        resolved = await resolveAndCheck(currentUrl);
      } catch (code) {
        return err(code as FetchErrorCode, currentUrl.toString());
      }

      let response: Response;
      try {
        response = await fetchWithRetry(currentUrl, resolved.ip, 3, controller.signal);
      } catch (e) {
        if (controller.signal.aborted) return err("TIMEOUT", currentUrl.toString());
        return err("NETWORK_ERROR", currentUrl.toString());
      }

      // Handle redirects manually.
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) return err("NETWORK_ERROR", currentUrl.toString());
        if (hop === MAX_REDIRECTS) return err("TOO_MANY_REDIRECTS", currentUrl.toString());
        try {
          currentUrl = new URL(location, currentUrl.toString());
        } catch {
          return err("BAD_SCHEME", currentUrl.toString());
        }
        // Consume body to free connection.
        response.body?.cancel().catch(() => {});
        continue;
      }

      // Error status codes.
      if (response.status === 404) return err("HTTP_404", currentUrl.toString(), 404);
      if (response.status >= 400 && response.status < 500)
        return err("HTTP_4XX", currentUrl.toString(), response.status);
      if (response.status >= 500) return err("HTTP_5XX", currentUrl.toString(), response.status);

      // Check content type before reading the body.
      const ct = parseContentType(response.headers.get("content-type"));
      const allowedTypes = options.forSitemap
        ? new Set([...ALLOWED_PAGE_TYPES, ...ALLOWED_SITEMAP_TYPES])
        : ALLOWED_PAGE_TYPES;
      if (ct && !allowedTypes.has(ct)) {
        response.body?.cancel().catch(() => {});
        return err("BAD_CONTENT_TYPE", currentUrl.toString(), response.status);
      }

      // Stream the body with a size cap.
      const { body, tooLarge } = await readBody(response);
      if (tooLarge) return err("TOO_LARGE", currentUrl.toString(), response.status);

      // Parse HTML.
      const isHtml =
        ct === "text/html" || ct === "application/xhtml+xml";
      const { text, title, links } = isHtml
        ? parseHtml(body, currentUrl.toString())
        : { text: body.slice(0, MAX_TEXT_CHARS), title: "", links: [] };

      return {
        ok: true,
        url: currentUrl.toString(),
        status: response.status,
        text,
        title,
        links,
        error: null,
      };
    }

    return err("TOO_MANY_REDIRECTS", currentUrl.toString());
  } finally {
    clearTimeout(timer);
  }
}
