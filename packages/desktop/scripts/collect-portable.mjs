import { copyFileSync, mkdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const suffix = process.platform === "win32" ? ".exe" : "";
const built = resolve(here, `../src-tauri/target/release/truck-save-editor${suffix}`);
const release = resolve(here, "../../../release");
const portable = join(release, `truck-save-editor${suffix}`);

// the app alone is a few MB; anything that small was built without the server inside
const size = statSync(built).size;
if (size < 20_000_000) throw new Error(`${built} has no embedded server: ${size} bytes`);

mkdirSync(release, { recursive: true });
copyFileSync(built, portable);
console.log(`portable app ready: ${portable} (${(size / 1048576).toFixed(0)} MB)`);
