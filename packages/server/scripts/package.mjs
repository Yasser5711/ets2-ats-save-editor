import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../../..");
const serverDist = resolve(here, "../dist");
const webDist = resolve(repo, "packages/web/dist");
const release = resolve(repo, "release");

if (!existsSync(join(webDist, "index.html"))) {
  throw new Error("packages/web/dist is missing - run `pnpm build` first");
}

function collect(dir) {
  const assets = {};
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      Object.assign(assets, collect(path));
      continue;
    }
    assets[relative(webDist, path).replaceAll("\\", "/")] = readFileSync(path).toString("base64");
  }
  return assets;
}

const assets = collect(webDist);
writeFileSync(
  join(serverDist, "embedded-assets.js"),
  `globalThis.__WEB_ASSETS = ${JSON.stringify(assets)};\n`,
);
writeFileSync(join(serverDist, "exe-entry.js"), 'import "./embedded-assets.js";\nimport "./index.js";\n');

rmSync(release, { recursive: true, force: true });
mkdirSync(release, { recursive: true });

const exe = join(release, "truck-save-editor.exe");
const build = spawnSync("bun", ["build", "--compile", "--outfile", exe, join(serverDist, "exe-entry.js")], {
  stdio: "inherit",
  shell: process.platform === "win32",
});
if (build.status !== 0) throw new Error("bun build failed");

const bytes = statSync(exe).size;
console.log(
  `release/truck-save-editor.exe ready (${(bytes / 1048576).toFixed(0)} MB, ${Object.keys(assets).length} web assets embedded)`,
);
