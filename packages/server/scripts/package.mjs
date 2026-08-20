import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../../..");
const release = resolve(repo, "release");
const webDist = resolve(repo, "packages/web/dist");

if (!existsSync(webDist)) throw new Error("packages/web/dist missing - run `turbo run build` first");

rmSync(release, { recursive: true, force: true });
mkdirSync(release, { recursive: true });

const build = spawnSync(
  "bun",
  [
    "build",
    "--compile",
    "--outfile",
    resolve(release, "truck-save-editor.exe"),
    resolve(here, "../dist/index.js"),
  ],
  { stdio: "inherit", shell: process.platform === "win32" },
);
if (build.status !== 0) throw new Error("bun build failed");

cpSync(webDist, resolve(release, "web"), { recursive: true });
console.log("release/truck-save-editor.exe + release/web ready");
