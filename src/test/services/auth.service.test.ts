import { describe, it, expect, beforeEach, vi } from 'vitest';
import { authService } from '@/services/auth.service';
import api from '@/services/api';
import type { LoginResponse, User } from '@/types';

// Mock axios
const mockPost = vi.fn();
const mockGet = vi.fn();

vi.mock('@/services/api', () => ({
  default: {
    post: mockPost,
    get: mockGet,
  },
  getData: <T>(response: { data: { success: boolean; data?: T } }): T | null => {
    return response.data.success ? response.data.data || null : null;
  },
}));

describe('authService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('login', () => {
    it('debería hacer login exitosamente', async () => {
      const mockResponse: LoginResponse = {
        token: 'test-token-123',
        user: {
          id: '1',
          email: 'test@example.com',
          rol: 'administrador',
        },
      };

      (api.post as any).mockResolvedValue({
        data: {
          success: true,
          data: mockResponse,
        },
      });

      const result = await authService.login('test@example.com', 'password123');

      expect(result).toEqual(mockResponse);
      expect(mockPost).toHaveBeenCalledWith('/auth/login', {
        email: 'test@example.com',
        password: 'password123',
      });
    });

    it('debería lanzar error si el login falla', async () => {
      mockPost.mockResolvedValue({
        data: {
          success: false,
          message: 'Credenciales inválidas',
        },
      });

      await expect(
        authService.login('invalid@example.com', 'wrong')
      ).rejects.toThrow('Error al iniciar sesión');
    });

    it('debería manejar errores de red', async () => {
      mockPost.mockRejectedValue(new Error('Network error'));

      await expect(
        authService.login('test@example.com', 'password')
      ).rejects.toThrow('Network error');
    });
  });

  describe('getProfile', () => {
    it('debería obtener el perfil del usuario', async () => {
      const mockUser: User = {
        id: '1',
        email: 'test@example.com',
        nombre: 'Test',
        apellido: 'User',
        telefono: '1234567890',
        rol: 'administrador',
        activo: true,
      };

      (api.get as any).mockResolvedValue({
        data: {
          success: true,
          data: mockUser,
        },
      });

      const result = await authService.getProfile();

      expect(result).toEqual(mockUser);
      expect(mockGet).toHaveBeenCalledWith('/auth/profile');
    });

    it('debería lanzar error si no se puede obtener el perfil', async () => {
      mockGet.mockResolvedValue({
        data: {
          success: false,
          message: 'No autorizado',
        },
      });

      await expect(authService.getProfile()).rejects.toThrow('Error al obtener perfil');
    });
  });

  describe('register', () => {
    it('debería registrar un nuevo usuario', async () => {
      const mockUser: User = {
        id: '2',
        email: 'new@example.com',
        nombre: 'New',
        apellido: 'User',
        rol: 'secretaria',
        activo: true,
      };

      mockPost.mockResolvedValue({
        data: {
          success: true,
          data: mockUser,
        },
      });

      const result = await authService.register({
        email: 'new@example.com',
        password: 'password123',
        nombre: 'New',
        apellido: 'User',
        rol: 'secretaria',
      });

      expect(result).toEqual(mockUser);
      expect(mockPost).toHaveBeenCalledWith('/auth/register', {
        email: 'new@example.com',
        password: 'password123',
        nombre: 'New',
        apellido: 'User',
        rol: 'secretaria',
      });
    });
  });
});
