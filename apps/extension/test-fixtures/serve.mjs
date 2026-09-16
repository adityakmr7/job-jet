#!/usr/bin/env node
// Zero-dependency static file server for the extension's test fixtures.
// Serves this directory, resolving `/foo/` -> `/foo/index.html` so the
// fixture pages get realistic-looking URLs (matters for the detection
// heuristic's URL-keyword check).
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const PORT = Number(process.env.PORT ?? 4000);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

async function resolvePath(urlPath) {
  let candidate = join(ROOT, decodeURIComponent(urlPath));
  try {
    const s = await stat(candidate);
    if (s.isDirectory()) candidate = join(candidate, "index.html");
  } catch {
    return null;
  }
  try {
    await stat(candidate);
    return candidate;
  } catch {
    return null;
  }
}

createServer(async (req, res) => {
  const urlPath = new URL(req.url ?? "/", "http://localhost").pathname;
  const filePath = await resolvePath(urlPath);
  if (!filePath) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
    return;
  }
  const body = await readFile(filePath);
  res.writeHead(200, { "Content-Type": MIME[extname(filePath)] ?? "application/octet-stream" });
  res.end(body);
}).listen(PORT, () => {
  console.log(`Job Jet test fixtures serving at http://localhost:${PORT}`);
  console.log(`  Positive case: http://localhost:${PORT}/careers/senior-frontend-engineer/apply/`);
  console.log(`  Negative case: http://localhost:${PORT}/about/`);
});
