/**
 * Zona horaria única del consultorio (mostrar fechas y armar “días calendario” igual que en el servidor con TZ=America/Argentina/Buenos_Aires).
 * Opcional: VITE_APP_TIMEZONE en .env / Netlify (default Buenos Aires).
 */
export const APP_TIMEZONE =
  (import.meta.env.VITE_APP_TIMEZONE as string | undefined)?.trim() || 'America/Argentina/Buenos_Aires';

/** YYYY-MM-DD del instante `d` en la zona de la app (p. ej. qué “día” es en Buenos Aires). */
export function getDateKeyInAppTimezone(d: Date): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = fmt.formatToParts(d);
  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  return `${y}-${m}-${day}`;
}

/** Fecha y hora legibles en la zona de la app (es-AR). */
export function formatDateTimeAppTimezone(
  d: Date | string,
  opts?: Intl.DateTimeFormatOptions
): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return String(d);
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: APP_TIMEZONE,
    dateStyle: 'medium',
    timeStyle: 'short',
    ...opts,
  }).format(date);
}
