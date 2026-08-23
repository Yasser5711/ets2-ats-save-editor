import { useEffect, useState } from "react";
import { CircleAlert, FolderOpen, HardDrive, Loader2, Truck } from "lucide-react";
import { api, type GameRoot } from "@/api.ts";
import { pickFolder } from "@/lib/platform.ts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export function SetupScreen({ onPick }: { onPick: (root: GameRoot) => void }) {
  const [detected, setDetected] = useState<GameRoot[]>([]);
  const [scanning, setScanning] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const scan = async () => setDetected((await api.env()).roots);
    scan()
      .catch((e: Error) => setError(`could not scan for game folders: ${e.message}`))
      .finally(() => setScanning(false));
  }, []);

  const browse = async () => {
    setError(null);
    const chosen = await pickFolder("Select your Euro Truck Simulator 2 or American Truck Simulator folder");
    if (chosen === null) return;
    try {
      const check = await api.validateRoot(chosen);
      if (!check.ok) {
        setError(`No profiles in ${chosen}. Pick the folder that contains "profiles", not a save inside it.`);
        return;
      }
      onPick({
        id: check.game?.includes("American") ? "ats" : "ets2",
        name: check.game ?? "Game folder",
        path: chosen,
        running: false,
      });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="flex h-full items-center justify-center p-8">
      <Card className="w-full max-w-xl">
        <CardHeader className="items-center text-center">
          <div className="bg-primary/10 text-primary mx-auto flex size-12 items-center justify-center rounded-xl">
            <Truck className="size-6" />
          </div>
          <CardTitle className="mt-3 text-xl">Where are your saves?</CardTitle>
          <CardDescription>
            Pick the game's folder in your Documents — the one that contains{" "}
            <code className="text-foreground font-mono">profiles</code>. Your saves live inside it and stay
            untouched until you ask for a change.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {scanning && (
            <div className="text-muted-foreground flex items-center gap-2 text-sm">
              <Loader2 className="size-4 animate-spin" /> looking in the usual places
            </div>
          )}

          {detected.length > 0 && (
            <div className="space-y-2">
              <p className="text-muted-foreground text-xs">Found on this PC — click to open:</p>
              {detected.map((root) => (
                <button
                  key={root.path}
                  onClick={() => onPick(root)}
                  className="hover:border-primary/60 hover:bg-accent flex w-full cursor-pointer items-center gap-3 rounded-lg border p-3 text-left transition-colors"
                >
                  <HardDrive className="text-primary size-5 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{root.name}</span>
                    <span className="text-muted-foreground block truncate font-mono text-xs">{root.path}</span>
                  </span>
                  <Badge variant="secondary">use this</Badge>
                </button>
              ))}
            </div>
          )}

          {!scanning && detected.length === 0 && (
            <div className="space-y-1 text-sm">
              <p>No game folder in the usual places, so choose it yourself.</p>
              <p className="text-muted-foreground text-xs">
                Typically <code className="font-mono">Documents\Euro Truck Simulator 2</code> or{" "}
                <code className="font-mono">Documents\American Truck Simulator</code> — including the OneDrive
                version of Documents.
              </p>
            </div>
          )}

          <Separator />

          <Button onClick={browse} className="w-full" size="lg">
            <FolderOpen className="size-4" /> Choose folder
          </Button>

          {error && (
            <p className="text-destructive flex items-start gap-2 text-sm">
              <CircleAlert className="mt-0.5 size-4 shrink-0" /> {error}
            </p>
          )}

        </CardContent>
      </Card>
    </div>
  );
}
