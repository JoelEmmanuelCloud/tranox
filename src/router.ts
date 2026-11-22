import type { IncomingMessage, ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { approvalChallenge, approveMilestone, freelancerView, jobView, rateView, txView, ViewError } from "./views.js";

const ROOT = join(import.meta.dirname, "..", "web");
const MAX_BODY = 8 * 1024;
const POST_LIMIT = 20;
const POST_WINDOW_MS = 60_000;

const PAGES: Record<string, string> = { "/": "index.html", "/job": "job.html", "/freelancer": "freelancer.html" };
const ASSETS: Record<string, string> = {
  "/assets/styles.css": "text/css; charset=utf-8",
  "/assets/app.js": "text/javascript; charset=utf-8",
  "/assets/icons.js": "text/javascript; charset=utf-8",
  "/assets/job.js": "text/javascript; charset=utf-8",
  "/assets/freelancer.js": "text/javascript; charset=utf-8",
};
const IMAGES: Record<string, string> = {
  "/favicon.png": "image/png",
  "/icon-192.png": "image/png",
  "/logo.png": "image/png",
  "/og.jpg": "image/jpeg",
  "/how-1200.webp": "image/webp",
  "/how-720.webp": "image/webp",
  "/fonts/archivo.woff2": "font/woff2",
  "/fonts/plex-mono-400.woff2": "font/woff2",
  "/fonts/plex-mono-500.woff2": "font/woff2",
};
const HEADERS: Record<string, string> = {
  "content-security-policy": "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; font-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "cache-control": "no-store",
};

const posts = new Map<string, number[]>();

function send(res: ServerResponse, status: number, type: string, body: string | Buffer) {
  res.writeHead(status, { "content-type": type, ...HEADERS }).end(body);
}

function json(res: ServerResponse, status: number, data: unknown) {
  send(res, status, "application/json; charset=utf-8", JSON.stringify(data));
}

function clientIp(req: IncomingMessage): string {
  const forwarded = req.headers["x-forwarded-for"];
  const first = typeof forwarded === "string" ? forwarded.split(",")[0].trim() : "";
  const cf = req.headers["cf-connecting-ip"];
  return first || (typeof cf === "string" && cf) || req.socket.remoteAddress || "unknown";
}

function allowPost(req: IncomingMessage): boolean {
  const now = Date.now();
  const ip = clientIp(req);
  const recent = (posts.get(ip) ?? []).filter((t) => now - t < POST_WINDOW_MS);
  recent.push(now);
  posts.set(ip, recent);
  if (posts.size > 10_000) for (const [k, v] of posts) if (v.every((t) => now - t >= POST_WINDOW_MS)) posts.delete(k);
  return recent.length <= POST_LIMIT;
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new ViewError(413, "Request too large");
    chunks.push(chunk);
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
    if (body && typeof body === "object" && !Array.isArray(body)) return body;
  } catch {}
  throw new ViewError(400, "Request body must be a JSON object");
}

async function route(req: IncomingMessage, res: ServerResponse) {
  const path = new URL(req.url ?? "/", "http://web").pathname;
  const method = req.method ?? "GET";

  if (method === "GET" || method === "HEAD") {
    if (PAGES[path]) {
      return send(res, 200, "text/html; charset=utf-8", await readFile(join(ROOT, PAGES[path])));
    }
    if (IMAGES[path]) return send(res, 200, IMAGES[path], await readFile(join(ROOT, path.slice(1))));
    if (ASSETS[path]) return send(res, 200, ASSETS[path], await readFile(join(ROOT, path.slice("/assets/".length))));
    let m = path.match(/^\/api\/jobs\/([a-z0-9]{15})$/);
    if (m) return json(res, 200, await jobView(m[1]));
    m = path.match(/^\/api\/freelancers\/([a-z0-9]{15})$/);
    if (m) return json(res, 200, await freelancerView(m[1]));
    m = path.match(/^\/api\/rates\/(cNGN|IDRX|wARS|wBRL|wMXN|wCOP)$/);
    if (m) return json(res, 200, await rateView(m[1]));
    m = path.match(/^\/api\/tx\/(0x[0-9a-f]{64})$/);
    if (m) return json(res, 200, await txView(m[1]));
  }

  if (method === "POST") {
    const m = path.match(/^\/api\/milestones\/([a-z0-9]{15})\/(challenge|approve)$/);
    if (m) {
      if (!allowPost(req)) throw new ViewError(429, "Too many requests; wait a minute");
      if (m[2] === "challenge") return json(res, 200, await approvalChallenge(m[1]));
      const body = await readJson(req);
      return json(res, 200, await approveMilestone(m[1], body.issued_at, body.signature));
    }
  }

  json(res, 404, { message: "Not found" });
}

export function handle(req: IncomingMessage, res: ServerResponse) {
  route(req, res).catch((e) => {
    if (e instanceof ViewError) return json(res, e.status, { message: e.message });
    console.error(`web: ${req.method} ${req.url} failed:`, e instanceof Error ? e.message : e);
    if (!res.headersSent) json(res, 500, { message: "Something went wrong. Try again in a minute." });
  });
}
