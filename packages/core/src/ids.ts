import type { SiiDocument } from "./model.ts";

const NAMELESS = /^_nameless\.([0-9a-f.]+)$/;

export function namelessValue(id: string): bigint | null {
  const m = NAMELESS.exec(id);
  if (!m) return null;
  let v = 0n;
  for (const group of m[1].split(".")) v = (v << 16n) | BigInt(parseInt(group, 16));
  return v;
}

export function namelessId(value: bigint): string {
  const groups: string[] = [];
  for (let shift = 48n; shift >= 0n; shift -= 16n) {
    const g = Number((value >> shift) & 0xffffn);
    if (groups.length === 0) {
      if (g === 0 && shift > 0n) continue;
      groups.push(g.toString(16));
    } else {
      groups.push(g.toString(16).padStart(4, "0"));
    }
  }
  return "_nameless." + groups.join(".");
}

/**
 * Hands out ids above every id already present in the document, so cloned units
 * can never collide with the game's own pointers. Ids are spaced like real
 * allocations to stay recognisable while diffing a save.
 */
export class IdAllocator {
  private next: bigint;

  constructor(doc: SiiDocument) {
    let max = 0n;
    for (const u of doc.units) {
      const v = namelessValue(u.id);
      if (v !== null && v > max) max = v;
    }
    this.next = ((max >> 8n) + 1n) << 8n;
  }

  take(): string {
    const id = namelessId(this.next);
    this.next += 0x10n;
    return id;
  }
}
