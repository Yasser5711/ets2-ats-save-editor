import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SIZE = 1024;
const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, "../icon-source.png");

const BACKDROP = [18, 21, 27];
const AMBER = [245, 159, 10];
const CAB = [232, 236, 243];

const inRoundedRect = (x, y, left, top, width, height, radius) => {
  if (x < left || y < top || x > left + width || y > top + height) return false;
  const dx = Math.max(left + radius - x, 0, x - (left + width - radius));
  const dy = Math.max(top + radius - y, 0, y - (top + height - radius));
  return dx * dx + dy * dy <= radius * radius;
};

const rows = [];
for (let y = 0; y < SIZE; y++) {
  const row = Buffer.alloc(SIZE * 4 + 1);
  row[0] = 0;
  for (let x = 0; x < SIZE; x++) {
    let colour = [0, 0, 0];
    let alpha = 0;
    if (inRoundedRect(x, y, 40, 40, SIZE - 80, SIZE - 80, 200)) {
      colour = BACKDROP;
      alpha = 255;
      // trailer box
      if (inRoundedRect(x, y, 200, 380, 360, 250, 28)) colour = AMBER;
      // cab
      if (inRoundedRect(x, y, 590, 440, 230, 190, 34)) colour = CAB;
      // windshield cut
      if (inRoundedRect(x, y, 700, 470, 95, 70, 18)) colour = BACKDROP;
      // wheels
      const wheels = [
        [300, 680],
        [470, 680],
        [700, 680],
      ];
      for (const [cx, cy] of wheels) {
        const d = (x - cx) ** 2 + (y - cy) ** 2;
        if (d <= 74 ** 2) colour = CAB;
        if (d <= 34 ** 2) colour = BACKDROP;
      }
      // road
      if (inRoundedRect(x, y, 200, 800, 620, 26, 13)) colour = AMBER;
    }
    const at = 1 + x * 4;
    row[at] = colour[0];
    row[at + 1] = colour[1];
    row[at + 2] = colour[2];
    row[at + 3] = alpha;
  }
  rows.push(row);
}

const chunk = (type, data) => {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crcTable = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crcTable[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const byte of body) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE((crc ^ 0xffffffff) >>> 0, 0);
  return Buffer.concat([length, body, crcBuf]);
};

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8;
ihdr[9] = 6;
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(Buffer.concat(rows), { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, png);
console.log(`icon source written: ${out} (${(png.length / 1024).toFixed(0)} KB)`);
