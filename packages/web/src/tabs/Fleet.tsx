import { useState } from "react";
import type { Ops, SaveDetail } from "../api.ts";
import { Button, NumberField, Panel, Toggle } from "../ui.tsx";

interface Props {
  detail: SaveDetail;
  ops: Ops;
  setOps: (next: Ops) => void;
}

export function FleetTab({ detail, ops, setOps }: Props) {
  const [filter, setFilter] = useState("");
  const staff = ops.staff ?? null;
  const rows = detail.trucks.filter(
    (t) => t.model.includes(filter.toLowerCase()) || t.garage.includes(filter.toLowerCase()),
  );
  const free = detail.garages.filter((g) => g.capacity > g.trucks && g.status !== "0").length;

  return (
    <div className="space-y-5">
      <Panel title="staff the garages">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Toggle
              label="park a truck in every free garage slot"
              hint={`${free} garages have a free slot, ${detail.driverPool} applicants in the pool`}
              checked={staff !== null}
              onChange={(on) => setOps({ ...ops, staff: on ? {} : null })}
            />
            <Toggle
              label="hire a driver for each truck"
              hint="drivers go on the payroll and take 1-2 in-game days before their first job"
              checked={staff !== null && staff.withDrivers !== false}
              onChange={(on) => setOps({ ...ops, staff: { ...(staff ?? {}), withDrivers: on } })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <NumberField
              label="seed"
              placeholder="20260823"
              value={staff?.seed?.toString() ?? ""}
              onChange={(v) => setOps({ ...ops, staff: { ...(staff ?? {}), seed: v === "" ? undefined : Number(v) } })}
            />
            <NumberField
              label="max garages"
              placeholder="all"
              value={staff?.limit?.toString() ?? ""}
              onChange={(v) => setOps({ ...ops, staff: { ...(staff ?? {}), limit: v === "" ? undefined : Number(v) } })}
            />
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Trucks are cloned from your own dealer stock, so every part exists in your DLC set. Strongest engines
          are favoured; the seed decides the mix.
        </p>
        <div className="mt-3">
          <Button onClick={() => setOps({ ...ops, staff: { withDrivers: true } })}>
            one driver + truck per garage
          </Button>
        </div>
      </Panel>

      <Panel
        title={`owned trucks (${detail.trucks.length})`}
        right={
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="filter model or city"
            className="rounded-md border border-[var(--color-edge)] bg-black/30 px-2 py-1 text-xs"
          />
        }
      >
        <div className="max-h-[26rem] overflow-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-[var(--color-panel)] text-slate-500">
              <tr>
                <th className="px-2 py-1.5">model</th>
                <th className="px-2 py-1.5">garage</th>
                <th className="px-2 py-1.5">driver</th>
                <th className="px-2 py-1.5">km</th>
                <th className="px-2 py-1.5">wear</th>
                <th className="px-2 py-1.5">fuel</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {rows.map((t) => (
                <tr key={t.id} className="border-t border-[var(--color-edge)]/60">
                  <td className="px-2 py-1 text-slate-200">{t.model}</td>
                  <td className="px-2 py-1">{t.garage}</td>
                  <td className="px-2 py-1 text-slate-400">{t.driver ?? "-"}</td>
                  <td className="px-2 py-1">{t.odometer}</td>
                  <td className="px-2 py-1">{(t.wear * 100).toFixed(1)}%</td>
                  <td className="px-2 py-1">{(t.fuel * 100).toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
