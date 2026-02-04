import api, { getData } from './api';
import type { ApiResponse } from '@/types';

export interface ConfiguracionAgenda {
  id: string;
  profesional_id: string;
  dia_semana: number; // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
  hora_inicio: string; // TIME format (HH:mm:ss)
  hora_fin: string; // TIME format (HH:mm:ss)
  duracion_turno_minutos: number;
  activo: boolean;
  fecha_creacion?: string;
  fecha_actualizacion?: string;
  vigencia_desde?: string; // YYYY-MM-DD
  vigencia_hasta?: string | null; // YYYY-MM-DD, null = vigente
  // Datos relacionados
  profesional_nombre?: string;
  profesional_apellido?: string;
  profesional_matricula?: string;
  profesional_especialidad?: string;
}

export interface BloqueNoDisponible {
  id: string;
  profesional_id: string;
  fecha_hora_inicio: string; // ISO datetime
  fecha_hora_fin: string; // ISO datetime
  motivo?: string;
  fecha_creacion?: string;
  fecha_actualizacion?: string;
  // Datos relacionados
  profesional_nombre?: string;
  profesional_apellido?: string;
}

export interface AgendaFilters {
  profesional_id?: string;
  dia_semana?: number;
  activo?: boolean;
  vigente?: boolean; // false = incluir histórico (configs con vigencia_hasta en el pasado)
}

export interface BloqueFilters {
  profesional_id?: string;
  fecha_inicio?: string; // ISO date
  fecha_fin?: string; // ISO date
}

export interface CreateAgendaData {
  profesional_id: string;
  dia_semana: number;
  hora_inicio: string; // HH:mm format
  hora_fin: string; // HH:mm format
  duracion_turno_minutos?: number;
  activo?: boolean;
  /** YYYY-MM-DD desde la que rige (ej. "hoy" del usuario); si no se envía, el servidor usa CURRENT_DATE */
  vigencia_desde?: string;
}

export interface UpdateAgendaData extends Partial<CreateAgendaData> {}

export interface CreateBloqueData {
  profesional_id: string;
  fecha_hora_inicio: string; // ISO datetime
  fecha_hora_fin: string; // ISO datetime
  motivo?: string;
}

export interface UpdateBloqueData extends Partial<CreateBloqueData> {}

export interface ExcepcionAgenda {
  id: string;
  profesional_id: string;
  fecha: string; // YYYY-MM-DD
  hora_inicio: string;
  hora_fin: string;
  duracion_turno_minutos: number;
  observaciones?: string | null;
  fecha_creacion?: string;
  fecha_actualizacion?: string;
  profesional_nombre?: string;
  profesional_apellido?: string;
}

export interface ExcepcionAgendaFilters {
  profesional_id?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
}

export interface CreateExcepcionAgendaData {
  profesional_id: string;
  fecha: string; // YYYY-MM-DD
  hora_inicio: string; // HH:mm o HH:mm:ss
  hora_fin: string;
  duracion_turno_minutos?: number;
  observaciones?: string | null;
}

export interface UpdateExcepcionAgendaData {
  fecha?: string;
  hora_inicio?: string;
  hora_fin?: string;
  duracion_turno_minutos?: number;
  observaciones?: string | null;
}

export const agendaService = {
  /**
   * Obtener todas las configuraciones de agenda con filtros opcionales
   */
  getAllAgenda: async (filters?: AgendaFilters): Promise<ConfiguracionAgenda[]> => {
    const params = new URLSearchParams();
    if (filters?.profesional_id) {
      params.append('profesional_id', filters.profesional_id);
    }
    if (filters?.dia_semana !== undefined) {
      params.append('dia_semana', filters.dia_semana.toString());
    }
    if (filters?.activo !== undefined) {
      params.append('activo', filters.activo.toString());
    }
    if (filters?.vigente !== undefined) {
      params.append('vigente', filters.vigente ? 'true' : 'false');
    }

    const response = await api.get<ApiResponse<ConfiguracionAgenda[]>>(
      `/agenda${params.toString() ? `?${params.toString()}` : ''}`
    );
    const data = getData(response);
    return data || [];
  },

  /**
   * Obtener configuraciones de agenda de un profesional
   */
  getAgendaByProfesional: async (profesionalId: string, soloActivos?: boolean): Promise<ConfiguracionAgenda[]> => {
    const params = new URLSearchParams();
    if (soloActivos) {
      params.append('solo_activos', 'true');
    }

    const response = await api.get<ApiResponse<ConfiguracionAgenda[]>>(
      `/agenda/profesional/${profesionalId}${params.toString() ? `?${params.toString()}` : ''}`
    );
    const data = getData(response);
    return data || [];
  },

  /**
   * Obtener configuración de agenda por ID
   */
  getAgendaById: async (id: string): Promise<ConfiguracionAgenda | null> => {
    const response = await api.get<ApiResponse<ConfiguracionAgenda>>(`/agenda/${id}`);
    return getData(response);
  },

  /**
   * Crear nueva configuración de agenda
   */
  createAgenda: async (data: CreateAgendaData): Promise<ConfiguracionAgenda> => {
    // Convertir HH:mm a HH:mm:ss si es necesario
    const dataWithSeconds = {
      ...data,
      hora_inicio: data.hora_inicio.includes(':') && data.hora_inicio.split(':').length === 2 
        ? `${data.hora_inicio}:00` 
        : data.hora_inicio,
      hora_fin: data.hora_fin.includes(':') && data.hora_fin.split(':').length === 2 
        ? `${data.hora_fin}:00` 
        : data.hora_fin,
    };
    const response = await api.post<ApiResponse<ConfiguracionAgenda>>('/agenda', dataWithSeconds);
    const result = getData(response);
    if (!result) {
      throw new Error('Error al crear configuración de agenda');
    }
    return result;
  },

  /**
   * Actualizar configuración de agenda
   */
  updateAgenda: async (id: string, data: UpdateAgendaData): Promise<ConfiguracionAgenda> => {
    // Convertir HH:mm a HH:mm:ss si es necesario
    const dataWithSeconds: any = { ...data };
    if (data.hora_inicio && data.hora_inicio.includes(':') && data.hora_inicio.split(':').length === 2) {
      dataWithSeconds.hora_inicio = `${data.hora_inicio}:00`;
    }
    if (data.hora_fin && data.hora_fin.includes(':') && data.hora_fin.split(':').length === 2) {
      dataWithSeconds.hora_fin = `${data.hora_fin}:00`;
    }
    const response = await api.put<ApiResponse<ConfiguracionAgenda>>(`/agenda/${id}`, dataWithSeconds);
    const result = getData(response);
    if (!result) {
      throw new Error('Error al actualizar configuración de agenda');
    }
    return result;
  },

  /**
   * Eliminar configuración de agenda
   */
  deleteAgenda: async (id: string): Promise<void> => {
    await api.delete<ApiResponse<void>>(`/agenda/${id}`);
  },

  /**
   * Activar configuración de agenda
   */
  activateAgenda: async (id: string): Promise<ConfiguracionAgenda> => {
    const response = await api.patch<ApiResponse<ConfiguracionAgenda>>(`/agenda/${id}/activate`);
    const result = getData(response);
    if (!result) {
      throw new Error('Error al activar configuración de agenda');
    }
    return result;
  },

  /**
   * Guardar horarios de la semana: cierra el periodo vigente y crea nuevas configuraciones (con vigencia).
   * Solo envía los días que atiende.
   * fecha_desde: "hoy" del usuario (YYYY-MM-DD) para que la agenda rija desde hoy aunque el servidor esté en otra zona horaria.
   */
  guardarHorariosSemana: async (
    profesionalId: string,
    horarios: { dia_semana: number; hora_inicio: string; hora_fin: string }[],
    fechaDesde?: string
  ): Promise<ConfiguracionAgenda[]> => {
    const body: { horarios: typeof horarios; fecha_desde?: string } = { horarios };
    if (fechaDesde) body.fecha_desde = fechaDesde;
    const response = await api.put<ApiResponse<ConfiguracionAgenda[]>>(
      `/agenda/profesional/${profesionalId}/horarios-semana`,
      body
    );
    const data = getData(response);
    return data || [];
  },

  /**
   * Desactivar configuración de agenda
   */
  deactivateAgenda: async (id: string): Promise<ConfiguracionAgenda> => {
    const response = await api.patch<ApiResponse<ConfiguracionAgenda>>(`/agenda/${id}/deactivate`);
    const result = getData(response);
    if (!result) {
      throw new Error('Error al desactivar configuración de agenda');
    }
    return result;
  },

  /**
   * Obtener todos los bloques no disponibles con filtros opcionales
   */
  getAllBloques: async (filters?: BloqueFilters): Promise<BloqueNoDisponible[]> => {
    const params = new URLSearchParams();
    if (filters?.profesional_id) {
      params.append('profesional_id', filters.profesional_id);
    }
    if (filters?.fecha_inicio) {
      params.append('fecha_inicio', filters.fecha_inicio);
    }
    if (filters?.fecha_fin) {
      params.append('fecha_fin', filters.fecha_fin);
    }

    const response = await api.get<ApiResponse<BloqueNoDisponible[]>>(
      `/agenda/bloques${params.toString() ? `?${params.toString()}` : ''}`
    );
    const data = getData(response);
    return data || [];
  },

  /**
   * Obtener bloques no disponibles de un profesional
   */
  getBloquesByProfesional: async (profesionalId: string, fecha_inicio?: string, fecha_fin?: string): Promise<BloqueNoDisponible[]> => {
    const params = new URLSearchParams();
    if (fecha_inicio) {
      params.append('fecha_inicio', fecha_inicio);
    }
    if (fecha_fin) {
      params.append('fecha_fin', fecha_fin);
    }

    const response = await api.get<ApiResponse<BloqueNoDisponible[]>>(
      `/agenda/bloques/profesional/${profesionalId}${params.toString() ? `?${params.toString()}` : ''}`
    );
    const data = getData(response);
    return data || [];
  },

  /**
   * Obtener bloque no disponible por ID
   */
  getBloqueById: async (id: string): Promise<BloqueNoDisponible | null> => {
    const response = await api.get<ApiResponse<BloqueNoDisponible>>(`/agenda/bloques/${id}`);
    return getData(response);
  },

  /**
   * Crear bloque no disponible
   */
  createBloque: async (data: CreateBloqueData): Promise<BloqueNoDisponible> => {
    const response = await api.post<ApiResponse<BloqueNoDisponible>>('/agenda/bloques', data);
    const result = getData(response);
    if (!result) {
      throw new Error('Error al crear bloque no disponible');
    }
    return result;
  },

  /**
   * Actualizar bloque no disponible
   */
  updateBloque: async (id: string, data: UpdateBloqueData): Promise<BloqueNoDisponible> => {
    const response = await api.put<ApiResponse<BloqueNoDisponible>>(`/agenda/bloques/${id}`, data);
    const result = getData(response);
    if (!result) {
      throw new Error('Error al actualizar bloque no disponible');
    }
    return result;
  },

  /**
   * Eliminar bloque no disponible
   */
  deleteBloque: async (id: string): Promise<void> => {
    await api.delete<ApiResponse<void>>(`/agenda/bloques/${id}`);
  },

  // ========== Días puntuales (excepciones de agenda) ==========

  getAllExcepciones: async (filters?: ExcepcionAgendaFilters): Promise<ExcepcionAgenda[]> => {
    const params = new URLSearchParams();
    if (filters?.profesional_id) params.append('profesional_id', filters.profesional_id);
    if (filters?.fecha_desde) params.append('fecha_desde', filters.fecha_desde);
    if (filters?.fecha_hasta) params.append('fecha_hasta', filters.fecha_hasta);
    const response = await api.get<ApiResponse<ExcepcionAgenda[]>>(
      `/agenda/excepciones${params.toString() ? `?${params.toString()}` : ''}`
    );
    return getData(response) || [];
  },

  getExcepcionesByProfesional: async (
    profesionalId: string,
    fecha_desde?: string,
    fecha_hasta?: string
  ): Promise<ExcepcionAgenda[]> => {
    const params = new URLSearchParams();
    if (fecha_desde) params.append('fecha_desde', fecha_desde);
    if (fecha_hasta) params.append('fecha_hasta', fecha_hasta);
    const response = await api.get<ApiResponse<ExcepcionAgenda[]>>(
      `/agenda/excepciones/profesional/${profesionalId}${params.toString() ? `?${params.toString()}` : ''}`
    );
    return getData(response) || [];
  },

  getExcepcionById: async (id: string): Promise<ExcepcionAgenda | null> => {
    const response = await api.get<ApiResponse<ExcepcionAgenda>>(`/agenda/excepciones/${id}`);
    return getData(response);
  },

  createExcepcion: async (data: CreateExcepcionAgendaData): Promise<ExcepcionAgenda> => {
    const dataWithSeconds = {
      ...data,
      hora_inicio: data.hora_inicio.includes(':') && data.hora_inicio.split(':').length === 2 ? `${data.hora_inicio}:00` : data.hora_inicio,
      hora_fin: data.hora_fin.includes(':') && data.hora_fin.split(':').length === 2 ? `${data.hora_fin}:00` : data.hora_fin,
    };
    const response = await api.post<ApiResponse<ExcepcionAgenda>>('/agenda/excepciones', dataWithSeconds);
    const result = getData(response);
    if (!result) throw new Error('Error al crear excepción de agenda');
    return result;
  },

  updateExcepcion: async (id: string, data: UpdateExcepcionAgendaData): Promise<ExcepcionAgenda> => {
    const dataWithSeconds: UpdateExcepcionAgendaData = { ...data };
    if (data.hora_inicio && data.hora_inicio.split(':').length === 2) {
      (dataWithSeconds as { hora_inicio: string }).hora_inicio = `${data.hora_inicio}:00`;
    }
    if (data.hora_fin && data.hora_fin.split(':').length === 2) {
      (dataWithSeconds as { hora_fin: string }).hora_fin = `${data.hora_fin}:00`;
    }
    const response = await api.put<ApiResponse<ExcepcionAgenda>>(`/agenda/excepciones/${id}`, dataWithSeconds);
    const result = getData(response);
    if (!result) throw new Error('Error al actualizar excepción de agenda');
    return result;
  },

  deleteExcepcion: async (id: string): Promise<void> => {
    await api.delete<ApiResponse<void>>(`/agenda/excepciones/${id}`);
  },
};
