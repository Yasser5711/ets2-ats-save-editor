import { expect, test } from "vitest";
import { cityHash64 } from "../src/hashfs.ts";
import { scanSector, type MapScan } from "../src/mapdata.ts";

const hash = (path: string) => cityHash64(Buffer.from(path, "utf8"));

// Archive entries are found by the hash of their path alone, so one wrong bit
// makes every map sector "missing". The values were taken from a hasher that
// resolves all 68 371 paths listed in the 1.62 def.scs; each one exercises a
// different length branch of the algorithm.
test("cityHash64 matches the hashes the game stores for archive paths", () => {
  expect(hash("")).toBe(0x9ae16a3b2f90404fn);
  expect(hash("abc")).toBe(0x3a912f483a4ece31n);
  expect(hash("map/europe/sec+0014+0012.base")).toBe(0x3cf62bee5393075fn);
  expect(hash("def/vehicle/truck/scania.streamline/data.sii")).toBe(0xc1ed20a385a5d9d8n);
  expect(hash("def/vehicle/truck/scania.streamline/accessory/exhaust_l/shape2.sii")).toBe(
    0x2875a25db6a60e50n,
  );
});

const ROAD = 3;
const PREFAB = 4;
const MODEL = 5;
const MAP_AREA = 42;

interface Item {
  type: number;
  uid: bigint;
  flags?: number;
  /** x/z of the item, in world units */
  at?: [number, number];
}

/** A `.base` file as the game lays it out: 20 header bytes, then items with opaque bodies. */
function sector(items: Item[], declared = items.length): Buffer {
  const header = Buffer.alloc(20);
  header.writeUInt32LE(907, 0);
  header.writeUInt32LE(declared, 16);
  const parts = [header];
  for (const item of items) {
    const [x, z] = item.at ?? [8100, 4200];
    const head = Buffer.alloc(57);
    head.writeUInt32LE(item.type, 0);
    head.writeBigUInt64LE(item.uid, 4);
    [x - 10, 30, z - 10, x + z - 20, x - z - 20].forEach((low, axis) => head.writeFloatLE(low, 12 + axis * 4));
    [x + 10, 40, z + 10, x + z + 20, x - z + 20].forEach((high, axis) => head.writeFloatLE(high, 32 + axis * 4));
    head.writeUInt32LE(item.flags ?? 0, 52);
    // bodies are full of small integers and tokens, which must not read as items
    const body = Buffer.alloc(64);
    for (let i = 0; i < 16; i++) body.writeUInt32LE(i % 5, i * 4);
    parts.push(head, body);
  }
  return Buffer.concat(parts);
}

function emptyScan(): MapScan {
  return { items: new Set(), roads: 0, prefabs: 0, areas: 0, sectors: 0, unverified: 0, archives: [] };
}

test("a sector scan keeps what shows on the UI map and counts every item it walked past", () => {
  const scan = emptyScan();
  const result = scanSector(
    sector([
      { type: ROAD, uid: 0x2935de0f802e0c00n },
      { type: ROAD, uid: 0x2935de0f802e0c01n, flags: 1 << 25 }, // hidden on the UI map
      { type: PREFAB, uid: 0x2935de0f802e0c02n, flags: 1 << 25 }, // bit 25 means nothing for a prefab
      { type: PREFAB, uid: 0x2935de0f802e0c03n, flags: 1 << 17 }, // hidden on the UI map
      { type: MAP_AREA, uid: 0x2935de0f802e0c04n },
      { type: MODEL, uid: 0x2935de0f802e0c05n },
    ]),
    2,
    1,
    scan,
  );
  expect(result).toEqual({ found: 6, declared: 6 });
  expect([...scan.items].toSorted()).toEqual(
    [0x2935de0f802e0c00n, 0x2935de0f802e0c02n, 0x2935de0f802e0c04n].map(String),
  );
  expect([scan.roads, scan.prefabs, scan.areas]).toEqual([1, 1, 1]);
});

test("a sector scan ignores bytes that only look like an item from far away", () => {
  const scan = emptyScan();
  // the same items, but lying 40 km outside the sector the file claims to be
  const result = scanSector(sector([{ type: ROAD, uid: 7n, at: [48_100, 4200] }]), 2, 1, scan);
  expect(result).toEqual({ found: 0, declared: 1 });
  expect(scan.items.size).toBe(0);
});
