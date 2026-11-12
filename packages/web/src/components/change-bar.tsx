import { useState } from "react";
import { ChevronUp, CircleAlert, CircleCheck, Loader2, RotateCcw, Save, SaveAll, X } from "lucide-react";
import type { Ops, PlanResult } from "@/api.ts";
import { pendingChanges } from "@/lib/changes.ts";
import { useI18n } from "@/lib/i18n.tsx";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  gameId: string;
  ops: Ops;
  setOps: (next: Ops) => void;
  /** result of the dry run for `ops`, null while it is still running */
  plan: PlanResult | null;
  /** why the dry run could not be made, e.g. a wrong game folder */
  planError: string | null;
  writing: boolean;
  onSaveNew: () => void;
  onOverwrite: () => void;
}

/**
 * Always in view at the bottom of the window: what is about to change, whether
 * it is safe, and the two ways to write it.
 */
export function ChangeBar({ gameId, ops, setOps, plan, planError, writing, onSaveNew, onOverwrite }: Props) {
  const i18n = useI18n();
  const { t, plural } = i18n;
  const [details, setDetails] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const changes = pendingChanges(ops, i18n, gameId);
  const problems = planError !== null ? [planError] : (plan?.problems ?? []);
  const checking = changes.length > 0 && plan === null && planError === null;
  const blocked = changes.length === 0 || checking || problems.length > 0 || writing;

  if (changes.length === 0) {
    return (
      <footer className="bg-card text-muted-foreground border-t px-6 py-3.5 text-sm">{t("bar.none")}</footer>
    );
  }

  return (
    <footer className="bg-card border-t shadow-[0_-8px_24px_-12px_rgb(0_0_0/0.5)]">
      {details && (
        <div className="max-h-56 space-y-2 overflow-y-auto border-b px-6 py-3">
          {problems.length > 0 && (
            <ul className="border-destructive/50 bg-destructive/10 space-y-1 rounded-md border p-2 text-xs">
              {problems.slice(0, 8).map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          )}
          {plan && (
            <pre className="text-muted-foreground font-mono text-xs leading-relaxed whitespace-pre-wrap">
              {plan.log.join("\n")}
            </pre>
          )}
        </div>
      )}

      <div className="space-y-2 px-6 py-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="font-semibold">{plural("bar.count", changes.length)}</span>
            {checking && (
              <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <Loader2 className="size-3.5 animate-spin" /> {t("bar.checking")}
              </span>
            )}
            {!checking && problems.length === 0 && (
              <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                <CircleCheck className="size-3.5" /> {t("bar.safe")}
              </span>
            )}
            {problems.length > 0 && (
              <span className="text-destructive flex items-center gap-1.5 text-xs">
                <CircleAlert className="size-3.5" /> {t("bar.blocked")}
              </span>
            )}
            <button
              onClick={() => setDetails(!details)}
              aria-expanded={details}
              className="text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-1 text-xs transition-colors"
            >
              {t("bar.details")}
              <ChevronUp className={cn("size-3.5 transition-transform", !details && "rotate-180")} />
            </button>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button variant="ghost" onClick={() => setOps({})} disabled={writing}>
              <RotateCcw /> {t("bar.reset")}
            </Button>
            <Button variant="outline" size="lg" onClick={() => setConfirming(true)} disabled={blocked}>
              <Save /> {t("bar.overwrite")}
            </Button>
            <Button size="lg" onClick={onSaveNew} disabled={blocked} title={t("bar.newSlotHint")}>
              {writing ? <Loader2 className="animate-spin" /> : <SaveAll />} {t("bar.newSlot")}
            </Button>
          </div>
        </div>

        <ul className="flex flex-wrap gap-1.5">
          {changes.map((change) => (
            <li
              key={change.id}
              className="bg-primary/12 text-foreground flex items-center gap-1 rounded-md py-0.5 pr-1 pl-2 text-xs"
            >
              {change.label}
              <button
                onClick={() => setOps(change.without)}
                aria-label={t("bar.remove", { label: change.label })}
                className="hover:bg-foreground/15 text-muted-foreground hover:text-foreground cursor-pointer rounded p-0.5 transition-colors"
              >
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      </div>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("confirm.title")}</DialogTitle>
            <DialogDescription>{t("confirm.body")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(false)}>
              {t("confirm.cancel")}
            </Button>
            <Button
              onClick={() => {
                setConfirming(false);
                onOverwrite();
              }}
            >
              {t("confirm.ok")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </footer>
  );
}
