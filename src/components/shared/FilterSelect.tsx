import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface FilterOption {
  value: string;
  label: string;
}

interface FilterSelectProps {
  value: string;
  onChange?: (value: string) => void;
  onValueChange?: (value: string) => void;
  options: FilterOption[];
  placeholder?: string;
  className?: string;
  allLabel?: string;
}

export function FilterSelect({
  value,
  onChange,
  onValueChange,
  options,
  placeholder = 'Seleccionar...',
  className,
  allLabel: _allLabel,
}: FilterSelectProps) {
  const handleChange = onChange ?? onValueChange ?? (() => {});
  return (
    <Select value={value} onValueChange={handleChange}>
      <SelectTrigger className={cn('w-[180px]', className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
