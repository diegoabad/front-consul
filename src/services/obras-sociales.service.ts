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

export interface PaginatedObrasSocialesResponse {
  data: ObraSocial[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ObrasSocialesQueryParams {
  page?: number;
  limit?: number;
  includeInactive?: boolean;
  q?: string;
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
   * Obtener obras sociales paginadas con filtros
   */
  getAllPaginated: async (params: ObrasSocialesQueryParams = {}): Promise<PaginatedObrasSocialesResponse> => {
    const search = new URLSearchParams();
    if (params.page != null) search.set('page', String(params.page));
    if (params.limit != null) search.set('limit', String(params.limit));
    if (params.includeInactive) search.set('includeInactive', 'true');
    if (params.q?.trim()) search.set('q', params.q.trim());
    const qs = search.toString();
    const response = await api.get<ApiResponse<PaginatedObrasSocialesResponse>>(
      `/obras-sociales${qs ? `?${qs}` : ''}`
    );
    const data = getData(response);
    if (!data) return { data: [], total: 0, page: 1, limit: 10, totalPages: 0 };
    return data;
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
