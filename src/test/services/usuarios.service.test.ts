import { describe, it, expect, beforeEach, vi } from 'vitest';
import { usuariosService } from '@/services/usuarios.service';
import api, { getData } from '@/services/api';
import type { User, ApiResponse } from '@/types';

// Mock del módulo api
vi.mock('@/services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  getData: vi.fn((response) => response.data?.data || null),
}));

describe('UsuariosService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAll', () => {
    it('debe obtener todos los usuarios sin filtros', async () => {
      const mockUsuarios: User[] = [
        {
          id: '1',
          email: 'test@example.com',
          nombre: 'Test',
          apellido: 'User',
          rol: 'administrador',
          activo: true,
        },
      ];

      (api.get as any).mockResolvedValue({
        data: {
          success: true,
          data: mockUsuarios,
        } as ApiResponse<User[]>,
      });

      const result = await usuariosService.getAll();

      expect(api.get).toHaveBeenCalledWith('/usuarios');
      expect(result).toEqual(mockUsuarios);
    });

    it('debe obtener usuarios con filtros', async () => {
      const mockUsuarios: User[] = [];
      (api.get as any).mockResolvedValue({
        data: {
          success: true,
          data: mockUsuarios,
        } as ApiResponse<User[]>,
      });

      await usuariosService.getAll({ rol: 'profesional', activo: true });

      expect(api.get).toHaveBeenCalledWith('/usuarios?rol=profesional&activo=true');
    });
  });

  describe('getById', () => {
    it('debe obtener un usuario por ID', async () => {
      const mockUsuario: User = {
        id: '1',
        email: 'test@example.com',
        nombre: 'Test',
        apellido: 'User',
        rol: 'administrador',
        activo: true,
      };

      (api.get as any).mockResolvedValue({
        data: {
          success: true,
          data: mockUsuario,
        } as ApiResponse<User>,
      });

      const result = await usuariosService.getById('1');

      expect(api.get).toHaveBeenCalledWith('/usuarios/1');
      expect(result).toEqual(mockUsuario);
    });
  });

  describe('create', () => {
    it('debe crear un nuevo usuario', async () => {
      const newUsuario = {
        email: 'new@example.com',
        password: 'password123',
        nombre: 'New',
        apellido: 'User',
        rol: 'profesional' as const,
      };

      const mockCreatedUsuario: User = {
        id: '2',
        ...newUsuario,
        activo: true,
      };

      (api.post as any).mockResolvedValue({
        data: {
          success: true,
          data: mockCreatedUsuario,
        } as ApiResponse<User>,
      });

      const result = await usuariosService.create(newUsuario);

      expect(api.post).toHaveBeenCalledWith('/usuarios', newUsuario);
      expect(result).toEqual(mockCreatedUsuario);
    });
  });

  describe('update', () => {
    it('debe actualizar un usuario', async () => {
      const updateData = {
        nombre: 'Updated',
        apellido: 'Name',
      };

      const mockUpdatedUsuario: User = {
        id: '1',
        email: 'test@example.com',
        ...updateData,
        rol: 'administrador',
        activo: true,
      };

      (api.put as any).mockResolvedValue({
        data: {
          success: true,
          data: mockUpdatedUsuario,
        } as ApiResponse<User>,
      });

      const result = await usuariosService.update('1', updateData);

      expect(api.put).toHaveBeenCalledWith('/usuarios/1', updateData);
      expect(result).toEqual(mockUpdatedUsuario);
    });
  });

  describe('delete', () => {
    it('debe eliminar un usuario', async () => {
      (api.delete as any).mockResolvedValue({
        data: {
          success: true,
        } as ApiResponse<void>,
      });

      await usuariosService.delete('1');

      expect(api.delete).toHaveBeenCalledWith('/usuarios/1');
    });
  });

  describe('activate', () => {
    it('debe activar un usuario', async () => {
      const mockUsuario: User = {
        id: '1',
        email: 'test@example.com',
        nombre: 'Test',
        apellido: 'User',
        rol: 'administrador',
        activo: true,
      };

      (api.patch as any).mockResolvedValue({
        data: {
          success: true,
          data: mockUsuario,
        } as ApiResponse<User>,
      });

      const result = await usuariosService.activate('1');

      expect(api.patch).toHaveBeenCalledWith('/usuarios/1/activate');
      expect(result).toEqual(mockUsuario);
    });
  });

  describe('deactivate', () => {
    it('debe desactivar un usuario', async () => {
      const mockUsuario: User = {
        id: '1',
        email: 'test@example.com',
        nombre: 'Test',
        apellido: 'User',
        rol: 'administrador',
        activo: false,
      };

      (api.patch as any).mockResolvedValue({
        data: {
          success: true,
          data: mockUsuario,
        } as ApiResponse<User>,
      });

      const result = await usuariosService.deactivate('1');

      expect(api.patch).toHaveBeenCalledWith('/usuarios/1/deactivate');
      expect(result).toEqual(mockUsuario);
    });
  });

  describe('updatePassword', () => {
    it('debe actualizar la contraseña de un usuario', async () => {
      (api.patch as any).mockResolvedValue({
        data: {
          success: true,
        } as ApiResponse<void>,
      });

      await usuariosService.updatePassword('1', { new_password: 'newPassword123' });

      expect(api.patch).toHaveBeenCalledWith('/usuarios/1/password', {
        newPassword: 'newPassword123',
        confirmPassword: 'newPassword123',
      });
    });
  });
});
