import { execFile } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { find, loadSii } from "@truck/core";

export interface GameDef {
  id: "ets2" | "ats";
  name: string;
  docsFolder: string;
  process: string;
}

export const GAMES: GameDef[] = [
  {
    id: "ets2",
    name: "Euro Truck Simulator 2",
    docsFolder: "Euro Truck Simulator 2",
    process: "eurotrucks2.exe",
  },
  {
    id: "ats",
    name: "American Truck Simulator",
    docsFolder: "American Truck Simulator",
    process: "amtrucks.exe",
  },
];

export interface GameRoot {
  id: string;
  name: string;
  path: string;
  running: boolean;
}

export interface SaveSlot {
  slot: string;
  path: string;
  name: string;
  modified: string;
  bytes: number;
  encrypted: boolean;
}

export interface Profile {
  dir: string;
  name: string;
  steam: boolean;
  path: string;
  slots: SaveSlot[];
}

function docsCandidates(): string[] {
  const home = homedir();
  return [join(home, "Documents"), join(home, "OneDrive", "Documents"), join(home, "OneDrive", "Documenti")];
}

export function detectRoots(): GameRoot[] {
  const found: GameRoot[] = [];
  for (const docs of docsCandidates()) {
    for (const game of GAMES) {
      const path = join(docs, game.docsFolder);
      if (existsSync(join(path, "profiles")) || existsSync(join(path, "steam_profiles"))) {
        found.push({ id: game.id, name: game.name, path, running: false });
      }
    }
  }
  return found;
}
export async function isRunning(gameId: string): Promise<boolean> {
  const game = GAMES.find((g) => g.id === gameId);
  if (!game || process.platform !== "win32") return false;
  const { promise, resolve } = Promise.withResolvers<boolean>();
  execFile("tasklist", ["/fi", `imagename eq ${game.process}`, "/nh"], (err, stdout) => {
    resolve(!err && stdout.toLowerCase().includes(game.process.toLowerCase()));
  });
  return promise;
}

function decodeProfileName(dir: string): string {
  if (!/^[0-9A-Fa-f]+$/.test(dir) || dir.length % 2 !== 0) return dir;
  return Buffer.from(dir, "hex").toString("utf8");
}

function readSlots(profileDir: string): SaveSlot[] {
  const saveDir = join(profileDir, "save");
  if (!existsSync(saveDir)) return [];
  const slots: SaveSlot[] = [];
  for (const slot of readdirSync(saveDir)) {
    const gamePath = join(saveDir, slot, "game.sii");
    if (!existsSync(gamePath)) continue;
    const stat = statSync(gamePath);
    let name = slot;
    let encrypted = true;
    try {
      const info = loadSii(join(saveDir, slot, "info.sii"));
      const container = info.doc.units[0];
      const raw = container ? find(container, "name")?.value : undefined;
      if (raw) name = raw.startsWith('"') ? raw.slice(1, -1) : raw;
      encrypted = info.kind === "encrypted";
    } catch {
      name = slot;
    }
    slots.push({
      slot,
      path: join(saveDir, slot),
      name,
      modified: stat.mtime.toISOString(),
      bytes: stat.size,
      encrypted,
    });
  }
  return slots.toSorted((a, b) => b.modified.localeCompare(a.modified));
}

export function listProfiles(root: string): Profile[] {
  const profiles: Profile[] = [];
  for (const folder of ["profiles", "steam_profiles"]) {
    const dir = join(root, folder);
    if (!existsSync(dir)) continue;
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (!statSync(path).isDirectory()) continue;
      profiles.push({
        dir: entry,
        name: decodeProfileName(entry),
        steam: folder === "steam_profiles",
        path,
        slots: readSlots(path),
      });
    }
  }
  return profiles;
}

export interface LogIssue {
  time: string;
  text: string;
  hint: string | null;
}

const HINTS: [RegExp, string][] = [
  [
    /Index outside array boundaries.*driver_u/i,
    "A garage has status > 0 with empty driver slots. Re-apply the garage change so slot counts match the size.",
  ],
  [/Index outside array boundaries/i, "An array in the save is shorter than the game expects for that unit."],
  [/Failed to (open|load) save/i, "The save file is malformed; restore the backup for that slot."],
  [/unknown unit/i, "A unit references a class the installed DLC/mods do not provide."],
  [/Multiple bus stop items/i, "Harmless map-data warning from the bus DLC, unrelated to save editing."],
];

export function readGameLog(root: string, limit = 40): LogIssue[] {
  const path = join(root, "game.log.txt");
  if (!existsSync(path)) return [];
  const text = readFileSync(path, "utf8");
  const issues: LogIssue[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!/<ERROR>|<FATAL>/.test(line)) continue;
    const [time, ...rest] = line.split(" : ");
    const body = rest.join(" : ");
    issues.push({
      time: time.trim(),
      text: body.replace(/^<\w+>\s*/, ""),
      hint: HINTS.find(([re]) => re.test(body))?.[1] ?? null,
    });
  }
  return issues.slice(-limit).toReversed();
}
