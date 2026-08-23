import type { Ops, SaveDetail } from "@/api.ts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NumberField, ToggleRow } from "@/components/field.tsx";
import { money } from "@/components/stat-card.tsx";

interface Props {
  detail: SaveDetail;
  ops: Ops;
  setOps: (next: Ops) => void;
}

const AMOUNTS = [1_000_000, 10_000_000, 100_000_000, 1_000_000_000];

export function EditorTab({ detail, ops, setOps }: Props) {
  const edits = ops.edits ?? {};
  const patch = (next: Partial<NonNullable<Ops["edits"]>>) => setOps({ ...ops, edits: { ...edits, ...next } });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Money and experience</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <NumberField
              label={`money · now ${money(detail.summary.money)}`}
              value={edits.money?.toString() ?? ""}
              placeholder="unchanged"
              onChange={(v) => patch({ money: v === "" ? undefined : Number(v) })}
            />
            <NumberField
              label={`experience · now ${money(detail.summary.experience)}`}
              value={edits.experience?.toString() ?? ""}
              placeholder="unchanged"
              onChange={(v) => patch({ experience: v === "" ? undefined : Number(v) })}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {AMOUNTS.map((amount) => (
              <Button key={amount} variant="outline" size="sm" onClick={() => patch({ money: amount })}>
                {money(String(amount))} €
              </Button>
            ))}
            <Button variant="outline" size="sm" onClick={() => patch({ experience: 10_000_000 })}>
              max level xp
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Skills</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="secondary" className="font-mono">
              adr {detail.summary.adr}
            </Badge>
            {Object.entries(detail.summary.skills).map(([skill, level]) => (
              <Badge key={skill} variant="secondary" className="font-mono">
                {skill} {level}
              </Badge>
            ))}
          </div>
          <ToggleRow
            label="All skills to 6 stars, every ADR class"
            hint="long distance, high value, fragile, urgent, mechanical"
            checked={Boolean(edits.maxSkills)}
            onChange={(v) => patch({ maxSkills: v || undefined })}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Fleet condition</CardTitle>
        </CardHeader>
        <CardContent>
          <ToggleRow
            label="Repair every owned vehicle"
            hint="clears wear including the permanent share that stops AI drivers at 30%"
            checked={Boolean(edits.repairVehicles)}
            onChange={(v) => patch({ repairVehicles: v || undefined })}
          />
          <ToggleRow
            label="Fill every tank"
            checked={Boolean(edits.refuelVehicles)}
            onChange={(v) => patch({ refuelVehicles: v || undefined })}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Save health</CardTitle>
        </CardHeader>
        <CardContent>
          {detail.problems.length === 0 ? (
            <p className="text-sm text-emerald-400">
              consistent · {detail.units.toLocaleString()} units · hq {detail.summary.hqCity}
            </p>
          ) : (
            <ul className="text-destructive space-y-1 text-xs">
              {detail.problems.slice(0, 12).map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
