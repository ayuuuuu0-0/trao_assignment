import type { DiscussionSource, DiscussionRecord } from "../schema/kit.js";

const HN_SEARCH_BASE = "https://hn.algolia.com/api/v1/search";
const MAX_SNIPPET_CHARS = 800;
const MAX_SOURCES = 5;

const INTERVIEW_KEYWORDS = [
  "interview",
  "hiring process",
  "hiring-process",
  "take-home",
  "take home",
  "onsite",
  "on-site",
  "recruiter",
  "screen",
  "screening",
  "offer",
  "assessment",
];

export type DiscussionSearchResult = DiscussionRecord & {
  error?: string;
};


export interface AlgoliaHit {
  objectID?: string;
  title?: string | null;
  story_title?: string | null;
  story_text?: string | null;
  comment_text?: string | null;
  url?: string | null;
}

// Basic HTML entity and tag cleaner for HN comment_text.
export function cleanHnText(raw: string): string {
  return raw
    .replace(/<pre><code>[\s\S]*?<\/code><\/pre>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

// Code-based relevance filter: company name AND interview keyword must appear.
export function filterRelevantHit(
  companyName: string,
  hit: AlgoliaHit
): DiscussionSource | null {
  if (!companyName.trim()) return null;

  const title = hit.title || hit.story_title || "Hacker News Discussion";
  const rawBody = hit.comment_text || hit.story_text || hit.title || "";
  const cleanedBody = cleanHnText(rawBody);

  const combined = `${title} ${cleanedBody}`.toLowerCase();
  const normalizedCompany = companyName.trim().toLowerCase();

  // Check company name presence (word boundary or substring match).
  if (!combined.includes(normalizedCompany)) {
    return null;
  }

  // Check interview keyword presence.
  const hasInterviewKeyword = INTERVIEW_KEYWORDS.some((kw) => combined.includes(kw));
  if (!hasInterviewKeyword) {
    return null;
  }

  const url =
    hit.url ||
    (hit.objectID ? `https://news.ycombinator.com/item?id=${hit.objectID}` : "https://news.ycombinator.com");

  const snippet = cleanedBody.slice(0, MAX_SNIPPET_CHARS);

  return {
    title: title.slice(0, 200),
    url,
    snippet,
  };
}


export async function searchDiscussion(
  companyName: string,
  fetchFn: typeof fetch = globalThis.fetch
): Promise<DiscussionSearchResult> {
  const trimmedCompany = companyName.trim();
  if (!trimmedCompany) {
    return { status: "none_found", sources: [] };
  }

  const queries = [
    `"${trimmedCompany}" interview`,
    `"${trimmedCompany}" hiring process`,
  ];

  const gatheredSources: DiscussionSource[] = [];
  const seenUrls = new Set<string>();

  for (const query of queries) {
    try {
      const endpoint = `${HN_SEARCH_BASE}?query=${encodeURIComponent(query)}&tags=(story,comment)&hitsPerPage=10`;
      const response = await fetchFn(endpoint, {
        headers: {
          Accept: "application/json",
          "User-Agent": "PrepMe-Bot/1.0 (+https://github.com/prepme)",
        },
      });

      if (!response.ok) {
        // Non-200 HTTP response.
        continue;
      }

      const data = (await response.json()) as { hits?: AlgoliaHit[] };
      const hits = Array.isArray(data?.hits) ? data.hits : [];

      for (const hit of hits) {
        const item = filterRelevantHit(trimmedCompany, hit);
        if (item && !seenUrls.has(item.url)) {
          seenUrls.add(item.url);
          gatheredSources.push(item);
          if (gatheredSources.length >= MAX_SOURCES) {
            break;
          }
        }
      }

      if (gatheredSources.length >= MAX_SOURCES) {
        break;
      }
    } catch (err: unknown) {
      // Individual query error; continue to next query.
      const message = err instanceof Error ? err.message : String(err);
      if (queries.indexOf(query) === queries.length - 1 && gatheredSources.length === 0) {
        return {
          status: "failed",
          sources: [],
          error: `HN search failed: ${message}`,
        };
      }
    }
  }

  if (gatheredSources.length === 0) {
    return { status: "none_found", sources: [] };
  }

  return {
    status: "found",
    sources: gatheredSources.slice(0, MAX_SOURCES),
  };
}
