// Link scoring and filtering for company site crawler.
// Pure functions with no network dependencies.

const EXCLUDE_EXTENSIONS = new Set([
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".svg",
  ".zip",
  ".tar",
  ".gz",
  ".mp4",
  ".mp3",
  ".avi",
  ".mov",
  ".exe",
  ".dmg",
]);

const HIGH_PRIORITY_PATTERNS = [
  "interview",
  "hiring-process",
  "hiring process",
  "how-we-hire",
  "how we hire",
  "how-to-hire",
  "how to hire",
  "interviewing",
  "hiring",
];

const CAREERS_PATTERNS = [
  "careers",
  "jobs",
  "join",
  "work-with-us",
  "work with us",
  "opportunities",
  "open-roles",
  "open roles",
];

const CULTURE_PATTERNS = [
  "handbook",
  "engineering",
  "culture",
  "values",
  "principles",
  "blog",
];

const ABOUT_PATTERNS = [
  "about",
  "company",
  "team",
  "mission",
  "who-we-are",
  "who we are",
];


const NEGATIVE_PATTERNS = [
  "login",
  "signin",
  "sign-in",
  "log-in",
  "signup",
  "sign-up",
  "register",
  "privacy",
  "terms",
  "cookie",
  "press",
  "legal",
  "unsubscribe",
  "auth",
  "account",
];

export interface LinkCandidate {
  url: string;
  anchorText?: string;
  inNav?: boolean;
}

export interface ScoredLink extends LinkCandidate {
  score: number;
}

// Checks if a candidate URL matches the origin and path prefix of startUrl.
export function isWithinScope(candidateUrl: string, startUrl: string): boolean {
  try {
    const candidate = new URL(candidateUrl);
    const start = new URL(startUrl);

    // Origin must match exactly.
    if (candidate.origin.toLowerCase() !== start.origin.toLowerCase()) {
      return false;
    }

    // Protocol must be http: or https:
    if (candidate.protocol !== "http:" && candidate.protocol !== "https:") {
      return false;
    }

    // Path prefix check: if startUrl has a non-root path (e.g. /acme/ or /acme),
    // candidate must be within that path prefix.
    const startPrefix = start.pathname.endsWith("/") ? start.pathname : `${start.pathname}/`;
    if (startPrefix !== "/") {
      const candidatePath = candidate.pathname.endsWith("/")
        ? candidate.pathname
        : `${candidate.pathname}/`;
      if (!candidatePath.startsWith(startPrefix) && candidate.pathname !== start.pathname) {
        return false;
      }
    }

    // Check file extensions.
    const pathname = candidate.pathname.toLowerCase();
    for (const ext of EXCLUDE_EXTENSIONS) {
      if (pathname.endsWith(ext)) return false;
    }

    return true;
  } catch {
    return false;
  }
}

// Computes heuristic score for a link based on Section 6.3 weights.
// Returns null if the link is excluded.
export function scoreLink(
  candidate: LinkCandidate,
  startUrl: string
): number | null {
  if (!isWithinScope(candidate.url, startUrl)) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(candidate.url);
  } catch {
    return null;
  }

  // Combine URL path and anchor text for keyword scanning.
  const target = `${parsed.pathname} ${parsed.search} ${candidate.anchorText ?? ""}`.toLowerCase();

  let score = 0;

  for (const pat of HIGH_PRIORITY_PATTERNS) {
    if (target.includes(pat)) {
      score += 10;
      break;
    }
  }

  for (const pat of CAREERS_PATTERNS) {
    if (target.includes(pat)) {
      score += 6;
      break;
    }
  }

  for (const pat of CULTURE_PATTERNS) {
    if (target.includes(pat)) {
      score += 4;
      break;
    }
  }

  for (const pat of ABOUT_PATTERNS) {
    if (target.includes(pat)) {
      score += 4;
      break;
    }
  }

  if (candidate.inNav) {
    score += 1;
  }

  for (const pat of NEGATIVE_PATTERNS) {
    if (target.includes(pat)) {
      score -= 10;
      break;
    }
  }

  return score;
}

// Ranks a list of candidate links, filters excluded ones, and returns sorted by score descending.
export function rankLinks(
  candidates: LinkCandidate[],
  startUrl: string
): ScoredLink[] {
  const scored: ScoredLink[] = [];
  const seenUrls = new Set<string>();

  for (const item of candidates) {
    // Normalize URL: remove trailing hash/fragment.
    let normalized: string;
    try {
      const u = new URL(item.url);
      u.hash = "";
      normalized = u.toString();
    } catch {
      continue;
    }

    if (seenUrls.has(normalized)) continue;
    seenUrls.add(normalized);

    const s = scoreLink({ ...item, url: normalized }, startUrl);
    if (s !== null && s > 0) {
      scored.push({ ...item, url: normalized, score: s });
    }
  }

  return scored.sort((a, b) => b.score - a.score);
}

// Labels a page as "hiring", "about", or "other" per Section 6.3 spec.
export function classifyPage(
  url: string,
  title: string,
  text: string
): "hiring" | "about" | "other" {
  const combined = `${url} ${title} ${text.slice(0, 2000)}`.toLowerCase();

  const hiringSignals = [
    "interview",
    "hiring process",
    "how we hire",
    "stages",
    "take-home",
    "onsite",
    "technical screen",
    "careers",
    "open roles",
    "job openings",
  ];

  for (const sig of hiringSignals) {
    if (combined.includes(sig)) {
      return "hiring";
    }
  }

  const aboutSignals = [
    "our values",
    "mission",
    "about us",
    "who we are",
    "leadership team",
    "what we do",
    "our story",
  ];

  for (const sig of aboutSignals) {
    if (combined.includes(sig)) {
      return "about";
    }
  }

  return "other";
}
