
export interface Line {
  key: string;
  index: number | null;
  value: string;
}

export interface Unit {
  cls: string;
  id: string;
  lines: Line[];
}
export interface SiiDocument {
  units: Unit[];
  version?: number;
  structs?: StructDef[];
}

export interface FieldDef {
  name: string;
  type: number;
  ordinals?: Map<number, string>;
}

export interface StructDef {
  id: number;
  name: string;
  fields: FieldDef[];
}

const UNIT_HEADER = /^\s*([\w.]+)\s*:\s*(\S+)\s*\{\s*$/;
const FIELD = /^\s*([\w.]+)(?:\[(\d*)\])?\s*:\s*(.*?)\s*$/;

export function parseSii(text: string): SiiDocument {
  const units: Unit[] = [];
  let current: Unit | null = null;
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.replace(/^\s+/, "");
    if (line === "" || line === "{" || line === "}" || line === "SiiNunit") {
      if (line === "}" && current) current = null;
      continue;
    }
    if (line.startsWith("#") || line.startsWith("//")) continue;
    const header = UNIT_HEADER.exec(line);
    if (header) {
      current = { cls: header[1], id: header[2], lines: [] };
      units.push(current);
      continue;
    }
    const field = FIELD.exec(line);
    if (!field) throw new Error(`unparsable SII line ${i + 1}: ${raw}`);
    if (!current) throw new Error(`field outside of a unit on line ${i + 1}: ${raw}`);
    current.lines.push({
      key: field[1],
      index: field[2] === undefined || field[2] === "" ? null : Number(field[2]),
      value: field[3],
    });
  }
  return { units };
}

export function stringifySii(doc: SiiDocument): string {
  const out: string[] = ["SiiNunit", "{"];
  for (const u of doc.units) {
    out.push(`${u.cls} : ${u.id} {`);
    for (const l of u.lines) {
      out.push(` ${l.key}${l.index === null ? "" : `[${l.index}]`}: ${l.value}`);
    }
    out.push("}", "");
  }
  out.push("}", "");
  return out.join("\r\n");
}

export class SiiIndex {
  readonly doc: SiiDocument;
  private byClass = new Map<string, Unit[]>();
  private byId = new Map<string, Unit>();

  constructor(doc: SiiDocument) {
    this.doc = doc;
    for (const u of doc.units) {
      const bucket = this.byClass.get(u.cls);
      if (bucket) bucket.push(u);
      else this.byClass.set(u.cls, [u]);
      this.byId.set(u.id, u);
    }
  }

  all(cls: string): Unit[] {
    return this.byClass.get(cls) ?? [];
  }

  one(cls: string): Unit {
    const found = this.all(cls);
    if (found.length !== 1) {
      throw new Error(`expected exactly one '${cls}' unit, found ${found.length}`);
    }
    return found[0];
  }

  byIdOrNull(id: string): Unit | null {
    return this.byId.get(id) ?? null;
  }

  follow(unit: Unit, key: string): Unit {
    const target = get(unit, key);
    const found = this.byId.get(target);
    if (!found) throw new Error(`${unit.cls}.${key} points at unknown unit '${target}'`);
    return found;
  }
}

export function find(unit: Unit, key: string): Line | null {
  for (const l of unit.lines) if (l.key === key && l.index === null) return l;
  return null;
}

export function get(unit: Unit, key: string): string {
  const line = find(unit, key);
  if (!line) throw new Error(`unit '${unit.cls}' has no field '${key}'`);
  return line.value;
}

/**
 * Overwrites an existing scalar field. Refuses to create new fields: the game
 * ignores unknown keys at best and rejects the unit at worst.
 */
export function set(unit: Unit, key: string, value: string | number | boolean): string {
  const line = find(unit, key);
  if (!line) throw new Error(`unit '${unit.cls}' has no field '${key}'`);
  const before = line.value;
  line.value = String(value);
  return before;
}

export function getArray(unit: Unit, key: string): string[] {
  const members = unit.lines.filter((l) => l.key === key && l.index !== null);
  const out: string[] = [];
  for (const m of members) out[m.index as number] = m.value;
  return out;
}

export function setArray(unit: Unit, key: string, values: string[]): void {
  const at = unit.lines.findIndex((l) => l.key === key);
  if (at < 0) throw new Error(`unit '${unit.cls}' has no field '${key}'`);
  const kept = unit.lines.filter((l) => l.key !== key);
  const fresh: Line[] = [{ key, index: null, value: String(values.length) }];
  values.forEach((v, i) => fresh.push({ key, index: i, value: v }));
  const tailStart = unit.lines.slice(0, at).filter((l) => l.key !== key).length;
  unit.lines = [...kept.slice(0, tailStart), ...fresh, ...kept.slice(tailStart)];
}
