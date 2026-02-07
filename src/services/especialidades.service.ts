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

export interface PaginatedEspecialidadesResponse {
  data: Especialidad[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface EspecialidadesQueryParams {
  page?: number;
  limit?: number;
  includeInactive?: boolean;
  q?: string;
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
   * Obtener especialidades paginadas (page, limit, includeInactive, q)
   */
  getAllPaginated: async (params: {
    page: number;
    limit: number;
    includeInactive?: boolean;
    q?: string;
  }): Promise<PaginatedEspecialidadesResponse> => {
    const searchParams = new URLSearchParams();
    searchParams.set('page', String(params.page));
    searchParams.set('limit', String(params.limit));
    if (params.includeInactive) searchParams.set('includeInactive', 'true');
    if (params.q?.trim()) searchParams.set('q', params.q.trim());
    const response = await api.get<ApiResponse<PaginatedEspecialidadesResponse>>(
      `/especialidades?${searchParams.toString()}`
    );
    const data = getData(response);
    if (!data) return { data: [], total: 0, page: 1, limit: params.limit, totalPages: 0 };
    return data;
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
