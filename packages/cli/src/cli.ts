#!/usr/bin/env node
/**
 * Command line front end for the ETS2/ATS save editor core.
 *
 *   node src/cli.ts profiles [docsDir]
 *   node src/cli.ts info <game.sii|saveDir>
 *   node src/cli.ts decode <file> [out.txt]
 *   node src/cli.ts edit <game.sii|saveDir> [options]
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { applyPlan, discoverySummary, type EditPlan, find, GARAGE_LARGE, get, loadSii, mergeDiscovery, saveSiiAsText, set, SiiIndex, staffGarages, type StaffOptions, stringifySii, summarize, validate, visitAllCities } from "@truck/core";

const DEFAULT_DOCS = join(homedir(), "Documents", "Euro Truck Simulator 2");

function resolveSave(target: string): string {
  if (statSync(target).isDirectory()) {
    const candidate = join(target, "game.sii");
    if (!existsSync(candidate)) throw new Error(`no game.sii in ${target}`);
    return candidate;
  }
  return target;
}

function profileName(dirName: string): string {
  if (!/^[0-9A-Fa-f]+$/.test(dirName) || dirName.length % 2 !== 0) return dirName;
  return Buffer.from(dirName, "hex").toString("utf8");
}

function listProfiles(docsDir: string): void {
  let found = 0;
  for (const root of ["profiles", "steam_profiles"]) {
    const dir = join(docsDir, root);
    if (!existsSync(dir)) continue;
    for (const entry of readdirSync(dir)) {
      const saveDir = join(dir, entry, "save");
      console.log(`\n${root}/${entry}  ->  ${profileName(entry)}`);
      found++;
      if (!existsSync(saveDir)) continue;
      for (const slot of readdirSync(saveDir)) {
        const info = join(saveDir, slot, "info.sii");
        if (!existsSync(info)) continue;
        const doc = loadSii(info).doc;
        const container = doc.units[0];
        const name = container ? (find(container, "name")?.value ?? "?") : "?";
        const stamp = new Date(statSync(join(saveDir, slot, "game.sii")).mtime);
        console.log(`   ${slot.padEnd(20)} ${name}  (${stamp.toISOString().slice(0, 16)})`);
      }
    }
  }
  if (found === 0) console.log(`no profiles under ${docsDir}`);
}

function printInfo(target: string): void {
  const path = resolveSave(target);
  const loaded = loadSii(path);
  const s = summarize(loaded.doc);
  const idx = new SiiIndex(loaded.doc);
  console.log(`file       ${path}`);
  console.log(`container  ${loaded.kind} -> ${loaded.inner} (BSII v${loaded.doc.version ?? "-"})`);
  console.log(`units      ${loaded.doc.units.length}`);
  console.log(`money      ${s.money}`);
  console.log(`experience ${s.experience}`);
  console.log(`adr        ${s.adr}`);
  console.log(
    `skills     ` +
      Object.entries(s.skills)
        .map(([k, v]) => `${k}=${v}`)
        .join(" "),
  );
  console.log(`hq city    ${s.hqCity}`);
  console.log(`owned      ${s.ownedTrucks} trucks, ${idx.all("vehicle").length} vehicle records`);
  console.log(`garages    ${s.garagesOwned} owned of ${s.garagesTotal}`);
  console.log(`explored   ${s.visitedCities} cities, ${s.unlockedDealers} dealers unlocked`);
}

interface EditArgs {
  plan: EditPlan;
  dryRun: boolean;
  backup: boolean;
  visitCities: boolean;
  discoveryDonor: string | null;
  staff: StaffOptions | null;
}

function parseArgs(args: string[]): EditArgs {
  const plan: EditPlan = {};
  let dryRun = false;
  let backup = true;
  let visitCities = false;
  let discoveryDonor: string | null = null;
  let staff: StaffOptions | null = null;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    const num = () => {
      const v = Number(args[++i]);
      if (!Number.isFinite(v)) throw new Error(`${a} needs a number`);
      return v;
    };
    switch (a) {
      case "--money":
        plan.money = num();
        break;
      case "--xp":
        plan.experience = num();
        break;
      case "--max-skills":
        plan.maxSkills = true;
        break;
      case "--garages":
        plan.garageStatus = GARAGE_LARGE;
        break;
      case "--garage-status":
        plan.garageStatus = num();
        break;
      case "--repair":
        plan.repairVehicles = true;
        break;
      case "--refuel":
        plan.refuelVehicles = true;
        break;
      case "--visit-all-cities":
        visitCities = true;
        break;
      case "--import-discovery":
        discoveryDonor = args[++i];
        if (discoveryDonor === undefined) throw new Error("--import-discovery needs a donor save");
        break;
      case "--staff-garages":
        staff = { ...(staff ?? {}) };
        break;
      case "--no-drivers":
        staff = { ...(staff ?? {}), withDrivers: false };
        break;
      case "--seed":
        staff = { ...(staff ?? {}), seed: num() };
        break;
      case "--staff-limit":
        staff = { ...(staff ?? {}), limit: num() };
        break;
      case "--dry-run":
        dryRun = true;
        break;
      case "--no-backup":
        backup = false;
        break;
      default:
        throw new Error(`unknown option ${a}`);
    }
  }
  return { plan, dryRun, backup, visitCities, discoveryDonor, staff };
}

/**
 * Copies a save slot to a new folder so edits can be tested without touching the
 * original. The slot's display name in `info.sii` is rewritten so both saves are
 * distinguishable in the game's load menu.
 */
function cloneSlot(src: string, dest: string, name: string | undefined): void {
  if (existsSync(dest)) throw new Error(`${dest} already exists`);
  mkdirSync(dest, { recursive: true });
  for (const f of readdirSync(src)) {
    if (statSync(join(src, f)).isDirectory()) continue;
    copyFileSync(join(src, f), join(dest, f));
  }
  if (name !== undefined) {
    const info = join(dest, "info.sii");
    const loaded = loadSii(info);
    set(loaded.doc.units[0], "name", JSON.stringify(name));
    saveSiiAsText(info, loaded.doc, false);
  }
  console.log(`cloned ${src} -> ${dest}${name === undefined ? "" : ` as "${name}"`}`);
}

function main(argv: string[]): void {
  const [cmd, ...rest] = argv;
  switch (cmd) {
    case "profiles":
      return listProfiles(rest[0] ?? DEFAULT_DOCS);
    case "info":
      return printInfo(rest[0] ?? join(DEFAULT_DOCS, "profiles"));
    case "decode": {
      const loaded = loadSii(rest[0]);
      const out = rest[1] ?? rest[0] + ".txt";
      writeFileSync(out, stringifySii(loaded.doc), "utf8");
      console.log(`${loaded.doc.units.length} units -> ${out}`);
      return;
    }
    case "edit": {
      const path = resolveSave(rest[0]);
      const args = parseArgs(rest.slice(1));
      const loaded = loadSii(path);
      const log = applyPlan(loaded.doc, args.plan);
      if (args.visitCities) log.push(...visitAllCities(loaded.doc));
      if (args.discoveryDonor !== null) {
        log.push(...mergeDiscovery(loaded.doc, loadSii(args.discoveryDonor).doc));
      }
      if (args.staff !== null) log.push(...staffGarages(loaded.doc, args.staff));
      for (const line of log) console.log(`  ${line}`);
      const problems = validate(loaded.doc);
      if (problems.length > 0) {
        console.error(`refusing to write, ${problems.length} consistency problems:`);
        for (const p of problems.slice(0, 20)) console.error(`  ${p}`);
        process.exitCode = 1;
        return;
      }
      console.log(`  discovery: ${discoverySummary(loaded.doc)}`);
      if (args.dryRun) {
        console.log("dry run: nothing written");
        return;
      }
      saveSiiAsText(path, loaded.doc, args.backup);
      console.log(`written as plain text: ${path}${args.backup ? ` (backup: ${path}.bak)` : ""}`);
      return;
    }
    case "clone": {
      const nameAt = rest.indexOf("--name");
      const name = nameAt < 0 ? undefined : rest[nameAt + 1];
      return cloneSlot(rest[0], rest[1], name);
    }
    case "check": {
      const path = resolveSave(rest[0]);
      const problems = validate(loadSii(path).doc);
      if (problems.length === 0) {
        console.log(`${path}: consistent`);
        return;
      }
      for (const p of problems.slice(0, 40)) console.log(`  ${p}`);
      if (problems.length > 40) console.log(`  ... and ${problems.length - 40} more`);
      process.exitCode = 1;
      return;
    }
    default:
      console.log(
        [
          "usage:",
          "  profiles [docsDir]                 list profiles and save slots",
          "  info <game.sii|saveDir>            show save summary",
          "  decode <file> [out.txt]            decrypt/decode to SiiNunit text",
          "  edit <game.sii|saveDir> [options]  modify and rewrite the save",
          "  check <game.sii|saveDir>           verify save invariants",
          "  clone <srcSlot> <dstSlot> [--name N]  copy a save slot",
          "",
          "edit options:",
          "  --money N --xp N --max-skills",
          "  --garages | --garage-status N          buy/upgrade every garage",
          "  --repair --refuel                      restore all owned vehicles",
          "  --visit-all-cities                     visit every city, unlock dealers+recruitment",
          "  --import-discovery <donor game.sii>    merge discovered map items from another save",
          "  --staff-garages [--no-drivers]          park a truck + hire a driver per garage",
          "  --seed N --staff-limit N               control fleet randomisation and size",
          "  --dry-run --no-backup",
        ].join("\n"),
      );
  }
}

try {
  main(process.argv.slice(2));
} catch (err) {
  console.error(`error: ${(err as Error).message}`);
  process.exitCode = 1;
}
