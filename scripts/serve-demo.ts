import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const PORT = 8099;
const DEMO_DIR = path.resolve(process.cwd(), "demo-site");

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".txt": "text/plain",
  ".json": "application/json",
  ".css": "text/css",
  ".js": "application/javascript",
};

const server = http.createServer((req, res) => {
  const urlPath = (req.url || "/").split("?")[0];
  let filePath = path.join(DEMO_DIR, urlPath);

  // If path ends with / or is a directory, look for index.html
  if (urlPath.endsWith("/") || (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory())) {
    filePath = path.join(filePath, "index.html");
  }

  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("404 Not Found");
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  res.writeHead(200, { "Content-Type": contentType });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, () => {
  console.log(`[demo-site] Demo test sites available at http://localhost:${PORT}/ (NexusAI, PetalHealth, OrbitSystems)`);
});
