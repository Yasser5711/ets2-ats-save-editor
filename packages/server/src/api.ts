import { copyFileSync, existsSync, mkdirSync, readdirSync, rmdirSync, statSync, unlinkSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { detectRoots, isRunning, listProfiles, readGameLog, GAMES } from "./games.ts";
import { allCities, applyPlan, discoverySummary, type EditPlan, GARAGE_CAPACITY, get, getArray, loadSii, mergeDiscovery, saveSiiAsText, set, type SiiDocument, SiiIndex, staffGarages, type StaffOptions, stringifySii, summarize, type Unit, validate, visitAllCities } from "@truck/core";

export interface FieldEdit {
  unitId: string;
  key: string;
  value: string;
}

export interface Ops {
  edits?: EditPlan;
  visitAllCities?: boolean;
  importDiscovery?: string;
  staff?: StaffOptions | null;
  fields?: FieldEdit[];
}

export interface GarageRow {
  id: string;
  city: string;
  status: string;
  capacity: number;
  trucks: number;
  drivers: number;
}

export interface TruckRow {
  id: string;
  model: string;
  garage: string;
  driver: string | null;
  odometer: string;
  wear: number;
  fuel: number;
}

const MODEL = /^\/def\/vehicle\/truck\/([^/]+)\/data\.sii$/;

function unquote(value: string): string {
  return value.startsWith('"') ? value.slice(1, -1) : value;
}

function truckModel(idx: SiiIndex, truck: Unit): string {
  for (const accId of getArray(truck, "accessories")) {
    const acc = idx.byIdOrNull(accId);
    if (!acc) continue;
    const path = unquote(acc.lines.find((l) => l.key === "data_path")?.value ?? "");
    const m = MODEL.exec(path);
    if (m) return m[1];
  }
  return "unknown";
}

function wearOf(truck: Unit): number {
  let worst = 0;
  for (const key of ["engine_wear", "transmission_wear", "cabin_wear", "chassis_wear"]) {
    const line = truck.lines.find((l) => l.key === key && l.index === null);
    if (!line) continue;
    worst = Math.max(worst, parseFloatValue(line.value));
  }
  return worst;
}

function parseFloatValue(raw: string): number {
  if (raw.startsWith("&")) {
    const buf = Buffer.alloc(4);
    buf.writeUInt32LE(parseInt(raw.slice(1), 16), 0);
    return buf.readFloatLE(0);
  }
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export function saveDetail(path: string) {
  const loaded = loadSii(join(path, "game.sii"));
  const idx = new SiiIndex(loaded.doc);
  const economy = idx.one("economy");
  const player = idx.follow(economy, "player");
  const garages: GarageRow[] = [];
  const driverByTruck = new Map<string, string>();
  const garageByTruck = new Map<string, string>();

  for (const g of idx.all("garage")) {
    const status = get(g, "status");
    const vehicles = getArray(g, "vehicles");
    const drivers = getArray(g, "drivers");
    vehicles.forEach((truck, i) => {
      if (truck === "null") return;
      garageByTruck.set(truck, g.id.replace(/^garage\./, ""));
      if (drivers[i] && drivers[i] !== "null") driverByTruck.set(truck, drivers[i]);
    });
    garages.push({
      id: g.id,
      city: g.id.replace(/^garage\./, ""),
      status,
      capacity: GARAGE_CAPACITY[status] ?? 0,
      trucks: vehicles.filter((v) => v !== "null").length,
      drivers: drivers.filter((d) => d !== "null").length,
    });
  }

  const trucks: TruckRow[] = [];
  for (const id of getArray(player, "trucks")) {
    const truck = idx.byIdOrNull(id);
    if (!truck) continue;
    trucks.push({
      id,
      model: truckModel(idx, truck),
      garage: garageByTruck.get(id) ?? "-",
      driver: driverByTruck.get(id) ?? null,
      odometer: get(truck, "odometer"),
      wear: wearOf(truck),
      fuel: parseFloatValue(get(truck, "fuel_relative")),
    });
  }

  return {
    path,
    container: `${loaded.kind} -> ${loaded.inner}`,
    units: loaded.doc.units.length,
    summary: summarize(loaded.doc),
    discovery: discoverySummary(loaded.doc),
    cities: allCities(loaded.doc).length,
    drivers: getArray(player, "drivers").length,
    driverPool: getArray(economy, "driver_pool").length,
    garages: garages.sort((a, b) => a.city.localeCompare(b.city)),
    trucks: trucks.sort((a, b) => a.garage.localeCompare(b.garage)),
    problems: validate(loaded.doc),
  };
}

function runOps(doc: SiiDocument, ops: Ops): string[] {
  const log: string[] = [];
  if (ops.edits) log.push(...applyPlan(doc, ops.edits));
  if (ops.visitAllCities) log.push(...visitAllCities(doc));
  if (ops.importDiscovery) {
    log.push(...mergeDiscovery(doc, loadSii(ops.importDiscovery).doc));
  }
  if (ops.staff) log.push(...staffGarages(doc, ops.staff));
  for (const edit of ops.fields ?? []) {
    const unit = new SiiIndex(doc).byIdOrNull(edit.unitId);
    if (!unit) throw new Error(`unit ${edit.unitId} not found`);
    const before = set(unit, edit.key, edit.value);
    log.push(`${unit.cls} ${unit.id}.${edit.key}: ${before} -> ${edit.value}`);
  }
  return log;
}

export function planOps(path: string, ops: Ops) {
  const loaded = loadSii(join(path, "game.sii"));
  const before = loaded.doc.units.length;
  const log = runOps(loaded.doc, ops);
  return {
    log,
    problems: validate(loaded.doc),
    unitsBefore: before,
    unitsAfter: loaded.doc.units.length,
    summary: summarize(loaded.doc),
    discovery: discoverySummary(loaded.doc),
  };
}

export function backupsOf(slotPath: string): { file: string; modified: string; bytes: number }[] {
  const dir = join(slotPath, "backups");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".sii"))
    .map((f) => {
      const stat = statSync(join(dir, f));
      return { file: f, modified: stat.mtime.toISOString(), bytes: stat.size };
    })
    .sort((a, b) => b.modified.localeCompare(a.modified));
}

function backupSlot(slotPath: string): string {
  const dir = join(slotPath, "backups");
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const target = join(dir, `game-${stamp}.sii`);
  copyFileSync(join(slotPath, "game.sii"), target);
  return target;
}

export function cloneSlot(srcSlot: string, name: string): string {
  const saveDir = dirname(srcSlot);
  let n = 2;
  while (existsSync(join(saveDir, String(n)))) n++;
  const dest = join(saveDir, String(n));
  mkdirSync(dest, { recursive: true });
  for (const file of readdirSync(srcSlot)) {
    const from = join(srcSlot, file);
    if (statSync(from).isDirectory()) continue;
    copyFileSync(from, join(dest, file));
  }
  const info = loadSii(join(dest, "info.sii"));
  set(info.doc.units[0], "name", JSON.stringify(name));
  saveSiiAsText(join(dest, "info.sii"), info.doc, false);
  return dest;
}

export function applyOps(path: string, ops: Ops, options: { cloneAs?: string } = {}) {
  const target = options.cloneAs ? cloneSlot(path, options.cloneAs) : path;
  const gamePath = join(target, "game.sii");
  const loaded = loadSii(gamePath);
  const log = runOps(loaded.doc, ops);
  const problems = validate(loaded.doc);
  if (problems.length > 0) {
    if (options.cloneAs) removeSlot(target);
    return { written: false, target, log, problems };
  }
  const backup = options.cloneAs ? null : backupSlot(target);
  saveSiiAsText(gamePath, loaded.doc, false);
  return { written: true, target, log, problems, backup: backup && basename(backup) };
}

export function restoreBackup(slotPath: string, file: string): void {
  const source = join(slotPath, "backups", basename(file));
  if (!existsSync(source)) throw new Error(`backup ${file} not found`);
  copyFileSync(source, join(slotPath, "game.sii"));
}

function removeSlot(dir: string): void {
  for (const file of readdirSync(dir)) {
    const path = join(dir, file);
    if (statSync(path).isDirectory()) removeSlot(path);
    else unlinkSync(path);
  }
  rmdirSync(dir);
}

export function searchUnits(path: string, query: string, limit = 200) {
  const loaded = loadSii(join(path, "game.sii"));
  const q = query.trim().toLowerCase();
  const hits: { cls: string; id: string; lines: { key: string; index: number | null; value: string }[] }[] = [];
  for (const unit of loaded.doc.units) {
    if (hits.length >= limit) break;
    if (q !== "" && !unit.cls.toLowerCase().includes(q) && !unit.id.toLowerCase().includes(q)) continue;
    hits.push({ cls: unit.cls, id: unit.id, lines: unit.lines.slice(0, 120) });
  }
  return { total: loaded.doc.units.length, hits };
}

export function exportText(path: string): string {
  return stringifySii(loadSii(join(path, "game.sii")).doc);
}

export async function environment() {
  const roots = detectRoots();
  for (const root of roots) root.running = await isRunning(root.id);
  return { roots, games: GAMES.map((g) => ({ id: g.id, name: g.name })) };
}

export { listProfiles, readGameLog };
