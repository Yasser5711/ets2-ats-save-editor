import { useState } from "react";
import type { Ops, SaveDetail } from "@/api.ts";
import { useI18n } from "@/lib/i18n.tsx";
import type { MessageKey } from "@/lib/messages.ts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

/** `garage.status` values in the order a player thinks of them, with their truck places */
const SIZES = [
  { status: 0, slots: 0 },
  { status: 6, slots: 1 },
  { status: 2, slots: 3 },
  { status: 3, slots: 5 },
];

interface Props {
  detail: SaveDetail;
  ops: Ops;
  setOps: (next: Ops) => void;
}

export function ListsTab({ detail, ops, setOps }: Props) {
  const { t, num } = useI18n();
  const [city, setCity] = useState("");
  const [truck, setTruck] = useState("");
  const chosen = ops.edits?.garageStatus;
  const garages = detail.garages.filter((garage) => garage.city.includes(city.toLowerCase()));
  const trucks = detail.trucks.filter(
    (row) => row.model.includes(truck.toLowerCase()) || row.garage.includes(truck.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <section className="bg-card ring-foreground/10 space-y-3 rounded-xl p-4 ring-1">
        <div>
          <h2 className="text-sm font-semibold">{t("lists.size")}</h2>
          <p className="text-muted-foreground mt-0.5 text-[13px]">{t("lists.sizeHint")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {SIZES.map((size) => (
            <Button
              key={size.status}
              variant={chosen === size.status ? "default" : "outline"}
              onClick={() =>
                setOps({
                  ...ops,
                  edits: { ...ops.edits, garageStatus: chosen === size.status ? undefined : size.status },
                })
              }
            >
              {t(`size.${size.status}` as MessageKey)}
              <span className="opacity-70">· {t("size.slots", { n: size.slots })}</span>
            </Button>
          ))}
        </div>
      </section>

      <section className="bg-card ring-foreground/10 rounded-xl ring-1">
        <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <h2 className="text-sm font-semibold">{t("lists.garages", { n: garages.length })}</h2>
          <Input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder={t("lists.filterCity")}
            className="h-8 w-52"
          />
        </header>
        <ScrollArea className="h-80">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("col.city")}</TableHead>
                <TableHead>{t("col.size")}</TableHead>
                <TableHead className="text-right">{t("col.places")}</TableHead>
                <TableHead className="text-right">{t("col.trucks")}</TableHead>
                <TableHead className="text-right">{t("col.drivers")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {garages.map((garage) => (
                <TableRow key={garage.id}>
                  <TableCell className="font-medium capitalize">{garage.city.replaceAll("_", " ")}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {SIZES.some((size) => String(size.status) === garage.status)
                      ? t(`size.${garage.status}` as MessageKey)
                      : garage.status}
                  </TableCell>
                  <TableCell className="tabular text-right">{garage.capacity}</TableCell>
                  <TableCell className="tabular text-right">{garage.trucks}</TableCell>
                  <TableCell className="tabular text-right">{garage.drivers}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </section>

      <section className="bg-card ring-foreground/10 rounded-xl ring-1">
        <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <h2 className="text-sm font-semibold">{t("lists.trucks", { n: trucks.length })}</h2>
          <Input
            value={truck}
            onChange={(e) => setTruck(e.target.value)}
            placeholder={t("lists.filterTruck")}
            className="h-8 w-52"
          />
        </header>
        <ScrollArea className="h-80">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("col.model")}</TableHead>
                <TableHead>{t("col.garage")}</TableHead>
                <TableHead>{t("col.driver")}</TableHead>
                <TableHead className="text-right">{t("col.km")}</TableHead>
                <TableHead className="w-28">{t("col.wear")}</TableHead>
                <TableHead className="w-28">{t("col.fuel")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trucks.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.model}</TableCell>
                  <TableCell className="text-muted-foreground capitalize">{row.garage.replaceAll("_", " ")}</TableCell>
                  <TableCell className="text-muted-foreground">{row.driver ?? "-"}</TableCell>
                  <TableCell className="tabular text-right">{num(row.odometer)}</TableCell>
                  <TableCell>
                    <Progress value={row.wear * 100} className="h-1.5" />
                  </TableCell>
                  <TableCell>
                    <Progress value={row.fuel * 100} className="h-1.5" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </section>
    </div>
  );
}
