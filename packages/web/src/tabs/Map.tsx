import { useState } from "react";
import type { Ops, SaveDetail } from "../api.ts";
import { Button, NumberField, Panel, Toggle } from "../ui.tsx";

interface Props {
  detail: SaveDetail;
  ops: Ops;
  setOps: (next: Ops) => void;
}

export function MapTab({ detail, ops, setOps }: Props) {
  const [donor, setDonor] = useState(ops.importDiscovery ?? "");

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Panel title="cities">
        <Toggle
          label={`visit all ${detail.cities} cities`}
          hint="also unlocks every truck dealer and recruitment agency"
          checked={Boolean(ops.visitAllCities)}
          onChange={(v) => setOps({ ...ops, visitAllCities: v || undefined })}
        />
        <div className="mt-3 font-mono text-xs text-slate-500">
          now: {detail.summary.visitedCities} visited · {detail.summary.unlockedDealers} dealers
        </div>
      </Panel>

      <Panel title="road discovery">
        <p className="mb-3 text-xs text-slate-500">
          Discovered roads are stored as map-item ids that live in the game's map files, so they can only be
          copied from another save. Point this at a fully-explored <code>game.sii</code> of a similar version.
        </p>
        <NumberField label="donor game.sii path" value={donor} onChange={setDonor} placeholder="C:\...\game.sii" />
        <div className="mt-3 flex gap-2">
          <Button
            onClick={() => setOps({ ...ops, importDiscovery: donor.trim() || undefined })}
            disabled={donor.trim() === ""}
          >
            stage import
          </Button>
          {ops.importDiscovery && (
            <Button tone="ghost" onClick={() => setOps({ ...ops, importDiscovery: undefined })}>
              clear
            </Button>
          )}
        </div>
        <div className="mt-3 font-mono text-xs text-slate-500">{detail.discovery}</div>
      </Panel>
    </div>
  );
}
