import api, { getData } from './api';
import type { User, ApiResponse } from '@/types';

export interface UsuarioFilters {
  page?: number;
  limit?: number;
  q?: string;
  rol?: string;
  activo?: boolean;
}

export interface PaginatedUsuariosResponse {
  data: User[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateUsuarioData {
  email: string;
  password: string;
  nombre: string;
  apellido: string;
  telefono?: string;
  rol: 'administrador' | 'profesional' | 'secretaria';
  activo?: boolean;
}

export interface UpdateUsuarioData extends Partial<Omit<CreateUsuarioData, 'password'>> {}

export interface UpdatePasswordData {
  password: string;
  new_password: string;
}

export const usuariosService = {
  /**
   * Obtener usuarios paginados con filtros (búsqueda y filtros en backend)
   */
  getAll: async (filters?: UsuarioFilters): Promise<PaginatedUsuariosResponse> => {
    const params = new URLSearchParams();
    if (filters?.page !== undefined) params.append('page', String(filters.page));
    if (filters?.limit !== undefined) params.append('limit', String(filters.limit));
    if (filters?.q?.trim()) params.append('q', filters.q.trim());
    if (filters?.rol) params.append('rol', filters.rol);
    if (filters?.activo !== undefined) params.append('activo', String(filters.activo));

    const response = await api.get<ApiResponse<PaginatedUsuariosResponse>>(
      `/usuarios${params.toString() ? `?${params.toString()}` : ''}`
    );
    const data = getData(response);
    return data ?? { data: [], total: 0, page: 1, limit: 10, totalPages: 0 };
  },

  /**
   * Obtener usuario por ID
   */
  getById: async (id: string): Promise<User | null> => {
    const response = await api.get<ApiResponse<User>>(`/usuarios/${id}`);
    return getData(response);
  },

  /**
   * Crear nuevo usuario
   */
  create: async (data: CreateUsuarioData): Promise<User> => {
    const response = await api.post<ApiResponse<User>>('/usuarios', data);
    const result = getData(response);
    if (!result) {
      throw new Error('Error al crear usuario');
    }
    return result;
  },

  /**
   * Actualizar usuario
   */
  update: async (id: string, data: UpdateUsuarioData): Promise<User> => {
    const response = await api.put<ApiResponse<User>>(`/usuarios/${id}`, data);
    const result = getData(response);
    if (!result) {
      throw new Error('Error al actualizar usuario');
    }
    return result;
  },

  /**
   * Eliminar usuario
   */
  delete: async (id: string): Promise<void> => {
    await api.delete<ApiResponse<void>>(`/usuarios/${id}`);
  },

  /**
   * Activar usuario
   */
  activate: async (id: string): Promise<User> => {
    const response = await api.patch<ApiResponse<User>>(`/usuarios/${id}/activate`);
    const result = getData(response);
    if (!result) {
      throw new Error('Error al activar usuario');
    }
    return result;
  },

  /**
   * Desactivar usuario
   */
  deactivate: async (id: string): Promise<User> => {
    const response = await api.patch<ApiResponse<User>>(`/usuarios/${id}/deactivate`);
    const result = getData(response);
    if (!result) {
      throw new Error('Error al desactivar usuario');
    }
    return result;
  },

  /**
   * Actualizar contraseña
   * Nota: El backend espera newPassword y confirmPassword, pero solo usa newPassword
   */
  updatePassword: async (id: string, data: { new_password: string }): Promise<void> => {
    // El backend espera newPassword y confirmPassword (validación), pero solo usa newPassword
    await api.patch<ApiResponse<void>>(`/usuarios/${id}/password`, {
      newPassword: data.new_password,
      confirmPassword: data.new_password, // Enviar el mismo valor para pasar la validación
    });
  },
};
