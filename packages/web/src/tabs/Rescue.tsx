import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CircleCheck, History, RefreshCw, Stethoscope } from "lucide-react";
import { api, type GameRoot, type LogIssue, type SaveDetail } from "@/api.ts";
import { useI18n } from "@/lib/i18n.tsx";
import { Button } from "@/components/ui/button";

interface Backup {
  file: string;
  modified: string;
  bytes: number;
}

interface Props {
  root: GameRoot;
  detail: SaveDetail;
  /** called after a backup was put back, so the save is read again */
  onRestored: () => void;
}

export function RescueTab({ root, detail, onRestored }: Props) {
  const { t, when } = useI18n();
  const [issues, setIssues] = useState<LogIssue[]>([]);
  const [backups, setBackups] = useState<Backup[]>([]);
  const path = detail.path;
  // the game repeats the same line for every frame something is wrong
  const repeats = new Map<string, { issue: LogIssue; count: number }>();
  for (const issue of issues) {
    const seen = repeats.get(issue.text);
    if (seen) seen.count++;
    else repeats.set(issue.text, { issue, count: 1 });
  }

  const refresh = () => {
    const load = async () => {
      setBackups(await api.backups(path));
      setIssues(await api.log(root.path));
    };
    load().catch((e: Error) => toast.error(e.message));
  };

  useEffect(refresh, [root.path, path]);

  const restore = (file: string) => {
    const run = async () => {
      await api.restore(path, file);
      toast.success(t("rescue.restored"));
      onRestored();
    };
    run().catch((e: Error) => toast.error(e.message));
  };

  return (
    <div className="space-y-4">
      <section className="bg-card ring-foreground/10 rounded-xl ring-1">
        <header className="flex items-start justify-between gap-3 border-b px-4 py-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <History className="text-primary size-4" /> {t("rescue.backups")}
            </h2>
            <p className="text-muted-foreground mt-0.5 text-[13px]">{t("rescue.backupsHint")}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={refresh}>
            <RefreshCw /> {t("rescue.refresh")}
          </Button>
        </header>
        <div className="divide-y">
          {backups.length === 0 && <p className="text-muted-foreground px-4 py-3 text-sm">{t("rescue.none")}</p>}
          {backups.map((backup) => (
            <div key={backup.file} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <span className="flex-1">{when(backup.modified)}</span>
              <span className="text-muted-foreground tabular text-xs">{(backup.bytes / 1048576).toFixed(1)} MB</span>
              <Button variant="outline" size="sm" onClick={() => restore(backup.file)}>
                {t("rescue.restore")}
              </Button>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-card ring-foreground/10 space-y-2 rounded-xl p-4 ring-1">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <CircleCheck className="text-primary size-4" /> {t("rescue.health")}
        </h2>
        {detail.problems.length === 0 ? (
          <p className="text-sm text-emerald-400">{t("rescue.healthy")}</p>
        ) : (
          <ul className="text-destructive space-y-1 font-mono text-xs">
            {detail.problems.slice(0, 12).map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-card ring-foreground/10 space-y-2 rounded-xl p-4 ring-1">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Stethoscope className="text-primary size-4" /> {t("rescue.log")}
        </h2>
        {issues.length === 0 && <p className="text-muted-foreground text-sm">{t("rescue.logNone")}</p>}
        <div className="max-h-72 space-y-1.5 overflow-y-auto">
          {[...repeats.values()].map(({ issue, count }) => (
            <div key={issue.text} className="rounded-md border p-2">
              <p className="text-destructive font-mono text-[11px] break-words">
                {issue.text}
                {count > 1 && <span className="text-muted-foreground"> ×{count}</span>}
              </p>
              {issue.hint && <p className="text-primary mt-1 text-xs">{issue.hint}</p>}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
