---
name: crawler-and-link-ranking
load_when: implementing the crawl, link scoring, page labelling, robots.txt or sitemap handling
depends_on: [00-rules, 20-safe-fetch]
related: [32-process-brief]
code: packages/core/src/retrieval/crawler.ts, linkRanker.ts, cleaner.ts
---

# Crawler and link ranking

## 6.3 Crawling and ranking links

**Brief**: crawl the site, rank the links, fetch what looks right. Hiring pages sit at unpredictable paths (`/careers`, `/jobs`, a handbook, an engineering blog). A fixed list of paths is not sufficient. Respect robots.txt.

- **AGENT**: link extraction, URL normalisation, robots.txt parsing (a library such as `robots-parser` works), sitemap fetching, a queue with a visited set.
- **GUIDE (crawl procedure)**:
  1. Normalise the start URL. Fetch `robots.txt` from the same origin. Treat a 4xx response as "allow all". Treat a 5xx response as "disallow all" for this run and record it.
  2. Fetch the start page (depth 0). Extract all links and resolve each against the page's own URL, so relative links work on any host and port.
  3. Also try `sitemap.xml` from the same origin. Sitemap URLs feed the same ranking.
  4. Score every candidate link (spec below). Fetch the top candidates at depth 1, up to the page budget.
  5. From any page classified `hiring` or from a handbook-like index, follow its highest-scoring links one level deeper (depth 2). This is how you reach a "How we hire" page nested under a handbook.
  6. Stop at 10 pages total, or when no candidate scores above zero.
- **GUIDE (scope)**: stay on the start URL's origin. If the start URL has a path other than `/` (for example `http://localhost:8099/acme/`), also stay inside that path prefix. A local server may host several companies under different paths, and a root-relative link such as `/globex/careers` must not pull another company's pages into this kit. Decide whether to allow subdomains of the same registrable domain (for example `careers.company.com`) and record it.
- **GUIDE (link scoring spec)**: score = sum of matches, computed by code. Suggested weights:

| Signal                                                                                    | Weight  |
| ----------------------------------------------------------------------------------------- | ------- |
| URL path or anchor contains `interview`, `hiring-process`, `how-we-hire`, `hiring`        | +10     |
| Contains `careers`, `jobs`, `join`, `work-with-us`                                        | +6      |
| Contains `handbook`, `engineering`, `culture`, `values`, `principles`, `blog`             | +4      |
| Contains `about`, `company`, `team`, `mission`, `who-we-are`                              | +4      |
| Link sits in `nav`, `header` or `footer`                                                  | +1      |
| Contains `login`, `signin`, `privacy`, `terms`, `cookie`, `press`, `legal`, `unsubscribe` | -10     |
| File extension is `.pdf`, `.jpg`, `.png`, `.zip`, `.mp4` or scheme is `mailto:`, `tel:`   | exclude |
| Different origin                                                                          | exclude |

Tune the numbers yourself on two or three real sites. The weights are a starting point, not a specification from the brief.

- **GUIDE (page labelling)**: label each fetched page `hiring`, `about` or `other`, with code, from URL keywords plus content keywords (`interview`, `stages`, `take-home`, `onsite`, `our values`, `mission`). Later steps read this label.
- **YOU**: page budget and depth (D12), and the reasoning for it against the 15-minute limit. List the exact sources you used in the README.
- **Test yourself**: run against one real site with a buried hiring page (the brief names GitLab and PostHog as examples that publish detailed hiring processes at paths nobody would guess), against a local static site with relative links, and against a site with no hiring page anywhere.

## Done when
- Relative links resolve on any host and port, and the path prefix scope works on a fixture that hosts two companies.
- robots.txt handling is tested: 4xx allows all, 5xx disallows all, a disallowed page is skipped and recorded.
- A fixture site with a buried hiring page is found. A fixture with none reports NO_HIRING_PAGE.
- The page budget and depth limit are respected.

---
Section numbers such as 6.11 in this file refer to the master plan. The map in `.ai/README.md` says which skill holds each section.
