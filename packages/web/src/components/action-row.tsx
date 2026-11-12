import type { ComponentType, ReactNode } from "react";
import { Check } from "lucide-react";
import { useI18n } from "@/lib/i18n.tsx";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";

type Icon = ComponentType<{ className?: string }>;

/** A titled group of actions about one topic. */
export function Section({ icon: Glyph, title, children }: { icon: Icon; title: string; children: ReactNode }) {
  return (
    <section className="bg-card ring-foreground/10 overflow-hidden rounded-xl ring-1">
      <h2 className="flex items-center gap-2.5 border-b px-4 py-3 text-sm font-semibold">
        <span className="bg-primary/12 text-primary flex size-7 items-center justify-center rounded-md">
          <Glyph className="size-4" />
        </span>
        {title}
      </h2>
      <div className="divide-y">{children}</div>
    </section>
  );
}

interface RowProps {
  title: string;
  hint?: string;
  /** where the save stands today, shown next to the switch */
  status?: string;
  /** the save already has this; the switch stays usable */
  done?: boolean;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  children?: ReactNode;
}

/** One thing the editor can do, switched on or off with a single click anywhere on the row. */
export function ActionRow({ title, hint, status, done, checked, disabled, onChange, children }: RowProps) {
  const { t } = useI18n();
  return (
    <div className={cn("transition-colors", checked && "bg-primary/6")}>
      <label
        className={cn(
          "flex items-center gap-4 px-4 py-3",
          disabled ? "cursor-not-allowed opacity-60" : "hover:bg-accent/40 cursor-pointer",
        )}
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{title}</span>
          {hint && <span className="text-muted-foreground mt-0.5 block text-[13px] leading-snug">{hint}</span>}
        </span>
        {(status || done) && (
          <span
            className={cn(
              "tabular flex shrink-0 items-center gap-1 text-right text-xs",
              done ? "text-emerald-400" : "text-muted-foreground",
            )}
          >
            {done && <Check className="size-3.5" />}
            {status ?? t("state.done")}
          </span>
        )}
        <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} />
      </label>
      {children && <div className="px-4 pb-3">{children}</div>}
    </div>
  );
}
