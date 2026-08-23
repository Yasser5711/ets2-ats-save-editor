import { useEffect, useState } from "react";
import { FolderOpen, HardDriveDownload, Loader2, Truck } from "lucide-react";
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
    const scan = async () => {
      const env = await api.env();
      setDetected(env.roots);
    };
    scan()
      .catch((e: Error) => setError(e.message))
      .finally(() => setScanning(false));
  }, []);

  const browse = async () => {
    const chosen = await pickFolder("Select your Euro Truck Simulator 2 or American Truck Simulator folder");
    if (chosen === null) return;
    setError(null);
    const check = await api.validateRoot(chosen);
    if (!check.ok) {
      setError(`${chosen} has no profiles or steam_profiles folder inside`);
      return;
    }
    onPick({ id: check.game?.includes("American") ? "ats" : "ets2", name: check.game ?? "Custom folder", path: chosen, running: false });
  };

  return (
    <div className="flex h-full items-center justify-center p-8">
      <Card className="w-full max-w-xl">
        <CardHeader className="items-center text-center">
          <div className="bg-primary/10 text-primary mx-auto flex size-12 items-center justify-center rounded-xl">
            <Truck className="size-6" />
          </div>
          <CardTitle className="mt-3 text-xl">Choose your game folder</CardTitle>
          <CardDescription>
            The folder that holds <code className="font-mono">profiles</code> and{" "}
            <code className="font-mono">steam_profiles</code> — usually under Documents.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {scanning && (
            <div className="text-muted-foreground flex items-center gap-2 text-sm">
              <Loader2 className="size-4 animate-spin" /> scanning the usual locations
            </div>
          )}

          {detected.length > 0 && (
            <div className="space-y-2">
              {detected.map((root) => (
                <button
                  key={root.path}
                  onClick={() => onPick(root)}
                  className="hover:border-primary/60 hover:bg-accent flex w-full cursor-pointer items-center gap-3 rounded-lg border p-3 text-left transition-colors"
                >
                  <HardDriveDownload className="text-primary size-5 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{root.name}</span>
                    <span className="text-muted-foreground block truncate font-mono text-xs">{root.path}</span>
                  </span>
                  <Badge variant="secondary">detected</Badge>
                </button>
              ))}
            </div>
          )}

          {!scanning && detected.length === 0 && (
            <p className="text-muted-foreground text-sm">
              Nothing found automatically. Pick the folder yourself.
            </p>
          )}

          <Separator />

          <Button onClick={browse} className="w-full" size="lg">
            <FolderOpen className="size-4" /> Browse for a folder
          </Button>

          {error && <p className="text-destructive text-sm">{error}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
