import api, { getData } from './api';
import type { Pago, ApiResponse } from '@/types';

export interface PagoFilters {
  profesional_id?: string;
  estado?: 'pendiente' | 'pagado' | 'vencido';
  periodo_desde?: string; // Date ISO string
  periodo_hasta?: string; // Date ISO string
}

export interface PaginatedPagosResponse {
  data: Pago[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PagoFiltersPaginated extends PagoFilters {
  page?: number;
  limit?: number;
}

export interface CreatePagoData {
  profesional_id: string;
  periodo: string; // Date ISO string (YYYY-MM-DD)
  monto: number;
  metodo_pago?: string;
  comprobante_url?: string;
  observaciones?: string;
}

export interface UpdatePagoData extends Partial<CreatePagoData> {
  estado?: 'pendiente' | 'pagado' | 'vencido';
}

export interface MarkAsPaidData {
  fecha_pago: string; // Date ISO string
  metodo_pago?: string;
  comprobante_url?: string;
  observaciones?: string;
}

export const pagosService = {
  /**
   * Obtener todos los pagos con filtros opcionales
   */
  getAll: async (filters?: PagoFilters): Promise<Pago[]> => {
    const params = new URLSearchParams();
    if (filters?.profesional_id) {
      params.append('profesional_id', filters.profesional_id);
    }
    if (filters?.estado) {
      params.append('estado', filters.estado);
    }
    if (filters?.periodo_desde) {
      params.append('periodo_desde', filters.periodo_desde);
    }
    if (filters?.periodo_hasta) {
      params.append('periodo_hasta', filters.periodo_hasta);
    }

    const response = await api.get<ApiResponse<Pago[]>>(
      `/pagos${params.toString() ? `?${params.toString()}` : ''}`
    );
    const data = getData(response);
    return data || [];
  },

  /**
   * Obtener pagos con paginación y filtros
   */
  getAllPaginated: async (filters?: PagoFiltersPaginated): Promise<PaginatedPagosResponse> => {
    const params = new URLSearchParams();
    if (filters?.page != null) params.set('page', String(filters.page));
    if (filters?.limit != null) params.set('limit', String(filters.limit));
    if (filters?.profesional_id) params.set('profesional_id', filters.profesional_id);
    if (filters?.estado) params.set('estado', filters.estado);
    if (filters?.periodo_desde) params.set('periodo_desde', filters.periodo_desde);
    if (filters?.periodo_hasta) params.set('periodo_hasta', filters.periodo_hasta);
    const qs = params.toString();
    const response = await api.get<ApiResponse<PaginatedPagosResponse>>(
      `/pagos${qs ? `?${qs}` : ''}`
    );
    const data = getData(response);
    return data ?? { data: [], total: 0, page: 1, limit: 10, totalPages: 0 };
  },

  /**
   * Obtener pagos pendientes
   */
  getPending: async (): Promise<Pago[]> => {
    const response = await api.get<ApiResponse<Pago[]>>('/pagos/pending');
    const data = getData(response);
    return data || [];
  },

  /**
   * Obtener pagos vencidos
   */
  getOverdue: async (): Promise<Pago[]> => {
    const response = await api.get<ApiResponse<Pago[]>>('/pagos/overdue');
    const data = getData(response);
    return data || [];
  },

  /**
   * Obtener pagos de un profesional
   */
  getByProfesional: async (profesionalId: string): Promise<Pago[]> => {
    const response = await api.get<ApiResponse<Pago[]>>(`/pagos/profesional/${profesionalId}`);
    const data = getData(response);
    return data || [];
  },

  /**
   * Obtener pago por ID
   */
  getById: async (id: string): Promise<Pago | null> => {
    const response = await api.get<ApiResponse<Pago>>(`/pagos/${id}`);
    return getData(response);
  },

  /**
   * Crear nuevo pago
   */
  create: async (data: CreatePagoData): Promise<Pago> => {
    const response = await api.post<ApiResponse<Pago>>('/pagos', data);
    const result = getData(response);
    if (!result) {
      throw new Error('Error al crear pago');
    }
    return result;
  },

  /**
   * Actualizar pago
   */
  update: async (id: string, data: UpdatePagoData): Promise<Pago> => {
    const response = await api.put<ApiResponse<Pago>>(`/pagos/${id}`, data);
    const result = getData(response);
    if (!result) {
      throw new Error('Error al actualizar pago');
    }
    return result;
  },

  /**
   * Marcar pago como pagado
   */
  markAsPaid: async (id: string, data: MarkAsPaidData): Promise<Pago> => {
    const response = await api.patch<ApiResponse<Pago>>(`/pagos/${id}/pay`, data);
    const result = getData(response);
    if (!result) {
      throw new Error('Error al marcar pago como pagado');
    }
    return result;
  },

  /**
   * Eliminar pago
   */
  delete: async (id: string): Promise<void> => {
    await api.delete<ApiResponse<null>>(`/pagos/${id}`);
  },
};
