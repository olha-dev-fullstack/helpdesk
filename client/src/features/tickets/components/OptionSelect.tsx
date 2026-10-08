import type { ReactNode } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SelectOption } from "../types";

export function OptionSelect<V extends string>({
  label,
  value,
  options,
  onChange,
  renderOption,
  className,
  disabled,
}: {
  /** Accessible name of the control. */
  label: string;
  value: V;
  options: SelectOption<V>[];
  onChange: (value: V) => void;
  /** Custom look for an option, used both in the list and for the selected value. */
  renderOption?: (option: SelectOption<V>) => ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  const render = (option: SelectOption<V>) =>
    renderOption ? renderOption(option) : option.label;

  return (
    <Select
      items={options}
      value={value}
      disabled={disabled}
      onValueChange={(next) => next !== null && onChange(next as V)}
    >
      <SelectTrigger aria-label={label} className={className}>
        <SelectValue>
          {(current: V) => {
            const option = options.find((o) => o.value === current);
            return option ? render(option) : null;
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {render(o)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
