import api, { getData } from './api';
import type { Profesional, ApiResponse } from '@/types';

export interface ProfesionalFilters {
  activo?: boolean;
  bloqueado?: boolean;
  especialidad?: string;
  estado_pago?: 'al_dia' | 'pendiente' | 'moroso';
}

export interface CreateProfesionalData {
  usuario_id: string;
  matricula?: string;
  especialidad?: string;
  estado_pago?: 'al_dia' | 'pendiente' | 'moroso';
  bloqueado?: boolean;
  razon_bloqueo?: string;
  fecha_ultimo_pago?: string;
  fecha_inicio_contrato?: string; // YYYY-MM-DD
  monto_mensual?: number;
  tipo_periodo_pago?: 'mensual' | 'quincenal' | 'semanal' | 'anual';
  observaciones?: string;
}

export interface UpdateProfesionalData extends Partial<CreateProfesionalData> {}

export interface BlockProfesionalData {
  razon_bloqueo: string;
}

export const profesionalesService = {
  /**
   * Obtener todos los profesionales con filtros opcionales
   */
  getAll: async (filters?: ProfesionalFilters): Promise<Profesional[]> => {
    const params = new URLSearchParams();
    if (filters?.activo !== undefined) {
      params.append('activo', filters.activo.toString());
    }
    if (filters?.bloqueado !== undefined) {
      params.append('bloqueado', filters.bloqueado.toString());
    }
    if (filters?.especialidad) {
      params.append('especialidad', filters.especialidad);
    }
    if (filters?.estado_pago) {
      params.append('estado_pago', filters.estado_pago);
    }

    const response = await api.get<ApiResponse<Profesional[]>>(
      `/profesionales${params.toString() ? `?${params.toString()}` : ''}`
    );
    const data = getData(response);
    return data || [];
  },

  /**
   * Obtener profesionales bloqueados
   */
  getBlocked: async (): Promise<Profesional[]> => {
    const response = await api.get<ApiResponse<Profesional[]>>('/profesionales/blocked');
    const data = getData(response);
    return data || [];
  },

  /**
   * Obtener profesional por ID
   */
  getById: async (id: string): Promise<Profesional | null> => {
    const response = await api.get<ApiResponse<Profesional>>(`/profesionales/${id}`);
    return getData(response);
  },

  /**
   * Obtener profesional por usuario_id
   */
  getByUsuarioId: async (usuarioId: string): Promise<Profesional | null> => {
    const response = await api.get<ApiResponse<Profesional>>(`/profesionales/by-user/${usuarioId}`);
    return getData(response);
  },

  /**
   * Crear nuevo profesional
   */
  create: async (data: CreateProfesionalData): Promise<Profesional> => {
    const response = await api.post<ApiResponse<Profesional>>('/profesionales', data);
    const result = getData(response);
    if (!result) {
      throw new Error('Error al crear profesional');
    }
    return result;
  },

  /**
   * Actualizar profesional
   */
  update: async (id: string, data: UpdateProfesionalData): Promise<Profesional> => {
    const response = await api.put<ApiResponse<Profesional>>(`/profesionales/${id}`, data);
    const result = getData(response);
    if (!result) {
      throw new Error('Error al actualizar profesional');
    }
    return result;
  },

  /**
   * Eliminar profesional
   */
  delete: async (id: string): Promise<void> => {
    await api.delete<ApiResponse<void>>(`/profesionales/${id}`);
  },

  /**
   * Bloquear profesional
   */
  block: async (id: string, data: BlockProfesionalData): Promise<Profesional> => {
    const response = await api.patch<ApiResponse<Profesional>>(`/profesionales/${id}/block`, data);
    const result = getData(response);
    if (!result) {
      throw new Error('Error al bloquear profesional');
    }
    return result;
  },

  /**
   * Desbloquear profesional
   */
  unblock: async (id: string): Promise<Profesional> => {
    const response = await api.patch<ApiResponse<Profesional>>(`/profesionales/${id}/unblock`);
    const result = getData(response);
    if (!result) {
      throw new Error('Error al desbloquear profesional');
    }
    return result;
  },
};
