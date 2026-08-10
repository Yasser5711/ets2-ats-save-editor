import { createDecipheriv, createCipheriv } from "node:crypto";
import { inflateSync, deflateSync } from "node:zlib";

const SII_KEY = Buffer.from([
  0x2a, 0x5f, 0xcb, 0x17, 0x91, 0xd2, 0x2f, 0xb6, 0x02, 0x45, 0xb3, 0xd8, 0x36,
  0x9e, 0xd0, 0xb2, 0xc2, 0x73, 0x71, 0x56, 0x3f, 0xbf, 0x1f, 0x3c, 0x9e, 0xdf,
  0x6b, 0x11, 0x82, 0x5a, 0x5d, 0x0a,
]);

export type SiiKind = "encrypted" | "binary" | "text" | "3nk" | "unknown";

/** ScsC layout: magic(4) hmac(32) iv(16) plainSize(4) ciphertext(...) */
const HEADER_SIZE = 56;
const IV_OFFSET = 36;
const SIZE_OFFSET = 52;

export function detectKind(buf: Buffer): SiiKind {
  if (buf.length < 4) return "unknown";
  const magic = buf.subarray(0, 4).toString("latin1");
  if (magic === "ScsC") return "encrypted";
  if (magic === "BSII") return "binary";
  if (magic === "SiiN") return "text";
  if (magic.startsWith("3nK")) return "3nk";
  return "unknown";
}

export function decryptScsC(buf: Buffer): Buffer {
  if (detectKind(buf) !== "encrypted") throw new Error("not an ScsC file");
  if (buf.length < HEADER_SIZE) throw new Error("truncated ScsC header");
  const iv = buf.subarray(IV_OFFSET, IV_OFFSET + 16);
  const plainSize = buf.readUInt32LE(SIZE_OFFSET);
  const decipher = createDecipheriv("aes-256-cbc", SII_KEY, iv);
  decipher.setAutoPadding(false);
  const compressed = Buffer.concat([
    decipher.update(buf.subarray(HEADER_SIZE)),
    decipher.final(),
  ]);
  const out = inflateSync(compressed);
  if (out.length !== plainSize) {
    throw new Error(`size mismatch: header says ${plainSize}, inflated ${out.length}`);
  }
  return out;
}

/**
 * Re-packs a payload into an `ScsC` container. The HMAC field is not verified by
 * the game, so it is zero-filled. Only needed when a file must stay encrypted;
 * the games also load plain `SiiNunit` text.
 */
export function encryptScsC(payload: Buffer, iv = Buffer.alloc(16)): Buffer {
  const compressed = deflateSync(payload);
  const padLen = 16 - (compressed.length % 16 || 16);
  const padded =
    padLen === 16 ? compressed : Buffer.concat([compressed, Buffer.alloc(padLen)]);
  const cipher = createCipheriv("aes-256-cbc", SII_KEY, iv);
  cipher.setAutoPadding(false);
  const body = Buffer.concat([cipher.update(padded), cipher.final()]);
  const head = Buffer.alloc(HEADER_SIZE);
  head.write("ScsC", 0, "latin1");
  iv.copy(head, IV_OFFSET);
  head.writeUInt32LE(payload.length, SIZE_OFFSET);
  return Buffer.concat([head, body]);
}
