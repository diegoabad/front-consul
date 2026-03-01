import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface TruncateWithTooltipProps {
  /** Texto a mostrar (se trunca si es largo) */
  children: React.ReactNode;
  /** Valor completo para el tooltip (si no se pasa, se usa children convertido a string) */
  value?: string | null;
  /** Clases CSS adicionales */
  className?: string;
  /** Ancho máximo (ej: max-w-[180px], max-w-[200px]). Por defecto truncate. */
  maxWidth?: string;
}

/**
 * Muestra texto truncado con ellipsis y tooltip con el valor completo al hacer hover.
 * Evita que columnas o celdas se estiren con datos largos (ej. encriptados).
 */
export function TruncateWithTooltip({
  children,
  value,
  className,
  maxWidth = 'max-w-full',
}: TruncateWithTooltipProps) {
  const fallback = typeof children === 'string' ? children : '';
  const tooltipText = (value ?? fallback) || '-';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn('block truncate cursor-default min-w-0', maxWidth, className)}>
            {children}
          </span>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="max-w-[320px] break-words bg-[#111827] text-white text-xs font-['Inter'] rounded-[8px] px-3 py-2 [&>p]:text-white"
        >
          <p className="text-white whitespace-pre-wrap break-words m-0">{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
