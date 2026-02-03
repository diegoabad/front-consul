import api, { getData } from './api';
import type { ApiResponse } from '@/types';

export interface Nota {
  id: string;
  paciente_id: string;
  usuario_id: string;
  contenido: string;
  fecha_creacion?: string;
  fecha_actualizacion?: string;
  // Datos relacionados
  paciente_nombre?: string;
  paciente_apellido?: string;
  usuario_nombre?: string;
  usuario_apellido?: string;
  especialidad?: string; // Si el usuario es profesional
}

export interface NotaFilters {
  paciente_id?: string;
  usuario_id?: string;
}

export interface CreateNotaData {
  paciente_id: string;
  usuario_id: string;
  contenido: string;
}

export interface UpdateNotaData {
  contenido: string;
}

export const notasService = {
  /**
   * Obtener todas las notas con filtros opcionales
   */
  getAll: async (filters?: NotaFilters): Promise<Nota[]> => {
    const params = new URLSearchParams();
    if (filters?.paciente_id) {
      params.append('paciente_id', filters.paciente_id);
    }
    if (filters?.usuario_id) {
      params.append('usuario_id', filters.usuario_id);
    }

    const response = await api.get<ApiResponse<Nota[]>>(
      `/notas${params.toString() ? `?${params.toString()}` : ''}`
    );
    const data = getData(response);
    return data || [];
  },

  /**
   * Obtener notas de un paciente
   */
  getByPaciente: async (pacienteId: string): Promise<Nota[]> => {
    const response = await api.get<ApiResponse<Nota[]>>(`/notas/paciente/${pacienteId}`);
    const data = getData(response);
    return data || [];
  },

  /**
   * Obtener notas de un usuario
   */
  getByUsuario: async (usuarioId: string): Promise<Nota[]> => {
    const response = await api.get<ApiResponse<Nota[]>>(`/notas/usuario/${usuarioId}`);
    const data = getData(response);
    return data || [];
  },

  /**
   * Obtener nota por ID
   */
  getById: async (id: string): Promise<Nota | null> => {
    const response = await api.get<ApiResponse<Nota>>(`/notas/${id}`);
    return getData(response);
  },

  /**
   * Crear nueva nota
   */
  create: async (data: CreateNotaData): Promise<Nota> => {
    const response = await api.post<ApiResponse<Nota>>('/notas', data);
    const result = getData(response);
    if (!result) {
      throw new Error('Error al crear nota');
    }
    return result;
  },

  /**
   * Actualizar nota
   */
  update: async (id: string, data: UpdateNotaData): Promise<Nota> => {
    const response = await api.put<ApiResponse<Nota>>(`/notas/${id}`, data);
    const result = getData(response);
    if (!result) {
      throw new Error('Error al actualizar nota');
    }
    return result;
  },

  /**
   * Eliminar nota
   */
  delete: async (id: string): Promise<void> => {
    await api.delete<ApiResponse<void>>(`/notas/${id}`);
  },
};
