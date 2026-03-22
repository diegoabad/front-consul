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

/**
 * Fecha civil YYYY-MM-DD sin zona horaria, interpretada en hora local.
 * `new Date("1989-06-22")` en JS es medianoche UTC y en AR puede mostrarse como 21/06.
 */
export function parseLocalDateFromYMD(isoOrYmd: string): Date {
  const ymd = String(isoOrYmd).trim().slice(0, 10);
  const parts = ymd.split("-");
  if (parts.length !== 3) return new Date(isoOrYmd);
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    return new Date(isoOrYmd);
  }
  return new Date(y, m - 1, d);
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Valor para `<input type="date">` (debe ser estrictamente YYYY-MM-DD).
 * Acepta ISO completo, texto legacy (p. ej. Date#toString() guardado mal) y dd/mm/aaaa.
 */
export function normalizeDateOnlyForInput(raw?: string | number | null): string {
  if (raw == null) return "";
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return "";
    return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
  }
  const s = String(raw).trim();
  if (s === "") return "";

  const isoHead = /^(\d{4})-(\d{2})-(\d{2})(?:T|$|[^0-9])/.exec(s);
  if (isoHead) {
    const y = parseInt(isoHead[1], 10);
    const mo = parseInt(isoHead[2], 10);
    const d = parseInt(isoHead[3], 10);
    const cal = new Date(y, mo - 1, d);
    if (cal.getFullYear() === y && cal.getMonth() === mo - 1 && cal.getDate() === d) {
      return `${isoHead[1]}-${isoHead[2]}-${isoHead[3]}`;
    }
  }

  const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(s);
  if (dmy) {
    const di = parseInt(dmy[1], 10);
    const mi = parseInt(dmy[2], 10);
    const yi = parseInt(dmy[3], 10);
    const cal = new Date(yi, mi - 1, di);
    if (cal.getFullYear() === yi && cal.getMonth() === mi - 1 && cal.getDate() === di) {
      return `${yi}-${pad2(mi)}-${pad2(di)}`;
    }
  }

  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) {
    const looksLikeIsoInstant = /^\d{4}-\d{2}-\d{2}T/.test(s);
    if (looksLikeIsoInstant) {
      return `${parsed.getUTCFullYear()}-${pad2(parsed.getUTCMonth() + 1)}-${pad2(parsed.getUTCDate())}`;
    }
    return `${parsed.getFullYear()}-${pad2(parsed.getMonth() + 1)}-${pad2(parsed.getDate())}`;
  }

  return "";
}
