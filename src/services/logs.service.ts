import api, { getData } from './api';
import type { ApiResponse } from '@/types';

export interface LogEntry {
  id: number;
  created_at: string;
  origen: 'front' | 'back';
  usuario_id: number | null;
  rol: string | null;
  pantalla: string | null;
  accion: string | null;
  ruta: string | null;
  metodo: string | null;
  params: string | null;
  mensaje: string;
  stack: string | null;
  usuario_email?: string | null;
}

export interface LogsListResponse {
  logs: LogEntry[];
  total: number;
  page?: number;
  limit?: number;
  totalPages?: number;
}

export interface LogsFilters {
  fecha_desde?: string;
  fecha_hasta?: string;
  origen?: 'front' | 'back';
  page?: number;
  limit?: number;
}

export const logsService = {
  list: async (filters: LogsFilters = {}): Promise<LogsListResponse> => {
    const params = new URLSearchParams();
    if (filters.fecha_desde) params.set('fecha_desde', filters.fecha_desde);
    if (filters.fecha_hasta) params.set('fecha_hasta', filters.fecha_hasta);
    if (filters.origen) params.set('origen', filters.origen);
    if (filters.page != null) params.set('page', String(filters.page));
    if (filters.limit != null) params.set('limit', String(filters.limit));
    const qs = params.toString();
    const url = qs ? `/logs?${qs}` : '/logs';
    const response = await api.get<ApiResponse<LogsListResponse>>(url);
    const data = getData(response);
    if (!data) return { logs: [], total: 0, page: 1, limit: 10, totalPages: 0 };
    return data;
  },

  deleteAll: async (): Promise<{ deleted: number }> => {
    const response = await api.delete<ApiResponse<{ deleted: number }>>('/logs');
    const data = getData(response);
    if (!data) return { deleted: 0 };
    return data;
  },

  deleteOne: async (id: number): Promise<void> => {
    await api.delete(`/logs/${id}`);
  },
};
