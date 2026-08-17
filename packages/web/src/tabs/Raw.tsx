import { useEffect, useState } from "react";
import { api, type Ops, type UnitHit } from "../api.ts";
import { Button, Panel } from "../ui.tsx";

interface Props {
  path: string;
  ops: Ops;
  setOps: (next: Ops) => void;
}

export function RawTab({ path, ops, setOps }: Props) {
  const [query, setQuery] = useState("economy");
  const [hits, setHits] = useState<UnitHit[]>([]);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<UnitHit | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    let alive = true;
    api.units(path, query).then((result) => {
      if (!alive) return;
      setHits(result.hits);
      setTotal(result.total);
    });
    return () => {
      alive = false;
    };
  }, [path, query]);

  const stage = (key: string, value: string) => {
    if (!selected) return;
    const fields = (ops.fields ?? []).filter((f) => !(f.unitId === selected.id && f.key === key));
    setOps({ ...ops, fields: [...fields, { unitId: selected.id, key, value }] });
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[20rem_1fr]">
      <Panel title={`units (${hits.length} of ${total.toLocaleString()})`}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="class or id"
          className="mb-2 w-full rounded-md border border-[var(--color-edge)] bg-black/30 px-2 py-1.5 font-mono text-xs"
        />
        <div className="max-h-[28rem] overflow-auto">
          {hits.map((hit) => (
            <button
              key={hit.id}
              onClick={() => {
                setSelected(hit);
                setDraft({});
              }}
              className={`block w-full cursor-pointer truncate rounded px-2 py-1 text-left font-mono text-[11px] hover:bg-slate-800 ${
                selected?.id === hit.id ? "bg-slate-800 text-amber-300" : "text-slate-300"
              }`}
            >
              {hit.cls} <span className="text-slate-500">{hit.id}</span>
            </button>
          ))}
        </div>
      </Panel>

      <Panel title={selected ? `${selected.cls} : ${selected.id}` : "pick a unit"}>
        {!selected && <div className="text-sm text-slate-500">Search on the left, then edit single fields.</div>}
        {selected && (
          <div className="max-h-[28rem] overflow-auto">
            <table className="w-full text-left font-mono text-xs">
              <tbody>
                {selected.lines.map((line, i) => {
                  const key = line.index === null ? line.key : `${line.key}[${line.index}]`;
                  const editable = line.index === null;
                  const staged = (ops.fields ?? []).find((f) => f.unitId === selected.id && f.key === line.key);
                  return (
                    <tr key={`${key}-${i}`} className="border-t border-[var(--color-edge)]/60">
                      <td className="w-1/3 px-2 py-1 text-slate-400">{key}</td>
                      <td className="px-2 py-1">
                        {editable ? (
                          <input
                            value={draft[line.key] ?? staged?.value ?? line.value}
                            onChange={(e) => setDraft({ ...draft, [line.key]: e.target.value })}
                            className={`w-full rounded border bg-black/30 px-1.5 py-0.5 ${
                              staged ? "border-amber-500 text-amber-300" : "border-transparent text-slate-200"
                            }`}
                          />
                        ) : (
                          <span className="text-slate-500">{line.value}</span>
                        )}
                      </td>
                      <td className="w-20 px-2 py-1">
                        {editable && draft[line.key] !== undefined && draft[line.key] !== line.value && (
                          <Button tone="ghost" onClick={() => stage(line.key, draft[line.key])}>
                            stage
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
