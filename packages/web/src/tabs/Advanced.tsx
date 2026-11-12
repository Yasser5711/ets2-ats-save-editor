import { useEffect, useState, type ReactNode } from "react";
import { FolderOpen } from "lucide-react";
import { api, type Ops, type SaveDetail, type UnitHit } from "@/api.ts";
import { useI18n } from "@/lib/i18n.tsx";
import { pickFolder } from "@/lib/platform.ts";
import { NumberField } from "@/components/field.tsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";

interface Props {
  detail: SaveDetail;
  ops: Ops;
  setOps: (next: Ops) => void;
}

function Panel({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <section className="bg-card ring-foreground/10 space-y-3 rounded-xl p-4 ring-1">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="text-muted-foreground mt-0.5 text-[13px]">{hint}</p>
      </div>
      {children}
    </section>
  );
}

export function AdvancedTab({ detail, ops, setOps }: Props) {
  const { t, num } = useI18n();
  const [donor, setDonor] = useState(ops.importDiscovery ?? "");
  const edits = ops.edits ?? {};
  const patch = (next: Partial<NonNullable<Ops["edits"]>>) => setOps({ ...ops, edits: { ...edits, ...next } });
  const staff = ops.staff ?? null;
  const patchStaff = (next: Partial<NonNullable<Ops["staff"]>>) => setOps({ ...ops, staff: { ...staff, ...next } });

  const browseDonor = async () => {
    const folder = await pickFolder(t("adv.donorPick"));
    if (folder !== null) setDonor(`${folder}/game.sii`.replaceAll("\\", "/"));
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={t("adv.values")} hint={t("adv.valuesHint")}>
          <div className="grid grid-cols-2 gap-3">
            <NumberField
              label={`${t("adv.xp")} (${num(detail.summary.experience)})`}
              value={edits.experience}
              placeholder={t("adv.unchanged")}
              onChange={(experience) => patch({ experience })}
            />
            {detail.summary.busExperience !== null && (
              <NumberField
                label={`${t("adv.busXp")} (${num(detail.summary.busExperience)})`}
                value={edits.busExperience}
                placeholder={t("adv.unchanged")}
                onChange={(busExperience) => patch({ busExperience })}
              />
            )}
          </div>
        </Panel>

        <Panel title={t("adv.fleet")} hint={t("adv.fleetHint")}>
          <label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
            {t("adv.withDrivers")}
            <Switch
              checked={staff !== null && staff.withDrivers !== false}
              disabled={staff === null}
              onCheckedChange={(withDrivers) => patchStaff({ withDrivers })}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <NumberField
              label={t("adv.seed")}
              value={staff?.seed}
              placeholder="20260823"
              disabled={staff === null}
              onChange={(seed) => patchStaff({ seed })}
            />
            <NumberField
              label={t("adv.limit")}
              value={staff?.limit}
              placeholder={t("adv.all")}
              disabled={staff === null}
              onChange={(limit) => patchStaff({ limit })}
            />
          </div>
        </Panel>
      </div>

      <Panel title={t("adv.donor")} hint={t("adv.donorHint")}>
        <div className="flex gap-2">
          <Input
            value={donor}
            onChange={(e) => setDonor(e.target.value)}
            placeholder="C:\...\save\1\game.sii"
            className="font-mono text-xs"
          />
          <Button variant="outline" size="icon" onClick={browseDonor} aria-label={t("adv.donorPick")}>
            <FolderOpen />
          </Button>
          {ops.importDiscovery ? (
            <Button variant="ghost" onClick={() => setOps({ ...ops, importDiscovery: undefined })}>
              {t("adv.donorRemove")}
            </Button>
          ) : (
            <Button
              variant="outline"
              disabled={donor.trim() === ""}
              onClick={() => setOps({ ...ops, importDiscovery: donor.trim() })}
            >
              {t("adv.donorAdd")}
            </Button>
          )}
        </div>
      </Panel>

      <Panel title={t("adv.units")} hint={t("adv.unitsHint", { n: num(detail.units) })}>
        <UnitEditor path={detail.path} ops={ops} setOps={setOps} />
      </Panel>
    </div>
  );
}

function UnitEditor({ path, ops, setOps }: { path: string; ops: Ops; setOps: (next: Ops) => void }) {
  const { t } = useI18n();
  const [query, setQuery] = useState("economy");
  const [hits, setHits] = useState<UnitHit[]>([]);
  const [selected, setSelected] = useState<UnitHit | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    let alive = true;
    const search = async () => {
      const result = await api.units(path, query);
      if (alive) setHits(result.hits);
    };
    void search();
    return () => {
      alive = false;
    };
  }, [path, query]);

  const keep = (key: string, value: string) => {
    if (!selected) return;
    const others = (ops.fields ?? []).filter((f) => !(f.unitId === selected.id && f.key === key));
    setOps({ ...ops, fields: [...others, { unitId: selected.id, key, value }] });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
      <div className="space-y-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("adv.unitsSearch")}
          className="h-8 font-mono text-xs"
        />
        <p className="text-muted-foreground text-xs">{t("adv.unitsShown", { n: hits.length })}</p>
        <ScrollArea className="h-80">
          {hits.map((hit) => (
            <button
              key={hit.id}
              onClick={() => {
                setSelected(hit);
                setDraft({});
              }}
              className={`hover:bg-accent block w-full cursor-pointer truncate rounded px-2 py-1 text-left font-mono text-[11px] ${
                selected?.id === hit.id ? "bg-accent text-primary" : ""
              }`}
            >
              {hit.cls} <span className="text-muted-foreground">{hit.id}</span>
            </button>
          ))}
        </ScrollArea>
      </div>

      {!selected && <p className="text-muted-foreground text-sm">{t("adv.unitsPick")}</p>}
      {selected && (
        <ScrollArea className="h-[23.5rem]">
          <p className="truncate pb-2 font-mono text-xs font-semibold">
            {selected.cls} : {selected.id}
          </p>
          <table className="w-full text-left font-mono text-xs">
            <tbody>
              {selected.lines.map((line) => {
                const name = line.index === null ? line.key : `${line.key}[${line.index}]`;
                const staged = (ops.fields ?? []).find((f) => f.unitId === selected.id && f.key === line.key);
                return (
                  <tr key={name} className="border-t">
                    <td className="text-muted-foreground w-1/3 px-2 py-1">{name}</td>
                    <td className="px-2 py-1">
                      {line.index === null ? (
                        <Input
                          value={draft[line.key] ?? staged?.value ?? line.value}
                          onChange={(e) => setDraft({ ...draft, [line.key]: e.target.value })}
                          className={`h-7 font-mono text-xs ${staged ? "border-primary text-primary" : ""}`}
                        />
                      ) : (
                        <span className="text-muted-foreground">{line.value}</span>
                      )}
                    </td>
                    <td className="w-20 px-2 py-1">
                      {line.index === null && draft[line.key] !== undefined && draft[line.key] !== line.value && (
                        <Button variant="secondary" size="sm" onClick={() => keep(line.key, draft[line.key])}>
                          {t("adv.keep")}
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </ScrollArea>
      )}
    </div>
  );
}
