import { useEffect, useState } from "react";
import { Banknote, GraduationCap, Map as MapIcon, Sparkles, Truck, Warehouse } from "lucide-react";
import { api, type Ops, type SaveDetail } from "@/api.ts";
import { GARAGE_LARGE, MAX_XP, levelOf, skillsAtMax } from "@/lib/career.ts";
import { currencyOf } from "@/lib/changes.ts";
import { useI18n } from "@/lib/i18n.tsx";
import { pickFolder } from "@/lib/platform.ts";
import { ActionRow, Section } from "@/components/action-row.tsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Props {
  gameId: string;
  detail: SaveDetail;
  ops: Ops;
  setOps: (next: Ops) => void;
}

const AMOUNTS = [1_000_000, 10_000_000, 100_000_000, 1_000_000_000];

export function QuickTab({ gameId, detail, ops, setOps }: Props) {
  const { t, num } = useI18n();
  const [gameDir, setGameDir] = useState(ops.discoverMap ?? "");
  const { summary } = detail;
  const edits = ops.edits ?? {};
  const patch = (next: Partial<NonNullable<Ops["edits"]>>) => setOps({ ...ops, edits: { ...edits, ...next } });
  const currency = currencyOf(gameId);
  const hasCoach = summary.busExperience !== null;
  const skills = skillsAtMax(summary);
  const freeGarages = detail.garages.filter((g) => g.status !== "0" && g.capacity > g.trucks).length;
  const staffed = Boolean(ops.staff) && ops.staff?.withDrivers !== false;

  useEffect(() => {
    let alive = true;
    const detect = async () => {
      const { path } = await api.install(gameId);
      if (alive && path !== null) setGameDir((current) => current || path);
    };
    // without Steam the folder is simply picked by hand
    detect().catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [gameId]);

  const chooseGameDir = async () => {
    const folder = await pickFolder(t("map.pickTitle"));
    if (folder === null) return;
    setGameDir(folder);
    if (ops.discoverMap) setOps({ ...ops, discoverMap: folder });
  };

  // a preset must never take something away: a richer or higher-level save keeps what it has
  const truckMaxed = Number(summary.experience) >= MAX_XP;
  const coachMaxed = Number(summary.busExperience) >= MAX_XP;
  const everything = () =>
    setOps({
      ...ops,
      edits: {
        ...edits,
        money: Number(summary.money) >= AMOUNTS[3] ? edits.money : AMOUNTS[3],
        experience: truckMaxed ? edits.experience : MAX_XP,
        busExperience: hasCoach && !coachMaxed ? MAX_XP : edits.busExperience,
        maxSkills: true,
        garageStatus: GARAGE_LARGE,
        repairVehicles: true,
        refuelVehicles: true,
      },
      staff: { ...ops.staff, withDrivers: true },
      dispatchDrivers: detail.idleDrivers > 0 || undefined,
      discoverMap: gameDir.trim() || undefined,
      visitAllCities: true,
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">{t("quick.intro")}</p>
        <Button variant="outline" onClick={everything}>
          <Sparkles /> {t("quick.everything")}
        </Button>
      </div>

      <Section icon={Banknote} title={t("money.title")}>
        <div className="space-y-3 px-4 py-3">
          <p className="text-muted-foreground text-[13px]">
            {t("money.now", { amount: `${num(summary.money)} ${currency}` })}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {AMOUNTS.map((amount) => (
              <Button
                key={amount}
                variant={edits.money === amount ? "default" : "outline"}
                className="tabular"
                onClick={() => patch({ money: edits.money === amount ? undefined : amount })}
              >
                {num(amount)} {currency}
              </Button>
            ))}
            <label className="text-muted-foreground ml-auto flex items-center gap-2 text-[13px]">
              {t("money.custom")}
              <Input
                inputMode="numeric"
                value={edits.money === undefined || AMOUNTS.includes(edits.money) ? "" : String(edits.money)}
                placeholder={t("money.placeholder")}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "");
                  patch({ money: digits === "" ? undefined : Number(digits) });
                }}
                className="tabular h-8 w-48"
              />
            </label>
          </div>
        </div>
      </Section>

      <Section icon={GraduationCap} title={t("career.title")}>
        <ActionRow
          title={t("career.truckMax")}
          hint={t("career.truckMaxHint")}
          status={t("career.level", { n: num(levelOf(summary.experience)) })}
          done={truckMaxed}
          disabled={truckMaxed}
          checked={edits.experience === MAX_XP}
          onChange={(on) => patch({ experience: on ? MAX_XP : undefined })}
        />
        {hasCoach && (
          <ActionRow
            title={t("career.busMax")}
            hint={t("career.busMaxHint")}
            status={t("career.level", { n: num(levelOf(summary.busExperience ?? 0)) })}
            done={coachMaxed}
            disabled={coachMaxed}
            checked={edits.busExperience === MAX_XP}
            onChange={(on) => patch({ busExperience: on ? MAX_XP : undefined })}
          />
        )}
        <ActionRow
          title={t("career.skills")}
          hint={t("career.skillsHint")}
          status={t("career.skillsAt", { n: skills.done, total: skills.total })}
          done={skills.done === skills.total}
          checked={Boolean(edits.maxSkills)}
          onChange={(on) => patch({ maxSkills: on || undefined })}
        />
      </Section>

      <Section icon={Warehouse} title={t("garages.title")}>
        <ActionRow
          title={t("garages.all")}
          hint={t("garages.allHint")}
          status={t("garages.owned", { n: summary.garagesOwned, total: summary.garagesTotal })}
          checked={edits.garageStatus === GARAGE_LARGE}
          onChange={(on) => patch({ garageStatus: on ? GARAGE_LARGE : undefined })}
        />
      </Section>

      <Section icon={Truck} title={t("fleet.title")}>
        <ActionRow
          title={t("fleet.staff")}
          hint={t("fleet.staffHint")}
          status={t("fleet.staffFree", { n: freeGarages })}
          checked={staffed}
          onChange={(on) => setOps({ ...ops, staff: on ? { ...ops.staff, withDrivers: true } : null })}
        >
          {staffed && detail.driverPool === 0 && (
            <p className="text-[13px] text-amber-300/90">{t("fleet.noApplicants")}</p>
          )}
        </ActionRow>
        <ActionRow
          title={t("fleet.dispatch")}
          hint={t("fleet.dispatchHint")}
          status={detail.idleDrivers > 0 ? t("fleet.idle", { n: detail.idleDrivers }) : t("fleet.allWorking")}
          done={detail.idleDrivers === 0}
          disabled={detail.idleDrivers === 0}
          checked={Boolean(ops.dispatchDrivers)}
          onChange={(on) => setOps({ ...ops, dispatchDrivers: on || undefined })}
        />
        <ActionRow
          title={t("fleet.repair")}
          hint={t("fleet.repairHint")}
          checked={Boolean(edits.repairVehicles)}
          onChange={(on) => patch({ repairVehicles: on || undefined })}
        />
        <ActionRow
          title={t("fleet.refuel")}
          checked={Boolean(edits.refuelVehicles)}
          onChange={(on) => patch({ refuelVehicles: on || undefined })}
        />
      </Section>

      <Section icon={MapIcon} title={t("map.title")}>
        <ActionRow
          title={t("map.discover")}
          hint={t("map.discoverHint")}
          status={t("map.known", { n: num(detail.discoveredItems) })}
          checked={Boolean(ops.discoverMap)}
          disabled={gameDir.trim() === ""}
          onChange={(on) => setOps({ ...ops, discoverMap: on ? gameDir.trim() : undefined })}
        >
          <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
            {gameDir.trim() === "" ? (
              <span className="text-amber-300/90">{t("map.gameFolderMissing")}</span>
            ) : (
              <>
                {t("map.gameFolder")}
                <code className="text-foreground/80 font-mono text-xs break-all">{gameDir}</code>
              </>
            )}
            <Button variant="link" size="xs" className="px-0" onClick={chooseGameDir}>
              {t(gameDir.trim() === "" ? "map.choose" : "map.change")}
            </Button>
          </p>
        </ActionRow>
        <ActionRow
          title={t("map.cities")}
          hint={t("map.citiesHint")}
          status={t("map.visited", { n: summary.visitedCities, total: detail.cities })}
          done={summary.visitedCities >= detail.cities}
          checked={Boolean(ops.visitAllCities)}
          onChange={(on) => setOps({ ...ops, visitAllCities: on || undefined })}
        />
      </Section>
    </div>
  );
}
