import { createServer, request } from "node:http";
import { env } from "../src/config.js";

const PORT = 8091;
const upstream = new URL(env.pbUrl);
const ALLOWED = [/^\/pay\.html$/, /^\/api\/tranox\/pay\/[a-z0-9]{15}$/];
const SECURITY_HEADERS: Record<string, string> = {
  "content-security-policy": "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "cache-control": "no-store",
};

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://gate");
  const path = url.pathname;
  if ((req.method !== "GET" && req.method !== "HEAD") || !ALLOWED.some((r) => r.test(path))) {
    res.writeHead(404, { "content-type": "text/plain", ...SECURITY_HEADERS }).end("Not found");
    return;
  }
  const forward = request(
    {
      host: upstream.hostname,
      port: upstream.port || 80,
      method: req.method,
      path: path + url.search,
      headers: { accept: req.headers.accept ?? "*/*" },
      timeout: 15_000,
    },
    (up) => {
      const headers: Record<string, string | string[]> = { ...SECURITY_HEADERS };
      for (const h of ["content-type", "content-length", "etag", "last-modified"]) {
        const v = up.headers[h];
        if (v !== undefined) headers[h] = v;
      }
      res.writeHead(up.statusCode ?? 502, headers);
      up.pipe(res);
    },
  );
  forward.on("timeout", () => forward.destroy(new Error("PocketBase did not answer in time")));
  forward.on("error", (e) => {
    console.error(`gate: ${req.method} ${path} failed: ${e.message}`);
    if (!res.headersSent) res.writeHead(502, { "content-type": "text/plain", ...SECURITY_HEADERS });
    res.end("Payments are unavailable right now. Try again in a few minutes.");
  });
  req.pipe(forward);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`payment gate on http://127.0.0.1:${PORT}, forwarding only the payment page to ${upstream.origin}`);
});
