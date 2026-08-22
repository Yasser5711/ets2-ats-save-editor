import { useEffect, useMemo, useState } from "react";
import { api, type GameRoot, type Ops, type PlanResult, type Profile, type SaveDetail } from "./api.ts";
import { Button, Panel, Stat, money } from "./ui.tsx";
import { EditorTab } from "./tabs/Editor.tsx";
import { GaragesTab } from "./tabs/Garages.tsx";
import { FleetTab } from "./tabs/Fleet.tsx";
import { MapTab } from "./tabs/Map.tsx";
import { RawTab } from "./tabs/Raw.tsx";
import { DoctorTab } from "./tabs/Doctor.tsx";

const TABS = ["Career", "Garages", "Fleet", "Map", "Units", "Doctor"] as const;
type Tab = (typeof TABS)[number];

export function App() {
  const [roots, setRoots] = useState<GameRoot[]>([]);
  const [root, setRoot] = useState<GameRoot | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [slotPath, setSlotPath] = useState<string | null>(null);
  const [detail, setDetail] = useState<SaveDetail | null>(null);
  const [ops, setOps] = useState<Ops>({});
  const [plan, setPlan] = useState<PlanResult | null>(null);
  const [tab, setTab] = useState<Tab>("Career");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const env = await api.env();
      setRoots(env.roots);
      setRoot(env.roots[0] ?? null);
    };
    load().catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!root) return;
    api.profiles(root.path).then(setProfiles).catch((e: Error) => setError(e.message));
  }, [root]);

  const loadSlot = (path: string) => {
    setSlotPath(path);
    setDetail(null);
    setOps({});
    setPlan(null);
    setBusy("reading save");
    api
      .save(path)
      .then(setDetail)
      .catch((e: Error) => setError(e.message))
      .finally(() => setBusy(null));
  };

  const dirty = useMemo(
    () =>
      Boolean(
        ops.visitAllCities ||
          ops.importDiscovery ||
          ops.staff ||
          (ops.fields && ops.fields.length > 0) ||
          (ops.edits && Object.keys(ops.edits).length > 0),
      ),
    [ops],
  );

  useEffect(() => {
    if (!slotPath || !dirty) return;
    let alive = true;
    setBusy("previewing");
    const preview = async () => {
      try {
        const result = await api.plan(slotPath, ops);
        if (alive) setPlan(result);
      } catch (e) {
        if (alive) setError((e as Error).message);
      } finally {
        if (alive) setBusy(null);
      }
    };
    void preview();
    return () => {
      alive = false;
    };
  }, [slotPath, ops, dirty]);

  const apply = (cloneAs?: string) => {
    if (!slotPath) return;
    setBusy(cloneAs ? "writing new slot" : "writing save");
    setError(null);
    const write = async () => {
      const result = await api.apply(slotPath, ops, cloneAs);
      if (!result.written) {
        setError(`refused: ${result.problems.slice(0, 3).join("; ")}`);
        return;
      }
      setNotice(
        cloneAs ? `written to a new slot: ${result.target}` : `written, backup kept as backups/${result.backup}`,
      );
      setOps({});
      loadSlot(cloneAs ? result.target : slotPath);
      if (root) setProfiles(await api.profiles(root.path));
    };
    write()
      .catch((e: Error) => setError(e.message))
      .finally(() => setBusy(null));
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-4 border-b border-[var(--color-edge)] bg-[var(--color-panel)] px-5 py-3">
        <div className="text-sm font-bold tracking-[0.2em] text-amber-500 uppercase">Truck Save Editor</div>
        <select
          value={root?.path ?? ""}
          onChange={(e) => setRoot(roots.find((r) => r.path === e.target.value) ?? null)}
          className="rounded-md border border-[var(--color-edge)] bg-black/30 px-2 py-1 text-sm"
        >
          {roots.map((r) => (
            <option key={r.path} value={r.path}>
              {r.name}
            </option>
          ))}
        </select>
        {root?.running && (
          <span className="rounded-md border border-red-800 bg-red-950/60 px-2 py-1 text-xs text-red-200">
            game is running - it will overwrite saves on exit
          </span>
        )}
        <div className="ml-auto flex items-center gap-2 text-xs text-slate-500">
          {busy && <span className="text-amber-400">{busy}...</span>}
          {detail && <span>{detail.units.toLocaleString()} units</span>}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="w-72 shrink-0 overflow-y-auto border-r border-[var(--color-edge)] bg-black/20 p-3">
          {profiles.map((profile) => (
            <div key={profile.path} className="mb-4">
              <div className="px-1 pb-1 text-xs font-semibold text-slate-300">
                {profile.name}
                {profile.steam && <span className="ml-1 text-[10px] text-slate-500">steam</span>}
              </div>
              {profile.slots.map((slot) => (
                <button
                  key={slot.path}
                  onClick={() => loadSlot(slot.path)}
                  className={`block w-full cursor-pointer rounded-md px-2 py-1.5 text-left text-xs hover:bg-slate-800 ${
                    slotPath === slot.path ? "bg-slate-800 ring-1 ring-amber-500/60" : ""
                  }`}
                >
                  <div className="truncate text-slate-200">{slot.name || slot.slot}</div>
                  <div className="text-[10px] text-slate-500">
                    {slot.slot} · {slot.modified.slice(0, 16).replace("T", " ")} ·{" "}
                    {(slot.bytes / 1048576).toFixed(1)} MB
                    {!slot.encrypted && " · text"}
                  </div>
                </button>
              ))}
            </div>
          ))}
          {profiles.length === 0 && <div className="p-2 text-xs text-slate-500">no profiles found</div>}
        </aside>

        <main className="min-w-0 flex-1 overflow-y-auto p-5">
          {error && (
            <div className="mb-4 rounded-md border border-red-800 bg-red-950/50 px-3 py-2 text-sm text-red-200">
              {error}
              <button className="ml-3 cursor-pointer text-xs underline" onClick={() => setError(null)}>
                dismiss
              </button>
            </div>
          )}
          {notice && (
            <div className="mb-4 rounded-md border border-emerald-800 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-200">
              {notice}
              <button className="ml-3 cursor-pointer text-xs underline" onClick={() => setNotice(null)}>
                ok
              </button>
            </div>
          )}

          {!detail && <div className="text-sm text-slate-500">Pick a save on the left to begin.</div>}

          {detail && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
                <Stat label="money" value={money(detail.summary.money)} />
                <Stat label="experience" value={money(detail.summary.experience)} />
                <Stat
                  label="garages"
                  value={`${detail.summary.garagesOwned}/${detail.summary.garagesTotal}`}
                />
                <Stat label="trucks" value={detail.trucks.length} hint={`${detail.drivers - 1} drivers`} />
                <Stat
                  label="cities"
                  value={`${detail.summary.visitedCities}/${detail.cities}`}
                  hint="visited"
                />
                <Stat label="container" value={detail.container.split(" -> ")[0]} hint={detail.discovery.split(",")[0]} />
              </div>

              <nav className="flex gap-1 border-b border-[var(--color-edge)]">
                {TABS.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`cursor-pointer px-3 py-2 text-sm ${
                      tab === t
                        ? "border-b-2 border-amber-500 text-amber-400"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </nav>

              {tab === "Career" && <EditorTab detail={detail} ops={ops} setOps={setOps} />}
              {tab === "Garages" && <GaragesTab detail={detail} ops={ops} setOps={setOps} />}
              {tab === "Fleet" && <FleetTab detail={detail} ops={ops} setOps={setOps} />}
              {tab === "Map" && <MapTab detail={detail} ops={ops} setOps={setOps} />}
              {tab === "Units" && <RawTab path={detail.path} ops={ops} setOps={setOps} />}
              {tab === "Doctor" && <DoctorTab root={root} path={detail.path} />}

              <Panel
                title="pending changes"
                right={
                  <div className="flex gap-2">
                    <Button tone="ghost" onClick={() => setOps({})} disabled={!dirty}>
                      reset
                    </Button>
                    <Button
                      onClick={() => apply(`edited ${new Date().toISOString().slice(5, 16)}`)}
                      disabled={!dirty || (plan?.problems.length ?? 0) > 0}
                    >
                      write to new slot
                    </Button>
                    <Button
                      tone="primary"
                      onClick={() => apply()}
                      disabled={!dirty || (plan?.problems.length ?? 0) > 0}
                    >
                      overwrite this save
                    </Button>
                  </div>
                }
              >
                {!dirty && <div className="text-sm text-slate-500">No changes staged.</div>}
                {dirty && plan && (
                  <div className="space-y-2">
                    {plan.problems.length > 0 && (
                      <div className="rounded-md border border-red-800 bg-red-950/50 p-2 text-xs text-red-200">
                        {plan.problems.slice(0, 6).map((p) => (
                          <div key={p}>{p}</div>
                        ))}
                      </div>
                    )}
                    <div className="text-xs text-slate-500">
                      units {plan.unitsBefore.toLocaleString()} → {plan.unitsAfter.toLocaleString()} ·{" "}
                      {plan.discovery}
                    </div>
                    <pre className="max-h-64 overflow-auto rounded-md bg-black/40 p-3 font-mono text-xs leading-relaxed text-slate-300">
                      {plan.log.join("\n")}
                    </pre>
                  </div>
                )}
              </Panel>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
