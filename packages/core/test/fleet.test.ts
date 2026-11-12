import { expect, test } from "vitest";
import { sandboxSave } from "./sandbox.ts";
import { SiiIndex, get, getArray, parseSii, setArray, stringifySii, type Unit } from "../src/model.ts";
import { loadSii } from "../src/save.ts";
import { applyPlan, summarize, validate } from "../src/edits.ts";
import { countIdleDrivers, dispatchIdleDrivers, staffGarages } from "../src/fleet.ts";
import { visitAllCities, mergeDiscovery, allCities, discoverMap, garageCities } from "../src/discovery.ts";
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

test.skipIf(!hasSandbox)("visiting all cities covers cities without a garage and keeps the visit counts aligned", () => {
  const doc = loadSii(SANDBOX).doc;
  const economy = new SiiIndex(doc).one("economy");
  const visitedBefore = getArray(economy, "visited_cities");
  const countsBefore = getArray(economy, "visited_cities_count");
  visitAllCities(doc);
  const cities = allCities(doc);
  const garages = garageCities(doc);
  expect(garages.length > 100).toBeTruthy();
  expect(cities.length > garages.length, "company-only cities count as cities").toBeTruthy();
  const visited = getArray(economy, "visited_cities");
  expect(visited.toSorted()).toEqual(cities);
  // one count per city; cities the player really visited keep their own
  const counts = getArray(economy, "visited_cities_count");
  expect(counts.length).toBe(visited.length);
  expect(visited.slice(0, visitedBefore.length)).toEqual(visitedBefore);
  expect(counts.slice(0, countsBefore.length)).toEqual(countsBefore);
  expect(getArray(economy, "unlocked_dealers")).toEqual(garages);
  expect(getArray(economy, "unlocked_recruitments")).toEqual(garages);
  for (const company of new SiiIndex(doc).all("company")) expect(get(company, "discovered")).toBe("true");
  expect(validate(doc)).toEqual([]);
});

test.skipIf(!hasSandbox)("discovering the map adds the installed items and keeps what the save knew", () => {
  const doc = loadSii(SANDBOX).doc;
  const economy = new SiiIndex(doc).one("economy");
  const mine = getArray(economy, "discovered_items");
  const scan = { items: new Set([mine[0], "42", "43"]), roads: 2, prefabs: 1, areas: 0, sectors: 1, unverified: 0, archives: [] };
  discoverMap(doc, scan);
  const after = getArray(economy, "discovered_items");
  expect(after.length).toBe(mine.length + 2);
  expect(after.slice(0, mine.length)).toEqual(mine);
  expect(after.includes("42") && after.includes("43")).toBeTruthy();
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
  const homeOf = new Map<string, string>();
  for (const g of idx.all("garage")) {
    const vehicles = getArray(g, "vehicles");
    const drivers = getArray(g, "drivers");
    vehicles.forEach((v, i) => {
      if (v === "null") return;
      parked.push(v);
      if (drivers[i] === "null") return;
      hired.push(drivers[i]);
      homeOf.set(drivers[i], g.id.replace(/^garage\./, ""));
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

  // A hired driver only ever works off the event queue: it has to be on duty at
  // its garage with exactly one "job ends" event ahead of the current game time.
  const queue = getArray(idx.follow(eco, "event_queue"), "data").map((id) => idx.byIdOrNull(id) as Unit);
  const times = queue.map((event) => Number(get(event, "time")));
  expect(times.toSorted((a, b) => a - b), "the queue stays ordered by time").toEqual(times);
  expect(countIdleDrivers(doc)).toBe(0);
  let dispatched = 0;
  for (const driverId of hired) {
    const driver = idx.byIdOrNull(driverId);
    expect(driver).toBeTruthy();
    if (driver.cls !== "driver_ai") continue;
    dispatched++;
    expect(get(driver, "long_dist")).toBe("6");
    expect(get(driver, "hometown")).toBe(homeOf.get(driverId));
    expect(get(driver, "current_city")).toBe(homeOf.get(driverId));
    expect(get(driver, "state")).toBe("2");
    expect(get(driver, "assigned_truck")).toBe("null");
    const events = queue.filter((event) => get(event, "unit_link") === driverId);
    expect(events.map((event) => get(event, "param"))).toEqual(["4"]);
    expect(Number(get(events[0], "time")) > Number(get(eco, "game_time"))).toBeTruthy();
  }
  expect(dispatched).toBe(20);

  // a second pass has nothing left to do
  expect(dispatchIdleDrivers(doc)).toEqual([]);
  expect(getArray(idx.follow(eco, "event_queue"), "data").length).toBe(queue.length);
});

test.skipIf(!hasSandbox)("max skills covers the coach skills and coach experience is its own field", () => {
  const doc = loadSii(SANDBOX).doc;
  const economy = new SiiIndex(doc).one("economy");
  // the sandbox save predates the 1.62 coach skills; give it two of them
  economy.lines.push({ key: "long_duty", index: null, value: "0" }, { key: "ecodriving", index: null, value: "1" });
  const truckXp = get(economy, "experience_points");
  applyPlan(doc, { busExperience: 123456.9, maxSkills: true });
  expect(get(economy, "bus_experience_points")).toBe("123456");
  expect(get(economy, "experience_points")).toBe(truckXp);
  expect(summarize(doc).busSkills).toEqual({ long_duty: "3", ecodriving: "3" });
  expect(get(economy, "long_dist")).toBe("6");
});

test.skipIf(!hasSandbox)("a garage slot may hold the player without a truck, a hired driver may not", () => {
  const doc = loadSii(SANDBOX).doc;
  const idx = new SiiIndex(doc);
  const garage = idx.all("garage").find((g) => getArray(g, "drivers").some((d) => d !== "null"));
  expect(garage, "the sandbox save has a garage with someone in it").toBeTruthy();

  // the game itself parks the player's own record in a slot before any truck is
  // bought - every fresh American Truck Simulator save looks like that
  setArray(garage, "vehicles", getArray(garage, "vehicles").map(() => "null"));
  expect(validate(doc)).toEqual([]);

  const hired = idx.all("driver_ai")[0];
  const drivers = getArray(garage, "drivers");
  drivers[0] = hired.id;
  setArray(garage, "drivers", drivers);
  expect(validate(doc).some((problem) => problem.includes("has no truck in that slot"))).toBeTruthy();
});
