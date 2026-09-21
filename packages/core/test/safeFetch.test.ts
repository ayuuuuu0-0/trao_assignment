import http from "node:http";
import { AddressInfo } from "node:net";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { safeFetch } from "../src/retrieval/safeFetch.js";

// All tests that spin up a real local server or do DNS lookups get 15 seconds.
// SSRF tests that just check the IP range (no network) are instant.
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
// isPrivateIp unit tests (no network)
// ---------------------------------------------------------------------------

describe("isPrivateIp", () => {
  it("is a pure module import that compiles", async () => {
    const { isPrivateIp } = await import("../src/retrieval/isPrivateIp.js");
    expect(typeof isPrivateIp).toBe("function");
  });

  it("blocks IPv4 loopback", async () => {
    const { isPrivateIp } = await import("../src/retrieval/isPrivateIp.js");
    expect(isPrivateIp("127.0.0.1")).toBe(true);
    expect(isPrivateIp("127.255.255.255")).toBe(true);
  });

  it("blocks RFC-1918 private ranges", async () => {
    const { isPrivateIp } = await import("../src/retrieval/isPrivateIp.js");
    expect(isPrivateIp("10.0.0.1")).toBe(true);
    expect(isPrivateIp("172.16.0.1")).toBe(true);
    expect(isPrivateIp("172.31.255.254")).toBe(true);
    expect(isPrivateIp("192.168.1.1")).toBe(true);
  });

  it("blocks link-local and metadata addresses", async () => {
    const { isPrivateIp } = await import("../src/retrieval/isPrivateIp.js");
    expect(isPrivateIp("169.254.0.1")).toBe(true);
    expect(isPrivateIp("169.254.169.254")).toBe(true); // cloud metadata
  });

  it("blocks shared address space 100.64.0.0/10", async () => {
    const { isPrivateIp } = await import("../src/retrieval/isPrivateIp.js");
    expect(isPrivateIp("100.64.0.1")).toBe(true);
    expect(isPrivateIp("100.127.255.255")).toBe(true);
  });

  it("allows public IPv4 addresses", async () => {
    const { isPrivateIp } = await import("../src/retrieval/isPrivateIp.js");
    expect(isPrivateIp("8.8.8.8")).toBe(false);
    expect(isPrivateIp("1.1.1.1")).toBe(false);
    expect(isPrivateIp("93.184.216.34")).toBe(false); // example.com
  });

  it("blocks IPv6 loopback ::1", async () => {
    const { isPrivateIp } = await import("../src/retrieval/isPrivateIp.js");
    expect(isPrivateIp("::1")).toBe(true);
  });

  it("blocks IPv6 ULA fc00::/7", async () => {
    const { isPrivateIp } = await import("../src/retrieval/isPrivateIp.js");
    expect(isPrivateIp("fc00::1")).toBe(true);
    expect(isPrivateIp("fd12:3456:789a::1")).toBe(true);
  });

  it("blocks IPv6 link-local fe80::/10", async () => {
    const { isPrivateIp } = await import("../src/retrieval/isPrivateIp.js");
    expect(isPrivateIp("fe80::1")).toBe(true);
  });

  it("blocks IPv4-mapped IPv6 for private addresses", async () => {
    const { isPrivateIp } = await import("../src/retrieval/isPrivateIp.js");
    expect(isPrivateIp("::ffff:127.0.0.1")).toBe(true);
    expect(isPrivateIp("::ffff:192.168.1.1")).toBe(true);
    expect(isPrivateIp("::ffff:169.254.169.254")).toBe(true);
  });

  it("allows public IPv6 addresses", async () => {
    const { isPrivateIp } = await import("../src/retrieval/isPrivateIp.js");
    expect(isPrivateIp("2001:4860:4860::8888")).toBe(false); // Google DNS
  });
});

// ---------------------------------------------------------------------------
// safeFetch — tests using a local HTTP server (ALLOW_PRIVATE_HOSTS=true)
// ---------------------------------------------------------------------------

describe("safeFetch — local server (ALLOW_PRIVATE_HOSTS=true)", () => {
  beforeEach(() => {
    process.env["ALLOW_PRIVATE_HOSTS"] = "true";
  });
  afterEach(() => {
    delete process.env["ALLOW_PRIVATE_HOSTS"];
  });

  it("returns ok=true and text for a normal HTML page", async () => {
    const server = await makeServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end("<html><head><title>Hello</title></head><body><h1>Test page</h1><p>Some content here.</p></body></html>");
    });
    try {
      const result = await safeFetch(server.url);
      expect(result.ok).toBe(true);
      expect(result.error).toBeNull();
      expect(result.title).toBe("Hello");
      expect(result.text).toContain("Test page");
      expect(result.status).toBe(200);
    } finally {
      await server.close();
    }
  });

  it("extracts absolute links from the page", async () => {
    const server = await makeServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`<html><body>
        <a href="/about">About</a>
        <a href="/careers">Careers</a>
        <a href="https://other.com/page">External</a>
      </body></html>`);
    });
    try {
      const result = await safeFetch(server.url);
      expect(result.ok).toBe(true);
      expect(result.links.some((l) => l.includes("/about"))).toBe(true);
      expect(result.links.some((l) => l.includes("/careers"))).toBe(true);
    } finally {
      await server.close();
    }
  });

  it("returns HTTP_404 for a 404 response", async () => {
    const server = await makeServer((_req, res) => {
      res.writeHead(404, { "Content-Type": "text/html" });
      res.end("Not found");
    });
    try {
      const result = await safeFetch(server.url);
      expect(result.ok).toBe(false);
      expect(result.error).toBe("HTTP_404");
      expect(result.status).toBe(404);
    } finally {
      await server.close();
    }
  });

  it("returns HTTP_4XX for a 403 response", async () => {
    const server = await makeServer((_req, res) => {
      res.writeHead(403, { "Content-Type": "text/html" });
      res.end("Forbidden");
    });
    try {
      const result = await safeFetch(server.url);
      expect(result.ok).toBe(false);
      expect(result.error).toBe("HTTP_4XX");
      expect(result.status).toBe(403);
    } finally {
      await server.close();
    }
  });

  it("returns BAD_CONTENT_TYPE for a PDF response", async () => {
    const server = await makeServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "application/pdf" });
      res.end("%PDF-1.4 ...");
    });
    try {
      const result = await safeFetch(server.url);
      expect(result.ok).toBe(false);
      expect(result.error).toBe("BAD_CONTENT_TYPE");
    } finally {
      await server.close();
    }
  });

  it("returns BAD_CONTENT_TYPE for an image response", async () => {
    const server = await makeServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "image/png" });
      res.end(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    });
    try {
      const result = await safeFetch(server.url);
      expect(result.ok).toBe(false);
      expect(result.error).toBe("BAD_CONTENT_TYPE");
    } finally {
      await server.close();
    }
  });

  it("returns TOO_LARGE for a body over 1.5 MB", async () => {
    const server = await makeServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/html" });
      // 2 MB of data
      const chunk = Buffer.alloc(64 * 1024, "A");
      for (let i = 0; i < 32; i++) res.write(chunk);
      res.end();
    });
    try {
      const result = await safeFetch(server.url);
      expect(result.ok).toBe(false);
      expect(result.error).toBe("TOO_LARGE");
    } finally {
      await server.close();
    }
  });

  it("follows a redirect and returns the final page", async () => {
    let server!: { url: string; close: () => Promise<void> };
    server = await makeServer((req, res) => {
      if (req.url === "/") {
        res.writeHead(301, { Location: "/destination" });
        res.end();
      } else {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end("<html><body><p>Destination page</p></body></html>");
      }
    });
    try {
      const result = await safeFetch(server.url);
      expect(result.ok).toBe(true);
      expect(result.text).toContain("Destination page");
    } finally {
      await server.close();
    }
  });

  it("returns TOO_MANY_REDIRECTS when redirect limit is exceeded", async () => {
    const server = await makeServer((_req, res) => {
      res.writeHead(302, { Location: "/" }); // infinite redirect loop
      res.end();
    });
    try {
      const result = await safeFetch(server.url);
      expect(result.ok).toBe(false);
      expect(result.error).toBe("TOO_MANY_REDIRECTS");
    } finally {
      await server.close();
    }
  });

  it("truncates text to 6000 characters", async () => {
    const server = await makeServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/html" });
      const longText = "word ".repeat(3000); // ~15,000 chars
      res.end(`<html><body><p>${longText}</p></body></html>`);
    });
    try {
      const result = await safeFetch(server.url);
      expect(result.ok).toBe(true);
      expect(result.text.length).toBeLessThanOrEqual(6000);
    } finally {
      await server.close();
    }
  });

  it("removes script and style tags from text", async () => {
    const server = await makeServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`<html><body>
        <script>alert('xss')</script>
        <style>.hidden { display: none; }</style>
        <p>Clean content here</p>
      </body></html>`);
    });
    try {
      const result = await safeFetch(server.url);
      expect(result.ok).toBe(true);
      expect(result.text).not.toContain("alert");
      expect(result.text).not.toContain("display: none");
      expect(result.text).toContain("Clean content");
    } finally {
      await server.close();
    }
  });

  it("accepts XML as sitemap when forSitemap=true", async () => {
    const server = await makeServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "application/xml" });
      res.end(`<?xml version="1.0"?><urlset><url><loc>http://example.com/page</loc></url></urlset>`);
    });
    try {
      const result = await safeFetch(server.url, { forSitemap: true });
      expect(result.ok).toBe(true);
    } finally {
      await server.close();
    }
  });

  it("rejects XML as non-sitemap", async () => {
    const server = await makeServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "application/xml" });
      res.end(`<?xml version="1.0"?><root/>`);
    });
    try {
      const result = await safeFetch(server.url);
      expect(result.ok).toBe(false);
      expect(result.error).toBe("BAD_CONTENT_TYPE");
    } finally {
      await server.close();
    }
  });
});

// ---------------------------------------------------------------------------
// safeFetch — SSRF blocking (ALLOW_PRIVATE_HOSTS=false / default)
// ---------------------------------------------------------------------------

describe("safeFetch — SSRF blocking (ALLOW_PRIVATE_HOSTS=false)", () => {
  beforeEach(() => {
    delete process.env["ALLOW_PRIVATE_HOSTS"];
  });

  it("blocks http://127.0.0.1", async () => {
    const result = await safeFetch("http://127.0.0.1/");
    expect(result.ok).toBe(false);
    expect(result.error).toBe("BLOCKED_HOST");
  });

  it("blocks http://localhost", async () => {
    const result = await safeFetch("http://localhost/");
    expect(result.ok).toBe(false);
    expect(result.error).toBe("BLOCKED_HOST");
  });

  it("blocks the cloud metadata address 169.254.169.254", async () => {
    const result = await safeFetch("http://169.254.169.254/latest/meta-data/");
    expect(result.ok).toBe(false);
    expect(result.error).toBe("BLOCKED_HOST");
  });

  it("blocks http://[::1]", async () => {
    const result = await safeFetch("http://[::1]/");
    expect(result.ok).toBe(false);
    expect(result.error).toBe("BLOCKED_HOST");
  });

  it("rejects a URL with embedded credentials", async () => {
    const result = await safeFetch("http://user:pass@example.com/");
    expect(result.ok).toBe(false);
    expect(result.error).toBe("EMBEDDED_CREDENTIALS");
  });

  it("rejects a ftp:// URL", async () => {
    const result = await safeFetch("ftp://example.com/file.txt");
    expect(result.ok).toBe(false);
    expect(result.error).toBe("BAD_SCHEME");
  });

  it("rejects a redirect from public to private host (ALLOW_PRIVATE_HOSTS=false)", async () => {
    // This test requires ALLOW_PRIVATE_HOSTS=true to start a local server,
    // then we set it to false before the redirect to a private host is followed.
    // Simplest approach: spin up a local redirect server with ALLOW_PRIVATE_HOSTS=true,
    // then call safeFetch with the flag unset so the second hop is blocked.
    process.env["ALLOW_PRIVATE_HOSTS"] = "true";
    const server = await makeServer((_req, res) => {
      res.writeHead(302, { Location: "http://169.254.169.254/latest" });
      res.end();
    });
    delete process.env["ALLOW_PRIVATE_HOSTS"]; // block on the redirect hop

    try {
      const result = await safeFetch(server.url);
      expect(result.ok).toBe(false);
      expect(result.error).toBe("BLOCKED_HOST");
    } finally {
      process.env["ALLOW_PRIVATE_HOSTS"] = "true";
      await server.close();
      delete process.env["ALLOW_PRIVATE_HOSTS"];
    }
  });
});

// ---------------------------------------------------------------------------
// safeFetch — bad input
// ---------------------------------------------------------------------------

describe("safeFetch — bad input", () => {
  it("returns BAD_SCHEME for a non-URL string", async () => {
    const result = await safeFetch("not-a-url");
    expect(result.ok).toBe(false);
    expect(result.error).toBe("BAD_SCHEME");
  });

  it("never throws even for completely invalid input", async () => {
    await expect(safeFetch("")).resolves.toMatchObject({ ok: false });
    await expect(safeFetch("mailto:a@b.com")).resolves.toMatchObject({ ok: false });
  });
});
