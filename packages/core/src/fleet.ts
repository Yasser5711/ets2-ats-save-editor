// garage.vehicles[i] pairs with garage.drivers[i]; hired drivers must also appear in
// player.drivers with its three parallel arrays or the game shows nothing.
import { SiiIndex, get, getArray, set, setArray, type SiiDocument, type Unit } from "./model.ts";
import { IdAllocator } from "./ids.ts";
import { repairVehicle, trySet } from "./edits.ts";

const DRIVER_SKILLS = ["long_dist", "heavy", "fragile", "urgent", "mechanical"] as const;
const DRIVER_SKILL_MAX = 6;

const ACCESSORY_CLASSES = new Set([
  "vehicle_accessory",
  "vehicle_wheel_accessory",
  "vehicle_paint_job_accessory",
  "vehicle_addon_accessory",
  "vehicle_drv_plate_accessory",
  "vehicle_cargo_accessory",
]);

export interface StaffOptions {
  seed?: number;
  withDrivers?: boolean;
  limit?: number;
}

interface Template {
  vehicle: Unit;
  model: string;
  power: number;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dataPath(unit: Unit): string {
  const raw = unit.lines.find((l) => l.key === "data_path" && l.index === null)?.value ?? "";
  return raw.startsWith('"') ? raw.slice(1, -1) : raw;
}

function collectTemplates(idx: SiiIndex): Template[] {
  const byModel = new Map<string, Template>();
  for (const offer of idx.all("used_truck_offer")) {
    const vehicle = idx.byIdOrNull(get(offer, "truck"));
    if (!vehicle) continue;
    let model = "";
    let power = 0;
    for (const accId of getArray(vehicle, "accessories")) {
      const acc = idx.byIdOrNull(accId);
      if (!acc) continue;
      const path = dataPath(acc);
      const chassis = /^\/def\/vehicle\/truck\/([^/]+)\/data\.sii$/.exec(path);
      if (chassis) model = chassis[1];
      if (path.includes("/engine/")) {
        const hp = /_(\d{3,4})\.sii$/.exec(path);
        if (hp) power = Math.max(power, Number(hp[1]));
      }
    }
    if (model === "") continue;
    const previous = byModel.get(model);
    if (!previous || power > previous.power) byModel.set(model, { vehicle, model, power });
  }
  return [...byModel.values()].toSorted((a, b) => b.power - a.power);
}

function cloneTruck(doc: SiiDocument, idx: SiiIndex, template: Template, ids: IdAllocator): Unit {
  const clone: Unit = {
    cls: template.vehicle.cls,
    id: ids.take(),
    lines: template.vehicle.lines.map((l) => ({ ...l })),
  };
  const newAccessories: string[] = [];
  for (const accId of getArray(template.vehicle, "accessories")) {
    const acc = idx.byIdOrNull(accId);
    if (!acc || !ACCESSORY_CLASSES.has(acc.cls)) continue;
    const accClone: Unit = { cls: acc.cls, id: ids.take(), lines: acc.lines.map((l) => ({ ...l })) };
    doc.units.push(accClone);
    newAccessories.push(accClone.id);
  }
  setArray(clone, "accessories", newAccessories);
  repairVehicle(clone);
  trySet(clone, "fuel_relative", 1);
  trySet(clone, "odometer", 0);
  trySet(clone, "integrity_odometer", 0);
  doc.units.push(clone);
  return clone;
}

function createProfitLog(doc: SiiDocument, ids: IdAllocator, template: Unit): Unit {
  const log: Unit = { cls: "profit_log", id: ids.take(), lines: template.lines.map((l) => ({ ...l })) };
  setArray(log, "stats_data", []);
  trySet(log, "acc_distance_free", 0);
  trySet(log, "acc_distance_on_job", 0);
  set(log, "history_age", "nil");
  doc.units.push(log);
  return log;
}

export function staffGarages(doc: SiiDocument, options: StaffOptions = {}): string[] {
  const withDrivers = options.withDrivers ?? true;
  const idx = new SiiIndex(doc);
  const economy = idx.one("economy");
  const player = idx.follow(economy, "player");
  const progress = idx.follow(economy, "game_progress");
  const ids = new IdAllocator(doc);
  const random = mulberry32(options.seed ?? 20260823);

  const templates = collectTemplates(idx);
  if (templates.length === 0) throw new Error("no dealer trucks in this save to clone from");
  const logTemplate = idx.byIdOrNull(getArray(player, "truck_profit_logs")[0] ?? "");
  if (!logTemplate) throw new Error("cannot find an existing truck profit log to copy");

  const pool = getArray(economy, "driver_pool");
  const taken = new Set<string>();
  for (const g of idx.all("garage")) for (const d of getArray(g, "drivers")) taken.add(d);
  const freeDrivers = pool.filter((d) => !taken.has(d));

  const trucks = getArray(player, "trucks");
  const truckLogs = getArray(player, "truck_profit_logs");
  const ownedModels = new Set(getArray(progress, "owned_trucks"));
  const hired: string[] = [];
  const usedModels = new Map<string, number>();
  let parked = 0;

  for (const garage of idx.all("garage")) {
    if (options.limit !== undefined && parked >= options.limit) break;
    if (get(garage, "status") === "0") continue;
    const vehicles = getArray(garage, "vehicles");
    const drivers = getArray(garage, "drivers");
    const slot = vehicles.findIndex((v, i) => v === "null" && drivers[i] === "null");
    if (slot < 0) continue;

    const pick = templates[Math.floor(random() ** 2 * templates.length)];
    const truck = cloneTruck(doc, idx, pick, ids);
    const profitLog = createProfitLog(doc, ids, logTemplate);
    trucks.push(truck.id);
    truckLogs.push(profitLog.id);
    ownedModels.add(`"vehicle.${pick.model}"`);
    usedModels.set(pick.model, (usedModels.get(pick.model) ?? 0) + 1);
    vehicles[slot] = truck.id;

    if (withDrivers) {
      const driverId = freeDrivers.pop();
      if (driverId !== undefined) {
        const driver = idx.byIdOrNull(driverId);
        if (driver) {
          set(driver, "assigned_truck", truck.id);
          set(driver, "adr", 1);
          for (const skill of DRIVER_SKILLS) set(driver, skill, DRIVER_SKILL_MAX);
          drivers[slot] = driverId;
          hired.push(driverId);
        }
      }
    }
    setArray(garage, "vehicles", vehicles);
    setArray(garage, "drivers", drivers);
    parked++;
  }

  setArray(player, "trucks", trucks);
  setArray(player, "truck_profit_logs", truckLogs);
  setArray(progress, "owned_trucks", [...ownedModels]);
  const hiredSet = new Set(hired);
  if (hired.length > 0) {
    setArray(
      economy,
      "driver_pool",
      pool.filter((d) => !hiredSet.has(d)),
    );
    setArray(player, "drivers", [...getArray(player, "drivers"), ...hired]);
    for (const parallel of [
      "driver_flags",
      "driver_readiness_timer",
      "driver_undrivable_truck_timers",
    ]) {
      setArray(player, parallel, [...getArray(player, parallel), ...hired.map(() => "0")]);
    }
  }

  const models = [...usedModels.entries()].toSorted((a, b) => b[1] - a[1]);
  return [
    `parked ${parked} cloned trucks (${doc.units.length} units in save)`,
    `hired ${hired.length} drivers on the payroll, ${freeDrivers.length} applicants left in the pool`,
    `models used: ${models.map(([m, n]) => `${m} x${n}`).join(", ")}`,
  ];
}
