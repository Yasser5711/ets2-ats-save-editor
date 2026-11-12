import { useEffect, useState } from "react";
import { FolderOpen, Map as MapIcon } from "lucide-react";
import { api, type Ops, type SaveDetail } from "@/api.ts";
import { pickFolder } from "@/lib/platform.ts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleRow } from "@/components/field.tsx";

interface Props {
  gameId: string;
  detail: SaveDetail;
  ops: Ops;
  setOps: (next: Ops) => void;
}

export function MapTab({ gameId, detail, ops, setOps }: Props) {
  const [donor, setDonor] = useState(ops.importDiscovery ?? "");
  const [gameDir, setGameDir] = useState(ops.discoverMap ?? "");

  useEffect(() => {
    let alive = true;
    const detect = async () => {
      const { path } = await api.install(gameId);
      if (alive && path !== null) setGameDir((current) => current || path);
    };
    // without Steam the folder is simply typed or picked by hand
    detect().catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [gameId]);

  const browse = async () => {
    const folder = await pickFolder("Select a fully explored save slot folder");
    if (folder === null) return;
    setDonor(`${folder}/game.sii`.replace(/\\/g, "/"));
  };

  const browseGame = async () => {
    const folder = await pickFolder("Select the folder the game is installed in");
    if (folder !== null) setGameDir(folder);
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
            hint="unlocks every truck dealer and recruitment agency, puts every company and bus stop on the map"
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
            Reads every road, junction and map area from the installed game, so the map reaches 100% for
            exactly your game version and DLC set. Run it again after a game update or a new map DLC.
          </p>
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-[10px] tracking-widest uppercase">
              game install folder
            </Label>
            <div className="flex gap-2">
              <Input
                value={gameDir}
                onChange={(e) => setGameDir(e.target.value)}
                placeholder="C:\...\steamapps\common\Euro Truck Simulator 2"
                className="font-mono"
              />
              <Button variant="outline" size="icon" onClick={browseGame} aria-label="browse for the game folder">
                <FolderOpen className="size-4" />
              </Button>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => setOps({ ...ops, discoverMap: gameDir.trim() || undefined })}
              disabled={gameDir.trim() === ""}
            >
              <MapIcon className="size-3.5" /> discover the whole map
            </Button>
            {ops.discoverMap && (
              <Button variant="ghost" size="sm" onClick={() => setOps({ ...ops, discoverMap: undefined })}>
                clear
              </Button>
            )}
          </div>
          <p className="text-muted-foreground font-mono text-xs">{detail.discovery}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Discovery from another save</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-muted-foreground text-xs">
            For map mods, whose roads are not in the game folder: merge the discoveries of a save that
            explored them. Point this at its <code className="font-mono">game.sii</code>.
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
        </CardContent>
      </Card>
    </div>
  );
}
