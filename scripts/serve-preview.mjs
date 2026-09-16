// Local-only static server for release previews and browser tests.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
const root = resolve("dist");
const mime = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".ttf": "font/ttf", ".ico": "image/x-icon" };
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    let path = resolve(root, `.${pathname}`);
    if (path !== root && !path.startsWith(root + sep)) { response.writeHead(400).end(); return; }
    if ((await stat(path)).isDirectory()) path = resolve(path, "index.html");
    const body = await readFile(path);
    response.writeHead(200, { "Content-Type": mime[extname(path)] ?? "application/octet-stream", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }); response.end(body);
  } catch { response.writeHead(404).end("Not found"); }
});
server.listen(43187, "127.0.0.1");
for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => server.close());
