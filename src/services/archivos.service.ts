import api, { getData } from './api';
import type { ApiResponse } from '@/types';

export interface Archivo {
  id: string;
  paciente_id: string;
  usuario_id?: string;
  profesional_id?: string | null;
  nombre_archivo: string;
  tipo_archivo?: string;
  url_archivo: string;
  tamanio_bytes?: number;
  descripcion?: string;
  fecha_subida?: string;
  fecha_actualizacion?: string;
  // Datos relacionados
  paciente_nombre?: string;
  paciente_apellido?: string;
  profesional_nombre?: string;
  profesional_apellido?: string;
  usuario_subido_nombre?: string;
  usuario_subido_apellido?: string;
}

export interface ArchivoFilters {
  paciente_id?: string;
  profesional_id?: string;
}

export interface CreateArchivoData {
  paciente_id: string;
  usuario_id: string;
  descripcion?: string;
  archivo: File; // Archivo a subir
}

export interface UpdateArchivoData {
  descripcion?: string;
}

export const archivosService = {
  /**
   * Obtener todos los archivos con filtros opcionales
   */
  getAll: async (filters?: ArchivoFilters): Promise<Archivo[]> => {
    const params = new URLSearchParams();
    if (filters?.paciente_id) {
      params.append('paciente_id', filters.paciente_id);
    }
    if (filters?.profesional_id) {
      params.append('profesional_id', filters.profesional_id);
    }

    const response = await api.get<ApiResponse<Archivo[]>>(
      `/archivos${params.toString() ? `?${params.toString()}` : ''}`
    );
    const data = getData(response);
    return data || [];
  },

  /**
   * Obtener archivos de un paciente
   */
  getByPaciente: async (pacienteId: string): Promise<Archivo[]> => {
    const response = await api.get<ApiResponse<Archivo[]>>(`/archivos/paciente/${pacienteId}`);
    const data = getData(response);
    return data || [];
  },

  /**
   * Obtener archivo por ID
   */
  getById: async (id: string): Promise<Archivo | null> => {
    const response = await api.get<ApiResponse<Archivo>>(`/archivos/${id}`);
    return getData(response);
  },

  /**
   * Subir archivo
   */
  upload: async (data: CreateArchivoData): Promise<Archivo> => {
    const formData = new FormData();
    formData.append('archivo', data.archivo);
    formData.append('paciente_id', data.paciente_id);
    formData.append('usuario_id', data.usuario_id);
    if (data.descripcion) {
      formData.append('descripcion', data.descripcion);
    }

    const response = await api.post<ApiResponse<Archivo>>('/archivos', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    const result = getData(response);
    if (!result) {
      throw new Error('Error al subir archivo');
    }
    return result;
  },

  /**
   * Actualizar metadatos de archivo
   */
  update: async (id: string, data: UpdateArchivoData): Promise<Archivo> => {
    const response = await api.put<ApiResponse<Archivo>>(`/archivos/${id}`, data);
    const result = getData(response);
    if (!result) {
      throw new Error('Error al actualizar archivo');
    }
    return result;
  },

  /**
   * Eliminar archivo
   */
  delete: async (id: string): Promise<void> => {
    await api.delete<ApiResponse<void>>(`/archivos/${id}`);
  },

  /**
   * Descargar archivo
   */
  download: async (id: string): Promise<Blob> => {
    const response = await api.get(`/archivos/${id}/download`, {
      responseType: 'blob',
    });
    return response.data;
  },
};
