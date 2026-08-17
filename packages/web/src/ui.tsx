import type { ReactNode } from "react";

export function Panel({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-[var(--color-edge)] bg-[var(--color-panel)]">
      <header className="flex items-center justify-between border-b border-[var(--color-edge)] px-4 py-2.5">
        <h2 className="text-xs font-semibold tracking-widest text-slate-400 uppercase">{title}</h2>
        {right}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Button({
  children,
  onClick,
  tone = "default",
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  tone?: "default" | "primary" | "danger" | "ghost";
  disabled?: boolean;
}) {
  const tones = {
    default: "bg-slate-800 hover:bg-slate-700 text-slate-100 border-slate-700",
    primary: "bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-400 font-semibold",
    danger: "bg-red-900/70 hover:bg-red-800 text-red-100 border-red-800",
    ghost: "bg-transparent hover:bg-slate-800 text-slate-300 border-transparent",
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`cursor-pointer rounded-md border px-3 py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${tones[tone]}`}
    >
      {children}
    </button>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-md border border-[var(--color-edge)] bg-black/20 px-3 py-2">
      <div className="text-[10px] tracking-widest text-slate-500 uppercase">{label}</div>
      <div className="font-mono text-lg text-slate-100">{value}</div>
      {hint && <div className="text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

export function Toggle({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-md px-2 py-1.5 hover:bg-black/20">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 size-4 accent-amber-500"
      />
      <span>
        <span className="text-sm text-slate-200">{label}</span>
        {hint && <span className="block text-xs text-slate-500">{hint}</span>}
      </span>
    </label>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-[10px] tracking-widest text-slate-500 uppercase">{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-[var(--color-edge)] bg-black/30 px-2 py-1.5 font-mono text-sm outline-none focus:border-amber-500"
      />
    </label>
  );
}

export function money(value: string): string {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString("en-US") : value;
}
