/**
 * Read-only access to the game's `.scs` archives (HashFS v2, used since game 1.50).
 *
 * An archive is a flat table of entries keyed by the CityHash64 of their path;
 * directories are entries too, and their content lists the names of their
 * children. Layout verified against the 1.62 game files and
 * sk-zk/TruckLib.HashFs.
 */
import { closeSync, openSync, readSync } from "node:fs";
import { inflateSync } from "node:zlib";

const MASK = (1n << 64n) - 1n;
const K0 = 0xc3a5c85c97cb3127n;
const K1 = 0xb492b66fbe98f273n;
const K2 = 0x9ae16a3b2f90404fn;
const K3 = 0xc949d7c7509e6557n;
const K_MUL = 0x9ddfea08eb382d69n;

type Pair = [bigint, bigint];

const rotate = (v: bigint, shift: number): bigint =>
  shift === 0 ? v : ((v >> BigInt(shift)) | (v << BigInt(64 - shift))) & MASK;
const shiftMix = (v: bigint): bigint => v ^ (v >> 47n);
const fetch64 = (s: Buffer, at: number): bigint => s.readBigUInt64LE(at);
const fetch32 = (s: Buffer, at: number): bigint => BigInt(s.readUInt32LE(at));

function hashLen16(u: bigint, v: bigint): bigint {
  let a = ((u ^ v) * K_MUL) & MASK;
  a ^= a >> 47n;
  let b = ((v ^ a) * K_MUL) & MASK;
  b ^= b >> 47n;
  return (b * K_MUL) & MASK;
}

function weakHash(s: Buffer, at: number, seedA: bigint, seedB: bigint): Pair {
  const w = fetch64(s, at);
  const x = fetch64(s, at + 8);
  const y = fetch64(s, at + 16);
  const z = fetch64(s, at + 24);
  let a = (seedA + w) & MASK;
  let b = rotate((seedB + a + z) & MASK, 21);
  const c = a;
  a = (a + x + y) & MASK;
  b = (b + rotate(a, 44)) & MASK;
  return [(a + z) & MASK, (b + c) & MASK];
}

function hashUpTo16(s: Buffer): bigint {
  const n = s.length;
  const len = BigInt(n);
  if (n > 8) {
    const a = fetch64(s, 0);
    const b = fetch64(s, n - 8);
    return hashLen16(a, rotate((b + len) & MASK, n)) ^ b;
  }
  if (n >= 4) return hashLen16((len + (fetch32(s, 0) << 3n)) & MASK, fetch32(s, n - 4));
  if (n > 0) {
    const y = BigInt(s[0]) + (BigInt(s[n >> 1]) << 8n);
    const z = len + (BigInt(s[n - 1]) << 2n);
    return (shiftMix(((y * K2) & MASK) ^ ((z * K3) & MASK)) * K2) & MASK;
  }
  return K2;
}

function hash17To32(s: Buffer): bigint {
  const n = s.length;
  const a = (fetch64(s, 0) * K1) & MASK;
  const b = fetch64(s, 8);
  const c = (fetch64(s, n - 8) * K2) & MASK;
  const d = (fetch64(s, n - 16) * K0) & MASK;
  return hashLen16(
    (rotate((a - b) & MASK, 43) + rotate(c, 30) + d) & MASK,
    (a + rotate(b ^ K3, 20) - c + BigInt(n)) & MASK,
  );
}

function hash33To64(s: Buffer): bigint {
  const n = s.length;
  let z = fetch64(s, 24);
  let a = (fetch64(s, 0) + (BigInt(n) + fetch64(s, n - 16)) * K0) & MASK;
  let b = rotate((a + z) & MASK, 52);
  let c = rotate(a, 37);
  a = (a + fetch64(s, 8)) & MASK;
  c = (c + rotate(a, 7)) & MASK;
  a = (a + fetch64(s, 16)) & MASK;
  const vf = (a + z) & MASK;
  const vs = (b + rotate(a, 31) + c) & MASK;
  a = (fetch64(s, 16) + fetch64(s, n - 32)) & MASK;
  z = fetch64(s, n - 8);
  b = rotate((a + z) & MASK, 52);
  c = rotate(a, 37);
  a = (a + fetch64(s, n - 24)) & MASK;
  c = (c + rotate(a, 7)) & MASK;
  a = (a + fetch64(s, n - 16)) & MASK;
  const wf = (a + z) & MASK;
  const ws = (b + rotate(a, 31) + c) & MASK;
  const r = shiftMix(((vf + ws) * K2 + (wf + vs) * K0) & MASK);
  return (shiftMix((r * K0 + vs) & MASK) * K2) & MASK;
}

/** CityHash64 v1.0, the variant the game hashes archive paths with. */
export function cityHash64(s: Buffer): bigint {
  const n = s.length;
  if (n <= 16) return hashUpTo16(s);
  if (n <= 32) return hash17To32(s);
  if (n <= 64) return hash33To64(s);

  let x = fetch64(s, n - 40);
  let y = (fetch64(s, n - 16) + fetch64(s, n - 56)) & MASK;
  let z = hashLen16((fetch64(s, n - 48) + BigInt(n)) & MASK, fetch64(s, n - 24));
  let v = weakHash(s, n - 64, BigInt(n), z);
  let w = weakHash(s, n - 32, (y + K1) & MASK, x);
  x = (x * K1 + fetch64(s, 0)) & MASK;
  const end = (n - 1) & ~63;
  for (let at = 0; at < end; at += 64) {
    x = (rotate((x + y + v[0] + fetch64(s, at + 8)) & MASK, 37) * K1) & MASK;
    y = (rotate((y + v[1] + fetch64(s, at + 48)) & MASK, 42) * K1) & MASK;
    x ^= w[1];
    y = (y + v[0] + fetch64(s, at + 40)) & MASK;
    z = (rotate((z + w[0]) & MASK, 33) * K1) & MASK;
    v = weakHash(s, at, (v[1] * K1) & MASK, (x + w[0]) & MASK);
    w = weakHash(s, at + 32, (z + w[1]) & MASK, (y + fetch64(s, at + 16)) & MASK);
    [z, x] = [x, z];
  }
  return hashLen16(
    (hashLen16(v[0], w[0]) + ((shiftMix(y) * K1) & MASK) + z) & MASK,
    (hashLen16(v[1], w[1]) + x) & MASK,
  );
}

const HEADER_BYTES = 52;
const ENTRY_BYTES = 16;
const META_BLOCK = 4;
const DATA_BLOCK = 16;
const CHUNK_PLAIN = 128;
const CHUNK_DIRECTORY = 129;
const SIZE_MASK = 0x0fffffff;
const FLAG_ZLIB = 0x10000000;

interface Entry {
  offset: number;
  stored: number;
  compressed: boolean;
  directory: boolean;
}

export interface Listing {
  dirs: string[];
  files: string[];
}

export class HashFs {
  private readonly fd: number;
  private readonly salt: string;
  private readonly entries = new Map<bigint, Entry>();

  constructor(path: string) {
    this.fd = openSync(path, "r");
    try {
      const header = this.bytes(0, HEADER_BYTES);
      if (header.toString("latin1", 0, 4) !== "SCS#") throw new Error(`${path}: not an SCS archive`);
      const version = header.readUInt16LE(4);
      if (version !== 2) {
        throw new Error(`${path}: HashFS v${version} is not supported, the game must be 1.50 or newer`);
      }
      const salt = header.readUInt16LE(6);
      this.salt = salt === 0 ? "" : String(salt);
      const count = header.readUInt32LE(12);
      const table = inflateSync(this.bytes(Number(header.readBigUInt64LE(28)), header.readUInt32LE(16)));
      const meta = inflateSync(this.bytes(Number(header.readBigUInt64LE(36)), header.readUInt32LE(24)));
      for (let i = 0; i < count; i++) {
        const row = i * ENTRY_BYTES;
        const chunks = meta.readUInt32LE(table.readUInt32LE(row + 8) * META_BLOCK);
        const kind = chunks >>> 24;
        // textures and sounds carry extra chunks; nothing the editor reads uses them
        if (kind !== CHUNK_PLAIN && kind !== CHUNK_DIRECTORY) continue;
        const at = (table.readUInt32LE(row + 8) + table.readUInt16LE(row + 12)) * META_BLOCK;
        const packed = meta.readUInt32LE(at);
        this.entries.set(table.readBigUInt64LE(row), {
          offset: meta.readUInt32LE(at + 12) * DATA_BLOCK,
          stored: packed & SIZE_MASK,
          compressed: (packed & FLAG_ZLIB) !== 0,
          directory: kind === CHUNK_DIRECTORY,
        });
      }
    } catch (err) {
      closeSync(this.fd);
      throw err;
    }
  }

  close(): void {
    closeSync(this.fd);
  }

  /** Children of a directory, or null when the archive has no such directory. */
  list(dir: string): Listing | null {
    const entry = this.entry(dir);
    if (!entry || !entry.directory) return null;
    const raw = this.content(entry);
    const count = raw.readUInt32LE(0);
    const listing: Listing = { dirs: [], files: [] };
    let at = 4 + count;
    for (let i = 0; i < count; i++) {
      const length = raw[4 + i];
      const name = raw.toString("utf8", at, at + length);
      at += length;
      if (name.startsWith("/")) listing.dirs.push(name.slice(1));
      else listing.files.push(name);
    }
    return listing;
  }

  /** Content of a file, or null when the archive has no such file. */
  read(path: string): Buffer | null {
    const entry = this.entry(path);
    return entry && !entry.directory ? this.content(entry) : null;
  }

  private entry(path: string): Entry | undefined {
    return this.entries.get(cityHash64(Buffer.from(this.salt + path, "utf8")));
  }

  private content(entry: Entry): Buffer {
    const raw = this.bytes(entry.offset, entry.stored);
    return entry.compressed ? inflateSync(raw) : raw;
  }

  private bytes(position: number, length: number): Buffer {
    const buffer = Buffer.alloc(length);
    const read = readSync(this.fd, buffer, 0, length, position);
    if (read !== length) throw new Error(`archive is truncated at ${position}`);
    return buffer;
  }
}
