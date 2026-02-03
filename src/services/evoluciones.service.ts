import api, { getData } from './api';
import type { ApiResponse } from '@/types';

export interface Evolucion {
  id: string;
  paciente_id: string;
  profesional_id: string;
  turno_id?: string;
  fecha_consulta: string;
  motivo_consulta?: string;
  diagnostico?: string;
  tratamiento?: string;
  observaciones?: string;
  fecha_creacion?: string;
  fecha_actualizacion?: string;
  // Datos relacionados
  paciente_nombre?: string;
  paciente_apellido?: string;
  profesional_nombre?: string;
  profesional_apellido?: string;
}

export interface EvolucionFilters {
  paciente_id?: string;
  profesional_id?: string;
  turno_id?: string;
}

export interface CreateEvolucionData {
  paciente_id: string;
  profesional_id: string;
  turno_id?: string;
  fecha_consulta: string; // Date ISO string
  motivo_consulta?: string;
  diagnostico?: string;
  tratamiento?: string;
  observaciones?: string;
}

export interface UpdateEvolucionData extends Partial<CreateEvolucionData> {}

export const evolucionesService = {
  /**
   * Obtener todas las evoluciones con filtros opcionales
   */
  getAll: async (filters?: EvolucionFilters): Promise<Evolucion[]> => {
    const params = new URLSearchParams();
    if (filters?.paciente_id) {
      params.append('paciente_id', filters.paciente_id);
    }
    if (filters?.profesional_id) {
      params.append('profesional_id', filters.profesional_id);
    }
    if (filters?.turno_id) {
      params.append('turno_id', filters.turno_id);
    }

    const response = await api.get<ApiResponse<Evolucion[]>>(
      `/evoluciones${params.toString() ? `?${params.toString()}` : ''}`
    );
    const data = getData(response);
    return data || [];
  },

  /**
   * Obtener evoluciones de un paciente
   */
  getByPaciente: async (pacienteId: string): Promise<Evolucion[]> => {
    const response = await api.get<ApiResponse<Evolucion[]>>(`/evoluciones/paciente/${pacienteId}`);
    const data = getData(response);
    return data || [];
  },

  /**
   * Obtener evoluciones de un profesional
   */
  getByProfesional: async (profesionalId: string): Promise<Evolucion[]> => {
    const response = await api.get<ApiResponse<Evolucion[]>>(`/evoluciones/profesional/${profesionalId}`);
    const data = getData(response);
    return data || [];
  },

  /**
   * Obtener evoluciones de un turno
   */
  getByTurno: async (turnoId: string): Promise<Evolucion[]> => {
    const response = await api.get<ApiResponse<Evolucion[]>>(`/evoluciones/turno/${turnoId}`);
    const data = getData(response);
    return data || [];
  },

  /**
   * Obtener evolución por ID
   */
  getById: async (id: string): Promise<Evolucion | null> => {
    const response = await api.get<ApiResponse<Evolucion>>(`/evoluciones/${id}`);
    return getData(response);
  },

  /**
   * Crear nueva evolución
   */
  create: async (data: CreateEvolucionData): Promise<Evolucion> => {
    const response = await api.post<ApiResponse<Evolucion>>('/evoluciones', data);
    const result = getData(response);
    if (!result) {
      throw new Error('Error al crear evolución');
    }
    return result;
  },

  /**
   * Actualizar evolución
   */
  update: async (id: string, data: UpdateEvolucionData): Promise<Evolucion> => {
    const response = await api.put<ApiResponse<Evolucion>>(`/evoluciones/${id}`, data);
    const result = getData(response);
    if (!result) {
      throw new Error('Error al actualizar evolución');
    }
    return result;
  },

  /**
   * Eliminar evolución
   */
  delete: async (id: string): Promise<void> => {
    await api.delete<ApiResponse<void>>(`/evoluciones/${id}`);
  },
};
