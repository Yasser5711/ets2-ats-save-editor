import type { SaveDetail } from "@/api.ts";
import { levelOf } from "@/lib/career.ts";
import { currencyOf } from "@/lib/changes.ts";
import { useI18n } from "@/lib/i18n.tsx";

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-card ring-foreground/10 min-w-36 flex-1 rounded-xl px-3.5 py-3 ring-1">
      <p className="text-muted-foreground truncate text-xs">{label}</p>
      <p className="tabular mt-1 text-lg leading-tight font-semibold whitespace-nowrap">{value}</p>
      {hint && <p className="text-muted-foreground mt-0.5 truncate text-xs">{hint}</p>}
    </div>
  );
}

/** Where the opened save stands today, in the words the game uses. */
export function Overview({ gameId, detail }: { gameId: string; detail: SaveDetail }) {
  const { t, num } = useI18n();
  const { summary } = detail;
  return (
    <div className="flex flex-wrap gap-3">
      <Tile label={t("stat.money")} value={`${num(summary.money)} ${currencyOf(gameId)}`} />
      <Tile
        label={t("stat.level")}
        value={num(levelOf(summary.experience))}
        hint={t("stat.xp", { n: num(summary.experience) })}
      />
      {summary.busExperience !== null && (
        <Tile
          label={t("stat.busLevel")}
          value={num(levelOf(summary.busExperience))}
          hint={t("stat.xp", { n: num(summary.busExperience) })}
        />
      )}
      <Tile
        label={t("stat.garages")}
        value={`${summary.garagesOwned} / ${summary.garagesTotal}`}
        hint={t("stat.hq", { city: summary.hqCity.replaceAll("_", " ") })}
      />
      <Tile
        label={t("stat.trucks")}
        value={num(detail.trucks.length)}
        hint={t("stat.drivers", { n: Math.max(detail.drivers - 1, 0) })}
      />
      <Tile label={t("stat.cities")} value={`${summary.visitedCities} / ${detail.cities}`} />
    </div>
  );
}
