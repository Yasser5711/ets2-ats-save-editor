import { useState } from "react";
import type { Ops, SaveDetail } from "../api.ts";
import { Button, Panel } from "../ui.tsx";

const SIZES: { status: number; label: string; slots: number }[] = [
  { status: 0, label: "not owned", slots: 0 },
  { status: 6, label: "tiny", slots: 1 },
  { status: 2, label: "small", slots: 3 },
  { status: 3, label: "large", slots: 5 },
];

interface Props {
  detail: SaveDetail;
  ops: Ops;
  setOps: (next: Ops) => void;
}

export function GaragesTab({ detail, ops, setOps }: Props) {
  const [filter, setFilter] = useState("");
  const rows = detail.garages.filter((g) => g.city.includes(filter.toLowerCase()));
  const chosen = ops.edits?.garageStatus;

  return (
    <div className="space-y-5">
      <Panel
        title="buy or upgrade every garage"
        right={
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="filter city"
            className="rounded-md border border-[var(--color-edge)] bg-black/30 px-2 py-1 text-xs"
          />
        }
      >
        <div className="flex flex-wrap gap-2">
          {SIZES.map((size) => (
            <Button
              key={size.status}
              tone={chosen === size.status ? "primary" : "default"}
              onClick={() =>
                setOps({
                  ...ops,
                  edits: {
                    ...ops.edits,
                    garageStatus: chosen === size.status ? undefined : size.status,
                  },
                })
              }
            >
              {size.label} · {size.slots} slots
            </Button>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Slot arrays are resized with the status. Garages holding more trucks than the new size allows are
          skipped instead of losing vehicles.
        </p>
      </Panel>

      <Panel title={`garages (${rows.length})`}>
        <div className="max-h-[26rem] overflow-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-[var(--color-panel)] text-slate-500">
              <tr>
                <th className="px-2 py-1.5">city</th>
                <th className="px-2 py-1.5">status</th>
                <th className="px-2 py-1.5">slots</th>
                <th className="px-2 py-1.5">trucks</th>
                <th className="px-2 py-1.5">drivers</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {rows.map((g) => (
                <tr key={g.id} className="border-t border-[var(--color-edge)]/60">
                  <td className="px-2 py-1 text-slate-200">{g.city}</td>
                  <td className="px-2 py-1">
                    {SIZES.find((s) => s.status === Number(g.status))?.label ?? g.status}
                  </td>
                  <td className="px-2 py-1 text-slate-500">{g.capacity}</td>
                  <td className="px-2 py-1">{g.trucks}</td>
                  <td className="px-2 py-1">{g.drivers}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
