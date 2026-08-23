import { useEffect, useState } from "react";
import { api, type Ops, type UnitHit } from "@/api.ts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

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
    const search = async () => {
      const result = await api.units(path, query);
      if (!alive) return;
      setHits(result.hits);
      setTotal(result.total);
    };
    void search();
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
    <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            Units · {hits.length} of {total.toLocaleString()}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="class or id"
            className="h-8 font-mono"
          />
          <ScrollArea className="h-[26rem]">
            {hits.map((hit) => (
              <button
                key={hit.id}
                onClick={() => {
                  setSelected(hit);
                  setDraft({});
                }}
                className={`hover:bg-accent block w-full cursor-pointer truncate rounded px-2 py-1 text-left font-mono text-[11px] ${
                  selected?.id === hit.id ? "bg-accent text-primary" : ""
                }`}
              >
                {hit.cls} <span className="text-muted-foreground">{hit.id}</span>
              </button>
            ))}
          </ScrollArea>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="truncate font-mono text-sm">
            {selected ? `${selected.cls} : ${selected.id}` : "pick a unit"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!selected && (
            <p className="text-muted-foreground text-sm">Search on the left, then edit single fields.</p>
          )}
          {selected && (
            <ScrollArea className="h-[26rem]">
              <table className="w-full text-left font-mono text-xs">
                <tbody>
                  {selected.lines.map((line, i) => {
                    const key = line.index === null ? line.key : `${line.key}[${line.index}]`;
                    const editable = line.index === null;
                    const staged = (ops.fields ?? []).find(
                      (f) => f.unitId === selected.id && f.key === line.key,
                    );
                    return (
                      <tr key={`${key}-${line.value}-${i}`} className="border-t">
                        <td className="text-muted-foreground w-1/3 px-2 py-1">{key}</td>
                        <td className="px-2 py-1">
                          {editable ? (
                            <Input
                              value={draft[line.key] ?? staged?.value ?? line.value}
                              onChange={(e) => setDraft({ ...draft, [line.key]: e.target.value })}
                              className={`h-7 font-mono text-xs ${staged ? "border-primary text-primary" : ""}`}
                            />
                          ) : (
                            <span className="text-muted-foreground">{line.value}</span>
                          )}
                        </td>
                        <td className="w-20 px-2 py-1">
                          {editable && draft[line.key] !== undefined && draft[line.key] !== line.value && (
                            <Button variant="secondary" size="sm" onClick={() => stage(line.key, draft[line.key])}>
                              stage
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
