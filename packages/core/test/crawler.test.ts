import http from "node:http";
import { AddressInfo } from "node:net";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  isWithinScope,
  scoreLink,
  rankLinks,
  classifyPage,
} from "../src/retrieval/linkRanker.js";
import { crawlSite } from "../src/retrieval/crawler.js";

const NET_TIMEOUT = 15_000;

function makeServer(
  handler: (req: http.IncomingMessage, res: http.ServerResponse) => void
): Promise<{ url: string; close: () => Promise<void> }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(handler);
    server.listen(0, "127.0.0.1", () => {
      const port = (server.address() as AddressInfo).port;
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise((res, rej) => server.close((e) => (e ? rej(e) : res()))),
      });
    });
    server.once("error", reject);
  });
}

// ---------------------------------------------------------------------------
// LinkRanker unit tests (pure functions, no network)
// ---------------------------------------------------------------------------

describe("isWithinScope", () => {
  it("allows URLs on the same origin when startUrl has root path", () => {
    expect(isWithinScope("https://example.com/careers", "https://example.com/")).toBe(true);
    expect(isWithinScope("https://example.com/about/team", "https://example.com")).toBe(true);
  });

  it("rejects different origins", () => {
    expect(isWithinScope("https://other.com/careers", "https://example.com/")).toBe(false);
    expect(isWithinScope("http://example.com/careers", "https://example.com/")).toBe(false);
  });

  it("enforces path prefix scoping for multi-tenant hosts", () => {
    const startUrl = "http://localhost:8099/acme/";
    expect(isWithinScope("http://localhost:8099/acme/careers", startUrl)).toBe(true);
    expect(isWithinScope("http://localhost:8099/acme/about/team", startUrl)).toBe(true);
    // Out of scope: globex company on the same host
    expect(isWithinScope("http://localhost:8099/globex/careers", startUrl)).toBe(false);
    expect(isWithinScope("http://localhost:8099/careers", startUrl)).toBe(false);
  });

  it("excludes binary and media file extensions", () => {
    expect(isWithinScope("https://example.com/handbook.pdf", "https://example.com/")).toBe(false);
    expect(isWithinScope("https://example.com/team.jpg", "https://example.com/")).toBe(false);
    expect(isWithinScope("https://example.com/archive.zip", "https://example.com/")).toBe(false);
  });
});

describe("scoreLink", () => {
  const start = "https://example.com/";

  it("awards +10 for interview and hiring-process keywords", () => {
    expect(scoreLink({ url: "https://example.com/interview-prep" }, start)).toBe(10);
    expect(scoreLink({ url: "https://example.com/page", anchorText: "How We Hire" }, start)).toBe(10);
  });

  it("awards +6 for careers and jobs keywords", () => {
    expect(scoreLink({ url: "https://example.com/careers" }, start)).toBe(6);
    expect(scoreLink({ url: "https://example.com/page", anchorText: "Open Jobs" }, start)).toBe(6);
  });

  it("awards +4 for culture, values, and about keywords", () => {
    expect(scoreLink({ url: "https://example.com/engineering-handbook" }, start)).toBe(4);
    expect(scoreLink({ url: "https://example.com/about-us" }, start)).toBe(4);
  });

  it("deducts 10 for login, terms, privacy keywords", () => {
    // careers (+6) and login (-10) = -4
    expect(scoreLink({ url: "https://example.com/login" }, start)).toBe(-10);
  });

  it("adds +1 if the link sits in navigation", () => {
    expect(scoreLink({ url: "https://example.com/careers", inNav: true }, start)).toBe(7);
  });

  it("returns null for out-of-scope or excluded links", () => {
    expect(scoreLink({ url: "https://other.com/careers" }, start)).toBeNull();
    expect(scoreLink({ url: "https://example.com/doc.pdf" }, start)).toBeNull();
  });
});

describe("rankLinks", () => {
  it("sorts links by score descending and deduplicates", () => {
    const candidates = [
      { url: "https://example.com/about" },            // score 4
      { url: "https://example.com/how-we-hire" },       // score 10
      { url: "https://example.com/careers" },           // score 6
      { url: "https://example.com/careers#section" },   // duplicate normalized
      { url: "https://example.com/privacy" },           // negative score -> filtered out
    ];
    const ranked = rankLinks(candidates, "https://example.com/");
    expect(ranked.length).toBe(3);
    expect(ranked[0].url).toBe("https://example.com/how-we-hire");
    expect(ranked[1].url).toBe("https://example.com/careers");
    expect(ranked[2].url).toBe("https://example.com/about");
  });
});

describe("classifyPage", () => {
  it("classifies pages with hiring keywords as hiring", () => {
    expect(classifyPage("https://example.com/careers", "Careers", "We have open roles and a take-home stage")).toBe("hiring");
    expect(classifyPage("https://example.com/hiring", "How We Hire", "Our interview process consists of 3 stages")).toBe("hiring");
  });

  it("classifies pages with mission/values keywords as about", () => {
    expect(classifyPage("https://example.com/about", "About Us", "Our mission and our values guide our team")).toBe("about");
  });

  it("classifies standard pages as other", () => {
    expect(classifyPage("https://example.com/pricing", "Pricing", "Standard subscription plans")).toBe("other");
  });
});

// ---------------------------------------------------------------------------
// Crawler integration tests with local HTTP fixture servers
// ---------------------------------------------------------------------------

describe("crawlSite", () => {
  beforeEach(() => {
    process.env["ALLOW_PRIVATE_HOSTS"] = "true";
  });
  afterEach(() => {
    delete process.env["ALLOW_PRIVATE_HOSTS"];
  });

  it("crawls start page and discovers ranked links", async () => {
    const server = await makeServer((req, res) => {
      if (req.url === "/robots.txt") {
        res.writeHead(404);
        res.end();
      } else if (req.url === "/sitemap.xml") {
        res.writeHead(404);
        res.end();
      } else if (req.url === "/") {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(`<html><body>
          <a href="/careers">Careers</a>
          <a href="/about">About Us</a>
        </body></html>`);
      } else if (req.url === "/careers") {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end("<html><body><h1>Careers at Acme</h1><p>Our interview process is 3 stages.</p></body></html>");
      } else if (req.url === "/about") {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end("<html><body><h1>About Us</h1><p>Our mission is to build great software.</p></body></html>");
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    try {
      const result = await crawlSite(server.url, { maxPages: 5 });
      expect(result.hiringPageFound).toBe(true);
      expect(result.aboutPageFound).toBe(true);
      expect(result.pages.some((p) => p.url.includes("/careers") && p.kind === "hiring")).toBe(true);
      expect(result.pages.some((p) => p.url.includes("/about") && p.kind === "about")).toBe(true);
    } finally {
      await server.close();
    }
  }, NET_TIMEOUT);

  it("respects path prefix boundary on a multi-company fixture host", async () => {
    const server = await makeServer((req, res) => {
      if (req.url === "/robots.txt" || req.url === "/sitemap.xml") {
        res.writeHead(404);
        res.end();
      } else if (req.url === "/acme/") {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(`<html><body>
          <a href="/acme/careers">Acme Careers</a>
          <a href="/globex/careers">Globex Careers</a>
        </body></html>`);
      } else if (req.url === "/acme/careers") {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end("<html><body><h1>Acme Careers</h1><p>Join Acme.</p></body></html>");
      } else if (req.url === "/globex/careers") {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end("<html><body><h1>Globex Careers</h1><p>Join Globex.</p></body></html>");
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    try {
      const result = await crawlSite(`${server.url}/acme/`, { maxPages: 5 });
      // /acme/careers must be visited
      expect(result.pages.some((p) => p.url.includes("/acme/careers"))).toBe(true);
      // /globex/careers must NEVER be visited
      expect(result.pages.some((p) => p.url.includes("/globex/careers"))).toBe(false);
    } finally {
      await server.close();
    }
  }, NET_TIMEOUT);

  it("respects robots.txt disallow rules", async () => {
    const server = await makeServer((req, res) => {
      if (req.url === "/robots.txt") {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("User-agent: *\nDisallow: /careers\n");
      } else if (req.url === "/sitemap.xml") {
        res.writeHead(404);
        res.end();
      } else if (req.url === "/") {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(`<html><body><a href="/careers">Careers</a><a href="/about">About</a></body></html>`);
      } else if (req.url === "/about") {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end("<html><body><h1>About Us</h1></body></html>");
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    try {
      const result = await crawlSite(server.url, { maxPages: 5 });
      // /careers should be recorded as skipped due to ROBOTS_DISALLOWED
      const skippedCareers = result.pages.find((p) => p.url.includes("/careers"));
      expect(skippedCareers).toBeDefined();
      expect(skippedCareers?.status).toBe("skipped");
      expect(skippedCareers?.reason).toBe("ROBOTS_DISALLOWED");
    } finally {
      await server.close();
    }
  }, NET_TIMEOUT);

  it("handles 5xx on robots.txt by disallowing crawl", async () => {
    const server = await makeServer((req, res) => {
      if (req.url === "/robots.txt") {
        res.writeHead(500);
        res.end("Server error");
      } else {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end("<html><body>Hello</body></html>");
      }
    });

    try {
      const result = await crawlSite(server.url);
      expect(result.robotsStatus).toBe("disallowed");
      expect(result.pages.some((p) => p.reason === "ROBOTS_TXT_5XX")).toBe(true);
    } finally {
      await server.close();
    }
  }, NET_TIMEOUT);

  it("discovers links from sitemap.xml", async () => {
    const server = await makeServer((req, res) => {
      if (req.url === "/robots.txt") {
        res.writeHead(404);
        res.end();
      } else if (req.url === "/sitemap.xml") {
        res.writeHead(200, { "Content-Type": "application/xml" });
        res.end(`<?xml version="1.0" encoding="UTF-8"?>
          <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
            <url><loc>${server.url}/careers</loc></url>
          </urlset>`);
      } else if (req.url === "/") {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end("<html><body><h1>Acme Home</h1></body></html>");
      } else if (req.url === "/careers") {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end("<html><body><h1>Acme Careers</h1><p>Our interview process.</p></body></html>");
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    try {
      const result = await crawlSite(server.url, { maxPages: 5 });
      expect(result.pages.some((p) => p.url.includes("/careers"))).toBe(true);
      expect(result.hiringPageFound).toBe(true);
    } finally {
      await server.close();
    }
  }, NET_TIMEOUT);

  it("follows depth 2 for handbook or hiring pages", async () => {
    // Depth 0: Home -> links to /handbook
    // Depth 1: /handbook -> links to /handbook/interview-process
    // Depth 2: /handbook/interview-process -> hiring info
    const server = await makeServer((req, res) => {
      if (req.url === "/robots.txt" || req.url === "/sitemap.xml") {
        res.writeHead(404);
        res.end();
      } else if (req.url === "/") {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(`<html><body><a href="/handbook">Company Handbook</a></body></html>`);
      } else if (req.url === "/handbook") {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(`<html><body><a href="/handbook/interview-process">How We Interview</a></body></html>`);
      } else if (req.url === "/handbook/interview-process") {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end("<html><body><h1>Interview Process</h1><p>We do a take-home screen.</p></body></html>");
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    try {
      const result = await crawlSite(server.url, { maxPages: 5, maxDepth: 2 });
      expect(result.pages.some((p) => p.url.includes("/handbook/interview-process"))).toBe(true);
      expect(result.hiringPageFound).toBe(true);
    } finally {
      await server.close();
    }
  }, NET_TIMEOUT);

  it("respects maxPages budget", async () => {
    const server = await makeServer((req, res) => {
      if (req.url === "/robots.txt" || req.url === "/sitemap.xml") {
        res.writeHead(404);
        res.end();
      } else if (req.url === "/") {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(`<html><body>
          <a href="/p1">Page 1</a>
          <a href="/p2">Page 2</a>
          <a href="/p3">Page 3</a>
          <a href="/p4">Page 4</a>
          <a href="/p5">Page 5</a>
        </body></html>`);
      } else {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end("<html><body>Page content</body></html>");
      }
    });

    try {
      const result = await crawlSite(server.url, { maxPages: 3 });
      const fetchedCount = result.pages.filter((p) => p.status === "fetched").length;
      expect(fetchedCount).toBeLessThanOrEqual(3);
    } finally {
      await server.close();
    }
  }, NET_TIMEOUT);
});
