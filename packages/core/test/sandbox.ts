import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/** First save slot of the first profile in the local sandbox copy, when present. */
export function sandboxSave(): string | null {
  const root = fileURLToPath(new URL("../../../sandbox/Euro Truck Simulator 2/profiles", import.meta.url));
  if (!existsSync(root)) return null;
  for (const profile of readdirSync(root)) {
    const slots = join(root, profile, "save");
    if (!existsSync(slots)) continue;
    for (const slot of readdirSync(slots)) {
      const game = join(slots, slot, "game.sii");
      if (existsSync(game)) return game;
    }
  }
  return null;
}

export function sandboxRoot(): string | null {
  const root = fileURLToPath(new URL("../../../sandbox/Euro Truck Simulator 2", import.meta.url));
  return existsSync(join(root, "profiles")) ? root : null;
}
