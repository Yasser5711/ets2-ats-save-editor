import { expect, test } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { decodeBsii, formatFloat, decodeToken } from "../src/bsii.ts";
import { parseSii, stringifySii, get, getArray, SiiIndex } from "../src/model.ts";
import { decryptScsC, encryptScsC, detectKind } from "../src/crypto.ts";
import { loadSii } from "../src/save.ts";
import { applyPlan, summarize, validate, GARAGE_CAPACITY } from "../src/edits.ts";

/**
 * Reference file from TheLazyTomcat/SII_Decrypt `Documents/Binary SII - Format.txt`,
 * together with the textual form documented for it.
 */
const REFERENCE_HEX = `
  42 53 49 49  02 00 00 00  00 00 00 00  01 01 00 00  00 0F 00 00  00 66 69 72
  73 74 5F 73  74 72 75 63  74 75 72 65  25 00 00 00  0B 00 00 00  69 6E 74 33
  32 5F 66 69  65 6C 64 36  00 00 00 14  00 00 00 62  79 74 65 62  6F 6F 6C 5F
  61 72 72 61  79 5F 66 69  65 6C 64 34  00 00 00 18  00 00 00 65  6D 70 74 79
  5F 75 69 6E  74 36 34 5F  61 72 72 61  79 5F 66 69  65 6C 64 00  00 00 00 00
  00 00 00 01  02 00 00 00  04 00 00 00  6C 61 73 74  05 00 00 00  0C 00 00 00
  73 69 6E 67  6C 65 5F 66  69 65 6C 64  00 00 00 00  01 00 00 00  FF 01 02 03
  04 05 06 07  08 FF FF FF  FF 03 00 00  00 00 01 00  00 00 00 00  02 00 00 00
  FF F8 F9 FA  FB FC FD FE  FF 00 00 80  3F 00 00 00  00 00`;

const REFERENCE_TEXT = [
  "SiiNunit",
  "{",
  "first_structure : _nameless.807.0605.0403.0201 {",
  " int32_field: -1",
  " bytebool_array_field: 3",
  " bytebool_array_field[0]: false",
  " bytebool_array_field[1]: true",
  " bytebool_array_field[2]: false",
  " empty_uint64_array_field: 0",
  "}",
  "",
  "last : _nameless.fffe.fdfc.fbfa.f9f8 {",
  " single_field: 1",
  "}",
  "",
  "}",
  "",
].join("\r\n");

const SANDBOX = fileURLToPath(
  new URL(
    "../../../sandbox/Euro Truck Simulator 2/profiles/556C5F746F75746F75636865/save/1/game.sii",
    import.meta.url,
  ),
);
const hasSandbox = existsSync(SANDBOX);

test("decodes the documented reference BSII file exactly", () => {
  const buf = Buffer.from(REFERENCE_HEX.replace(/\s+/g, ""), "hex");
  const doc = decodeBsii(buf);
  expect(doc.version).toBe(2);
  expect(stringifySii(doc)).toBe(REFERENCE_TEXT);
});

test("nameless ids keep four hex digits after the leading group", () => {
  const buf = Buffer.from(REFERENCE_HEX.replace(/\s+/g, ""), "hex");
  const ids = decodeBsii(buf).units.map((u) => u.id);
  expect(ids).toEqual(["_nameless.807.0605.0403.0201", "_nameless.fffe.fdfc.fbfa.f9f8"]);
});

test("floats use decimal form when integral and hex bits otherwise", () => {
  expect(formatFloat(1)).toBe("1");
  expect(formatFloat(-2048)).toBe("-2048");
  expect(formatFloat(0.1)).toBe("&3dcccccd");
  expect(formatFloat(1e8)).toBe("&4cbebc20");
});

test("tokens decode from base-38 identifiers", () => {
  expect(decodeToken(0n)).toBe("");
  // single characters map to their 1-based index in "0-9a-z_"
  expect(decodeToken(11n)).toBe("a");
  // "truck" folded back to front: ((((21*38+13)*38+31)*38+28)*38+30)
  expect(decodeToken(44547050n)).toBe("truck");
  // bit 63 belongs to the game and must not leak into the identifier
  expect(decodeToken(44547050n | (1n << 63n))).toBe("truck");
});

test.skipIf(!hasSandbox)("ScsC container round-trips through re-encryption", () => {
  const raw = readFileSync(SANDBOX);
  expect(detectKind(raw)).toBe("encrypted");
  const payload = decryptScsC(raw);
  const again = decryptScsC(encryptScsC(payload));
  expect(payload.equals(again)).toBeTruthy();
});

test.skipIf(!hasSandbox)("real save decodes, re-parses and keeps every unit", () => {
  const doc = decodeBsii(decryptScsC(readFileSync(SANDBOX)));
  const text = stringifySii(doc);
  const reparsed = parseSii(text);
  expect(reparsed.units.length).toBe(doc.units.length);
  expect(stringifySii(reparsed)).toBe(text);
});

test.skipIf(!hasSandbox)("edits land on the fields the game reads back", () => {
  const doc = loadSii(SANDBOX).doc;
  applyPlan(doc, { money: 1234567, experience: 42, maxSkills: true, garageStatus: 3 });
  const after = summarize(doc);
  expect(after.money).toBe("1234567");
  expect(after.experience).toBe("42");
  expect(after.adr).toBe("63");
  expect(after.garagesOwned).toBe(after.garagesTotal);
  // the mutation must survive a text round-trip, which is how the game reads it
  const reloaded = parseSii(stringifySii(doc));
  const idx = new SiiIndex(reloaded);
  expect(get(idx.follow(idx.one("economy"), "bank"), "money_account")).toBe("1234567");
});

test.skipIf(!hasSandbox)("garage resizing keeps slot arrays consistent and preserves parked trucks", () => {
  const doc = loadSii(SANDBOX).doc;
  expect(validate(doc)).toEqual([]);

  const before = new SiiIndex(doc);
  const hq = before.byIdOrNull("garage.istanbul");
  expect(hq, "expected the sandbox save to own garage.istanbul").toBeTruthy();
  const parked = getArray(hq, "vehicles").filter((v) => v !== "null");
  const hired = getArray(hq, "drivers").filter((d) => d !== "null");
  expect(parked.length > 0 && hired.length > 0).toBeTruthy();

  applyPlan(doc, { garageStatus: 3 });
  // an empty drivers array is what crashed the garage screen, so this must hold
  expect(validate(doc)).toEqual([]);
  for (const g of new SiiIndex(doc).all("garage")) {
    expect(getArray(g, "vehicles").length).toBe(GARAGE_CAPACITY["3"]);
    expect(getArray(g, "drivers").length).toBe(GARAGE_CAPACITY["3"]);
  }
  const after = new SiiIndex(doc).byIdOrNull("garage.istanbul");
  expect(after).toBeTruthy();
  expect(
    getArray(after, "vehicles").filter((v) => v !== "null")).toEqual(
    parked);
  expect(
    getArray(after, "drivers").filter((d) => d !== "null")).toEqual(
    hired);

  // shrinking below the occupied slot count must leave that garage alone
  applyPlan(doc, { garageStatus: 6 });
  expect(validate(doc)).toEqual([]);
});
