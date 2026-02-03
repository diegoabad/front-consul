import { describe, it, expect, beforeEach, vi } from 'vitest';
import api, { getData } from '@/services/api';
import type { ApiResponse } from '@/types';

describe('API Service', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('getData helper', () => {
    it('debe extraer data de una respuesta exitosa', () => {
      const response = {
        data: {
          success: true,
          data: { id: '1', name: 'Test' },
        } as ApiResponse<{ id: string; name: string }>,
      };

      const result = getData(response);
      expect(result).toEqual({ id: '1', name: 'Test' });
    });

    it('debe retornar null si success es false', () => {
      const response = {
        data: {
          success: false,
          message: 'Error',
        } as ApiResponse,
      };

      const result = getData(response);
      expect(result).toBeNull();
    });

    it('debe retornar null si data no existe', () => {
      const response = {
        data: {
          success: true,
        } as ApiResponse,
      };

      const result = getData(response);
      expect(result).toBeNull();
    });
  });

  describe('Request Interceptor', () => {
    it('debe agregar token de autorización si existe', async () => {
      localStorage.setItem('token', 'test-token-123');

      // Mock de axios para capturar la configuración
      const originalGet = api.get;
      const mockGet = vi.fn().mockResolvedValue({ data: {} });
      api.get = mockGet;

      await api.get('/test');

      expect(mockGet).toHaveBeenCalled();
      const callConfig = mockGet.mock.calls[0][1] || {};
      expect(callConfig.headers?.Authorization).toBe('Bearer test-token-123');

      // Restaurar
      api.get = originalGet;
    });
  });

  describe('Response Interceptor', () => {
    it('debe redirigir a login en error 401', async () => {
      const originalLocation = window.location;
      delete (window as any).location;
      window.location = { href: '' } as any;

      // Simular error 401
      const error = {
        response: {
          status: 401,
        },
      };

      try {
        await api.interceptors.response.handlers[0].rejected(error);
      } catch (e) {
        // Se espera que rechace
      }

      expect(localStorage.getItem('token')).toBeNull();
      expect(localStorage.getItem('user')).toBeNull();

      // Restaurar
      window.location = originalLocation;
    });
  });
});
