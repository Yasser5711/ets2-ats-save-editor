import { useState } from "react";
import { ChevronRight, Search } from "lucide-react";
import type { Profile, SaveSlot } from "@/api.ts";
import { useI18n } from "@/lib/i18n.tsx";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Props {
  profiles: Profile[];
  selected: string | null;
  onPick: (path: string) => void;
}

/** the game's own rolling saves; a player rarely wants to edit those */
const AUTOMATIC = /^(autosave|quicksave|multiplayer_backup)/;

function SlotButton({ slot, active, onPick }: { slot: SaveSlot; active: boolean; onPick: (path: string) => void }) {
  const { t, when } = useI18n();
  return (
    <button
      onClick={() => onPick(slot.path)}
      aria-current={active}
      className={cn(
        "hover:bg-accent block w-full cursor-pointer rounded-lg px-2.5 py-2 text-left transition-colors",
        active && "bg-accent ring-primary/60 ring-1",
      )}
    >
      <span className="block truncate text-sm font-medium">{slot.name || slot.slot}</span>
      <span className="text-muted-foreground block truncate text-xs">
        {when(slot.modified)}
        {!slot.encrypted && ` · ${t("saves.edited")}`}
      </span>
    </button>
  );
}

export function SaveList({ profiles, selected, onPick }: Props) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const wanted = query.trim().toLowerCase();
  const total = profiles.reduce((sum, profile) => sum + profile.slots.length, 0);
  const groups = profiles.map((profile) => {
    const slots = profile.slots.filter(
      (slot) => slot.name.toLowerCase().includes(wanted) || slot.slot.toLowerCase().includes(wanted),
    );
    return {
      profile,
      manual: slots.filter((slot) => !AUTOMATIC.test(slot.slot)),
      automatic: slots.filter((slot) => AUTOMATIC.test(slot.slot)),
    };
  });
  const shown = groups.reduce((sum, group) => sum + group.manual.length + group.automatic.length, 0);

  return (
    <aside className="bg-sidebar flex w-72 shrink-0 flex-col border-r">
      <div className="space-y-2 p-3 pb-2">
        <h2 className="px-1 text-sm font-semibold">{t("saves.title")}</h2>
        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("saves.search")}
            className="h-8 pl-8"
          />
        </div>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-4 p-3 pt-1">
          {groups.map(({ profile, manual, automatic }) =>
            manual.length + automatic.length === 0 ? null : (
              <div key={profile.path} className="space-y-0.5">
                <p className="text-muted-foreground truncate px-2.5 pb-1 text-xs font-medium">{profile.name}</p>
                {manual.map((slot) => (
                  <SlotButton key={slot.path} slot={slot} active={selected === slot.path} onPick={onPick} />
                ))}
                {automatic.length > 0 && (
                  <details
                    className="group"
                    // a search or a selected automatic save must not stay hidden behind the fold
                    open={wanted !== "" || automatic.some((slot) => slot.path === selected) || manual.length === 0 || undefined}
                  >
                    <summary className="text-muted-foreground hover:text-foreground flex cursor-pointer list-none items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs transition-colors">
                      <ChevronRight className="size-3.5 transition-transform group-open:rotate-90" />
                      {t("saves.auto", { n: automatic.length })}
                    </summary>
                    {automatic.map((slot) => (
                      <SlotButton key={slot.path} slot={slot} active={selected === slot.path} onPick={onPick} />
                    ))}
                  </details>
                )}
              </div>
            ),
          )}
          {total === 0 && <p className="text-muted-foreground px-2.5 text-sm">{t("saves.none")}</p>}
          {total > 0 && shown === 0 && <p className="text-muted-foreground px-2.5 text-sm">{t("saves.noMatch")}</p>}
        </div>
      </ScrollArea>
    </aside>
  );
}
