import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyOps,
  backupsOf,
  environment,
  exportText,
  listProfiles,
  planOps,
  readGameLog,
  restoreBackup,
  saveDetail,
  searchUnits,
  validateRoot,
  type Ops,
} from "./api.ts";

declare global {
  var __WEB_ASSETS: Record<string, string> | undefined; // eslint-disable-line no-underscore-dangle -- injected by the packaged build
}

// eslint-disable-next-line no-underscore-dangle -- injected by the packaged build
const EMBEDDED = globalThis.__WEB_ASSETS;
const WEB_ROOT =
  [
    join(process.cwd(), "packages", "web", "dist"),
    resolve(fileURLToPath(new URL("../../web/dist", import.meta.url))),
  ].find((candidate) => existsSync(join(candidate, "index.html"))) ?? "";
const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
};

async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

/**
 * The desktop webview loads the UI from the Tauri asset protocol, so calls to
 * this server are cross-origin. It only ever listens on 127.0.0.1, so echoing
 * the caller's origin back is enough.
 */
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  "access-control-max-age": "86400",
};

function send(res: ServerResponse, status: number, payload: unknown): void {
  const text = typeof payload === "string" ? payload : JSON.stringify(payload);
  res.writeHead(status, {
    ...CORS,
    "content-type": typeof payload === "string" ? "text/plain; charset=utf-8" : MIME[".json"],
    "cache-control": "no-store",
  });
  res.end(text);
}

async function handleApi(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  const path = url.searchParams.get("path") ?? "";
  switch (`${req.method} ${url.pathname}`) {
    case "GET /api/validate-root":
      return send(res, 200, validateRoot(path));
    case "GET /api/env":
      return send(res, 200, await environment());
    case "GET /api/profiles":
      return send(res, 200, listProfiles(url.searchParams.get("root") ?? ""));
    case "GET /api/save":
      return send(res, 200, saveDetail(path));
    case "GET /api/units":
      return send(res, 200, searchUnits(path, url.searchParams.get("q") ?? ""));
    case "GET /api/backups":
      return send(res, 200, backupsOf(path));
    case "GET /api/log":
      return send(res, 200, readGameLog(url.searchParams.get("root") ?? ""));
    case "GET /api/export":
      return send(res, 200, exportText(path));
    case "POST /api/plan": {
      const payload = (await body(req)) as { path: string; ops: Ops };
      return send(res, 200, planOps(payload.path, payload.ops));
    }
    case "POST /api/apply": {
      const payload = (await body(req)) as { path: string; ops: Ops; cloneAs?: string };
      return send(res, 200, applyOps(payload.path, payload.ops, { cloneAs: payload.cloneAs }));
    }
    case "POST /api/restore": {
      const payload = (await body(req)) as { path: string; file: string };
      restoreBackup(payload.path, payload.file);
      return send(res, 200, { restored: payload.file });
    }
    default:
      return send(res, 404, { error: "no such endpoint" });
  }
}

function serveStatic(res: ServerResponse, pathname: string): void {
  const requested = pathname === "/" ? "index.html" : pathname.replace(/^\//, "");
  if (EMBEDDED) {
    const name = EMBEDDED[requested] === undefined ? "index.html" : requested;
    const payload = EMBEDDED[name];
    if (payload === undefined) return send(res, 500, "no web assets were embedded in this build");
    res.writeHead(200, { "content-type": MIME[extname(name)] ?? "application/octet-stream" });
    res.end(Buffer.from(payload, "base64"));
    return;
  }
  const target = join(WEB_ROOT, requested);
  const chosen = existsSync(target) && extname(target) !== "" ? target : join(WEB_ROOT, "index.html");
  if (WEB_ROOT === "" || !existsSync(chosen)) {
    return send(res, 500, "web assets are missing - run `pnpm build` first");
  }
  res.writeHead(200, { "content-type": MIME[extname(chosen)] ?? "application/octet-stream" });
  res.end(readFileSync(chosen));
}

export function startServer(port: number): Promise<number> {
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname.startsWith("/api/")) {
      if (req.method === "OPTIONS") {
        res.writeHead(204, CORS);
        res.end();
        return;
      }
      const started = Date.now();
      res.on("finish", () => {
        console.log(`${req.method} ${url.pathname} -> ${res.statusCode} in ${Date.now() - started}ms`);
      });
      handleApi(req, res, url).catch((err: Error) => send(res, 400, { error: err.message }));
      return;
    }
    serveStatic(res, url.pathname);
  });
  const { promise, resolve: ready } = Promise.withResolvers<number>();
  server.listen(port, "127.0.0.1", () => ready(port));
  return promise;
}

const port = Number(process.env.PORT ?? 7311);
const bound = await startServer(port);
console.log(`save editor ready: http://127.0.0.1:${bound}`);
