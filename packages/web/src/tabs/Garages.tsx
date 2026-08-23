import { useState } from "react";
import type { Ops, SaveDetail } from "@/api.ts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const SIZES = [
  { status: 0, label: "not owned", slots: 0 },
  { status: 6, label: "tiny", slots: 1 },
  { status: 2, label: "small", slots: 3 },
  { status: 3, label: "large", slots: 5 },
];

interface Props {
  detail: SaveDetail;
  ops: Ops;
  setOps: (next: Ops) => void;
}

export function GaragesTab({ detail, ops, setOps }: Props) {
  const [filter, setFilter] = useState("");
  const rows = detail.garages.filter((garage) => garage.city.includes(filter.toLowerCase()));
  const chosen = ops.edits?.garageStatus;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Buy or upgrade every garage</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {SIZES.map((size) => (
              <Button
                key={size.status}
                variant={chosen === size.status ? "default" : "outline"}
                size="sm"
                onClick={() =>
                  setOps({
                    ...ops,
                    edits: {
                      ...ops.edits,
                      garageStatus: chosen === size.status ? undefined : size.status,
                    },
                  })
                }
              >
                {size.label} · {size.slots} slots
              </Button>
            ))}
          </div>
          <p className="text-muted-foreground text-xs">
            Slot arrays are resized with the status. Garages holding more trucks than the new size allows are
            skipped instead of losing vehicles.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-sm">Garages · {rows.length}</CardTitle>
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="filter city"
            className="h-8 w-44"
          />
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-96">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>city</TableHead>
                  <TableHead>status</TableHead>
                  <TableHead className="text-right">slots</TableHead>
                  <TableHead className="text-right">trucks</TableHead>
                  <TableHead className="text-right">drivers</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="font-mono">
                {rows.map((garage) => (
                  <TableRow key={garage.id}>
                    <TableCell>{garage.city}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {SIZES.find((size) => size.status === Number(garage.status))?.label ?? garage.status}
                    </TableCell>
                    <TableCell className="tabular text-right">{garage.capacity}</TableCell>
                    <TableCell className="tabular text-right">{garage.trucks}</TableCell>
                    <TableCell className="tabular text-right">{garage.drivers}</TableCell>
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
