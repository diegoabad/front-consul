import api from './api';

export type EstadoRecordatorio = 'enviado' | 'pendiente' | 'fallido' | 'sin_numero' | 'anulado' | 'todos';

export interface RecordatorioEntry {
  id: string;
  fecha_hora_inicio: string;
  estado_turno: string;
  recordatorio_enviado: boolean;
  recordatorio_enviado_at: string | null;
  recordatorio_intentos: number;
  recordatorio_ultimo_error: string | null;
  recordatorio_activo: boolean;
  recordatorio_horas_antes: number;
  recordatorio_programado_at: string | null;
  profesional_id: string;
  profesional_nombre: string;
  profesional_apellido: string;
  paciente_nombre: string;
  paciente_apellido: string;
  paciente_whatsapp: string | null;
  paciente_telefono: string | null;
  estado_recordatorio: EstadoRecordatorio;
  turno_eliminado: boolean;
  paciente_notificaciones_activas: boolean;
}

export interface RecordatoriosResponse {
  recordatorios: RecordatorioEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface RecordatorioFilters {
  profesional_id?: string;
  fecha_turno_desde?: string;
  fecha_turno_hasta?: string;
  fecha_programado_desde?: string;
  fecha_programado_hasta?: string;
  fecha_ultimo_envio_desde?: string;
  fecha_ultimo_envio_hasta?: string;
  estado?: EstadoRecordatorio;
  page?: number;
  limit?: number;
}

export const recordatoriosService = {
  list: async (filters: RecordatorioFilters = {}): Promise<RecordatoriosResponse> => {
    const params = new URLSearchParams();
    if (filters.profesional_id) params.set('profesional_id', filters.profesional_id);
    if (filters.fecha_turno_desde) params.set('fecha_turno_desde', filters.fecha_turno_desde);
    if (filters.fecha_turno_hasta) params.set('fecha_turno_hasta', filters.fecha_turno_hasta);
    if (filters.fecha_programado_desde) params.set('fecha_programado_desde', filters.fecha_programado_desde);
    if (filters.fecha_programado_hasta) params.set('fecha_programado_hasta', filters.fecha_programado_hasta);
    if (filters.fecha_ultimo_envio_desde) params.set('fecha_ultimo_envio_desde', filters.fecha_ultimo_envio_desde);
    if (filters.fecha_ultimo_envio_hasta) params.set('fecha_ultimo_envio_hasta', filters.fecha_ultimo_envio_hasta);
    if (filters.estado && filters.estado !== 'todos') params.set('estado', filters.estado);
    if (filters.page) params.set('page', String(filters.page));
    if (filters.limit) params.set('limit', String(filters.limit));

    const res = await api.get<{ success: boolean; data: RecordatoriosResponse }>(
      `/recordatorios?${params.toString()}`
    );
    return res.data.data;
  },

  enviarManual: async (turnoId: string): Promise<void> => {
    await api.post(`/recordatorios/turno/${turnoId}/enviar`);
  },
};
