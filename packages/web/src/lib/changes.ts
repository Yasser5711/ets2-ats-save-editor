import type { Ops } from "@/api.ts";
import type { I18n } from "./i18n.tsx";
import type { MessageKey } from "./messages.ts";
import { MAX_XP } from "./career.ts";

export interface Change {
  id: string;
  label: string;
  /** the staged operations without this change */
  without: Ops;
}

type Edits = NonNullable<Ops["edits"]>;

export const currencyOf = (gameId: string) => (gameId === "ats" ? "$" : "€");

/** The staged operations as the list of things a player asked for. */
export function pendingChanges(ops: Ops, i18n: I18n, gameId: string): Change[] {
  const { t, num, plural } = i18n;
  const edits = ops.edits ?? {};
  const changes: Change[] = [];
  // the label is only worked out for a value that is really staged
  const edit = <K extends keyof Edits>(key: K, label: (value: NonNullable<Edits[K]>) => string) => {
    const value = edits[key];
    if (value === undefined) return;
    changes.push({
      id: key,
      label: label(value as NonNullable<Edits[K]>),
      without: { ...ops, edits: { ...edits, [key]: undefined } },
    });
  };
  const flag = (key: Exclude<keyof Ops, "edits">, label: string) => {
    const value = ops[key];
    if (!value || (Array.isArray(value) && value.length === 0)) return;
    changes.push({ id: key, label, without: { ...ops, [key]: undefined } });
  };

  edit("money", (amount) => t("change.money", { amount: `${num(amount)} ${currencyOf(gameId)}` }));
  edit("experience", (xp) => (xp === MAX_XP ? t("change.xpMax") : t("change.xp", { n: num(xp) })));
  edit("busExperience", (xp) => (xp === MAX_XP ? t("change.busXpMax") : t("change.busXp", { n: num(xp) })));
  edit("maxSkills", () => t("change.skills"));
  edit("garageStatus", (status) => t("change.garages", { size: t(`size.${status}` as MessageKey) }));
  flag("staff", t(ops.staff?.withDrivers === false ? "change.staffNoDrivers" : "change.staff"));
  flag("dispatchDrivers", t("change.dispatch"));
  edit("repairVehicles", () => t("change.repair"));
  edit("refuelVehicles", () => t("change.refuel"));
  flag("discoverMap", t("change.map"));
  flag("visitAllCities", t("change.cities"));
  flag("importDiscovery", t("change.donor"));
  flag("fields", plural("change.fields", ops.fields?.length ?? 0));
  return changes;
}
