import api, { getData } from './api';
import type { ApiResponse } from '@/types';

export interface Especialidad {
  id: string;
  nombre: string;
  descripcion?: string;
  activo: boolean;
  fecha_creacion?: string;
  fecha_actualizacion?: string;
}

export interface CreateEspecialidadData {
  nombre: string;
  descripcion?: string;
}

export interface UpdateEspecialidadData extends Partial<CreateEspecialidadData> {
  activo?: boolean;
}

export const especialidadesService = {
  /**
   * Obtener todas las especialidades activas
   */
  getAll: async (includeInactive = false): Promise<Especialidad[]> => {
    const params = includeInactive ? '?includeInactive=true' : '';
    const response = await api.get<ApiResponse<Especialidad[]>>(`/especialidades${params}`);
    const data = getData(response);
    return data || [];
  },

  /**
   * Obtener especialidad por ID
   */
  getById: async (id: string): Promise<Especialidad | null> => {
    const response = await api.get<ApiResponse<Especialidad>>(`/especialidades/${id}`);
    return getData(response);
  },

  /**
   * Crear nueva especialidad
   */
  create: async (data: CreateEspecialidadData): Promise<Especialidad> => {
    const response = await api.post<ApiResponse<Especialidad>>('/especialidades', data);
    const result = getData(response);
    if (!result) {
      throw new Error('Error al crear especialidad');
    }
    return result;
  },

  /**
   * Actualizar especialidad
   */
  update: async (id: string, data: UpdateEspecialidadData): Promise<Especialidad> => {
    const response = await api.put<ApiResponse<Especialidad>>(`/especialidades/${id}`, data);
    const result = getData(response);
    if (!result) {
      throw new Error('Error al actualizar especialidad');
    }
    return result;
  },

  /**
   * Desactivar especialidad
   */
  delete: async (id: string): Promise<void> => {
    await api.delete<ApiResponse<void>>(`/especialidades/${id}`);
  },
};
