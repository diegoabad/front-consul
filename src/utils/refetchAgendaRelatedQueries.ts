import type { QueryClient } from '@tanstack/react-query';
import { agendaService } from '@/services/agenda.service';

export type RefetchAgendaRelatedOptions = {
  /** Si se conoce, fuerza fetch de la misma query que usa Turnos (`['agendas', id, 'conHistorico']`) y de excepciones cacheadas de ese profesional. Evita datos viejos cuando `refetchQueries` omite queries deshabilitadas o no matchea bien. */
  profesionalId?: string;
};

/**
 * Tras crear/editar agenda o excepciones, invalida y refetch-ea todo lo que alimenta
 * el calendario de Turnos. Además, si hay `profesionalId`, hace `fetchQuery` explícito
 * para la clave de Turnos (no solo `['agendas']`).
 */
export async function refetchAgendaRelatedQueries(
  queryClient: QueryClient,
  options?: RefetchAgendaRelatedOptions
): Promise<void> {
  await queryClient.invalidateQueries({
    queryKey: ['agendas'],
    refetchType: 'all',
  });
  await queryClient.invalidateQueries({
    queryKey: ['excepciones'],
    refetchType: 'all',
  });

  const pid = options?.profesionalId?.trim();
  if (!pid) return;

  await queryClient.fetchQuery({
    queryKey: ['agendas', pid, 'conHistorico'],
    queryFn: () =>
      agendaService.getAllAgenda({
        profesional_id: pid,
        activo: true,
        vigente: false,
      }),
  });

  const excepcionesQueries = queryClient.getQueryCache().findAll({
    predicate: (q) => {
      const k = q.queryKey;
      return Array.isArray(k) && k.length >= 2 && k[0] === 'excepciones' && k[1] === pid;
    },
  });
  await Promise.all(
    excepcionesQueries.map((q) => q.fetch().catch(() => undefined))
  );
}
