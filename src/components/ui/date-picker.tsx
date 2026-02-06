import { useState, useRef, useEffect, type RefObject } from 'react';
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
  /** Si se pasan, el componente es controlado (útil para cerrar al hacer scroll en modales). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Ref del contenedor con scroll (ej. contenido del modal). Si se pasa, al hacer scroll se actualiza la posición del calendario para que siga al trigger. */
  scrollContainerRef?: RefObject<HTMLElement | null>;
  /** Si true, el calendario se renderiza inline (pegado al trigger) y hace scroll con la página; no usa portal. */
  inline?: boolean;
  /** Si se pasa, solo se pueden elegir fechas cuyo día de la semana (0=domingo, 1=lunes, ..., 6=sábado) esté en este array. */
  allowedDaysOfWeek?: number[];
}

export function DatePicker({ value, onChange, placeholder = 'Seleccionar fecha', className, id, min, max, open: openProp, onOpenChange, scrollContainerRef, inline = false, allowedDaysOfWeek }: DatePickerProps) {
  const [openInternal, setOpenInternal] = useState(false);
  const isControlled = onOpenChange !== undefined;
  const open = isControlled ? (openProp ?? false) : openInternal;
  const setOpen = isControlled ? (next: boolean) => { onOpenChange(next); } : setOpenInternal;

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
  }, [open, setOpen]);

  useEffect(() => {
    if (inline || !open || !scrollContainerRef?.current || !triggerRef.current) return;
    const el = scrollContainerRef.current;
    const updatePosition = () => {
      if (triggerRef.current) setAnchor(triggerRef.current.getBoundingClientRect());
    };
    el.addEventListener('scroll', updatePosition, true);
    return () => el.removeEventListener('scroll', updatePosition, true);
  }, [inline, open, scrollContainerRef]);

  const handleOpen = () => {
    const next = !open;
    setOpen(next);
    if (next && triggerRef.current) {
      setCurrentMonth(value ? startOfMonth(new Date(value + 'T12:00:00')) : startOfMonth(new Date()));
      if (!inline) setAnchor(triggerRef.current.getBoundingClientRect());
    } else {
      setAnchor(null);
    }
  };

  const displayText = value
    ? format(new Date(value + 'T12:00:00'), "d 'de' MMMM, yyyy", { locale: es })
    : placeholder;

  const calendarContent = (
    <div
      data-date-picker-portal
      className={cn(
        'bg-white border border-[#E5E7EB] rounded-[16px] shadow-xl p-4 pointer-events-auto min-w-[280px] max-w-[450px]',
        inline ? 'absolute top-full left-0 right-0 mt-2 z-50 w-full' : 'z-[9999]'
      )}
      style={inline || !anchor ? undefined : {
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
                  const dayOfWeek = day.getDay();
                  const notAllowedDay = allowedDaysOfWeek != null && allowedDaysOfWeek.length > 0 && !allowedDaysOfWeek.includes(dayOfWeek);
                  const isDisabled = (min && dayStr(day) < min) || (max && dayStr(day) > max) || notAllowedDay;
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
          </div>
  );

  return (
    <div className={inline ? 'relative' : undefined}>
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

      {open && (inline ? true : anchor) && (inline ? calendarContent : createPortal(calendarContent, document.body))}
    </div>
  );
}
