import { useState, useRef, useEffect, useMemo, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn, normalizeDateOnlyForInput } from '@/lib/utils';

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
  disabled?: boolean;
  /**
   * Muestra desplegables de mes y año (además de las flechas). Útil para saltar años sin clic mes a mes (ej. fecha de nacimiento).
   * El rango de años se infiere de `min`/`max` si existen; si no, desde (año actual − 120) hasta año actual.
   */
  showMonthYearSelects?: boolean;
  /**
   * Sin fecha: permite escribir DD/MM/AAAA en el propio control y abrir el calendario con el ícono.
   * Con fecha: un solo botón con el texto formateado; clic abre el calendario (sin campo de texto en el popup).
   */
  directInputWhenEmpty?: boolean;
  /**
   * Altura y estilo alineados a un Select compacto (h-9, bordes grises, texto 13px). Útil en tablas o grillas junto a un desplegable de hora.
   */
  dense?: boolean;
  /** Si devuelve true para YYYY-MM-DD, ese día no se puede elegir (además de min/max y allowedDaysOfWeek). */
  isDateDisabled?: (ymd: string) => boolean;
  /** Si false, no se muestra el botón para limpiar la fecha (evita pasar a modo vacío y escribir a mano). Por defecto true. */
  allowClear?: boolean;
}

function effectiveYearRange(min?: string, max?: string): { from: number; to: number } {
  const nowY = new Date().getFullYear();
  let from = nowY - 120;
  let to = nowY;
  if (min && /^\d{4}/.test(min)) {
    const y = parseInt(min.slice(0, 4), 10);
    if (Number.isFinite(y)) from = y;
  }
  if (max && /^\d{4}/.test(max)) {
    const y = parseInt(max.slice(0, 4), 10);
    if (Number.isFinite(y)) to = y;
  }
  if (from > to) return { from: to, to: from };
  return { from, to };
}

function isYmdInBounds(ymd: string, min?: string, max?: string): boolean {
  if (min && ymd < min) return false;
  if (max && ymd > max) return false;
  return true;
}

/** Solo dígitos (máx. 8) → dd/mm/aaaa con barras mientras escribe. */
function formatDigitsAsDdMmYyyy(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length === 0) return '';
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'Seleccionar fecha',
  className,
  id,
  min,
  max,
  open: openProp,
  onOpenChange,
  scrollContainerRef,
  inline = false,
  allowedDaysOfWeek,
  disabled = false,
  showMonthYearSelects = false,
  directInputWhenEmpty = false,
  dense = false,
  isDateDisabled,
  allowClear = true,
}: DatePickerProps) {
  const [openInternal, setOpenInternal] = useState(false);
  const isControlled = onOpenChange !== undefined;
  const open = isControlled ? (openProp ?? false) : openInternal;
  const setOpen = isControlled ? (next: boolean) => { onOpenChange(next); } : setOpenInternal;

  const [currentMonth, setCurrentMonth] = useState<Date>(() =>
    value ? startOfMonth(new Date(value + 'T12:00:00')) : startOfMonth(new Date())
  );
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const [emptyDraft, setEmptyDraft] = useState('');
  const [emptyInputError, setEmptyInputError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const emptyInputRef = useRef<HTMLInputElement>(null);

  const { from: yearFrom, to: yearTo } = useMemo(() => effectiveYearRange(min, max), [min, max]);
  const yearOptions = useMemo(() => {
    const list: number[] = [];
    for (let y = yearTo; y >= yearFrom; y--) list.push(y);
    return list;
  }, [yearFrom, yearTo]);

  const monthOptions = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => {
        const cap = format(new Date(2000, i, 1), 'LLLL', { locale: es });
        return { value: i, label: cap.charAt(0).toUpperCase() + cap.slice(1) };
      }),
    []
  );

  useEffect(() => {
    if (value) {
      setEmptyDraft('');
      setEmptyInputError(null);
    }
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (portalRef.current?.contains(target)) return;
      setOpen(false);
      setAnchor(null);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open, setOpen]);

  useEffect(() => {
    if (inline || !open || !scrollContainerRef?.current || !containerRef.current) return;
    const el = scrollContainerRef.current;
    const updatePosition = () => {
      if (containerRef.current) setAnchor(containerRef.current.getBoundingClientRect());
    };
    el.addEventListener('scroll', updatePosition, true);
    return () => el.removeEventListener('scroll', updatePosition, true);
  }, [inline, open, scrollContainerRef]);

  const updateAnchor = () => {
    if (containerRef.current && !inline) {
      setAnchor(containerRef.current.getBoundingClientRect());
    }
  };

  const handleOpen = () => {
    if (disabled) return;
    const next = !open;
    setOpen(next);
    if (next) {
      setCurrentMonth(value ? startOfMonth(new Date(value + 'T12:00:00')) : startOfMonth(new Date()));
      updateAnchor();
    } else {
      setAnchor(null);
    }
  };

  const tryApplyEmptyDraft = () => {
    const raw = emptyDraft.trim();
    if (!raw) {
      setEmptyInputError(null);
      return;
    }
    const ymd = normalizeDateOnlyForInput(raw);
    if (!ymd) {
      setEmptyInputError('Usá DD/MM/AAAA o AAAA-MM-DD');
      return;
    }
    if (!isYmdInBounds(ymd, min, max)) {
      setEmptyInputError('Fecha fuera del rango permitido');
      return;
    }
    if (isDateDisabled?.(ymd)) {
      setEmptyInputError('Ese día no está habilitado');
      return;
    }
    setEmptyInputError(null);
    onChange(ymd);
    setEmptyDraft('');
    setOpen(false);
    setAnchor(null);
  };

  const selectClass =
    'h-9 w-full rounded-[8px] border-[1.5px] border-[#D1D5DB] bg-white px-2 text-[13px] text-[#374151] focus:border-[#2563eb] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/20';

  const displayText = value
    ? format(new Date(value + 'T12:00:00'), "d 'de' MMMM, yyyy", { locale: es })
    : placeholder;

  const popoverWide = showMonthYearSelects;

  const calendarContent = (
    <div
      ref={portalRef}
      data-date-picker-portal
      onPointerDown={(e) => e.stopPropagation()}
      className={cn(
        'bg-white border border-[#E5E7EB] rounded-[16px] shadow-xl p-3 pointer-events-auto',
        popoverWide ? 'min-w-[280px] max-w-[320px]' : 'min-w-[252px] max-w-[308px]',
        inline ? 'absolute top-full left-0 right-0 mt-2 z-50 w-full' : 'z-[9999]'
      )}
      style={inline || !anchor ? undefined : {
        position: 'fixed',
        top: anchor.bottom + 8,
        left: anchor.left,
        width: Math.min(Math.max(anchor.width, popoverWide ? 280 : 252), popoverWide ? 320 : 308),
      }}
    >
            {showMonthYearSelects ? (
              <div className="grid grid-cols-2 gap-2 mb-3">
                <select
                  className={selectClass}
                  value={currentMonth.getMonth()}
                  aria-label="Mes"
                  onChange={(e) => {
                    const month = parseInt(e.target.value, 10);
                    setCurrentMonth(new Date(currentMonth.getFullYear(), month, 1));
                  }}
                >
                  {monthOptions.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <select
                  className={selectClass}
                  value={currentMonth.getFullYear()}
                  aria-label="Año"
                  onChange={(e) => {
                    const year = parseInt(e.target.value, 10);
                    setCurrentMonth(new Date(year, currentMonth.getMonth(), 1));
                  }}
                >
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div className="flex items-center justify-between mb-3">
              {!showMonthYearSelects ? (
                <span className="text-[14px] font-semibold text-[#111827] font-['Poppins']">
                  {format(currentMonth, 'MMMM yyyy', { locale: es }).charAt(0).toUpperCase() +
                    format(currentMonth, 'MMMM yyyy', { locale: es }).slice(1)}
                </span>
              ) : (
                <span className="text-[12px] font-medium text-[#6B7280]">Días del mes</span>
              )}
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-[8px] hover:bg-[#dbeafe] text-[#2563eb] [&_svg]:pointer-events-auto"
                  onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
                >
                  <ChevronLeft className="h-3.5 w-3.5 stroke-[2]" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-[8px] hover:bg-[#dbeafe] text-[#2563eb] [&_svg]:pointer-events-auto"
                  onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
                >
                  <ChevronRight className="h-3.5 w-3.5 stroke-[2]" />
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-0.5 text-center min-h-[196px]">
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
                  const ds = dayStr(day);
                  const customDisabled = Boolean(isDateDisabled?.(ds));
                  const isDisabled = (min && ds < min) || (max && ds > max) || notAllowedDay || customDisabled;
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
                        'h-8 rounded-[8px] text-[12px] font-medium font-[\'Inter\'] transition-all',
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

  const showEmptyInput = directInputWhenEmpty && !value;

  return (
    <div
      ref={containerRef}
      className="relative w-full min-w-0"
    >
      {showEmptyInput ? (
        <div className="space-y-1.5">
          <div className={cn('flex w-full min-w-0', className)}>
            <div
              className={cn(
                'flex flex-1 min-w-0 items-stretch rounded-[10px] border-[1.5px] border-[#D1D5DB] bg-white overflow-hidden',
                'focus-within:border-[#2563eb] focus-within:ring-2 focus-within:ring-[#2563eb]/20 focus-within:ring-offset-0',
                disabled && 'opacity-60 pointer-events-none'
              )}
            >
              <button
                type="button"
                tabIndex={-1}
                aria-label="Abrir calendario"
                disabled={disabled}
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleOpen}
                className="flex items-center justify-center px-3 text-[#6B7280] hover:bg-[#F9FAFB] shrink-0 border-r border-[#E5E7EB] transition-colors"
              >
                <Calendar className="h-4 w-4 stroke-[2]" />
              </button>
              <input
                ref={emptyInputRef}
                id={id}
                type="text"
                autoComplete="off"
                disabled={disabled}
                placeholder="DD/MM/AAAA"
                inputMode="numeric"
                maxLength={10}
                value={emptyDraft}
                onChange={(e) => {
                  const formatted = formatDigitsAsDdMmYyyy(e.target.value);
                  setEmptyDraft(formatted);
                  setEmptyInputError(null);
                  requestAnimationFrame(() => {
                    const el = emptyInputRef.current;
                    if (!el) return;
                    const len = formatted.length;
                    el.setSelectionRange(len, len);
                  });
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    tryApplyEmptyDraft();
                  }
                }}
                onBlur={(e) => {
                  const next = e.relatedTarget as Element | null;
                  if (next && containerRef.current?.contains(next)) return;
                  if (next?.closest?.('[data-date-picker-portal]')) return;
                  tryApplyEmptyDraft();
                }}
                className="flex-1 min-w-0 h-[48px] px-3 text-[15px] text-[#374151] placeholder:text-[#9CA3AF] bg-transparent border-0 outline-none"
              />
            </div>
          </div>
          {emptyInputError ? (
            <p className="text-[11px] text-[#DC2626] px-0.5">{emptyInputError}</p>
          ) : null}
        </div>
      ) : dense ? (
        <button
          type="button"
          id={!showEmptyInput ? id : undefined}
          disabled={disabled}
          onClick={handleOpen}
          className={cn(
            'relative box-border flex h-9 w-full min-h-0 shrink-0 items-center justify-start gap-2 overflow-hidden whitespace-nowrap rounded-[8px] border-[1.5px] border-[#D1D5DB] bg-white px-3 py-0 font-[\'Inter\'] text-left text-[13px] font-normal leading-none text-[#374151] shadow-none transition-colors',
            'hover:bg-[#F9FAFB] hover:border-[#2563eb] focus:outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20',
            !value && 'text-[#9CA3AF]',
            disabled && 'cursor-not-allowed opacity-60 hover:bg-transparent',
            value && !disabled && allowClear && 'pr-10',
            className
          )}
        >
          <Calendar className="h-3.5 w-3.5 shrink-0 text-[#6B7280] stroke-[2]" />
          <span className={cn('min-w-0 flex-1 truncate text-left', value ? 'text-[#374151]' : '')}>{displayText}</span>
          {!value ? (
            <ChevronRight className={cn('h-4 w-4 shrink-0 text-[#6B7280] transition-transform', open && 'rotate-90')} />
          ) : null}
        </button>
      ) : (
        <Button
          type="button"
          variant="outline"
          id={!showEmptyInput ? id : undefined}
          disabled={disabled}
          onClick={handleOpen}
          className={cn(
            'mt-0 h-[48px] w-full justify-start gap-2 border-[1.5px] border-[#D1D5DB] rounded-[10px] font-[\'Inter\'] text-left font-normal text-[#374151] hover:bg-[#F9FAFB] hover:text-[#374151] focus-visible:ring-2 focus-visible:ring-[#2563eb]/20 focus-visible:ring-offset-0',
            !value && 'text-[#9CA3AF]',
            disabled && 'opacity-60 cursor-not-allowed hover:bg-transparent',
            value && !disabled && 'pr-10',
            className
          )}
        >
          <Calendar className="h-4 w-4 text-[#6B7280] stroke-[2] flex-shrink-0" />
          <span className={cn('flex-1 truncate', value ? 'text-[#374151]' : '')}>{displayText}</span>
          {!value ? (
            <ChevronRight className={cn('h-4 w-4 text-[#6B7280] flex-shrink-0 transition-transform', open && 'rotate-90')} />
          ) : null}
        </Button>
      )}

      {value && !disabled && allowClear && (
        <button
          type="button"
          aria-label="Limpiar fecha"
          onClick={(e) => {
            e.stopPropagation();
            onChange('');
            setEmptyDraft('');
            setEmptyInputError(null);
            setOpen(false);
            setAnchor(null);
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 flex items-center justify-center rounded-full text-[#9CA3AF] hover:text-[#374151] hover:bg-[#E5E7EB] transition-colors z-[1]"
        >
          <X className="h-3.5 w-3.5 stroke-[2.5]" />
        </button>
      )}

      {open && (inline ? true : anchor) && (inline ? calendarContent : createPortal(calendarContent, document.body))}
    </div>
  );
}
