import api, { getData } from './api';
import type { User, ApiResponse } from '@/types';

export interface UsuarioFilters {
  rol?: string;
  activo?: boolean;
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
   * Obtener todos los usuarios con filtros opcionales
   */
  getAll: async (filters?: UsuarioFilters): Promise<User[]> => {
    const params = new URLSearchParams();
    if (filters?.rol) {
      params.append('rol', filters.rol);
    }
    if (filters?.activo !== undefined) {
      params.append('activo', filters.activo.toString());
    }

    const response = await api.get<ApiResponse<User[]>>(
      `/usuarios${params.toString() ? `?${params.toString()}` : ''}`
    );
    const data = getData(response);
    return data || [];
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
