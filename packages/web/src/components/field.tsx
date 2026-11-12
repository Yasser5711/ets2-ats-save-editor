import { Input } from "@/components/ui/input";

interface Props {
  label: string;
  /** undefined leaves the save's own value alone */
  value: number | undefined;
  onChange: (next: number | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
}

/** A whole number that may be left empty. */
export function NumberField({ label, value, onChange, placeholder, disabled }: Props) {
  return (
    <label className="block space-y-1.5">
      <span className="text-muted-foreground block text-[13px]">{label}</span>
      <Input
        inputMode="numeric"
        value={value === undefined ? "" : String(value)}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "");
          onChange(digits === "" ? undefined : Number(digits));
        }}
        className="tabular"
      />
    </label>
  );
}
