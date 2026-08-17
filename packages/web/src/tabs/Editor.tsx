import type { Ops, SaveDetail } from "../api.ts";
import { Button, NumberField, Panel, Toggle, money } from "../ui.tsx";

interface Props {
  detail: SaveDetail;
  ops: Ops;
  setOps: (next: Ops) => void;
}

export function EditorTab({ detail, ops, setOps }: Props) {
  const edits = ops.edits ?? {};
  const patch = (next: Partial<NonNullable<Ops["edits"]>>) => setOps({ ...ops, edits: { ...edits, ...next } });

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Panel title="money and experience">
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label={`money (now ${money(detail.summary.money)})`}
            value={edits.money?.toString() ?? ""}
            placeholder="unchanged"
            onChange={(v) => patch({ money: v === "" ? undefined : Number(v) })}
          />
          <NumberField
            label={`experience (now ${money(detail.summary.experience)})`}
            value={edits.experience?.toString() ?? ""}
            placeholder="unchanged"
            onChange={(v) => patch({ experience: v === "" ? undefined : Number(v) })}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {[1_000_000, 10_000_000, 100_000_000, 1_000_000_000].map((amount) => (
            <Button key={amount} onClick={() => patch({ money: amount })}>
              {money(String(amount))} €
            </Button>
          ))}
          <Button onClick={() => patch({ experience: 10_000_000 })}>max level xp</Button>
        </div>
      </Panel>

      <Panel title="skills">
        <div className="mb-3 flex flex-wrap gap-2 font-mono text-xs text-slate-400">
          <span>adr={detail.summary.adr}</span>
          {Object.entries(detail.summary.skills).map(([k, v]) => (
            <span key={k}>
              {k}={v}
            </span>
          ))}
        </div>
        <Toggle
          label="all skills to 6 stars, every ADR class"
          hint="long distance, high value, fragile, urgent, mechanical"
          checked={Boolean(edits.maxSkills)}
          onChange={(v) => patch({ maxSkills: v || undefined })}
        />
      </Panel>

      <Panel title="fleet condition">
        <Toggle
          label="repair every owned vehicle"
          hint="clears wear including the permanent share that stops AI drivers at 30%"
          checked={Boolean(edits.repairVehicles)}
          onChange={(v) => patch({ repairVehicles: v || undefined })}
        />
        <Toggle
          label="fill every tank"
          checked={Boolean(edits.refuelVehicles)}
          onChange={(v) => patch({ refuelVehicles: v || undefined })}
        />
      </Panel>

      <Panel title="save health">
        {detail.problems.length === 0 ? (
          <div className="text-sm text-emerald-400">
            consistent · {detail.units.toLocaleString()} units · hq {detail.summary.hqCity}
          </div>
        ) : (
          <ul className="space-y-1 text-xs text-red-300">
            {detail.problems.slice(0, 12).map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
