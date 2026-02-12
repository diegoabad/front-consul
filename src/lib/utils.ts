import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formatea texto para mostrar en pantalla: primera letra de cada palabra en mayúscula, resto en minúscula.
 * Los datos se guardan en minúsculas en BD; esta función normaliza la visualización.
 */
export function formatDisplayText(str: string | null | undefined): string {
  if (str == null || typeof str !== "string") return str ?? "";
  return str
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ""))
    .join(" ");
}

/** Fecha y hora para evoluciones: "dd de MMMM de yyyy HH:mm" con mes en mayúscula inicial. */
export function formatEvolucionDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const formatted = format(d, "dd 'de' MMMM 'de' yyyy HH:mm", { locale: es });
  const parts = formatted.split(" de ");
  if (parts.length >= 3) {
    parts[1] = parts[1].charAt(0).toUpperCase() + parts[1].slice(1).toLowerCase();
  }
  return parts.join(" de ");
}

/** Fecha y hora compacta para listados: "dd/mm/aa HH:mm" (ej. 12/02/25 10:30). */
export function formatEvolucionDateTimeShort(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "dd/MM/yy HH:mm");
}
