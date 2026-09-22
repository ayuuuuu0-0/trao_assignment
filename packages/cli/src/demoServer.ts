import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

/**
 * Starts a minimal HTTP static file server serving the demo-site directory.
 * Returns a cleanup close function. If port is already active, safely resolves without error.
 */
export async function startDemoServer(
  port = 8099,
  demoDir = path.resolve(process.cwd(), "demo-site")
): Promise<{ url: string; close: () => Promise<void> }> {
  const server = http.createServer(async (req, res) => {
    try {
      const parsedUrl = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
      let reqPath = decodeURIComponent(parsedUrl.pathname);

      if (reqPath.endsWith("/")) {
        reqPath += "index.html";
      }

      let filePath = path.join(demoDir, reqPath);

      // Prevent directory traversal
      if (!filePath.startsWith(demoDir)) {
        res.writeHead(403, { "Content-Type": "text/plain" });
        res.end("Forbidden");
        return;
      }

      let stat;
      try {
        stat = await fs.stat(filePath);
      } catch {
        // If file doesn't exist, try appending .html or index.html
        if (!path.extname(filePath)) {
          try {
            const htmlPath = filePath + ".html";
            stat = await fs.stat(htmlPath);
            filePath = htmlPath;
          } catch {
            try {
              const indexPath = path.join(filePath, "index.html");
              stat = await fs.stat(indexPath);
              filePath = indexPath;
            } catch {
              res.writeHead(404, { "Content-Type": "text/plain" });
              res.end("Not Found");
              return;
            }
          }
        } else {
          res.writeHead(404, { "Content-Type": "text/plain" });
          res.end("Not Found");
          return;
        }
      }

      if (stat.isDirectory()) {
        filePath = path.join(filePath, "index.html");
      }

      const content = await fs.readFile(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || "application/octet-stream";

      res.writeHead(200, {
        "Content-Type": contentType,
        "Content-Length": content.length,
      });
      res.end(content);
    } catch {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Internal Server Error");
    }
  });

  return new Promise((resolve) => {
    server.once("error", (err: any) => {
      if (err.code === "EADDRINUSE") {
        // Port already running, reuse existing server
        resolve({
          url: `http://127.0.0.1:${port}`,
          close: async () => {},
        });
      } else {
        resolve({
          url: `http://127.0.0.1:${port}`,
          close: async () => {},
        });
      }
    });

    server.listen(port, "127.0.0.1", () => {
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () =>
          new Promise<void>((res) => {
            server.close(() => res());
          }),
      });
    });
  });
}
