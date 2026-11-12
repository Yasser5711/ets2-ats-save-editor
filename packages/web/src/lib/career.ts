import type { Summary } from "@/api.ts";

/**
 * Experience needed to leave each level, from /def/economy_data_xp.sii; coach
 * levels use the same table. Past the last entry every level costs the same.
 */
const LEVEL_XP = [
  200, 500, 700, 900, 1000, 1100, 1300, 1600, 1700, 2100, 2300, 2600, 2700, 2900, 3000, 3100, 3400, 3700, 4000,
  4300, 4600, 4700, 4900, 5200, 5700, 5900, 6000, 6200, 6600, 6800,
];

export function levelOf(experience: string | number): number {
  let left = Number(experience);
  if (!Number.isFinite(left)) return 0;
  let level = 0;
  while (left >= LEVEL_XP[Math.min(level, LEVEL_XP.length - 1)]) {
    left -= LEVEL_XP[Math.min(level, LEVEL_XP.length - 1)];
    level++;
  }
  return level;
}

/** Enough experience for any level the game asks for. */
export const MAX_XP = 10_000_000;
export const GARAGE_LARGE = 3;

const TRUCK_SKILL_MAX = 6;
const COACH_SKILL_MAX = 3;
const ADR_ALL = 63;

/** How many skills sit at their maximum, ADR counted as one. */
export function skillsAtMax(summary: Summary): { done: number; total: number } {
  const truck = Object.values(summary.skills);
  const coach = Object.values(summary.busSkills);
  const done =
    truck.filter((rank) => Number(rank) >= TRUCK_SKILL_MAX).length +
    coach.filter((rank) => Number(rank) >= COACH_SKILL_MAX).length +
    (Number(summary.adr) >= ADR_ALL ? 1 : 0);
  return { done, total: truck.length + coach.length + 1 };
}
