import api, { getData } from './api';
import type { ApiResponse } from '@/types';

export interface ObraSocial {
  id: string;
  nombre: string;
  codigo?: string;
  descripcion?: string;
  activo: boolean;
  fecha_creacion?: string;
  fecha_actualizacion?: string;
}

export interface CreateObraSocialData {
  nombre: string;
  codigo?: string;
  descripcion?: string;
}

export interface UpdateObraSocialData extends Partial<CreateObraSocialData> {
  activo?: boolean;
}

export const obrasSocialesService = {
  /**
   * Obtener todas las obras sociales activas
   */
  getAll: async (includeInactive = false): Promise<ObraSocial[]> => {
    const params = includeInactive ? '?includeInactive=true' : '';
    const response = await api.get<ApiResponse<ObraSocial[]>>(`/obras-sociales${params}`);
    const data = getData(response);
    return data || [];
  },

  /**
   * Obtener obra social por ID
   */
  getById: async (id: string): Promise<ObraSocial | null> => {
    const response = await api.get<ApiResponse<ObraSocial>>(`/obras-sociales/${id}`);
    return getData(response);
  },

  /**
   * Crear nueva obra social
   */
  create: async (data: CreateObraSocialData): Promise<ObraSocial> => {
    const response = await api.post<ApiResponse<ObraSocial>>('/obras-sociales', data);
    const result = getData(response);
    if (!result) {
      throw new Error('Error al crear obra social');
    }
    return result;
  },

  /**
   * Actualizar obra social
   */
  update: async (id: string, data: UpdateObraSocialData): Promise<ObraSocial> => {
    const response = await api.put<ApiResponse<ObraSocial>>(`/obras-sociales/${id}`, data);
    const result = getData(response);
    if (!result) {
      throw new Error('Error al actualizar obra social');
    }
    return result;
  },

  /**
   * Desactivar obra social
   */
  delete: async (id: string): Promise<void> => {
    await api.delete<ApiResponse<void>>(`/obras-sociales/${id}`);
  },
};
