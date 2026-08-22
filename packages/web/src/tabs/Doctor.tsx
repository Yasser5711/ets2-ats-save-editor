import { useEffect, useState } from "react";
import { api, type GameRoot, type LogIssue } from "../api.ts";
import { Button, Panel } from "../ui.tsx";

export function DoctorTab({ root, path }: { root: GameRoot | null; path: string }) {
  const [issues, setIssues] = useState<LogIssue[]>([]);
  const [backups, setBackups] = useState<{ file: string; modified: string; bytes: number }[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = () => {
    const load = async () => {
      if (root) setIssues(await api.log(root.path));
      setBackups(await api.backups(path));
    };
    load().catch((e: Error) => setNotice(e.message));
  };

  useEffect(refresh, [root, path]);

  return (
    <div className="space-y-5">
      <Panel title="backups of this slot" right={<Button tone="ghost" onClick={refresh}>refresh</Button>}>
        {backups.length === 0 && <div className="text-sm text-slate-500">No backups yet.</div>}
        <div className="space-y-1">
          {backups.map((b) => (
            <div key={b.file} className="flex items-center gap-3 font-mono text-xs">
              <span className="text-slate-300">{b.file}</span>
              <span className="text-slate-500">{(b.bytes / 1048576).toFixed(1)} MB</span>
              <Button
                tone="danger"
                onClick={() => {
                  const restore = async () => {
                    await api.restore(path, b.file);
                    setNotice(`restored ${b.file}`);
                  };
                  restore().catch((e: Error) => setNotice(e.message));
                }}
              >
                restore
              </Button>
            </div>
          ))}
        </div>
        {notice && <div className="mt-2 text-xs text-emerald-300">{notice}</div>}
      </Panel>

      <Panel title="game log errors">
        {issues.length === 0 && <div className="text-sm text-slate-500">Nothing logged.</div>}
        <div className="max-h-80 space-y-1 overflow-auto">
          {issues.map((issue, i) => (
            <div key={`${issue.time}-${i}`} className="rounded border border-[var(--color-edge)]/60 p-2">
              <div className="font-mono text-[11px] text-red-300">{issue.text}</div>
              {issue.hint && <div className="mt-1 text-xs text-amber-300">{issue.hint}</div>}
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
