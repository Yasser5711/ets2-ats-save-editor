import { api as apiUrl } from "./lib/platform.ts";

export interface GameRoot {
  id: string;
  name: string;
  path: string;
  running: boolean;
}

export interface SaveSlot {
  slot: string;
  path: string;
  name: string;
  modified: string;
  bytes: number;
  encrypted: boolean;
}

export interface Profile {
  dir: string;
  name: string;
  steam: boolean;
  path: string;
  slots: SaveSlot[];
}

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

export interface GarageRow {
  id: string;
  city: string;
  status: string;
  capacity: number;
  trucks: number;
  drivers: number;
}

export interface TruckRow {
  id: string;
  model: string;
  garage: string;
  driver: string | null;
  odometer: string;
  wear: number;
  fuel: number;
}

export interface SaveDetail {
  path: string;
  container: string;
  units: number;
  summary: Summary;
  discovery: string;
  cities: number;
  drivers: number;
  driverPool: number;
  garages: GarageRow[];
  trucks: TruckRow[];
  problems: string[];
}

export interface Ops {
  edits?: {
    money?: number;
    experience?: number;
    maxSkills?: boolean;
    garageStatus?: number;
    repairVehicles?: boolean;
    refuelVehicles?: boolean;
  };
  visitAllCities?: boolean;
  importDiscovery?: string;
  staff?: { seed?: number; withDrivers?: boolean; limit?: number } | null;
  fields?: { unitId: string; key: string; value: string }[];
}

export interface PlanResult {
  log: string[];
  problems: string[];
  unitsBefore: number;
  unitsAfter: number;
  summary: Summary;
  discovery: string;
}

export interface ApplyResult extends Omit<PlanResult, "unitsBefore" | "unitsAfter" | "summary" | "discovery"> {
  written: boolean;
  target: string;
  backup?: string | null;
}

export interface LogIssue {
  time: string;
  text: string;
  hint: string | null;
}

export interface UnitHit {
  cls: string;
  id: string;
  lines: { key: string; index: number | null; value: string }[];
}

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(apiUrl(url), init);
  const data: unknown = await res.json();
  if (!res.ok) {
    const message =
      data && typeof data === "object" && "error" in data && typeof data.error === "string"
        ? data.error
        : res.statusText;
    throw new Error(message);
  }
  return data as T;
}

export interface RootCheck {
  ok: boolean;
  path: string;
  game: string | null;
  profiles: number;
}

export const api = {
  validateRoot: (path: string) =>
    json<RootCheck>(`/api/validate-root?path=${encodeURIComponent(path)}`),
  env: () => json<{ roots: GameRoot[]; games: { id: string; name: string }[] }>("/api/env"),
  profiles: (root: string) => json<Profile[]>(`/api/profiles?root=${encodeURIComponent(root)}`),
  save: (path: string) => json<SaveDetail>(`/api/save?path=${encodeURIComponent(path)}`),
  units: (path: string, q: string) =>
    json<{ total: number; hits: UnitHit[] }>(
      `/api/units?path=${encodeURIComponent(path)}&q=${encodeURIComponent(q)}`,
    ),
  backups: (path: string) =>
    json<{ file: string; modified: string; bytes: number }[]>(`/api/backups?path=${encodeURIComponent(path)}`),
  log: (root: string) => json<LogIssue[]>(`/api/log?root=${encodeURIComponent(root)}`),
  plan: (path: string, ops: Ops) =>
    json<PlanResult>("/api/plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path, ops }),
    }),
  apply: (path: string, ops: Ops, cloneAs?: string) =>
    json<ApplyResult>("/api/apply", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path, ops, cloneAs }),
    }),
  restore: (path: string, file: string) =>
    json<{ restored: string }>("/api/restore", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path, file }),
    }),
};
