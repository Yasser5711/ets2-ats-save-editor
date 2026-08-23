import { useEffect, useState } from "react";
import { toast } from "sonner";
import { History, RefreshCw, Stethoscope } from "lucide-react";
import { api, type GameRoot, type LogIssue } from "@/api.ts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Backup {
  file: string;
  modified: string;
  bytes: number;
}

export function DoctorTab({ root, path }: { root: GameRoot | null; path: string }) {
  const [issues, setIssues] = useState<LogIssue[]>([]);
  const [backups, setBackups] = useState<Backup[]>([]);

  const refresh = () => {
    const load = async () => {
      if (root) setIssues(await api.log(root.path));
      setBackups(await api.backups(path));
    };
    load().catch((e: Error) => toast.error(e.message));
  };

  useEffect(refresh, [root, path]);

  const restore = (file: string) => {
    const run = async () => {
      await api.restore(path, file);
      toast.success(`restored ${file}`);
    };
    run().catch((e: Error) => toast.error(e.message));
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm">
            <History className="size-4" /> Backups of this slot
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={refresh}>
            <RefreshCw className="size-3.5" /> refresh
          </Button>
        </CardHeader>
        <CardContent className="space-y-1">
          {backups.length === 0 && <p className="text-muted-foreground text-sm">No backups yet.</p>}
          {backups.map((backup) => (
            <div key={backup.file} className="flex items-center gap-3 font-mono text-xs">
              <span className="truncate">{backup.file}</span>
              <span className="text-muted-foreground tabular">{(backup.bytes / 1048576).toFixed(1)} MB</span>
              <Button variant="destructive" size="sm" onClick={() => restore(backup.file)}>
                restore
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Stethoscope className="size-4" /> Game log errors
          </CardTitle>
        </CardHeader>
        <CardContent>
          {issues.length === 0 && <p className="text-muted-foreground text-sm">Nothing logged.</p>}
          <ScrollArea className="max-h-80">
            <div className="space-y-1.5">
              {issues.map((issue) => (
                <div key={`${issue.time}-${issue.text}`} className="rounded-md border p-2">
                  <p className="text-destructive font-mono text-[11px]">{issue.text}</p>
                  {issue.hint && <p className="text-primary mt-1 text-xs">{issue.hint}</p>}
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
