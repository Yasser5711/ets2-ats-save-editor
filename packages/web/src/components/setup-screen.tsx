import { useEffect, useState } from "react";
import { ChevronRight, CircleAlert, FolderOpen, HardDrive, Loader2, Truck } from "lucide-react";
import { api, type GameRoot } from "@/api.ts";
import { useI18n } from "@/lib/i18n.tsx";
import { pickFolder } from "@/lib/platform.ts";
import { Button } from "@/components/ui/button";

export function SetupScreen({ onPick }: { onPick: (root: GameRoot) => void }) {
  const { t, plural } = useI18n();
  const [detected, setDetected] = useState<GameRoot[]>([]);
  const [scanning, setScanning] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const scan = async () => setDetected((await api.env()).roots);
    scan()
      .catch((e: Error) => setError(t("setup.scanFailed", { message: e.message })))
      .finally(() => setScanning(false));
    // scanned once when the screen opens; a language switch must not scan again
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const browse = async () => {
    setError(null);
    const chosen = await pickFolder(t("setup.pickTitle"));
    if (chosen === null) return;
    try {
      const check = await api.validateRoot(chosen);
      if (!check.ok) {
        setError(t("setup.noProfiles", { path: chosen }));
        return;
      }
      if (check.saves === 0) {
        setError(t("setup.cloudHint", { path: chosen }));
        return;
      }
      onPick({
        id: check.game?.includes("American") ? "ats" : "ets2",
        name: check.game ?? "",
        path: chosen,
        running: false,
        source: "documents",
        profiles: check.profiles,
        saves: check.saves,
      });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="w-full max-w-xl space-y-6">
        <div className="space-y-3 text-center">
          <span className="bg-primary/12 text-primary mx-auto flex size-12 items-center justify-center rounded-xl">
            <Truck className="size-6" />
          </span>
          <h1 className="text-2xl font-semibold tracking-tight">{t("setup.title")}</h1>
          <p className="text-muted-foreground mx-auto max-w-md text-sm text-pretty">{t("setup.body")}</p>
        </div>

        {scanning && (
          <p className="text-muted-foreground flex items-center justify-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" /> {t("setup.scanning")}
          </p>
        )}

        {detected.length > 0 && (
          <div className="space-y-2">
            <p className="text-muted-foreground text-[13px]">{t("setup.found")}</p>
            {detected.map((root) => (
              <button
                key={root.path}
                onClick={() => onPick(root)}
                disabled={root.saves === 0}
                className="bg-card ring-foreground/10 hover:ring-primary/60 hover:bg-accent flex w-full cursor-pointer items-center gap-3 rounded-xl p-3.5 text-left ring-1 transition-all active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
              >
                <HardDrive className="text-primary size-5 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{root.name}</span>
                  <span className="text-muted-foreground block truncate text-xs">
                    {t(root.source === "documents" ? "setup.documents" : "setup.cloud")} ·{" "}
                    {plural("setup.profiles", root.profiles)} ·{" "}
                    {root.saves === 0 ? t("setup.noSaves") : t("setup.saves", { n: root.saves })}
                  </span>
                  <span className="text-muted-foreground/70 block truncate font-mono text-[11px]">{root.path}</span>
                </span>
                {root.saves === 0 ? (
                  <span className="text-muted-foreground text-xs">{t("setup.empty")}</span>
                ) : (
                  <span className="text-primary flex items-center gap-0.5 text-sm font-medium">
                    {t("setup.use")} <ChevronRight className="size-4" />
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {!scanning && detected.length === 0 && (
          <div className="space-y-1 text-center text-sm">
            <p>{t("setup.notFound")}</p>
            <p className="text-muted-foreground text-[13px]">{t("setup.usual")}</p>
          </div>
        )}

        <Button onClick={browse} variant={detected.length > 0 ? "outline" : "default"} className="w-full" size="lg">
          <FolderOpen /> {t("setup.choose")}
        </Button>

        {error && (
          <p className="text-destructive flex items-start gap-2 text-sm">
            <CircleAlert className="mt-0.5 size-4 shrink-0" /> {error}
          </p>
        )}
      </div>
    </div>
  );
}
