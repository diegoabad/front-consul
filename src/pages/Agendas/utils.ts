import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatDisplayText } from '@/lib/utils';
import type { ConfiguracionAgenda } from '@/types';

export const DIAS_SEMANA = [
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sábado' },
  { value: 0, label: 'Domingo' },
];

export const DIAS_CORTOS: Record<number, string> = {
  1: 'Lu', 2: 'Ma', 3: 'Mi', 4: 'Ju', 5: 'Vi', 6: 'Sá', 0: 'Do',
};

export function getDiaSemanaLabel(dia: number): string {
  return DIAS_SEMANA.find((d) => d.value === dia)?.label ?? '';
}

export function formatTime(time: string): string {
  return time.substring(0, 5);
}

export function formatFechaSafe(fecha: string | null | undefined): string {
  if (!fecha) return '-';
  const dateOnly = typeof fecha === 'string' && fecha.length >= 10 ? fecha.slice(0, 10) : fecha;
  const d = new Date(dateOnly + 'T12:00:00');
  if (Number.isNaN(d.getTime())) return '-';
  return formatDisplayText(format(d, 'd MMM yyyy', { locale: es }));
}

export function formatDiasYHorarios(agendas: ConfiguracionAgenda[]): string {
  if (agendas.length === 0) return '—';
  const bySlot = new Map<string, number[]>();
  for (const a of agendas) {
    const key = `${formatTime(a.hora_inicio)}-${formatTime(a.hora_fin)}`;
    if (!bySlot.has(key)) bySlot.set(key, []);
    bySlot.get(key)!.push(a.dia_semana);
  }
  const ordenDias = [1, 2, 3, 4, 5, 6, 0];
  const parts: string[] = [];
  bySlot.forEach((dias, slot) => {
    dias.sort((a, b) => ordenDias.indexOf(a) - ordenDias.indexOf(b));
    const labels = dias.map((d) => DIAS_CORTOS[d] ?? '').filter(Boolean);
    parts.push(`${labels.join('-')} ${slot}`);
  });
  return parts.join(' · ');
}

export function horariosSeSolapan(a1: string, a2: string, b1: string, b2: string): boolean {
  const toMin = (t: string) => {
    const [h, m] = t.substring(0, 5).split(':').map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
  };
  const startA = toMin(a1);
  const endA = toMin(a2);
  const startB = toMin(b1);
  const endB = toMin(b2);
  return startA < endB && startB < endA;
}
