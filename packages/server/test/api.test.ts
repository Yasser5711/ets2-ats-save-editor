import { expect, test } from "vitest";
import { existsSync, rmSync } from "node:fs";
import { sandboxRoot, sandboxSave } from "./sandbox.ts";
import { dirname, join } from "node:path";
import { applyOps, backupsOf, cloneSlot, planOps, restoreBackup, saveDetail, searchUnits } from "../src/api.ts";
import { listProfiles, readGameLog } from "../src/games.ts";

const ROOT = sandboxRoot() ?? "";
const SAVE = sandboxSave() ?? "";
const SLOT = SAVE === "" ? "" : dirname(SAVE);
const hasSandbox = ROOT !== "" && SLOT !== "" && existsSync(join(SLOT, "game.sii"));

test.skipIf(!hasSandbox)("profile listing decodes hex folder names and reads slot titles", () => {
  const profiles = listProfiles(ROOT);
  const profile = profiles.find((p) => !/^[0-9A-Fa-f]+$/.test(p.name));
  expect(profile, "hex folder names are decoded into readable profile names").toBeTruthy();
  expect(profile.slots.length > 5).toBeTruthy();
  expect(profile.slots.every((s) => s.bytes > 0 && s.modified.length > 0)).toBeTruthy();
});

test.skipIf(!hasSandbox)("save detail exposes garages, trucks and validation", () => {
  const detail = saveDetail(SLOT);
  expect(detail.problems.length).toBe(0);
  expect(detail.garages.length).toBe(detail.summary.garagesTotal);
  expect(detail.trucks.length >= 1).toBeTruthy();
  expect(detail.trucks.every((row) => row.model !== "")).toBeTruthy();
  expect(detail.cities > 100).toBeTruthy();
});

test.skipIf(!hasSandbox)("planning never touches the file on disk", () => {
  const before = saveDetail(SLOT).summary.money;
  const plan = planOps(SLOT, { edits: { money: 1 } });
  expect(plan.log[0]).toMatch(/money_account/);
  expect(plan.summary.money).toBe("1");
  expect(saveDetail(SLOT).summary.money).toBe(before);
});

test.skipIf(!hasSandbox)("applying refuses inconsistent edits and leaves the save alone", () => {
  const target = cloneSlot(SLOT, "api refusal test");
  try {
    const money = saveDetail(target).summary.money;
    const result = applyOps(target, {
      fields: [{ unitId: "garage.istanbul", key: "status", value: "6" }],
    });
    expect(result.written).toBe(false);
    expect(result.problems.some((p) => p.includes("slots"))).toBeTruthy();
    expect(saveDetail(target).summary.money).toBe(money);
  } finally {
    rmSync(target, { recursive: true, force: true });
  }
});

test.skipIf(!hasSandbox)("applying writes, backs up and restores", () => {
  const target = cloneSlot(SLOT, "api write test");
  try {
    const original = saveDetail(target).summary.money;
    const result = applyOps(target, { edits: { money: 4242 } });
    expect(result.written).toBe(true);
    expect(saveDetail(target).summary.money).toBe("4242");
    const backups = backupsOf(target);
    expect(backups.length).toBe(1);
    restoreBackup(target, backups[0].file);
    expect(saveDetail(target).summary.money).toBe(original);
  } finally {
    rmSync(target, { recursive: true, force: true });
  }
});

test.skipIf(!hasSandbox)("cloning creates a fresh numbered slot with a new title", () => {
  const target = cloneSlot(SLOT, "api clone name");
  try {
    expect(existsSync(join(target, "game.sii"))).toBeTruthy();
    const slots = listProfiles(ROOT).flatMap((p) => p.slots);
    expect(slots.some((s) => s.name === "api clone name")).toBeTruthy();
  } finally {
    rmSync(target, { recursive: true, force: true });
  }
});

test.skipIf(!hasSandbox)("unit search filters by class and returns editable lines", () => {
  const found = searchUnits(SLOT, "garage.istanbul");
  expect(found.hits.length).toBe(1);
  expect(found.hits[0].cls).toBe("garage");
  expect(found.hits[0].lines.some((l) => l.key === "status")).toBeTruthy();
  expect(found.total > 1000).toBeTruthy();
});

test("log doctor annotates known crash signatures", () => {
  const issues = readGameLog(ROOT);
  expect(Array.isArray(issues)).toBeTruthy();
  for (const issue of issues) expect(issue.text.length > 0).toBeTruthy();
});
