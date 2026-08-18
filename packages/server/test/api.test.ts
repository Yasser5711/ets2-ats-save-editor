import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { applyOps, backupsOf, cloneSlot, planOps, restoreBackup, saveDetail, searchUnits } from "../src/api.ts";
import { listProfiles, readGameLog } from "../src/games.ts";

const ROOT = fileURLToPath(new URL("../../../sandbox/Euro Truck Simulator 2", import.meta.url));
const SLOT = join(ROOT, "profiles/556C5F746F75746F75636865/save/1");
const skip = !existsSync(join(SLOT, "game.sii"));

test("profile listing decodes hex folder names and reads slot titles", (t) => {
  if (skip) return t.skip("sandbox missing");
  const profiles = listProfiles(ROOT);
  const profile = profiles.find((p) => p.name === "Ul_toutouche");
  assert.ok(profile, "profile name is hex-decoded");
  assert.ok(profile.slots.length > 5);
  assert.ok(profile.slots.every((s) => s.bytes > 0 && s.modified.length > 0));
});

test("save detail exposes garages, trucks and validation", (t) => {
  if (skip) return t.skip("sandbox missing");
  const detail = saveDetail(SLOT);
  assert.equal(detail.problems.length, 0);
  assert.equal(detail.garages.length, detail.summary.garagesTotal);
  assert.ok(detail.trucks.length >= 1);
  assert.ok(detail.trucks.every((row) => row.model !== ""));
  assert.ok(detail.cities > 100);
});

test("planning never touches the file on disk", (t) => {
  if (skip) return t.skip("sandbox missing");
  const before = saveDetail(SLOT).summary.money;
  const plan = planOps(SLOT, { edits: { money: 1 } });
  assert.match(plan.log[0], /money_account/);
  assert.equal(plan.summary.money, "1");
  assert.equal(saveDetail(SLOT).summary.money, before);
});

test("applying refuses inconsistent edits and leaves the save alone", (t) => {
  if (skip) return t.skip("sandbox missing");
  const target = cloneSlot(SLOT, "api refusal test");
  try {
    const money = saveDetail(target).summary.money;
    const result = applyOps(target, {
      fields: [{ unitId: "garage.istanbul", key: "status", value: "6" }],
    });
    assert.equal(result.written, false);
    assert.ok(result.problems.some((p) => p.includes("slots")));
    assert.equal(saveDetail(target).summary.money, money);
  } finally {
    rmSync(target, { recursive: true, force: true });
  }
});

test("applying writes, backs up and restores", (t) => {
  if (skip) return t.skip("sandbox missing");
  const target = cloneSlot(SLOT, "api write test");
  try {
    const original = saveDetail(target).summary.money;
    const result = applyOps(target, { edits: { money: 4242 } });
    assert.equal(result.written, true);
    assert.equal(saveDetail(target).summary.money, "4242");
    const backups = backupsOf(target);
    assert.equal(backups.length, 1);
    restoreBackup(target, backups[0].file);
    assert.equal(saveDetail(target).summary.money, original);
  } finally {
    rmSync(target, { recursive: true, force: true });
  }
});

test("cloning creates a fresh numbered slot with a new title", (t) => {
  if (skip) return t.skip("sandbox missing");
  const target = cloneSlot(SLOT, "api clone name");
  try {
    assert.ok(existsSync(join(target, "game.sii")));
    const slots = listProfiles(ROOT).flatMap((p) => p.slots);
    assert.ok(slots.some((s) => s.name === "api clone name"));
  } finally {
    rmSync(target, { recursive: true, force: true });
  }
});

test("unit search filters by class and returns editable lines", (t) => {
  if (skip) return t.skip("sandbox missing");
  const found = searchUnits(SLOT, "garage.istanbul");
  assert.equal(found.hits.length, 1);
  assert.equal(found.hits[0].cls, "garage");
  assert.ok(found.hits[0].lines.some((l) => l.key === "status"));
  assert.ok(found.total > 1000);
});

test("log doctor annotates known crash signatures", (t) => {
  const issues = readGameLog(ROOT);
  assert.ok(Array.isArray(issues));
  for (const issue of issues) assert.ok(issue.text.length > 0);
});
