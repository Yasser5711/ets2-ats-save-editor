import { useState } from "react";
import { Users } from "lucide-react";
import type { Ops, SaveDetail } from "@/api.ts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { NumberField, ToggleRow } from "@/components/field.tsx";

interface Props {
  detail: SaveDetail;
  ops: Ops;
  setOps: (next: Ops) => void;
}

export function FleetTab({ detail, ops, setOps }: Props) {
  const [filter, setFilter] = useState("");
  const staff = ops.staff ?? null;
  const patchStaff = (patch: Partial<NonNullable<Ops["staff"]>>) =>
    setOps({ ...ops, staff: staff === null ? { ...patch } : { ...staff, ...patch } });
  const rows = detail.trucks.filter(
    (truck) =>
      truck.model.includes(filter.toLowerCase()) || truck.garage.includes(filter.toLowerCase()),
  );
  const free = detail.garages.filter((garage) => garage.capacity > garage.trucks && garage.status !== "0").length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Staff the garages</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <ToggleRow
                label="Park a truck in every free garage slot"
                hint={`${free} garages have a free slot, ${detail.driverPool} applicants in the pool`}
                checked={staff !== null}
                onChange={(on) => setOps({ ...ops, staff: on ? {} : null })}
              />
              <ToggleRow
                label="Hire a driver for each truck"
                hint="drivers go on the payroll and take 1-2 in-game days before their first job"
                checked={staff !== null && staff.withDrivers !== false}
                onChange={(on) => patchStaff({ withDrivers: on })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <NumberField
                label="seed"
                placeholder="20260823"
                value={staff?.seed?.toString() ?? ""}
                onChange={(v) => patchStaff({ seed: v === "" ? undefined : Number(v) })}
              />
              <NumberField
                label="max garages"
                placeholder="all"
                value={staff?.limit?.toString() ?? ""}
                onChange={(v) => patchStaff({ limit: v === "" ? undefined : Number(v) })}
              />
            </div>
          </div>
          <p className="text-muted-foreground text-xs">
            Trucks are cloned from your own dealer stock, so every part exists in your DLC set. Strongest
            engines are favoured; the seed decides the mix.
          </p>
          <Button size="sm" onClick={() => setOps({ ...ops, staff: { withDrivers: true } })}>
            <Users className="size-3.5" /> one driver + truck per garage
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-sm">Owned trucks · {detail.trucks.length}</CardTitle>
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="filter model or city"
            className="h-8 w-52"
          />
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-96">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>model</TableHead>
                  <TableHead>garage</TableHead>
                  <TableHead>driver</TableHead>
                  <TableHead className="text-right">km</TableHead>
                  <TableHead className="w-28">wear</TableHead>
                  <TableHead className="w-28">fuel</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="font-mono">
                {rows.map((truck) => (
                  <TableRow key={truck.id}>
                    <TableCell>{truck.model}</TableCell>
                    <TableCell className="text-muted-foreground">{truck.garage}</TableCell>
                    <TableCell className="text-muted-foreground">{truck.driver ?? "-"}</TableCell>
                    <TableCell className="tabular text-right">{truck.odometer}</TableCell>
                    <TableCell>
                      <Progress value={truck.wear * 100} className="h-1.5" />
                    </TableCell>
                    <TableCell>
                      <Progress value={truck.fuel * 100} className="h-1.5" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
