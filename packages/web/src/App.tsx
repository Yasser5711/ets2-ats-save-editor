import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, FolderOpen, Loader2, RotateCcw, Save, SaveAll, Truck } from "lucide-react";
import { api, type GameRoot, type Ops, type PlanResult, type Profile, type SaveDetail } from "@/api.ts";
import { initPlatform, isDesktop, loadSettings, pickFolder, saveSettings } from "@/lib/platform.ts";
import { SetupScreen } from "@/components/setup-screen.tsx";
import { StatCard, money } from "@/components/stat-card.tsx";
import { EditorTab } from "@/tabs/Editor.tsx";
import { GaragesTab } from "@/tabs/Garages.tsx";
import { FleetTab } from "@/tabs/Fleet.tsx";
import { MapTab } from "@/tabs/Map.tsx";
import { RawTab } from "@/tabs/Raw.tsx";
import { DoctorTab } from "@/tabs/Doctor.tsx";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";

const TABS = ["Career", "Garages", "Fleet", "Map", "Units", "Doctor"] as const;

export function App() {
  const [ready, setReady] = useState(false);
  const [root, setRoot] = useState<GameRoot | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [slotPath, setSlotPath] = useState<string | null>(null);
  const [detail, setDetail] = useState<SaveDetail | null>(null);
  const [ops, setOps] = useState<Ops>({});
  const [plan, setPlan] = useState<PlanResult | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const boot = async () => {
      await initPlatform();
      const settings = await loadSettings();
      if (settings.root !== null) {
        const check = await api.validateRoot(settings.root);
        if (check.ok) {
          setRoot({
            id: settings.gameId ?? "ets2",
            name: check.game ?? "Game folder",
            path: settings.root,
            running: false,
            source: "documents",
            profiles: check.profiles,
            saves: check.saves,
          });
        }
      }
      setReady(true);
    };
    boot().catch((e: Error) => toast.error(e.message));
  }, []);

  useEffect(() => {
    if (!root) return;
    const load = async () => setProfiles(await api.profiles(root.path));
    load().catch((e: Error) => toast.error(e.message));
  }, [root]);

  const chooseRoot = (chosen: GameRoot) => {
    setRoot(chosen);
    setSlotPath(null);
    setDetail(null);
    void saveSettings({ root: chosen.path, gameId: chosen.id });
  };

  const changeFolder = async () => {
    const chosen = await pickFolder("Select the game folder");
    if (chosen === null) return;
    const check = await api.validateRoot(chosen);
    if (!check.ok) {
      toast.error("That folder has no profiles inside");
      return;
    }
    if (check.saves === 0) {
      toast.warning("That folder holds profiles but no saves", {
        description: "Steam Cloud keeps them under Steam\\userdata\\<account>\\<appid>\\remote",
      });
      return;
    }
    chooseRoot({
      id: check.game?.includes("American") ? "ats" : (root?.id ?? "ets2"),
      name: check.game ?? "Game folder",
      path: chosen,
      running: false,
      source: "documents",
      profiles: check.profiles,
      saves: check.saves,
    });
  };

  const loadSlot = (path: string) => {
    setSlotPath(path);
    setDetail(null);
    setOps({});
    setPlan(null);
    setBusy("reading save");
    const read = async () => setDetail(await api.save(path));
    read()
      .catch((e: Error) => toast.error(e.message))
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
        if (alive) toast.error((e as Error).message);
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
    const write = async () => {
      const result = await api.apply(slotPath, ops, cloneAs);
      if (!result.written) {
        toast.error("Refused to write", { description: result.problems.slice(0, 2).join("; ") });
        return;
      }
      toast.success(cloneAs ? "Written to a new save slot" : "Save written", {
        description: cloneAs ? result.target : `backup kept as backups/${result.backup}`,
      });
      setOps({});
      loadSlot(cloneAs ? result.target : slotPath);
      if (root) setProfiles(await api.profiles(root.path));
    };
    write()
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setBusy(null));
  };

  if (!ready) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center gap-2 text-sm">
        <Loader2 className="size-4 animate-spin" /> starting
      </div>
    );
  }

  if (!root) {
    return (
      <>
        <SetupScreen onPick={chooseRoot} />
        <Toaster />
      </>
    );
  }

  const blocked = !dirty || (plan?.problems.length ?? 0) > 0;

  return (
    <div className="flex h-full flex-col">
      <header className="bg-card flex items-center gap-3 border-b px-4 py-2.5">
        <span className="text-primary flex items-center gap-2 text-sm font-semibold tracking-wide">
          <Truck className="size-4" /> Truck Save Editor
        </span>
        <Separator orientation="vertical" className="h-5" />
        <Button variant="ghost" size="sm" onClick={changeFolder} className="max-w-md">
          <FolderOpen className="size-4" />
          <span className="truncate font-mono text-xs">{root.path}</span>
        </Button>
        {root.running && (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle className="size-3" /> game running
          </Badge>
        )}
        <div className="text-muted-foreground ml-auto flex items-center gap-3 text-xs">
          {busy && (
            <span className="text-primary flex items-center gap-1.5">
              <Loader2 className="size-3 animate-spin" /> {busy}
            </span>
          )}
          {detail && <span className="tabular">{detail.units.toLocaleString()} units</span>}
          {isDesktop() && <Badge variant="outline">desktop</Badge>}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="bg-sidebar w-72 shrink-0 border-r">
          <ScrollArea className="h-full">
            <div className="space-y-4 p-3">
              {profiles.map((profile) => (
                <div key={profile.path}>
                  <div className="text-muted-foreground flex items-center gap-2 px-1 pb-1 text-xs font-semibold">
                    {profile.name}
                    {profile.steam && <Badge variant="outline">steam</Badge>}
                  </div>
                  {profile.slots.map((slot) => (
                    <button
                      key={slot.path}
                      onClick={() => loadSlot(slot.path)}
                      className={`hover:bg-accent block w-full cursor-pointer rounded-md px-2 py-1.5 text-left transition-colors ${
                        slotPath === slot.path ? "bg-accent ring-primary/50 ring-1" : ""
                      }`}
                    >
                      <span className="block truncate text-xs font-medium">{slot.name || slot.slot}</span>
                      <span className="text-muted-foreground block truncate text-[10px]">
                        {slot.slot} · {slot.modified.slice(0, 16).replace("T", " ")} ·{" "}
                        {(slot.bytes / 1048576).toFixed(1)} MB{!slot.encrypted && " · text"}
                      </span>
                    </button>
                  ))}
                </div>
              ))}
              {profiles.length === 0 && (
                <p className="text-muted-foreground p-2 text-xs">no profiles in this folder</p>
              )}
            </div>
          </ScrollArea>
        </aside>

        <main className="min-w-0 flex-1 overflow-y-auto p-5">
          {!detail && <p className="text-muted-foreground text-sm">Pick a save on the left to begin.</p>}

          {detail && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                <StatCard label="money" value={money(detail.summary.money)} />
                <StatCard label="experience" value={money(detail.summary.experience)} />
                <StatCard
                  label="garages"
                  value={`${detail.summary.garagesOwned}/${detail.summary.garagesTotal}`}
                />
                <StatCard label="trucks" value={detail.trucks.length} hint={`${detail.drivers - 1} drivers`} />
                <StatCard
                  label="cities"
                  value={`${detail.summary.visitedCities}/${detail.cities}`}
                  hint="visited"
                />
                <StatCard label="hq" value={detail.summary.hqCity} hint={detail.container} />
              </div>

              <Tabs defaultValue="Career">
                <TabsList>
                  {TABS.map((tab) => (
                    <TabsTrigger key={tab} value={tab}>
                      {tab}
                    </TabsTrigger>
                  ))}
                </TabsList>
                <TabsContent value="Career">
                  <EditorTab detail={detail} ops={ops} setOps={setOps} />
                </TabsContent>
                <TabsContent value="Garages">
                  <GaragesTab detail={detail} ops={ops} setOps={setOps} />
                </TabsContent>
                <TabsContent value="Fleet">
                  <FleetTab detail={detail} ops={ops} setOps={setOps} />
                </TabsContent>
                <TabsContent value="Map">
                  <MapTab detail={detail} ops={ops} setOps={setOps} />
                </TabsContent>
                <TabsContent value="Units">
                  <RawTab path={detail.path} ops={ops} setOps={setOps} />
                </TabsContent>
                <TabsContent value="Doctor">
                  <DoctorTab root={root} path={detail.path} />
                </TabsContent>
              </Tabs>

              <Card>
                <CardHeader className="flex-row items-center justify-between">
                  <CardTitle className="text-xs tracking-widest uppercase">pending changes</CardTitle>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setOps({})} disabled={!dirty}>
                      <RotateCcw className="size-3.5" /> reset
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => apply(`edited ${new Date().toISOString().slice(5, 16)}`)}
                      disabled={blocked}
                    >
                      <SaveAll className="size-3.5" /> new slot
                    </Button>
                    <Button size="sm" onClick={() => apply()} disabled={blocked}>
                      <Save className="size-3.5" /> overwrite
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {!dirty && <p className="text-muted-foreground text-sm">No changes staged.</p>}
                  {dirty && plan && (
                    <div className="space-y-2">
                      {plan.problems.length > 0 && (
                        <div className="border-destructive/60 bg-destructive/10 text-destructive-foreground space-y-1 rounded-md border p-2 text-xs">
                          {plan.problems.slice(0, 6).map((problem) => (
                            <div key={problem}>{problem}</div>
                          ))}
                        </div>
                      )}
                      <p className="text-muted-foreground text-xs">
                        units {plan.unitsBefore.toLocaleString()} → {plan.unitsAfter.toLocaleString()} ·{" "}
                        {plan.discovery}
                      </p>
                      <pre className="bg-muted/40 max-h-60 overflow-auto rounded-md p-3 font-mono text-xs leading-relaxed">
                        {plan.log.join("\n")}
                      </pre>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </main>
      </div>
      <Toaster />
    </div>
  );
}
