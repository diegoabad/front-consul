import api, { getData } from './api';
import type { ApiResponse } from '@/types';

export interface Turno {
  id: string;
  profesional_id: string;
  paciente_id: string;
  fecha_hora_inicio: string; // ISO datetime
  fecha_hora_fin: string; // ISO datetime
  serie_id?: string | null;
  serie_secuencia?: number | null;
  estado: 'confirmado' | 'pendiente' | 'cancelado' | 'completado' | 'ausente';
  sobreturno?: boolean;
  motivo?: string;
  cancelado_por?: string;
  razon_cancelacion?: string;
  fecha_creacion?: string;
  fecha_actualizacion?: string;
  // Datos relacionados
  profesional_nombre?: string;
  profesional_apellido?: string;
  profesional_email?: string;
  paciente_nombre?: string;
  paciente_apellido?: string;
  paciente_dni?: string;
  paciente_telefono?: string;
  paciente_email?: string;
  profesional_especialidad?: string;
}

export interface TurnoFilters {
  profesional_id?: string;
  paciente_id?: string;
  estado?: 'confirmado' | 'pendiente' | 'cancelado' | 'completado' | 'ausente' | 'activos';
  fecha_inicio?: string; // ISO date
  fecha_fin?: string; // ISO date
  page?: number;
  limit?: number;
}

export interface PaginatedTurnosResponse {
  data: Turno[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateTurnoData {
  profesional_id: string;
  paciente_id: string;
  fecha_hora_inicio: string; // ISO datetime
  fecha_hora_fin: string; // ISO datetime
  estado?: 'confirmado' | 'pendiente' | 'cancelado' | 'completado' | 'ausente';
  sobreturno?: boolean;
  motivo?: string;
  /** Si true, el backend permite crear el turno aunque no esté dentro de la agenda (usuario confirmó "turno fuera de horario"). */
  permiso_fuera_agenda?: boolean;
}

export interface UpdateTurnoData extends Partial<CreateTurnoData> {}

export interface CancelTurnoData {
  razon_cancelacion: string;
}

export interface AvailabilityCheck {
  profesional_id: string;
  fecha_hora_inicio: string; // ISO datetime
  fecha_hora_fin: string; // ISO datetime
}

export type FrecuenciaRecurrencia = 'semanal' | 'quincenal' | 'mensual';

export interface PreviewRecurrenciaPayload {
  profesional_id: string;
  paciente_id: string;
  frecuencia: FrecuenciaRecurrencia;
  fecha_hora_inicio: string;
  fecha_hora_fin: string;
  dia_semana?: number;
  semana_del_mes?: number | null;
  fecha_fin?: string | null;
  max_ocurrencias?: number;
  meses_max?: number;
  permiso_fuera_agenda?: boolean;
}

export interface PreviewRecurrenciaFila {
  indice: number;
  fecha_hora_inicio: string;
  fecha_hora_fin: string;
  ok: boolean;
  flags: {
    profesional_inexistente?: boolean;
    profesional_bloqueado?: boolean;
    paciente_inexistente?: boolean;
    paciente_inactivo?: boolean;
    fuera_de_agenda?: boolean;
    bloque?: boolean;
    paciente_solapado?: boolean;
    ocupado?: boolean;
  };
  mensaje: string | null;
}

export interface CreateRecurrenciaPayload {
  profesional_id: string;
  paciente_id: string;
  motivo?: string;
  permiso_fuera_agenda?: boolean;
  serie: {
    frecuencia: FrecuenciaRecurrencia;
    mensual_modo?: 'nth_weekday' | 'dia_calendario' | null;
    dia_semana?: number | null;
    semana_del_mes?: number | null;
    fecha_fin?: string | null;
    max_ocurrencias?: number;
  };
  ocurrencias: Array<{
    fecha_hora_inicio: string;
    fecha_hora_fin: string;
    permiso_fuera_agenda?: boolean;
  }>;
}

/** Validar varios intervalos en una sola petición (mismo profesional/paciente). */
export interface ValidarSlotsBatchPayload {
  profesional_id: string;
  paciente_id: string;
  permiso_fuera_agenda?: boolean;
  slots: Array<{
    fecha_hora_inicio: string;
    fecha_hora_fin: string;
    permiso_fuera_agenda?: boolean;
  }>;
}

export interface ValidarSlotsBatchResultadoFila {
  indice: number;
  ok: boolean;
  flags: PreviewRecurrenciaFila['flags'];
  mensaje: string | null;
}

export const turnosService = {
  /**
   * Obtener todos los turnos con filtros opcionales
   */
  getAll: async (filters?: TurnoFilters): Promise<Turno[]> => {
    const params = new URLSearchParams();
    if (filters?.profesional_id) {
      params.append('profesional_id', filters.profesional_id);
    }
    if (filters?.paciente_id) {
      params.append('paciente_id', filters.paciente_id);
    }
    if (filters?.estado) {
      params.append('estado', filters.estado);
    }
    if (filters?.fecha_inicio) {
      params.append('fecha_inicio', filters.fecha_inicio);
    }
    if (filters?.fecha_fin) {
      params.append('fecha_fin', filters.fecha_fin);
    }

    const response = await api.get<ApiResponse<Turno[]>>(
      `/turnos${params.toString() ? `?${params.toString()}` : ''}`
    );
    const data = getData(response);
    return data || [];
  },

  /**
   * Obtener turnos paginados (filtros en backend). Usar para historial de turnos de un paciente.
   */
  getAllPaginated: async (filters: TurnoFilters & { page: number; limit: number }): Promise<PaginatedTurnosResponse> => {
    const params = new URLSearchParams();
    params.append('page', String(filters.page));
    params.append('limit', String(filters.limit));
    if (filters.profesional_id) params.append('profesional_id', filters.profesional_id);
    if (filters.paciente_id) params.append('paciente_id', filters.paciente_id);
    if (filters.estado) params.append('estado', filters.estado);
    if (filters.fecha_inicio) params.append('fecha_inicio', filters.fecha_inicio);
    if (filters.fecha_fin) params.append('fecha_fin', filters.fecha_fin);

    const response = await api.get<ApiResponse<PaginatedTurnosResponse>>(`/turnos?${params.toString()}`);
    const data = getData(response);
    return data ?? { data: [], total: 0, page: 1, limit: 10, totalPages: 0 };
  },

  /**
   * Verificar disponibilidad de un horario
   */
  checkAvailability: async (data: AvailabilityCheck): Promise<{ disponible: boolean }> => {
    const params = new URLSearchParams();
    params.append('profesional_id', data.profesional_id);
    params.append('fecha_hora_inicio', data.fecha_hora_inicio);
    params.append('fecha_hora_fin', data.fecha_hora_fin);

    const response = await api.get<ApiResponse<{ disponible: boolean }>>(
      `/turnos/availability?${params.toString()}`
    );
    const result = getData(response);
    return result || { disponible: false };
  },

  /**
   * Obtener turnos de un profesional
   */
  getByProfesional: async (profesionalId: string, fecha_inicio?: string, fecha_fin?: string): Promise<Turno[]> => {
    const params = new URLSearchParams();
    if (fecha_inicio) {
      params.append('fecha_inicio', fecha_inicio);
    }
    if (fecha_fin) {
      params.append('fecha_fin', fecha_fin);
    }

    const response = await api.get<ApiResponse<Turno[]>>(
      `/turnos/profesional/${profesionalId}${params.toString() ? `?${params.toString()}` : ''}`
    );
    const data = getData(response);
    return data || [];
  },

  /**
   * Obtener turnos de un paciente
   */
  getByPaciente: async (pacienteId: string, fecha_inicio?: string, fecha_fin?: string): Promise<Turno[]> => {
    const params = new URLSearchParams();
    if (fecha_inicio) {
      params.append('fecha_inicio', fecha_inicio);
    }
    if (fecha_fin) {
      params.append('fecha_fin', fecha_fin);
    }

    const response = await api.get<ApiResponse<Turno[]>>(
      `/turnos/paciente/${pacienteId}${params.toString() ? `?${params.toString()}` : ''}`
    );
    const data = getData(response);
    return data || [];
  },

  /**
   * Obtener turno por ID
   */
  getById: async (id: string): Promise<Turno | null> => {
    const response = await api.get<ApiResponse<Turno>>(`/turnos/${id}`);
    return getData(response);
  },

  /**
   * Preview de turnos recurrentes (sin guardar)
   */
  previewRecurrencia: async (
    data: PreviewRecurrenciaPayload
  ): Promise<{ ocurrencias: PreviewRecurrenciaFila[] }> => {
    const response = await api.post<ApiResponse<{ ocurrencias: PreviewRecurrenciaFila[] }>>(
      '/turnos/recurrencia/preview',
      data
    );
    const result = getData(response);
    if (!result?.ocurrencias) {
      throw new Error('Error al generar vista previa');
    }
    return result;
  },

  /**
   * Validar disponibilidad de varios horarios de una vez (sin persistir).
   * Útil para revalidar tras editar fechas en la vista previa de recurrencia.
   */
  validarSlotsBatch: async (
    data: ValidarSlotsBatchPayload
  ): Promise<{ resultados: ValidarSlotsBatchResultadoFila[] }> => {
    const response = await api.post<ApiResponse<{ resultados: ValidarSlotsBatchResultadoFila[] }>>(
      '/turnos/slots/validar-batch',
      data
    );
    const result = getData(response);
    if (!result?.resultados) {
      throw new Error('Error al validar horarios');
    }
    return result;
  },

  /**
   * Crear serie de turnos (lista ya editada en cliente)
   */
  createRecurrencia: async (
    data: CreateRecurrenciaPayload
  ): Promise<{ serie_id: string; turnos: Turno[] }> => {
    const response = await api.post<ApiResponse<{ serie_id: string; turnos: Turno[] }>>(
      '/turnos/recurrencia',
      data
    );
    const result = getData(response);
    if (!result?.turnos || !result.serie_id) {
      throw new Error('Error al crear la serie de turnos');
    }
    return result;
  },

  /**
   * Crear nuevo turno
   */
  create: async (data: CreateTurnoData): Promise<Turno> => {
    const response = await api.post<ApiResponse<Turno>>('/turnos', data);
    const result = getData(response);
    if (!result) {
      throw new Error('Error al crear turno');
    }
    return result;
  },

  /**
   * Actualizar turno
   */
  update: async (id: string, data: UpdateTurnoData): Promise<Turno> => {
    const response = await api.put<ApiResponse<Turno>>(`/turnos/${id}`, data);
    const result = getData(response);
    if (!result) {
      throw new Error('Error al actualizar turno');
    }
    return result;
  },

  /**
   * Cancelar turno
   */
  cancel: async (id: string, data: CancelTurnoData): Promise<Turno> => {
    const response = await api.patch<ApiResponse<Turno>>(`/turnos/${id}/cancel`, data);
    const result = getData(response);
    if (!result) {
      throw new Error('Error al cancelar turno');
    }
    return result;
  },

  /**
   * Confirmar turno
   */
  confirm: async (id: string): Promise<Turno> => {
    const response = await api.patch<ApiResponse<Turno>>(`/turnos/${id}/confirm`);
    const result = getData(response);
    if (!result) {
      throw new Error('Error al confirmar turno');
    }
    return result;
  },

  /**
   * Completar turno
   */
  complete: async (id: string): Promise<Turno> => {
    const response = await api.patch<ApiResponse<Turno>>(`/turnos/${id}/complete`);
    const result = getData(response);
    if (!result) {
      throw new Error('Error al completar turno');
    }
    return result;
  },

  /**
   * Eliminar turno
   * @param alcance solo_este (default) | desde_aqui_en_adelante (solo si hay serie_id)
   */
  delete: async (id: string, alcance: 'solo_este' | 'desde_aqui_en_adelante' = 'solo_este'): Promise<void> => {
    const q = alcance !== 'solo_este' ? `?alcance=${encodeURIComponent(alcance)}` : '';
    await api.delete<ApiResponse<unknown>>(`/turnos/${id}${q}`);
  },
};
