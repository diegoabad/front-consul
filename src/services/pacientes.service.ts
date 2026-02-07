import api, { getData } from './api';
import type { Paciente, ApiResponse } from '@/types';

export interface PacienteFilters {
  page?: number;
  limit?: number;
  q?: string;
  activo?: boolean;
  obra_social?: string;
}

export interface PaginatedPacientesResponse {
  data: Paciente[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
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
  plan?: string;
  contacto_emergencia_nombre?: string;
  contacto_emergencia_telefono?: string;
  activo?: boolean;
}

export interface UpdatePacienteData extends Partial<CreatePacienteData> {}

export const pacientesService = {
  /**
   * Obtener pacientes paginados con filtros (búsqueda y filtros en backend)
   */
  getAll: async (filters?: PacienteFilters): Promise<PaginatedPacientesResponse> => {
    const params = new URLSearchParams();
    if (filters?.page !== undefined) params.append('page', String(filters.page));
    if (filters?.limit !== undefined) params.append('limit', String(filters.limit));
    if (filters?.q?.trim()) params.append('q', filters.q.trim());
    if (filters?.activo !== undefined) params.append('activo', String(filters.activo));
    if (filters?.obra_social) params.append('obra_social', filters.obra_social);

    const response = await api.get<ApiResponse<PaginatedPacientesResponse>>(
      `/pacientes${params.toString() ? `?${params.toString()}` : ''}`
    );
    const data = getData(response);
    return data ?? { data: [], total: 0, page: 1, limit: 10, totalPages: 0 };
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

  /**
   * Listar profesionales asignados a un paciente
   */
  getAsignaciones: async (pacienteId: string): Promise<AsignacionPacienteProfesional[]> => {
    const response = await api.get<ApiResponse<AsignacionPacienteProfesional[]>>(
      `/pacientes/${pacienteId}/asignaciones`
    );
    const data = getData(response);
    return data || [];
  },

  /**
   * Asignar un profesional al paciente
   */
  addAsignacion: async (pacienteId: string, profesional_id: string): Promise<AsignacionPacienteProfesional[]> => {
    const response = await api.post<ApiResponse<AsignacionPacienteProfesional[]>>(
      `/pacientes/${pacienteId}/asignaciones`,
      { profesional_id }
    );
    const data = getData(response);
    return data || [];
  },

  /**
   * Quitar asignación de un profesional al paciente
   */
  removeAsignacion: async (pacienteId: string, profesionalId: string): Promise<void> => {
    await api.delete<ApiResponse<void>>(`/pacientes/${pacienteId}/asignaciones/${profesionalId}`);
  },

  /**
   * Reemplazar todas las asignaciones del paciente en una sola operación
   */
  setAsignaciones: async (
    pacienteId: string,
    profesionalIds: string[]
  ): Promise<AsignacionPacienteProfesional[]> => {
    const response = await api.put<ApiResponse<AsignacionPacienteProfesional[]>>(
      `/pacientes/${pacienteId}/asignaciones`,
      { profesional_ids: profesionalIds }
    );
    const data = getData(response);
    return data || [];
  },
};

export interface AsignacionPacienteProfesional {
  id: string;
  paciente_id: string;
  profesional_id: string;
  asignado_por_usuario_id: string | null;
  fecha_asignacion: string;
  paciente_nombre?: string;
  paciente_apellido?: string;
  profesional_nombre: string;
  profesional_apellido: string;
  profesional_especialidad?: string;
}
