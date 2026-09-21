import robotsParser from "robots-parser";
import { safeFetch, FetchResult } from "./safeFetch.js";
import {
  isWithinScope,
  rankLinks,
  classifyPage,
  LinkCandidate,
} from "./linkRanker.js";

export interface Robot {
  isAllowed(url: string, ua?: string): boolean | undefined;
  isDisallowed(url: string, ua?: string): boolean | undefined;
  getMatchingLineNumber(url: string, ua?: string): number;
  getCrawlDelay(ua?: string): number | undefined;
  getSitemaps(): string[];
  getPreferredHost(): string | null;
}

type RobotsParserFn = (url: string, robotstxt: string) => Robot;
const parseRobots: RobotsParserFn = (
  typeof robotsParser === "function"
    ? robotsParser
    : (robotsParser as unknown as { default: RobotsParserFn }).default
) as RobotsParserFn;


const USER_AGENT = "PrepMe-Bot/1.0 (+https://github.com/prepme)";
const DEFAULT_MAX_PAGES = 10;
const DEFAULT_MAX_DEPTH = 2;

export interface CrawledPage {
  url: string;
  kind: "hiring" | "about" | "other";
  status: "fetched" | "skipped";
  title?: string;
  text?: string;
  reason?: string;
}

export interface CrawlResult {
  pages: CrawledPage[];
  hiringPageFound: boolean;
  aboutPageFound: boolean;
  robotsStatus: "allowed" | "disallowed" | "ignored";
  error?: string;
}

export interface CrawlOptions {
  maxPages?: number;
  maxDepth?: number;
  politeDelayMs?: number;
}

// Extract URLs from sitemap XML content.
function extractSitemapUrls(xmlText: string): string[] {
  const urls: string[] = [];
  const regex = /<\s*loc\s*>([^<]+)<\/\s*loc\s*>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(xmlText)) !== null) {
    const u = match[1]?.trim();
    if (u) urls.push(u);
  }
  return urls;
}

export async function crawlSite(
  startUrl: string,
  options: CrawlOptions = {}
): Promise<CrawlResult> {
  const maxPages = options.maxPages ?? DEFAULT_MAX_PAGES;
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
  const delayMs = options.politeDelayMs ?? 0;

  const result: CrawlResult = {
    pages: [],
    hiringPageFound: false,
    aboutPageFound: false,
    robotsStatus: "allowed",
  };

  let parsedStart: URL;
  try {
    parsedStart = new URL(startUrl);
  } catch {
    result.error = "INVALID_URL";
    return result;
  }

  // 1. Fetch robots.txt from the origin (or origin + path prefix).
  let robotsInstance: Robot | null = null;
  const robotsUrl = new URL("/robots.txt", parsedStart.origin).toString();
  const robotsRes = await safeFetch(robotsUrl);

  if (robotsRes.status && robotsRes.status >= 500) {
    // 5xx on robots.txt -> treat as disallow all for safety.
    result.robotsStatus = "disallowed";
    result.pages.push({
      url: robotsUrl,
      kind: "other",
      status: "skipped",
      reason: "ROBOTS_TXT_5XX",
    });
    return result;
  } else if (robotsRes.ok && robotsRes.text) {
    robotsInstance = parseRobots(robotsUrl, robotsRes.text);
    result.robotsStatus = "allowed";
  } else {
    // 4xx or not found -> treat as allow all.
    result.robotsStatus = "ignored";
  }


  // Helper: check if a URL is allowed by robots.txt.
  function isAllowedByRobots(urlToCheck: string): boolean {
    if (!robotsInstance) return true;
    const allowed = robotsInstance.isAllowed(urlToCheck, USER_AGENT);
    return allowed !== false;
  }

  const visited = new Set<string>();
  const queue: Array<{ url: string; depth: number }> = [];

  // Normalize and enqueue the start URL.
  const cleanStartUrl = new URL(startUrl);
  cleanStartUrl.hash = "";
  const startNormalized = cleanStartUrl.toString();

  queue.push({ url: startNormalized, depth: 0 });
  visited.add(startNormalized);

  // 2. Also try sitemap.xml in the background.
  const sitemapUrl = new URL("/sitemap.xml", parsedStart.origin).toString();
  const sitemapRes = await safeFetch(sitemapUrl, { forSitemap: true });
  if (sitemapRes.ok && sitemapRes.text) {
    const smUrls = extractSitemapUrls(sitemapRes.text);
    const candidates: LinkCandidate[] = smUrls.map((u) => ({ url: u }));
    const ranked = rankLinks(candidates, startNormalized);
    for (const r of ranked) {
      if (!visited.has(r.url)) {
        visited.add(r.url);
        queue.push({ url: r.url, depth: 1 });
      }
    }
  }

  // 3. Process BFS queue up to maxPages budget.
  while (queue.length > 0 && result.pages.filter((p) => p.status === "fetched").length < maxPages) {
    const current = queue.shift()!;

    // Enforce robots.txt per URL.
    if (!isAllowedByRobots(current.url)) {
      result.pages.push({
        url: current.url,
        kind: "other",
        status: "skipped",
        reason: "ROBOTS_DISALLOWED",
      });
      continue;
    }

    if (delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }

    const fetchRes = await safeFetch(current.url);

    if (!fetchRes.ok) {
      result.pages.push({
        url: current.url,
        kind: "other",
        status: "skipped",
        reason: fetchRes.error ?? "FETCH_FAILED",
      });
      continue;
    }

    const kind = classifyPage(fetchRes.url, fetchRes.title, fetchRes.text);
    if (kind === "hiring") result.hiringPageFound = true;
    if (kind === "about") result.aboutPageFound = true;

    result.pages.push({
      url: fetchRes.url,
      kind,
      status: "fetched",
      title: fetchRes.title,
      text: fetchRes.text,
    });

    // If we can follow links deeper (depth < maxDepth):
    if (current.depth < maxDepth) {
      // From depth 0: rank all links and enqueue at depth 1.
      // From depth 1: only follow links if page is classified as "hiring" or handbook/engineering.
      const shouldFollowChildren =
        current.depth === 0 ||
        kind === "hiring" ||
        current.url.includes("handbook") ||
        current.url.includes("engineering");

      if (shouldFollowChildren && fetchRes.links.length > 0) {
        const candidates: LinkCandidate[] = fetchRes.links.map((link) => ({ url: link }));
        const ranked = rankLinks(candidates, startNormalized);

        for (const link of ranked) {
          if (!visited.has(link.url)) {
            visited.add(link.url);
            queue.push({ url: link.url, depth: current.depth + 1 });
          }
        }
      }
    }
  }

  return result;
}
