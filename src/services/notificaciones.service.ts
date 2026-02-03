import api, { getData } from './api';
import type { ApiResponse } from '@/types';

export interface Notificacion {
  id: string;
  destinatario_email: string;
  asunto: string;
  contenido: string;
  tipo?: string;
  estado: 'pendiente' | 'enviado' | 'fallido';
  error_mensaje?: string;
  relacionado_tipo?: string;
  relacionado_id?: string;
  fecha_envio?: string;
  fecha_creacion?: string;
  fecha_actualizacion?: string;
}

export interface NotificacionFilters {
  destinatario_email?: string;
  tipo?: string;
  estado?: 'pendiente' | 'enviado' | 'fallido';
  relacionado_tipo?: string;
  relacionado_id?: string;
}

export interface CreateNotificacionData {
  destinatario_email: string;
  asunto: string;
  contenido: string;
  tipo?: string;
  relacionado_tipo?: string;
  relacionado_id?: string;
}

export interface UpdateNotificacionData extends Partial<CreateNotificacionData> {}

export const notificacionesService = {
  /**
   * Obtener todas las notificaciones con filtros opcionales
   */
  getAll: async (filters?: NotificacionFilters): Promise<Notificacion[]> => {
    const params = new URLSearchParams();
    if (filters?.destinatario_email) {
      params.append('destinatario_email', filters.destinatario_email);
    }
    if (filters?.tipo) {
      params.append('tipo', filters.tipo);
    }
    if (filters?.estado) {
      params.append('estado', filters.estado);
    }
    if (filters?.relacionado_tipo) {
      params.append('relacionado_tipo', filters.relacionado_tipo);
    }
    if (filters?.relacionado_id) {
      params.append('relacionado_id', filters.relacionado_id);
    }

    const response = await api.get<ApiResponse<Notificacion[]>>(
      `/notificaciones${params.toString() ? `?${params.toString()}` : ''}`
    );
    const data = getData(response);
    return data || [];
  },

  /**
   * Obtener notificaciones pendientes
   */
  getPending: async (): Promise<Notificacion[]> => {
    const response = await api.get<ApiResponse<Notificacion[]>>('/notificaciones/pending');
    const data = getData(response);
    return data || [];
  },

  /**
   * Obtener notificaciones de un destinatario por email
   */
  getByDestinatario: async (email: string): Promise<Notificacion[]> => {
    const response = await api.get<ApiResponse<Notificacion[]>>(`/notificaciones/destinatario/${email}`);
    const data = getData(response);
    return data || [];
  },

  /**
   * Obtener notificación por ID
   */
  getById: async (id: string): Promise<Notificacion | null> => {
    const response = await api.get<ApiResponse<Notificacion>>(`/notificaciones/${id}`);
    return getData(response);
  },

  /**
   * Crear nueva notificación
   */
  create: async (data: CreateNotificacionData): Promise<Notificacion> => {
    const response = await api.post<ApiResponse<Notificacion>>('/notificaciones', data);
    const result = getData(response);
    if (!result) {
      throw new Error('Error al crear notificación');
    }
    return result;
  },

  /**
   * Actualizar notificación
   */
  update: async (id: string, data: UpdateNotificacionData): Promise<Notificacion> => {
    const response = await api.put<ApiResponse<Notificacion>>(`/notificaciones/${id}`, data);
    const result = getData(response);
    if (!result) {
      throw new Error('Error al actualizar notificación');
    }
    return result;
  },

  /**
   * Enviar notificación
   */
  send: async (id: string): Promise<Notificacion> => {
    const response = await api.post<ApiResponse<Notificacion>>(`/notificaciones/${id}/send`);
    const result = getData(response);
    if (!result) {
      throw new Error('Error al enviar notificación');
    }
    return result;
  },
};
