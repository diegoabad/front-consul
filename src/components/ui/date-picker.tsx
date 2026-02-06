import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  /** Fecha mínima seleccionable (YYYY-MM-DD). No se pueden elegir días anteriores. */
  min?: string;
  /** Fecha máxima seleccionable (YYYY-MM-DD). No se pueden elegir días posteriores. */
  max?: string;
}

export function DatePicker({ value, onChange, placeholder = 'Seleccionar fecha', className, id, min, max }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState<Date>(() =>
    value ? startOfMonth(new Date(value + 'T12:00:00')) : startOfMonth(new Date())
  );
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if ((e.target as Element).closest?.('[data-date-picker-portal]')) return;
      setOpen(false);
      setAnchor(null);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const handleOpen = () => {
    const next = !open;
    setOpen(next);
    if (next && triggerRef.current) {
      setCurrentMonth(value ? startOfMonth(new Date(value + 'T12:00:00')) : startOfMonth(new Date()));
      setAnchor(triggerRef.current.getBoundingClientRect());
    } else {
      setAnchor(null);
    }
  };

  const displayText = value
    ? format(new Date(value + 'T12:00:00'), "d 'de' MMMM, yyyy", { locale: es })
    : placeholder;

  return (
    <>
      <Button
        ref={triggerRef}
        type="button"
        variant="outline"
        id={id}
        onClick={handleOpen}
        className={cn(
          'mt-0 h-[48px] w-full justify-start gap-2 border-[1.5px] border-[#D1D5DB] rounded-[10px] font-[\'Inter\'] text-left font-normal text-[#374151] hover:bg-[#F9FAFB] hover:text-[#374151] focus-visible:ring-2 focus-visible:ring-[#2563eb]/20 focus-visible:ring-offset-0',
          !value && 'text-[#9CA3AF]',
          className
        )}
      >
        <Calendar className="h-4 w-4 text-[#6B7280] stroke-[2] flex-shrink-0" />
        <span className={cn('flex-1 truncate', value ? 'text-[#374151]' : '')}>{displayText}</span>
        <ChevronRight className={cn('h-4 w-4 text-[#6B7280] flex-shrink-0 transition-transform', open && 'rotate-90')} />
      </Button>

      {open && anchor &&
        createPortal(
          <div
            data-date-picker-portal
            className="bg-white border border-[#E5E7EB] rounded-[16px] shadow-xl p-4 z-[9999] pointer-events-auto min-w-[280px] max-w-[450px]"
            style={{
              position: 'fixed',
              top: anchor.bottom + 8,
              left: anchor.left,
              width: Math.min(Math.max(anchor.width, 280), 450),
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-[16px] font-semibold text-[#111827] font-['Poppins']">
                {format(currentMonth, 'MMMM yyyy', { locale: es }).charAt(0).toUpperCase() +
                  format(currentMonth, 'MMMM yyyy', { locale: es }).slice(1)}
              </span>
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-[8px] hover:bg-[#dbeafe] text-[#2563eb]"
                  onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
                >
                  <ChevronLeft className="h-4 w-4 stroke-[2]" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-[8px] hover:bg-[#dbeafe] text-[#2563eb]"
                  onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
                >
                  <ChevronRight className="h-4 w-4 stroke-[2]" />
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center">
              {['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'].map((d) => (
                <span key={d} className="text-[11px] font-medium text-[#6B7280] font-['Inter'] py-1">
                  {d}
                </span>
              ))}
              {(() => {
                const monthStart = currentMonth;
                const monthEnd = endOfMonth(currentMonth);
                const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
                const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
                const days = eachDayOfInterval({ start: calStart, end: calEnd });
                const selectedDate = value ? new Date(value + 'T12:00:00') : null;
                const dayStr = (d: Date) => format(d, 'yyyy-MM-dd');
                return days.map((day) => {
                  const isCurrentMonth = isSameMonth(day, currentMonth);
                  const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
                  const isDisabled = (min && dayStr(day) < min) || (max && dayStr(day) > max);
                  return (
                    <button
                      key={day.toISOString()}
                      type="button"
                      disabled={Boolean(isDisabled)}
                      onClick={() => {
                        if (isDisabled) return;
                        onChange(format(day, 'yyyy-MM-dd'));
                        setCurrentMonth(startOfMonth(day));
                        setOpen(false);
                        setAnchor(null);
                      }}
                      className={cn(
                        'h-9 rounded-[10px] text-[13px] font-medium font-[\'Inter\'] transition-all',
                        isSelected && 'bg-[#2563eb] text-white hover:bg-[#1d4ed8]',
                        isDisabled && 'opacity-40 cursor-not-allowed pointer-events-none',
                        !isSelected && !isDisabled && !isCurrentMonth && 'text-[#9CA3AF] hover:bg-[#F3F4F6] cursor-pointer',
                        !isSelected && !isDisabled && isCurrentMonth && 'text-[#374151] hover:bg-[#dbeafe] cursor-pointer'
                      )}
                    >
                      {format(day, 'd')}
                    </button>
                  );
                });
              })()}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
