import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { SiiIndex, get, getArray, parseSii, stringifySii } from "../src/model.ts";
import { loadSii } from "../src/save.ts";
import { applyPlan, validate } from "../src/edits.ts";
import { staffGarages } from "../src/fleet.ts";
import { visitAllCities, mergeDiscovery, allCities } from "../src/discovery.ts";
import { IdAllocator, namelessId, namelessValue } from "../src/ids.ts";

const SANDBOX = fileURLToPath(
  new URL(
    "../../../sandbox/Euro Truck Simulator 2/profiles/556C5F746F75746F75636865/save/1/game.sii",
    import.meta.url,
  ),
);

test("nameless ids round-trip through their 64-bit value", () => {
  assert.equal(namelessValue("_nameless.2b6.8e3e.d7f8"), 0x02b68e3ed7f8n);
  assert.equal(namelessId(0x02b68e3ed7f8n), "_nameless.2b6.8e3e.d7f8");
  assert.equal(namelessValue("garage.berlin"), null);
});

test("the id allocator stays above every id already in the save", (t) => {
  if (!existsSync(SANDBOX)) return t.skip("sandbox save not present");
  const doc = loadSii(SANDBOX).doc;
  let max = 0n;
  for (const u of doc.units) {
    const v = namelessValue(u.id);
    if (v !== null && v > max) max = v;
  }
  const ids = new IdAllocator(doc);
  const minted = [ids.take(), ids.take(), ids.take()];
  assert.equal(new Set(minted).size, 3);
  for (const id of minted) assert.ok((namelessValue(id) as bigint) > max);
});

test("visiting all cities fills the city arrays from the save's own garages", (t) => {
  if (!existsSync(SANDBOX)) return t.skip("sandbox save not present");
  const doc = loadSii(SANDBOX).doc;
  visitAllCities(doc);
  const economy = new SiiIndex(doc).one("economy");
  const cities = allCities(doc);
  assert.ok(cities.length > 100);
  assert.deepEqual(getArray(economy, "visited_cities"), cities);
  assert.equal(get(economy, "visited_cities_count"), String(cities.length));
  assert.deepEqual(getArray(economy, "unlocked_dealers"), cities);
  assert.deepEqual(getArray(economy, "unlocked_recruitments"), cities);
  assert.deepEqual(validate(doc), []);
});

test("merging discovery unions item ids without dropping our own", (t) => {
  if (!existsSync(SANDBOX)) return t.skip("sandbox save not present");
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
  assert.equal(after.length, mine.length + 2);
  assert.ok(after.includes("42") && after.includes("43"));
  for (const uid of mine) assert.ok(after.includes(uid));
});

test("staffing garages parks unique cloned trucks and hires unique drivers", (t) => {
  if (!existsSync(SANDBOX)) return t.skip("sandbox save not present");
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
  assert.deepEqual(validate(doc), []);
  // the game only shows drivers that are on the player's payroll
  const payroll = getArray(new SiiIndex(doc).follow(new SiiIndex(doc).one("economy"), "player"), "drivers");
  assert.equal(payroll.length, 21, "player + 20 hired drivers");

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
  assert.equal(new Set(parked).size, parked.length, "a truck may only sit in one slot");
  assert.equal(new Set(hired).size, hired.length, "a driver may only work in one slot");
  assert.equal(getArray(pl, "trucks").length, trucksBefore + 20);
  assert.equal(getArray(pl, "truck_profit_logs").length, trucksBefore + 20);
  assert.equal(getArray(eco, "driver_pool").length, poolBefore - 20);

  // every cloned truck must own its accessories, never share the dealer's
  const newTrucks = getArray(pl, "trucks").slice(trucksBefore);
  assert.equal(newTrucks.length, 20);
  const seenAccessories = new Set<string>();
  for (const id of newTrucks) {
    const truck = idx.byIdOrNull(id);
    assert.ok(truck, `cloned truck ${id} exists`);
    const accessories = getArray(truck, "accessories");
    assert.ok(accessories.length > 10, "a truck clone keeps its full accessory list");
    assert.equal(get(truck, "engine_wear"), "0");
    assert.equal(get(truck, "fuel_relative"), "1");
    for (const acc of accessories) {
      assert.ok(idx.byIdOrNull(acc), `accessory ${acc} was cloned`);
      assert.ok(!templateAccessories.has(acc), "clones never reuse dealer accessories");
      assert.ok(!seenAccessories.has(acc), "clones never share accessories with each other");
      seenAccessories.add(acc);
    }
  }

  // AI drivers point at the truck standing in their own slot; the player's own
  // driver record shares the HQ slot but has no assigned_truck field
  for (const driverId of hired) {
    const driver = idx.byIdOrNull(driverId);
    assert.ok(driver);
    if (driver.cls !== "driver_ai") continue;
    assert.ok(parked.includes(get(driver, "assigned_truck")));
    assert.equal(get(driver, "long_dist"), "6");
  }
});
