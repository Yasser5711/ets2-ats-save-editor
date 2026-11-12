import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, FolderOpen, Languages, MousePointerClick, Truck } from "lucide-react";
import { api, type GameRoot, type Ops, type PlanResult, type Profile, type SaveDetail } from "@/api.ts";
import { pendingChanges } from "@/lib/changes.ts";
import { useI18n } from "@/lib/i18n.tsx";
import { initPlatform, loadSettings, pickFolder, saveSettings } from "@/lib/platform.ts";
import { ChangeBar } from "@/components/change-bar.tsx";
import { Overview } from "@/components/overview.tsx";
import { SaveList } from "@/components/save-list.tsx";
import { SetupScreen } from "@/components/setup-screen.tsx";
import { AdvancedTab } from "@/tabs/Advanced.tsx";
import { ListsTab } from "@/tabs/Lists.tsx";
import { QuickTab } from "@/tabs/Quick.tsx";
import { RescueTab } from "@/tabs/Rescue.tsx";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";

const TABS = ["quick", "lists", "advanced", "rescue"] as const;
type Tab = (typeof TABS)[number];

const two = (n: number) => String(n).padStart(2, "0");

/** Local day and time in plain ASCII, safe inside a save's display name. */
function stamp(now: Date): string {
  return `${two(now.getDate())}-${two(now.getMonth() + 1)} ${two(now.getHours())}h${two(now.getMinutes())}`;
}

/** The dry run of one request; a newer request makes it stale. */
interface Preview {
  key: string;
  plan: PlanResult | null;
  error: string | null;
}

export function App() {
  const i18n = useI18n();
  const { t, lang, setLang } = i18n;
  const [ready, setReady] = useState(false);
  const [root, setRoot] = useState<GameRoot | null>(null);
  const [running, setRunning] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [slotPath, setSlotPath] = useState<string | null>(null);
  const [detail, setDetail] = useState<SaveDetail | null>(null);
  const [tab, setTab] = useState<Tab>("quick");
  const [ops, setOps] = useState<Ops>({});
  const [preview, setPreview] = useState<Preview | null>(null);
  const [writing, setWriting] = useState(false);

  useEffect(() => {
    const boot = async () => {
      await initPlatform();
      const settings = await loadSettings();
      if (settings.root !== null) {
        const check = await api.validateRoot(settings.root);
        if (check.ok) {
          setRoot({
            id: settings.gameId ?? "ets2",
            name: check.game ?? "",
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
    setOps({});
    void saveSettings({ root: chosen.path, gameId: chosen.id });
  };

  const changeFolder = async () => {
    const chosen = await pickFolder(t("setup.pickTitle"));
    if (chosen === null) return;
    const check = await api.validateRoot(chosen);
    if (!check.ok) {
      toast.error(t("setup.noProfiles", { path: chosen }));
      return;
    }
    if (check.saves === 0) {
      toast.warning(t("setup.cloudHint", { path: chosen }));
      return;
    }
    chooseRoot({
      id: check.game?.includes("American") ? "ats" : (root?.id ?? "ets2"),
      name: check.game ?? "",
      path: chosen,
      running: false,
      source: "documents",
      profiles: check.profiles,
      saves: check.saves,
    });
  };

  const gameId = root?.id ?? "ets2";

  const loadSlot = (path: string) => {
    setSlotPath(path);
    setDetail(null);
    setOps({});
    setPreview(null);
    const read = async () => {
      // asked again for every save that is opened: the game may have been started since
      const [save, env] = await Promise.all([api.save(path), api.env()]);
      setDetail(save);
      setRunning(env.roots.some((candidate) => candidate.id === gameId && candidate.running));
    };
    read().catch((e: Error) => toast.error(e.message));
  };

  const staged = pendingChanges(ops, i18n, gameId).length;
  // undefined values vanish in JSON, so this only changes when the request does
  const request = JSON.stringify(ops);
  const previewKey = `${slotPath}\n${request}`;

  useEffect(() => {
    if (!slotPath || staged === 0) return;
    let alive = true;
    const run = async () => {
      try {
        const plan = await api.plan(slotPath, JSON.parse(request) as Ops);
        if (alive) setPreview({ key: previewKey, plan, error: null });
      } catch (e) {
        if (alive) setPreview({ key: previewKey, plan: null, error: (e as Error).message });
      }
    };
    void run();
    return () => {
      alive = false;
    };
  }, [slotPath, request, staged, previewKey]);
  const current = preview?.key === previewKey ? preview : null;

  const apply = (cloneAs?: string) => {
    if (!slotPath) return;
    setWriting(true);
    const write = async () => {
      const result = await api.apply(slotPath, ops, cloneAs);
      if (!result.written) {
        toast.error(t("done.refused"), { description: result.problems.slice(0, 2).join("; ") });
        return;
      }
      if (cloneAs) toast.success(t("done.new"), { description: t("done.newHint", { name: cloneAs }) });
      else toast.success(t("done.overwrite"), { description: t("done.overwriteHint") });
      loadSlot(result.target);
      if (root) setProfiles(await api.profiles(root.path));
    };
    write()
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setWriting(false));
  };

  if (!ready) {
    return <p className="text-muted-foreground flex h-full items-center justify-center text-sm">{t("app.starting")}</p>;
  }

  const language = (
    <Button variant="ghost" size="sm" onClick={() => setLang(lang === "fr" ? "en" : "fr")}>
      <Languages /> {t("app.otherLanguage")}
    </Button>
  );

  if (!root) {
    return (
      <>
        <div className="absolute top-3 right-4">{language}</div>
        <SetupScreen onPick={chooseRoot} />
        <Toaster />
      </>
    );
  }

  const slot = profiles.flatMap((profile) => profile.slots).find((candidate) => candidate.path === slotPath);

  return (
    <div className="flex h-full flex-col">
      <header className="bg-card flex items-center gap-2 border-b px-4 py-2">
        <span className="text-primary flex items-center gap-2 pr-2 text-sm font-semibold">
          <Truck className="size-4" /> Truck Save Editor
        </span>
        <Button variant="ghost" size="sm" onClick={changeFolder} title={t("header.folder")} className="max-w-md">
          <FolderOpen />
          <span className="text-muted-foreground truncate font-mono text-xs">{root.path}</span>
        </Button>
        <div className="ml-auto">{language}</div>
      </header>

      <div className="flex min-h-0 flex-1">
        <SaveList profiles={profiles} selected={slotPath} onPick={loadSlot} />

        <div className="flex min-w-0 flex-1 flex-col">
          {running && (
            <p className="flex items-center gap-2 border-b border-amber-400/30 bg-amber-400/10 px-6 py-2.5 text-sm text-amber-200">
              <AlertTriangle className="size-4 shrink-0" /> {t("banner.running")}
            </p>
          )}

          <main className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto max-w-5xl space-y-5 p-6">
              {slotPath === null && (
                <div className="mx-auto max-w-md space-y-3 pt-24 text-center">
                  <span className="bg-primary/12 text-primary mx-auto flex size-12 items-center justify-center rounded-xl">
                    <MousePointerClick className="size-6" />
                  </span>
                  <h1 className="text-lg font-semibold">{t("empty.title")}</h1>
                  <p className="text-muted-foreground text-sm text-pretty">{t("empty.body")}</p>
                  <p className="text-muted-foreground text-[13px] text-pretty">{t("empty.tip")}</p>
                </div>
              )}

              {slotPath !== null && !detail && (
                <div className="animate-pulse space-y-5" aria-busy="true" aria-label={t("busy.reading")}>
                  <div className="bg-muted h-7 w-64 rounded-md" />
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                    {[1, 2, 3, 4, 5, 6].map((tile) => (
                      <div key={tile} className="bg-muted h-[4.5rem] rounded-xl" />
                    ))}
                  </div>
                  <div className="bg-muted h-40 rounded-xl" />
                  <div className="bg-muted h-56 rounded-xl" />
                </div>
              )}

              {detail && (
                <>
                  <h1 className="truncate text-xl font-semibold tracking-tight">{slot?.name || slot?.slot}</h1>
                  <Overview gameId={gameId} detail={detail} />
                  <Tabs value={tab} onValueChange={(next) => setTab(next as Tab)} className="gap-4">
                    <TabsList>
                      {TABS.map((key) => (
                        <TabsTrigger key={key} value={key} className="px-3">
                          {t(`tab.${key}`)}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                    <TabsContent value="quick">
                      <QuickTab gameId={gameId} detail={detail} ops={ops} setOps={setOps} />
                    </TabsContent>
                    <TabsContent value="lists">
                      <ListsTab detail={detail} ops={ops} setOps={setOps} />
                    </TabsContent>
                    <TabsContent value="advanced">
                      <AdvancedTab detail={detail} ops={ops} setOps={setOps} />
                    </TabsContent>
                    <TabsContent value="rescue">
                      <RescueTab root={root} detail={detail} onRestored={() => loadSlot(detail.path)} />
                    </TabsContent>
                  </Tabs>
                </>
              )}
            </div>
          </main>

          {detail && (
            <ChangeBar
              gameId={gameId}
              ops={ops}
              setOps={setOps}
              plan={current?.plan ?? null}
              planError={current?.error ?? null}
              writing={writing}
              onSaveNew={() => apply(t("bar.newName", { date: stamp(new Date()) }))}
              onOverwrite={() => apply()}
            />
          )}
        </div>
      </div>
      <Toaster />
    </div>
  );
}
