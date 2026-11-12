/**
 * Map discovery and city unlocking.
 *
 * `economy.discovered_items` holds 64-bit map-item UIDs. Those UIDs live in the
 * game's map data, so a full list cannot be synthesised from a save alone. The
 * reliable source is the installed game itself (`scanGameMap`), which always
 * matches the map version and DLC set the save will be loaded with. A donor
 * save only helps as far as its map version goes: against game 1.62 a donor
 * with 95 000 items covered 80 000 of the 181 000 the map actually has.
 *
 * City tokens, on the other hand, are all present inside the save already, in
 * the ids of its `garage`, `company` and `bus_stop` units.
 */
import { SiiIndex, find, get, getArray, setArray, type SiiDocument } from "./model.ts";
import type { MapScan } from "./mapdata.ts";

function sortedCities(ids: Iterable<string>): string[] {
  const cities = new Set<string>();
  for (const id of ids) {
    const city = id.slice(id.lastIndexOf(".") + 1);
    if (city !== "" && !city.startsWith("_")) cities.add(city);
  }
  return [...cities].toSorted();
}

/** Cities with a garage - the ones that can have a truck dealer or a recruitment agency. */
export function garageCities(doc: SiiDocument): string[] {
  return sortedCities(new SiiIndex(doc).all("garage").map((g) => g.id));
}

/** Every city of the installed map; two out of five have companies but no garage. */
export function allCities(doc: SiiDocument): string[] {
  const idx = new SiiIndex(doc);
  const ids = [...idx.all("garage"), ...idx.all("company")].map((unit) => unit.id);
  for (const stop of idx.all("bus_stop")) if (stop.id.startsWith("bus_stop.city.")) ids.push(stop.id);
  return sortedCities(ids);
}

export function visitAllCities(doc: SiiDocument): string[] {
  const idx = new SiiIndex(doc);
  const economy = idx.one("economy");
  // visited_cities_count[i] is how often visited_cities[i] was entered, so known
  // cities keep their place and their count
  const visited = getArray(economy, "visited_cities");
  const counts = getArray(economy, "visited_cities_count");
  const before = visited.length;
  const known = new Set(visited);
  for (const city of allCities(doc)) if (!known.has(city)) visited.push(city);
  setArray(economy, "visited_cities", visited);
  setArray(
    economy,
    "visited_cities_count",
    visited.map((_, i) => counts[i] ?? "1"),
  );
  const garages = garageCities(doc);
  setArray(economy, "unlocked_dealers", garages);
  setArray(economy, "unlocked_recruitments", garages);
  const log = [
    `visited_cities: ${before} -> ${visited.length}`,
    `unlocked dealers and recruitment agencies in ${garages.length} cities`,
  ];
  for (const cls of ["company", "bus_stop"]) {
    const units = idx.all(cls);
    let found = 0;
    for (const unit of units) {
      const flag = find(unit, "discovered");
      if (flag?.value !== "false") continue;
      flag.value = "true";
      found++;
    }
    if (units.length > 0) log.push(`${cls}: discovered ${found} more, ${units.length} in total`);
  }
  return log;
}

/**
 * Marks every road, prefab and map area of the installed game as discovered.
 * Items already in the save stay, so discoveries on mod maps are not lost.
 */
export function discoverMap(doc: SiiDocument, scan: MapScan): string[] {
  const economy = new SiiIndex(doc).one("economy");
  const mine = getArray(economy, "discovered_items");
  const merged = new Set(mine);
  let covered = 0;
  for (const uid of mine) if (scan.items.has(uid)) covered++;
  for (const uid of scan.items) merged.add(uid);
  setArray(economy, "discovered_items", [...merged]);
  const log = [
    `discovered_items: ${mine.length} -> ${merged.size}`,
    `installed map has ${scan.items.size} items (${scan.roads} roads, ${scan.prefabs} prefabs, ` +
      `${scan.areas} map areas) in ${scan.sectors} sectors; the save knew ${covered} of them`,
  ];
  if (scan.unverified > 0) {
    log.push(`${scan.unverified} sectors hold more items than could be recognised - the map may stay below 100%`);
  }
  return log;
}

/**
 * Merges the discovered map items of a donor save into this one. Item UIDs that
 * the installed map does not contain are simply never looked up by the game.
 */
export function mergeDiscovery(doc: SiiDocument, donor: SiiDocument): string[] {
  const target = new SiiIndex(doc).one("economy");
  const source = new SiiIndex(donor).one("economy");
  const log: string[] = [];
  const mineItems = new Set(getArray(target, "discovered_items"));
  const donorItems = getArray(source, "discovered_items");
  const shared = donorItems.filter((uid) => mineItems.has(uid)).length;
  for (const field of ["discovered_items", "discovered_roads"]) {
    const mine = getArray(target, field);
    const theirs = getArray(source, field);
    if (theirs.length === 0) continue;
    const merged = new Set(mine);
    for (const uid of theirs) merged.add(uid);
    setArray(target, field, [...merged]);
    log.push(`${field}: ${mine.length} -> ${merged.size} (donor had ${theirs.length})`);
  }
  log.push(
    `donor shares ${shared} of this save's ${mineItems.size} known items` +
      (shared === 0 ? " - map versions are too far apart to expect much" : ""),
  );
  return log;
}

export function discoverySummary(doc: SiiDocument): string {
  const economy = new SiiIndex(doc).one("economy");
  return (
    `${getArray(economy, "discovered_items").length} items, ` +
    `${getArray(economy, "visited_cities").length} of ${allCities(doc).length} cities visited, ` +
    `last: ${get(economy, "last_visited_city")}`
  );
}
