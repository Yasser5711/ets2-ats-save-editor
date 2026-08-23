import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

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
    <div className="space-y-1.5">
      <Label className="text-muted-foreground text-[10px] tracking-widest uppercase">{label}</Label>
      <Input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="tabular font-mono"
      />
    </div>
  );
}

export function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="hover:bg-accent/40 flex cursor-pointer items-start gap-3 rounded-md p-2 transition-colors">
      <Switch checked={checked} onCheckedChange={onChange} className="mt-0.5" />
      <span className="min-w-0">
        <span className="block text-sm">{label}</span>
        {hint && <span className="text-muted-foreground block text-xs">{hint}</span>}
      </span>
    </label>
  );
}
