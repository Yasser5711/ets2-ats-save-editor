import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";

export function StatCard({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <Card className="gap-0 p-3">
      <span className="text-muted-foreground text-[10px] font-medium tracking-widest uppercase">{label}</span>
      <span className="tabular mt-1 font-mono text-lg leading-tight">{value}</span>
      {hint && <span className="text-muted-foreground truncate text-xs">{hint}</span>}
    </Card>
  );
}

export function money(value: string): string {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toLocaleString("en-US") : value;
}
