import { useState } from "react";
import { FolderOpen, Map as MapIcon } from "lucide-react";
import type { Ops, SaveDetail } from "@/api.ts";
import { pickFolder } from "@/lib/platform.ts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleRow } from "@/components/field.tsx";

interface Props {
  detail: SaveDetail;
  ops: Ops;
  setOps: (next: Ops) => void;
}

export function MapTab({ detail, ops, setOps }: Props) {
  const [donor, setDonor] = useState(ops.importDiscovery ?? "");

  const browse = async () => {
    const folder = await pickFolder("Select a fully explored save slot folder");
    if (folder === null) return;
    setDonor(`${folder}/game.sii`.replace(/\\/g, "/"));
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Cities</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ToggleRow
            label={`Visit all ${detail.cities} cities`}
            hint="also unlocks every truck dealer and recruitment agency"
            checked={Boolean(ops.visitAllCities)}
            onChange={(v) => setOps({ ...ops, visitAllCities: v || undefined })}
          />
          <p className="text-muted-foreground font-mono text-xs">
            now: {detail.summary.visitedCities} visited · {detail.summary.unlockedDealers} dealers
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Road discovery</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-muted-foreground text-xs">
            Discovered roads are map-item ids that live in the game files, so they can only be copied from
            another save. Point this at a fully explored <code className="font-mono">game.sii</code>.
          </p>
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-[10px] tracking-widest uppercase">
              donor game.sii
            </Label>
            <div className="flex gap-2">
              <Input
                value={donor}
                onChange={(e) => setDonor(e.target.value)}
                placeholder="C:\...\save\1\game.sii"
                className="font-mono"
              />
              <Button variant="outline" size="icon" onClick={browse} aria-label="browse for a donor save">
                <FolderOpen className="size-4" />
              </Button>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => setOps({ ...ops, importDiscovery: donor.trim() || undefined })}
              disabled={donor.trim() === ""}
            >
              <MapIcon className="size-3.5" /> stage import
            </Button>
            {ops.importDiscovery && (
              <Button variant="ghost" size="sm" onClick={() => setOps({ ...ops, importDiscovery: undefined })}>
                clear
              </Button>
            )}
          </div>
          <p className="text-muted-foreground font-mono text-xs">{detail.discovery}</p>
        </CardContent>
      </Card>
    </div>
  );
}
