---
name: safe-fetch
load_when: implementing or changing safeFetch, redirects, SSRF checks, content type or size limits
depends_on: [00-rules]
related: [21-crawler, 23-prompt-safety]
code: packages/core/src/retrieval/safeFetch.ts
---

# Safe fetch

## 6.2 Fetching one page safely

**Brief**: retrieve and clean an individual page. Validate external URLs. Restrict content types and sizes. Skip and report a source that cannot be retrieved. Rate-limit and back off on failure.

- **AGENT**: a `safeFetch(url)` function with timeout, redirect handling, content-type check, size cap, an HTML-to-text cleaner (Cheerio plus Readability is common), a per-host rate limiter and retry with exponential backoff.
- **GUIDE (safeFetch spec)**:
  - Allow `http` and `https` only. Reject URLs with embedded credentials.
  - Resolve the hostname and check every returned address against blocked ranges: `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16` (includes the cloud metadata address `169.254.169.254`), `0.0.0.0/8`, `100.64.0.0/10`, `::1`, `fc00::/7`, `fe80::/10`, and IPv4-mapped IPv6 addresses. Connect to the address you checked, so a DNS answer cannot change between the check and the connection.
  - Follow redirects manually, at most 3 to 5 hops, and re-validate every hop. A public URL that redirects to `http://127.0.0.1` must be blocked.
  - Content types: `text/html`, `application/xhtml+xml` and `text/plain` for pages. `application/xml` and `text/xml` for sitemaps only. Reject everything else without reading the body.
  - Size: stop reading after 1.5 MB, counting decompressed bytes as they stream in.
  - Timeout: 10 seconds per request.
  - Retry 2 times with exponential backoff and jitter on timeouts, network errors and 5xx. Never retry 404 or other 4xx responses. Honour `Retry-After` on 429 and 503.
  - Send no cookies. Send a `User-Agent` that names your project.
  - Return a result object, never throw: `{ ok, url, status, text, title, links, error }`. The `error` field carries a short code such as `TIMEOUT`, `BLOCKED_HOST`, `BAD_CONTENT_TYPE`, `TOO_LARGE`, `HTTP_404`, `ROBOTS_DISALLOWED`.
- **GUIDE (cleaning spec)**: remove `script`, `style`, `nav`, `footer` and cookie banners. Keep the page title and headings. Collapse whitespace. Truncate to 6,000 characters per page before any prompt sees it.
- **YOU (private-host switch)**: batch cases use `localhost`, so private hosts must be allowed there and blocked in production. Recommended: `ALLOW_PRIVATE_HOSTS` defaults to false. The `evaluate` command sets it to true for its own process only. The server never reads it in production. Also test that a redirect from an allowed host to a private one is still blocked when the flag is false.
- **Test yourself**: point `safeFetch` at `http://127.0.0.1`, `http://169.254.169.254`, `http://[::1]`, a redirect to a private address, a PDF, a 5 MB page and a page that never responds.

## Done when
- Tests cover blocked ranges (IPv4, IPv6, IPv4 mapped IPv6, metadata address), redirect to a private address, PDF and image content types, a body over the size cap, and a timeout.
- ALLOW_PRIVATE_HOSTS works both ways and defaults to blocked.
- safeFetch never throws. It returns a result object with an error code.

---
Section numbers such as 6.11 in this file refer to the master plan. The map in `.ai/README.md` says which skill holds each section.
