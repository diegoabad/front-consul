import api, { getData } from './api';
import type { ApiResponse } from '@/types';

export interface Turno {
  id: string;
  profesional_id: string;
  paciente_id: string;
  fecha_hora_inicio: string; // ISO datetime
  fecha_hora_fin: string; // ISO datetime
  estado: 'confirmado' | 'pendiente' | 'cancelado' | 'completado' | 'ausente';
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
  estado?: 'confirmado' | 'pendiente' | 'cancelado' | 'completado' | 'ausente';
  fecha_inicio?: string; // ISO date
  fecha_fin?: string; // ISO date
}

export interface CreateTurnoData {
  profesional_id: string;
  paciente_id: string;
  fecha_hora_inicio: string; // ISO datetime
  fecha_hora_fin: string; // ISO datetime
  estado?: 'confirmado' | 'pendiente' | 'cancelado' | 'completado' | 'ausente';
  motivo?: string;
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
   */
  delete: async (id: string): Promise<void> => {
    await api.delete<ApiResponse<unknown>>(`/turnos/${id}`);
  },
};
