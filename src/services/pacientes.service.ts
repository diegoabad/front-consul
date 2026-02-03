import api, { getData } from './api';
import type { Paciente, ApiResponse } from '@/types';

export interface PacienteFilters {
  activo?: boolean;
  obra_social?: string;
}

export interface CreatePacienteData {
  dni: string;
  nombre: string;
  apellido: string;
  fecha_nacimiento?: string;
  telefono: string;
  email?: string;
  direccion?: string;
  obra_social?: string;
  numero_afiliado?: string;
  contacto_emergencia_nombre?: string;
  contacto_emergencia_telefono?: string;
  activo?: boolean;
}

export interface UpdatePacienteData extends Partial<CreatePacienteData> {}

export const pacientesService = {
  /**
   * Obtener todos los pacientes con filtros opcionales
   */
  getAll: async (filters?: PacienteFilters): Promise<Paciente[]> => {
    const params = new URLSearchParams();
    if (filters?.activo !== undefined) {
      params.append('activo', filters.activo.toString());
    }
    if (filters?.obra_social) {
      params.append('obra_social', filters.obra_social);
    }

    const response = await api.get<ApiResponse<Paciente[]>>(
      `/pacientes${params.toString() ? `?${params.toString()}` : ''}`
    );
    const data = getData(response);
    return data || [];
  },

  /**
   * Buscar pacientes por término de búsqueda
   */
  search: async (query: string): Promise<Paciente[]> => {
    const response = await api.get<ApiResponse<Paciente[]>>(
      `/pacientes/search?q=${encodeURIComponent(query)}`
    );
    const data = getData(response);
    return data || [];
  },

  /**
   * Obtener paciente por DNI. Retorna null si no existe (404).
   */
  getByDni: async (dni: string): Promise<Paciente | null> => {
    const trimmed = String(dni).trim();
    if (!trimmed) return null;
    try {
      const response = await api.get<ApiResponse<Paciente>>(`/pacientes/by-dni?dni=${encodeURIComponent(trimmed)}`);
      return getData(response);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 404) return null;
      throw err;
    }
  },

  /**
   * Obtener paciente por ID
   */
  getById: async (id: string): Promise<Paciente | null> => {
    const response = await api.get<ApiResponse<Paciente>>(`/pacientes/${id}`);
    return getData(response);
  },

  /**
   * Crear nuevo paciente
   */
  create: async (data: CreatePacienteData): Promise<Paciente> => {
    const response = await api.post<ApiResponse<Paciente>>('/pacientes', data);
    const result = getData(response);
    if (!result) {
      throw new Error('Error al crear paciente');
    }
    return result;
  },

  /**
   * Actualizar paciente
   */
  update: async (id: string, data: UpdatePacienteData): Promise<Paciente> => {
    const response = await api.put<ApiResponse<Paciente>>(`/pacientes/${id}`, data);
    const result = getData(response);
    if (!result) {
      throw new Error('Error al actualizar paciente');
    }
    return result;
  },

  /**
   * Eliminar paciente (soft delete)
   */
  delete: async (id: string): Promise<void> => {
    await api.delete<ApiResponse<void>>(`/pacientes/${id}`);
  },

  /**
   * Activar paciente
   */
  activate: async (id: string): Promise<Paciente> => {
    const response = await api.patch<ApiResponse<Paciente>>(`/pacientes/${id}/activate`);
    const result = getData(response);
    if (!result) {
      throw new Error('Error al activar paciente');
    }
    return result;
  },

  /**
   * Desactivar paciente
   */
  deactivate: async (id: string): Promise<Paciente> => {
    const response = await api.patch<ApiResponse<Paciente>>(`/pacientes/${id}/deactivate`);
    const result = getData(response);
    if (!result) {
      throw new Error('Error al desactivar paciente');
    }
    return result;
  },
};
