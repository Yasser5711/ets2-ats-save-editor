/**
 * Collects the map items the game can mark as discovered, straight from the
 * installed game's map sectors.
 *
 * A sector's `.base` file is a list of items. Every item starts with the same
 * header - type, uid, a 5-axis bounding volume, flags, view distance - and
 * continues with a type-specific body whose layout changes between game
 * versions. Only the header matters here, so instead of decoding 40 item bodies
 * the scanner recognises headers by their shape: a small type id followed by a
 * bounding volume that is ordered, finite and lies around the sector the file
 * belongs to. The item count in the file header confirms nothing was missed.
 *
 * Checked against game 1.62 (map version 907): all 1148 sectors match their
 * item count, and none of the 80 000 uids a played save had discovered carries
 * the "hidden on the UI map" flag, so hidden items are left out.
 */
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { HashFs } from "./hashfs.ts";

const ITEMS_AT = 20;
const ITEM_HEAD = 57;
const MAX_TYPE = 63;
const TYPE_ROAD = 3;
const TYPE_PREFAB = 4;
const TYPE_MAP_AREA = 42;
const SECTOR_SIZE = 4000;
/** bit of the item flags that keeps an item off the UI map, per item type */
const HIDDEN_ON_UI_MAP: Record<number, number> = { [TYPE_ROAD]: 1 << 25, [TYPE_PREFAB]: 1 << 17 };
const SECTOR_FILE = /^sec([+-]\d{4})([+-]\d{4})\.base$/;

export interface SectorScan {
  /** items found, nested ones included, so this may exceed `declared` */
  found: number;
  /** item count stored in the sector header */
  declared: number;
}

export interface MapScan {
  /** uids in the decimal form `economy.discovered_items` uses */
  items: Set<string>;
  roads: number;
  prefabs: number;
  areas: number;
  sectors: number;
  /** sectors where fewer items were recognised than the header declares */
  unverified: number;
  archives: string[];
}

function isCoordinate(value: number): boolean {
  // integers read as floats come out as denormals, real coordinates never do
  return value === 0 || (Math.abs(value) > 1e-6 && Math.abs(value) < 1e7);
}

function isItemHead(base: Buffer, at: number, minX: number, minZ: number): boolean {
  let extent = 0;
  for (let axis = 0; axis < 5; axis++) {
    const low = base.readFloatLE(at + 12 + axis * 4);
    const high = base.readFloatLE(at + 32 + axis * 4);
    if (!(low <= high) || !isCoordinate(low) || !isCoordinate(high)) return false;
    extent += high - low;
  }
  if (extent === 0) return false;
  const x = (base.readFloatLE(at + 12) + base.readFloatLE(at + 32)) / 2;
  const z = (base.readFloatLE(at + 20) + base.readFloatLE(at + 40)) / 2;
  // an item is stored with the sector of its first node and may reach into a neighbour
  return (
    x >= minX - SECTOR_SIZE &&
    x <= minX + 2 * SECTOR_SIZE &&
    z >= minZ - SECTOR_SIZE &&
    z <= minZ + 2 * SECTOR_SIZE
  );
}

/** Adds the discoverable items of one `.base` file to `scan`. */
export function scanSector(base: Buffer, sectorX: number, sectorZ: number, scan: MapScan): SectorScan {
  const minX = sectorX * SECTOR_SIZE;
  const minZ = sectorZ * SECTOR_SIZE;
  const last = base.length - ITEM_HEAD;
  let found = 0;
  for (let at = ITEMS_AT; at <= last; at++) {
    const type = base[at];
    if (type === 0 || type > MAX_TYPE) continue;
    if (base[at + 1] !== 0 || base[at + 2] !== 0 || base[at + 3] !== 0) continue;
    if (!isItemHead(base, at, minX, minZ)) continue;
    found++;
    if (type !== TYPE_ROAD && type !== TYPE_PREFAB && type !== TYPE_MAP_AREA) continue;
    if ((base.readUInt32LE(at + 52) & (HIDDEN_ON_UI_MAP[type] ?? 0)) !== 0) continue;
    const uid = base.readBigUInt64LE(at + 4).toString();
    if (scan.items.has(uid)) continue;
    scan.items.add(uid);
    if (type === TYPE_ROAD) scan.roads++;
    else if (type === TYPE_PREFAB) scan.prefabs++;
    else scan.areas++;
  }
  return { found, declared: base.length >= ITEMS_AT ? base.readUInt32LE(16) : 0 };
}

/**
 * Scans every map sector of an installed game. `gameDir` is the folder holding
 * `base_map.scs`; map DLCs are picked up from their own archives.
 */
export function scanGameMap(gameDir: string): MapScan {
  if (!existsSync(gameDir)) throw new Error(`game folder ${gameDir} does not exist`);
  const scan: MapScan = {
    items: new Set(),
    roads: 0,
    prefabs: 0,
    areas: 0,
    sectors: 0,
    unverified: 0,
    archives: [],
  };
  for (const file of readdirSync(gameDir).toSorted()) {
    if (!file.endsWith(".scs")) continue;
    let archive: HashFs;
    try {
      archive = new HashFs(join(gameDir, file));
    } catch {
      continue; // zip-packed mods and pre-1.50 archives hold no sectors we can read
    }
    try {
      let sectors = 0;
      for (const map of archive.list("map")?.dirs ?? []) {
        for (const name of archive.list(`map/${map}`)?.files ?? []) {
          const coords = SECTOR_FILE.exec(name);
          const base = coords && archive.read(`map/${map}/${name}`);
          if (!coords || !base) continue;
          const result = scanSector(base, Number(coords[1]), Number(coords[2]), scan);
          if (result.found < result.declared) scan.unverified++;
          sectors++;
        }
      }
      if (sectors > 0) scan.archives.push(file);
      scan.sectors += sectors;
    } finally {
      archive.close();
    }
  }
  if (scan.sectors === 0) {
    throw new Error(`no map sectors under ${gameDir} - pick the folder that holds base_map.scs`);
  }
  return scan;
}
