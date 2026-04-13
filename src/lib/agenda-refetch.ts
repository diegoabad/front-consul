/**
 * Intervalo de polling para la agenda / listado de turnos (ms).
 * Config: `VITE_AGENDA_REFETCH_MS` en `.env`. Mínimo 1000 ms; fallback 5000.
 * @see docs/agenda-actualizacion-tiempo-real.md
 */
export function getAgendaRefetchIntervalMs(): number {
  const raw = Number(import.meta.env.VITE_AGENDA_REFETCH_MS);
  if (Number.isFinite(raw) && raw >= 1000) return raw;
  return 5000;
}
