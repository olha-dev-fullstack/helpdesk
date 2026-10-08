import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SelectOption } from "../types";

export function FilterSelect<V extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  /** Accessible name of the control. */
  label: string;
  value: V;
  options: SelectOption<V>[];
  onChange: (value: V) => void;
  className?: string;
}) {
  return (
    <Select
      items={options}
      value={value}
      onValueChange={(next) => next !== null && onChange(next as V)}
    >
      <SelectTrigger aria-label={label} className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
