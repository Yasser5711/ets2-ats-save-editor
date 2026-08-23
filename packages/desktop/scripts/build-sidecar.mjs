import { existsSync, mkdirSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../../..");
const binaries = resolve(here, "../src-tauri/binaries");
const serverEntry = resolve(repo, "packages/server/dist/index.js");

if (!existsSync(serverEntry)) throw new Error("build @truck/server first");

const target = execFileSync("rustc", ["-vV"], { encoding: "utf8" })
  .split("\n")
  .find((line) => line.startsWith("host:"))
  ?.replace("host:", "")
  .trim();
if (!target) throw new Error("could not read the rust host triple");

mkdirSync(binaries, { recursive: true });
const suffix = process.platform === "win32" ? ".exe" : "";
const outfile = join(binaries, `truck-save-server-${target}${suffix}`);

execFileSync("bun", ["build", "--compile", "--outfile", outfile, serverEntry], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

const size = statSync(outfile).size;
if (size < 1_000_000) throw new Error(`sidecar looks truncated: ${size} bytes`);
console.log(`sidecar ready: ${outfile} (${(size / 1048576).toFixed(0)} MB)`);
