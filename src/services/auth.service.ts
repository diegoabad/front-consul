import api, { getData } from './api';
import type { User, LoginResponse, ApiResponse } from '@/types';

export const authService = {
  login: async (email: string, password: string): Promise<LoginResponse> => {
    const response = await api.post<ApiResponse<LoginResponse>>('/auth/login', {
      email,
      password,
    });
    const data = getData(response);
    if (!data) {
      throw new Error('Error al iniciar sesión');
    }
    return data;
  },

  register: async (userData: {
    email: string;
    password: string;
    nombre: string;
    apellido: string;
    telefono?: string;
    rol: string;
  }): Promise<User> => {
    const response = await api.post<ApiResponse<User>>('/auth/register', userData);
    const data = getData(response);
    if (!data) {
      throw new Error('Error al registrar usuario');
    }
    return data;
  },

  getProfile: async (): Promise<User> => {
    const response = await api.get<ApiResponse<User>>('/auth/profile');
    const data = getData(response);
    if (!data) {
      throw new Error('Error al obtener perfil');
    }
    return data;
  },

  /** Actualizar perfil propio (nombre, apellido, email, telefono) */
  updateProfile: async (data: { nombre?: string; apellido?: string; email?: string; telefono?: string | null }): Promise<User> => {
    const response = await api.patch<ApiResponse<User>>('/auth/profile', data);
    const result = getData(response);
    if (!result) {
      throw new Error('Error al actualizar perfil');
    }
    return result;
  },

  /** Cambiar contraseña del usuario autenticado */
  updateMyPassword: async (newPassword: string, confirmPassword: string): Promise<void> => {
    await api.patch<ApiResponse<void>>('/auth/profile/password', { newPassword, confirmPassword });
  },
};
