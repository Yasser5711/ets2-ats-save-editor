import { test } from "node:test";
import assert from "node:assert/strict";
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

test("decodes the documented reference BSII file exactly", () => {
  const buf = Buffer.from(REFERENCE_HEX.replace(/\s+/g, ""), "hex");
  const doc = decodeBsii(buf);
  assert.equal(doc.version, 2);
  assert.equal(stringifySii(doc), REFERENCE_TEXT);
});

test("nameless ids keep four hex digits after the leading group", () => {
  const buf = Buffer.from(REFERENCE_HEX.replace(/\s+/g, ""), "hex");
  const ids = decodeBsii(buf).units.map((u) => u.id);
  assert.deepEqual(ids, ["_nameless.807.0605.0403.0201", "_nameless.fffe.fdfc.fbfa.f9f8"]);
});

test("floats use decimal form when integral and hex bits otherwise", () => {
  assert.equal(formatFloat(1), "1");
  assert.equal(formatFloat(-2048), "-2048");
  assert.equal(formatFloat(0.1), "&3dcccccd");
  assert.equal(formatFloat(1e8), "&4cbebc20");
});

test("tokens decode from base-38 identifiers", () => {
  assert.equal(decodeToken(0n), "");
  // single characters map to their 1-based index in "0-9a-z_"
  assert.equal(decodeToken(11n), "a");
  // "truck" folded back to front: ((((21*38+13)*38+31)*38+28)*38+30)
  assert.equal(decodeToken(44547050n), "truck");
  // bit 63 belongs to the game and must not leak into the identifier
  assert.equal(decodeToken(44547050n | (1n << 63n)), "truck");
});

test("ScsC container round-trips through re-encryption", (t) => {
  if (!existsSync(SANDBOX)) return t.skip("sandbox save not present");
  const raw = readFileSync(SANDBOX);
  assert.equal(detectKind(raw), "encrypted");
  const payload = decryptScsC(raw);
  const again = decryptScsC(encryptScsC(payload));
  assert.ok(payload.equals(again));
});

test("real save decodes, re-parses and keeps every unit", (t) => {
  if (!existsSync(SANDBOX)) return t.skip("sandbox save not present");
  const doc = decodeBsii(decryptScsC(readFileSync(SANDBOX)));
  const text = stringifySii(doc);
  const reparsed = parseSii(text);
  assert.equal(reparsed.units.length, doc.units.length);
  assert.equal(stringifySii(reparsed), text);
});

test("edits land on the fields the game reads back", (t) => {
  if (!existsSync(SANDBOX)) return t.skip("sandbox save not present");
  const doc = loadSii(SANDBOX).doc;
  applyPlan(doc, { money: 1234567, experience: 42, maxSkills: true, garageStatus: 3 });
  const after = summarize(doc);
  assert.equal(after.money, "1234567");
  assert.equal(after.experience, "42");
  assert.equal(after.adr, "63");
  assert.equal(after.garagesOwned, after.garagesTotal);
  // the mutation must survive a text round-trip, which is how the game reads it
  const reloaded = parseSii(stringifySii(doc));
  const idx = new SiiIndex(reloaded);
  assert.equal(get(idx.follow(idx.one("economy"), "bank"), "money_account"), "1234567");
});

test("garage resizing keeps slot arrays consistent and preserves parked trucks", (t) => {
  if (!existsSync(SANDBOX)) return t.skip("sandbox save not present");
  const doc = loadSii(SANDBOX).doc;
  assert.deepEqual(validate(doc), []);

  const before = new SiiIndex(doc);
  const hq = before.byIdOrNull("garage.istanbul");
  assert.ok(hq, "expected the sandbox save to own garage.istanbul");
  const parked = getArray(hq, "vehicles").filter((v) => v !== "null");
  const hired = getArray(hq, "drivers").filter((d) => d !== "null");
  assert.ok(parked.length > 0 && hired.length > 0);

  applyPlan(doc, { garageStatus: 3 });
  // an empty drivers array is what crashed the garage screen, so this must hold
  assert.deepEqual(validate(doc), []);
  for (const g of new SiiIndex(doc).all("garage")) {
    assert.equal(getArray(g, "vehicles").length, GARAGE_CAPACITY["3"]);
    assert.equal(getArray(g, "drivers").length, GARAGE_CAPACITY["3"]);
  }
  const after = new SiiIndex(doc).byIdOrNull("garage.istanbul");
  assert.ok(after);
  assert.deepEqual(
    getArray(after, "vehicles").filter((v) => v !== "null"),
    parked,
  );
  assert.deepEqual(
    getArray(after, "drivers").filter((d) => d !== "null"),
    hired,
  );

  // shrinking below the occupied slot count must leave that garage alone
  applyPlan(doc, { garageStatus: 6 });
  assert.deepEqual(validate(doc), []);
});
