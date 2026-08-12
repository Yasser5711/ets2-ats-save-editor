/**
 * Decoder for SCS Software's binary SII format (`BSII`, versions 1-3) as used by
 * decrypted Euro Truck Simulator 2 / American Truck Simulator save files.
 *
 * Format reference: TheLazyTomcat/SII_Decrypt `Documents/Binary SII - Format.txt`
 * and `Documents/Binary SII - Types.txt`.
 */

import { namelessId } from "./ids.ts";
import type { FieldDef, Line, SiiDocument, StructDef, Unit } from "./model.ts";

const CHARS = "0123456789abcdefghijklmnopqrstuvwxyz_";

export const T = {
  String: 0x01,
  StringArray: 0x02,
  Token: 0x03,
  TokenArray: 0x04,
  Float: 0x05,
  FloatArray: 0x06,
  Float2: 0x07,
  Float2Array: 0x08,
  Float3: 0x09,
  Float3Array: 0x0a,
  Int3: 0x11,
  Int3Array: 0x12,
  Float4: 0x17,
  Float4Array: 0x18,
  Placement: 0x19,
  PlacementArray: 0x1a,
  Int32: 0x25,
  Int32Array: 0x26,
  UInt32: 0x27,
  UInt32Array: 0x28,
  Int16: 0x29,
  Int16Array: 0x2a,
  UInt16: 0x2b,
  UInt16Array: 0x2c,
  UInt32b: 0x2f,
  Int64: 0x31,
  Int64Array: 0x32,
  UInt64: 0x33,
  UInt64Array: 0x34,
  Bool: 0x35,
  BoolArray: 0x36,
  Ordinal: 0x37,
  IdA: 0x39,
  IdAArray: 0x3a,
  IdB: 0x3b,
  IdBArray: 0x3c,
  IdC: 0x3d,
  IdCArray: 0x3e,
} as const;

class Reader {
  pos = 0;
  buf: Buffer;
  constructor(buf: Buffer) {
    this.buf = buf;
  }
  u8() {
    return this.buf.readUInt8(this.pos++);
  }
  u16() {
    const v = this.buf.readUInt16LE(this.pos);
    this.pos += 2;
    return v;
  }
  i16() {
    const v = this.buf.readInt16LE(this.pos);
    this.pos += 2;
    return v;
  }
  u32() {
    const v = this.buf.readUInt32LE(this.pos);
    this.pos += 4;
    return v;
  }
  i32() {
    const v = this.buf.readInt32LE(this.pos);
    this.pos += 4;
    return v;
  }
  u64() {
    const v = this.buf.readBigUInt64LE(this.pos);
    this.pos += 8;
    return v;
  }
  i64() {
    const v = this.buf.readBigInt64LE(this.pos);
    this.pos += 8;
    return v;
  }
  f32() {
    const v = this.buf.readFloatLE(this.pos);
    this.pos += 4;
    return v;
  }
  str() {
    const len = this.u32();
    const s = this.buf.subarray(this.pos, this.pos + len).toString("utf8");
    this.pos += len;
    return s;
  }
  get eof() {
    return this.pos >= this.buf.length;
  }
}

/** Decodes a 64-bit token back into its identifier (base-38, low 63 bits). */
export function decodeToken(raw: bigint): string {
  let v = raw & 0x7fffffffffffffffn;
  let out = "";
  while (v !== 0n) {
    const idx = Number(v % 38n) - 1;
    v /= 38n;
    if (idx >= 0 && idx < CHARS.length) out += CHARS[idx];
  }
  return out;
}

export function formatFloat(v: number): string {
  if (Number.isNaN(v) || !Number.isFinite(v) || !Number.isInteger(v) || Math.abs(v) >= 1e7) {
    const b = Buffer.allocUnsafe(4);
    b.writeFloatLE(v, 0);
    return "&" + b.readUInt32LE(0).toString(16).padStart(8, "0");
  }
  return String(v);
}

function readId(r: Reader): string {
  const parts = r.u8();
  if (parts === 0xff) return namelessId(r.u64());
  if (parts === 0) return "null";
  const out: string[] = [];
  for (let i = 0; i < parts; i++) out.push(decodeToken(r.u64()));
  return out.join(".");
}

const BARE_STRING = /^[A-Za-z_][0-9A-Za-z_]*$|^-?\d+$/;

export function formatString(s: string): string {
  return BARE_STRING.test(s) ? s : JSON.stringify(s);
}

/**
 * An all-ones unsigned value is the game's "unset" marker and is written as
 * `nil` in text form (SII_Decrypt `SII_Decode_ValueNode_0000002B/27/33.pas`).
 */
function uintText(v: number | bigint, allOnes: number | bigint): string {
  return v === allOnes ? "nil" : String(v);
}

function readValue(r: Reader, f: FieldDef, version: number, lines: Line[]): void {
  const push = (value: string, index: number | null = null): void => {
    lines.push({ key: f.name, index, value });
  };
  const arr = (n: number, read: (i: number) => string) => {
    push(String(n));
    for (let i = 0; i < n; i++) push(read(i), i);
  };
  const f3 = () => `(${formatFloat(r.f32())}, ${formatFloat(r.f32())}, ${formatFloat(r.f32())})`;
  const f4 = () =>
    `(${formatFloat(r.f32())}; ${formatFloat(r.f32())}, ${formatFloat(r.f32())}, ${formatFloat(r.f32())})`;
  const placement = () => {
    const x = r.f32();
    const y = r.f32();
    const z = r.f32();
    let px = x;
    let pz = z;
    if (version > 1) {
      const bias = BigInt(Math.trunc(r.f32()));
      px += Number(((bias & 0xfffn) - 2048n) << 9n);
      pz += Number((((bias >> 12n) & 0xfffn) - 2048n) << 9n);
    }
    const q = [r.f32(), r.f32(), r.f32(), version > 1 ? r.f32() : 0];
    return (
      `(${formatFloat(px)}, ${formatFloat(y)}, ${formatFloat(pz)})` +
      ` (${formatFloat(q[0])}; ${formatFloat(q[1])}, ${formatFloat(q[2])}, ${formatFloat(q[3])})`
    );
  };

  switch (f.type) {
    case T.String:
      return push(formatString(r.str()));
    case T.StringArray:
      return arr(r.u32(), () => formatString(r.str()));
    case T.Token:
      return push(decodeToken(r.u64()) || '""');
    case T.TokenArray:
      return arr(r.u32(), () => decodeToken(r.u64()) || '""');
    case T.Float:
      return push(formatFloat(r.f32()));
    case T.FloatArray:
      return arr(r.u32(), () => formatFloat(r.f32()));
    case T.Float2:
      return push(`(${formatFloat(r.f32())}, ${formatFloat(r.f32())})`);
    case T.Float2Array:
      return arr(r.u32(), () => `(${formatFloat(r.f32())}, ${formatFloat(r.f32())})`);
    case T.Float3:
      return push(f3());
    case T.Float3Array:
      return arr(r.u32(), f3);
    case T.Int3:
      return push(`(${r.i32()}, ${r.i32()}, ${r.i32()})`);
    case T.Int3Array:
      return arr(r.u32(), () => `(${r.i32()}, ${r.i32()}, ${r.i32()})`);
    case T.Float4:
      return push(f4());
    case T.Float4Array:
      return arr(r.u32(), f4);
    case T.Placement:
      return push(placement());
    case T.PlacementArray:
      return arr(r.u32(), placement);
    case T.Int32:
      return push(String(r.i32()));
    case T.Int32Array:
      return arr(r.u32(), () => String(r.i32()));
    case T.UInt32:
    case T.UInt32b:
      return push(uintText(r.u32(), 0xffffffff));
    case T.UInt32Array:
      return arr(r.u32(), () => uintText(r.u32(), 0xffffffff));
    case T.Int16:
      return push(String(r.i16()));
    case T.Int16Array:
      return arr(r.u32(), () => String(r.i16()));
    case T.UInt16:
      return push(uintText(r.u16(), 0xffff));
    case T.UInt16Array:
      return arr(r.u32(), () => uintText(r.u16(), 0xffff));
    case T.Int64:
      return push(String(r.i64()));
    case T.Int64Array:
      return arr(r.u32(), () => String(r.i64()));
    case T.UInt64:
      return push(uintText(r.u64(), 0xffffffffffffffffn));
    case T.UInt64Array:
      return arr(r.u32(), () => uintText(r.u64(), 0xffffffffffffffffn));
    case T.Bool:
      return push(r.u8() !== 0 ? "true" : "false");
    case T.BoolArray:
      return arr(r.u32(), () => (r.u8() !== 0 ? "true" : "false"));
    case T.Ordinal:
      return push(f.ordinals?.get(r.u32()) ?? "");
    case T.IdA:
    case T.IdB:
    case T.IdC:
      return push(readId(r));
    case T.IdAArray:
    case T.IdBArray:
    case T.IdCArray:
      return arr(r.u32(), () => readId(r));
    default:
      throw new Error(`unsupported BSII value type 0x${f.type.toString(16)} (field ${f.name})`);
  }
}

export function decodeBsii(buf: Buffer): SiiDocument {
  const r = new Reader(buf);
  if (buf.subarray(0, 4).toString("latin1") !== "BSII") throw new Error("not a BSII payload");
  r.pos = 4;
  const version = r.u32();
  if (version < 1 || version > 3) throw new Error(`unsupported BSII version ${version}`);

  const structs = new Map<number, StructDef>();
  const units: Unit[] = [];

  let terminated = false;
  while (!r.eof) {
    const blockType = r.u32();
    if (blockType === 0) {
      if (r.u8() === 0) {
        terminated = true; // invalid structure block marks end of stream
        break;
      }
      const id = r.u32();
      const name = r.str();
      const fields: FieldDef[] = [];
      for (;;) {
        const type = r.u32();
        if (type === 0) break;
        const fname = r.str();
        const def: FieldDef = { name: fname, type };
        if (type === T.Ordinal) {
          const n = r.u32();
          const map = new Map<number, string>();
          for (let i = 0; i < n; i++) map.set(r.u32(), r.str());
          def.ordinals = map;
        }
        fields.push(def);
      }
      structs.set(id, { id, name, fields });
    } else {
      const def = structs.get(blockType);
      if (!def) throw new Error(`data block references unknown structure ${blockType}`);
      const unit: Unit = { cls: def.name, id: readId(r), lines: [] };
      for (const f of def.fields) readValue(r, f, version, unit.lines);
      units.push(unit);
    }
  }
  if (!terminated) throw new Error("BSII stream ended without a terminator block");
  if (r.pos !== buf.length) {
    throw new Error(`decoder desync: ${buf.length - r.pos} bytes left after terminator`);
  }
  return { version, units, structs: [...structs.values()] };
}
