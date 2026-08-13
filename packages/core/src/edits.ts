import { SiiIndex, get, set, getArray, setArray, type SiiDocument, type Unit } from "./model.ts";

export const SKILL_MAX = 6;
export const ADR_ALL = 63;
export const SKILL_FIELDS = ["long_dist", "heavy", "fragile", "urgent", "mechanical"] as const;

/**
 * `garage.status` and the number of vehicle/driver slots each size owns.
 * 0 = not owned, 6 = tiny (1), 2 = small (3), 3 = large (5). The slot arrays
 * MUST match the capacity: the game indexes `drivers[0]` when a garage screen
 * opens and crashes on an empty array
 * (`arrays_base_impl.h: Index outside array boundaries`).
 * Capacities verified against LIPtoH/TS-SE-Tool `DataManipulation.cs:PrepareGarages`.
 */
export const GARAGE_CAPACITY: Record<string, number> = { "0": 0, "2": 3, "3": 5, "6": 1 };
export const GARAGE_LARGE = 3;

const WEAR_FIELDS = [
  "engine_wear",
  "transmission_wear",
  "cabin_wear",
  "chassis_wear",
  "engine_wear_unfixable",
  "transmission_wear_unfixable",
  "cabin_wear_unfixable",
  "chassis_wear_unfixable",
] as const;

export interface Summary {
  money: string;
  experience: string;
  adr: string;
  skills: Record<string, string>;
  gameTime: string;
  hqCity: string;
  ownedTrucks: number;
  garagesOwned: number;
  garagesTotal: number;
  visitedCities: number;
  unlockedDealers: number;
}

export function summarize(doc: SiiDocument): Summary {
  const idx = new SiiIndex(doc);
  const economy = idx.one("economy");
  const bank = idx.follow(economy, "bank");
  const player = idx.follow(economy, "player");
  const garages = idx.all("garage");
  const skills: Record<string, string> = {};
  for (const f of SKILL_FIELDS) skills[f] = get(economy, f);
  return {
    money: get(bank, "money_account"),
    experience: get(economy, "experience_points"),
    adr: get(economy, "adr"),
    skills,
    gameTime: get(economy, "game_time"),
    hqCity: get(player, "hq_city"),
    ownedTrucks: getArray(player, "trucks").length,
    garagesOwned: garages.filter((g) => get(g, "status") !== "0").length,
    garagesTotal: garages.length,
    visitedCities: getArray(economy, "visited_cities").length,
    unlockedDealers: getArray(economy, "unlocked_dealers").length,
  };
}

export interface EditPlan {
  money?: number;
  experience?: number;
  maxSkills?: boolean;
  garageStatus?: number;
  repairVehicles?: boolean;
  refuelVehicles?: boolean;
}

export function applyPlan(doc: SiiDocument, plan: EditPlan): string[] {
  const idx = new SiiIndex(doc);
  const economy = idx.one("economy");
  const bank = idx.follow(economy, "bank");
  const log: string[] = [];

  if (plan.money !== undefined) {
    const before = set(bank, "money_account", Math.trunc(plan.money));
    log.push(`bank.money_account: ${before} -> ${get(bank, "money_account")}`);
  }
  if (plan.experience !== undefined) {
    const before = set(economy, "experience_points", Math.trunc(plan.experience));
    log.push(`economy.experience_points: ${before} -> ${get(economy, "experience_points")}`);
  }
  if (plan.maxSkills) {
    const before = set(economy, "adr", ADR_ALL);
    log.push(`economy.adr: ${before} -> ${ADR_ALL}`);
    for (const f of SKILL_FIELDS) {
      const prev = set(economy, f, SKILL_MAX);
      log.push(`economy.${f}: ${prev} -> ${SKILL_MAX}`);
    }
  }
  if (plan.garageStatus !== undefined) {
    const status = String(plan.garageStatus);
    const capacity = GARAGE_CAPACITY[status];
    if (capacity === undefined) {
      throw new Error(`unknown garage status ${status}; expected one of 0, 2, 3, 6`);
    }
    let changed = 0;
    const kept: string[] = [];
    for (const g of idx.all("garage")) {
      const occupied = getArray(g, "vehicles")
        .map((v, i) => [v, getArray(g, "drivers")[i] ?? "null"] as const)
        .filter(([vehicle, driver]) => vehicle !== "null" || driver !== "null");
      if (occupied.length > capacity) {
        kept.push(g.id);
        continue;
      }
      const vehicles = occupied.map(([v]) => v);
      const drivers = occupied.map(([, d]) => d);
      while (vehicles.length < capacity) {
        vehicles.push("null");
        drivers.push("null");
      }
      setArray(g, "vehicles", vehicles);
      setArray(g, "drivers", drivers);
      if (get(g, "status") !== status) changed++;
      set(g, "status", status);
    }
    log.push(`garage.status = ${status} with ${capacity} slots on ${changed} garages`);
    if (kept.length > 0) {
      log.push(`kept ${kept.length} garages untouched (occupied slots exceed capacity): ${kept.join(", ")}`);
    }
  }
  if (plan.repairVehicles || plan.refuelVehicles) {
    let repaired = 0;
    let refuelled = 0;
    for (const v of idx.all("vehicle")) {
      if (plan.repairVehicles) {
        repaired += repairVehicle(v) ? 1 : 0;
      }
      if (plan.refuelVehicles && trySet(v, "fuel_relative", 1)) refuelled++;
    }
    if (plan.repairVehicles) log.push(`repaired ${repaired} vehicles`);
    if (plan.refuelVehicles) log.push(`refuelled ${refuelled} vehicles`);
  }
  return log;
}

export function validate(doc: SiiDocument): string[] {
  const idx = new SiiIndex(doc);
  const problems: string[] = [];
  const economy = idx.one("economy");
  for (const key of ["bank", "player", "game_progress", "event_queue"]) {
    const target = get(economy, key);
    if (target !== "null" && idx.byIdOrNull(target) === null) {
      problems.push(`economy.${key} -> missing unit ${target}`);
    }
  }
  const claimedTrucks = new Map<string, string>();
  const claimedDrivers = new Map<string, string>();
  for (const g of idx.all("garage")) {
    const status = get(g, "status");
    const capacity = GARAGE_CAPACITY[status];
    if (capacity === undefined) {
      problems.push(`${g.id}: unknown status ${status}`);
      continue;
    }
    const vehicles = getArray(g, "vehicles");
    const drivers = getArray(g, "drivers");
    for (const [key, slots] of [
      ["vehicles", vehicles],
      ["drivers", drivers],
    ] as const) {
      if (slots.length !== capacity) {
        problems.push(
          `${g.id}: status ${status} needs ${capacity} ${key} slots, found ${slots.length}`,
        );
      }
      const claimed = key === "vehicles" ? claimedTrucks : claimedDrivers;
      for (const ref of slots) {
        if (ref === "null") continue;
        if (idx.byIdOrNull(ref) === null) {
          problems.push(`${g.id}: ${key} slot points at missing unit ${ref}`);
        }
        const owner = claimed.get(ref);
        if (owner !== undefined) problems.push(`${ref} is in both ${owner} and ${g.id}`);
        else claimed.set(ref, g.id);
      }
    }
    drivers.forEach((driver, i) => {
      if (driver === "null") return;
      const truck = vehicles[i];
      if (truck === undefined || truck === "null") {
        problems.push(`${g.id}: driver ${driver} in slot ${i} has no truck in that slot`);
        return;
      }
      const unit = idx.byIdOrNull(driver);
      if (unit && unit.cls === "driver_ai" && get(unit, "assigned_truck") !== truck) {
        problems.push(`${driver}: assigned_truck does not match the truck in ${g.id} slot ${i}`);
      }
    });
  }
  const player = idx.byIdOrNull(get(economy, "player"));
  if (player) {
    const trucks = getArray(player, "trucks");
    const logs = getArray(player, "truck_profit_logs");
    if (trucks.length !== logs.length) {
      problems.push(`player: ${trucks.length} trucks but ${logs.length} truck_profit_logs`);
    }
    for (const [key, refs] of [
      ["trucks", trucks],
      ["truck_profit_logs", logs],
      ["drivers", getArray(player, "drivers")],
    ] as const) {
      for (const ref of refs) {
        if (ref !== "null" && idx.byIdOrNull(ref) === null) {
          problems.push(`player.${key} references missing unit ${ref}`);
        }
      }
    }
    for (const parallel of ["driver_flags", "driver_readiness_timer", "driver_undrivable_truck_timers"]) {
      const len = getArray(player, parallel).length;
      if (len !== getArray(player, "drivers").length) {
        problems.push(`player.${parallel} has ${len} entries, drivers has ${getArray(player, "drivers").length}`);
      }
    }
  }
  for (const v of idx.all("vehicle")) {
    for (const acc of getArray(v, "accessories")) {
      if (idx.byIdOrNull(acc) === null) {
        problems.push(`${v.id}: accessory ${acc} is missing`);
      }
    }
  }
  return problems;
}

export function repairVehicle(v: Unit): boolean {
  let touched = false;
  for (const f of WEAR_FIELDS) if (trySet(v, f, 0)) touched = true;
  const wheels = getArray(v, "wheels_wear");
  if (wheels.length > 0) {
    setArray(v, "wheels_wear", wheels.map(() => "0"));
    touched = true;
  }
  const wheelsUnfixable = getArray(v, "wheels_wear_unfixable");
  if (wheelsUnfixable.length > 0) {
    setArray(
      v,
      "wheels_wear_unfixable",
      wheelsUnfixable.map(() => "0"),
    );
    touched = true;
  }
  return touched;
}

export function trySet(unit: Unit, key: string, value: string | number): boolean {
  const has = unit.lines.some((l) => l.key === key && l.index === null);
  if (!has) return false;
  set(unit, key, value);
  return true;
}
