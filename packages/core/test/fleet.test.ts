import { expect, test } from "vitest";
import { sandboxSave } from "./sandbox.ts";
import { SiiIndex, get, getArray, parseSii, stringifySii } from "../src/model.ts";
import { loadSii } from "../src/save.ts";
import { applyPlan, validate } from "../src/edits.ts";
import { staffGarages } from "../src/fleet.ts";
import { visitAllCities, mergeDiscovery, allCities } from "../src/discovery.ts";
import { IdAllocator, namelessId, namelessValue } from "../src/ids.ts";

const SANDBOX = sandboxSave() ?? "";
const hasSandbox = SANDBOX !== "";

test("nameless ids round-trip through their 64-bit value", () => {
  expect(namelessValue("_nameless.2b6.8e3e.d7f8")).toBe(0x02b68e3ed7f8n);
  expect(namelessId(0x02b68e3ed7f8n)).toBe("_nameless.2b6.8e3e.d7f8");
  expect(namelessValue("garage.berlin")).toBe(null);
});

test.skipIf(!hasSandbox)("the id allocator stays above every id already in the save", () => {
  const doc = loadSii(SANDBOX).doc;
  let max = 0n;
  for (const u of doc.units) {
    const v = namelessValue(u.id);
    if (v !== null && v > max) max = v;
  }
  const ids = new IdAllocator(doc);
  const minted = [ids.take(), ids.take(), ids.take()];
  expect(new Set(minted).size).toBe(3);
  for (const id of minted) expect((namelessValue(id) as bigint) > max).toBeTruthy();
});

test.skipIf(!hasSandbox)("visiting all cities fills the city arrays from the save's own garages", () => {
  const doc = loadSii(SANDBOX).doc;
  visitAllCities(doc);
  const economy = new SiiIndex(doc).one("economy");
  const cities = allCities(doc);
  expect(cities.length > 100).toBeTruthy();
  expect(getArray(economy, "visited_cities")).toEqual(cities);
  expect(get(economy, "visited_cities_count")).toBe(String(cities.length));
  expect(getArray(economy, "unlocked_dealers")).toEqual(cities);
  expect(getArray(economy, "unlocked_recruitments")).toEqual(cities);
  expect(validate(doc)).toEqual([]);
});

test.skipIf(!hasSandbox)("merging discovery unions item ids without dropping our own", () => {
  const doc = loadSii(SANDBOX).doc;
  const economy = new SiiIndex(doc).one("economy");
  const mine = getArray(economy, "discovered_items");
  const donor = parseSii(
    stringifySii({
      units: [
        {
          cls: "economy",
          id: "_nameless.1",
          lines: [
            { key: "discovered_items", index: null, value: "3" },
            { key: "discovered_items", index: 0, value: mine[0] },
            { key: "discovered_items", index: 1, value: "42" },
            { key: "discovered_items", index: 2, value: "43" },
            { key: "discovered_roads", index: null, value: "0" },
          ],
        },
      ],
    }),
  );
  mergeDiscovery(doc, donor);
  const after = getArray(economy, "discovered_items");
  expect(after.length).toBe(mine.length + 2);
  expect(after.includes("42") && after.includes("43")).toBeTruthy();
  for (const uid of mine) expect(after.includes(uid)).toBeTruthy();
});

test.skipIf(!hasSandbox)("staffing garages parks unique cloned trucks and hires unique drivers", () => {
  const doc = loadSii(SANDBOX).doc;
  const before = new SiiIndex(doc);
  const economy = before.one("economy");
  const player = before.follow(economy, "player");
  const templateAccessories = new Set<string>();
  for (const offer of before.all("used_truck_offer")) {
    const vehicle = before.byIdOrNull(get(offer, "truck"));
    if (vehicle) for (const a of getArray(vehicle, "accessories")) templateAccessories.add(a);
  }
  const trucksBefore = getArray(player, "trucks").length;
  const poolBefore = getArray(economy, "driver_pool").length;

  applyPlan(doc, { garageStatus: 3 });
  staffGarages(doc, { seed: 1, limit: 20 });
  expect(validate(doc)).toEqual([]);
  // the game only shows drivers that are on the player's payroll
  const payroll = getArray(new SiiIndex(doc).follow(new SiiIndex(doc).one("economy"), "player"), "drivers");
  expect(payroll.length).toBe( 21);

  const idx = new SiiIndex(doc);
  const eco = idx.one("economy");
  const pl = idx.follow(eco, "player");
  const parked: string[] = [];
  const hired: string[] = [];
  for (const g of idx.all("garage")) {
    const vehicles = getArray(g, "vehicles");
    const drivers = getArray(g, "drivers");
    vehicles.forEach((v, i) => {
      if (v === "null") return;
      parked.push(v);
      if (drivers[i] !== "null") hired.push(drivers[i]);
    });
  }
  expect(new Set(parked).size).toBe( parked.length);
  expect(new Set(hired).size).toBe( hired.length);
  expect(getArray(pl, "trucks").length).toBe(trucksBefore + 20);
  expect(getArray(pl, "truck_profit_logs").length).toBe(trucksBefore + 20);
  expect(getArray(eco, "driver_pool").length).toBe(poolBefore - 20);

  // every cloned truck must own its accessories, never share the dealer's
  const newTrucks = getArray(pl, "trucks").slice(trucksBefore);
  expect(newTrucks.length).toBe(20);
  const seenAccessories = new Set<string>();
  for (const id of newTrucks) {
    const truck = idx.byIdOrNull(id);
    expect(truck, `cloned truck ${id} exists`).toBeTruthy();
    const accessories = getArray(truck, "accessories");
    expect(accessories.length > 10, "a truck clone keeps its full accessory list").toBeTruthy();
    expect(get(truck, "engine_wear")).toBe("0");
    expect(get(truck, "fuel_relative")).toBe("1");
    for (const acc of accessories) {
      expect(idx.byIdOrNull(acc), `accessory ${acc} was cloned`).toBeTruthy();
      expect(!templateAccessories.has(acc), "clones never reuse dealer accessories").toBeTruthy();
      expect(!seenAccessories.has(acc), "clones never share accessories with each other").toBeTruthy();
      seenAccessories.add(acc);
    }
  }

  // AI drivers point at the truck standing in their own slot; the player's own
  // driver record shares the HQ slot but has no assigned_truck field
  for (const driverId of hired) {
    const driver = idx.byIdOrNull(driverId);
    expect(driver).toBeTruthy();
    if (driver.cls !== "driver_ai") continue;
    expect(parked.includes(get(driver, "assigned_truck"))).toBeTruthy();
    expect(get(driver, "long_dist")).toBe("6");
  }
});
