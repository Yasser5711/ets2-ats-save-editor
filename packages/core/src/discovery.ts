/**
 * Map discovery and city unlocking.
 *
 * `economy.discovered_items` holds 64-bit map-item UIDs. Those UIDs live in the
 * game's map data, so a full list cannot be synthesised from a save alone; it can
 * only be copied from a save of a comparable map version. UIDs are stable for
 * items that survive a map rework: 965 of the 1827 items in our 1.61 test save
 * also appear in an unrelated older save, which is why merging a donor list works.
 *
 * City tokens, on the other hand, are all present inside the save already: every
 * city of the installed map has its own `garage : garage.<city>` unit.
 */
import { SiiIndex, get, getArray, set, setArray, type SiiDocument } from "./model.ts";

export function allCities(doc: SiiDocument): string[] {
  const cities = new Set<string>();
  for (const g of new SiiIndex(doc).all("garage")) {
    const city = g.id.replace(/^garage\./, "");
    if (city !== "" && !city.startsWith("_")) cities.add(city);
  }
  return [...cities].sort();
}

export function visitAllCities(doc: SiiDocument): string[] {
  const idx = new SiiIndex(doc);
  const economy = idx.one("economy");
  const cities = allCities(doc);
  const before = getArray(economy, "visited_cities").length;
  setArray(economy, "visited_cities", cities);
  set(economy, "visited_cities_count", cities.length);
  setArray(economy, "unlocked_dealers", cities);
  setArray(economy, "unlocked_recruitments", cities);
  return [
    `visited_cities: ${before} -> ${cities.length}`,
    `unlocked dealers and recruitment agencies in ${cities.length} cities`,
  ];
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
