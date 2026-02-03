import { describe, it, expect, beforeEach, vi } from 'vitest';
import { notificacionesService } from '@/services/notificaciones.service';
import api, { getData } from '@/services/api';
import type { Notificacion, ApiResponse } from '@/types';

// Mock del módulo api
vi.mock('@/services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
  getData: vi.fn((response) => response.data?.data || null),
}));

describe('NotificacionesService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAll', () => {
    it('debe obtener todas las notificaciones sin filtros', async () => {
      const mockNotificaciones: Notificacion[] = [
        {
          id: '1',
          destinatario_email: 'test@example.com',
          asunto: 'Test',
          contenido: 'Contenido de prueba',
          estado: 'enviado',
        },
      ];

      (api.get as any).mockResolvedValue({
        data: {
          success: true,
          data: mockNotificaciones,
        } as ApiResponse<Notificacion[]>,
      });

      const result = await notificacionesService.getAll();

      expect(api.get).toHaveBeenCalledWith('/notificaciones');
      expect(result).toEqual(mockNotificaciones);
    });

    it('debe obtener notificaciones con filtros', async () => {
      const mockNotificaciones: Notificacion[] = [];
      (api.get as any).mockResolvedValue({
        data: {
          success: true,
          data: mockNotificaciones,
        } as ApiResponse<Notificacion[]>,
      });

      const result = await notificacionesService.getAll({
        destinatario_email: 'test@example.com',
        estado: 'enviado',
        tipo: 'turno',
      });

      expect(api.get).toHaveBeenCalledWith(expect.stringContaining('/notificaciones?'));
      expect(api.get).toHaveBeenCalledWith(expect.stringContaining('destinatario_email='));
      expect(api.get).toHaveBeenCalledWith(expect.stringContaining('estado=enviado'));
      expect(api.get).toHaveBeenCalledWith(expect.stringContaining('tipo=turno'));
      expect(result).toEqual(mockNotificaciones);
    });
  });

  describe('getPending', () => {
    it('debe obtener notificaciones pendientes', async () => {
      const mockNotificaciones: Notificacion[] = [
        {
          id: '1',
          destinatario_email: 'test@example.com',
          asunto: 'Test',
          contenido: 'Contenido de prueba',
          estado: 'pendiente',
        },
      ];

      (api.get as any).mockResolvedValue({
        data: {
          success: true,
          data: mockNotificaciones,
        } as ApiResponse<Notificacion[]>,
      });

      const result = await notificacionesService.getPending();

      expect(api.get).toHaveBeenCalledWith('/notificaciones/pending');
      expect(result).toEqual(mockNotificaciones);
    });
  });

  describe('getByDestinatario', () => {
    it('debe obtener notificaciones de un destinatario', async () => {
      const mockNotificaciones: Notificacion[] = [
        {
          id: '1',
          destinatario_email: 'test@example.com',
          asunto: 'Test',
          contenido: 'Contenido de prueba',
          estado: 'enviado',
        },
      ];

      (api.get as any).mockResolvedValue({
        data: {
          success: true,
          data: mockNotificaciones,
        } as ApiResponse<Notificacion[]>,
      });

      const result = await notificacionesService.getByDestinatario('test@example.com');

      expect(api.get).toHaveBeenCalledWith('/notificaciones/destinatario/test@example.com');
      expect(result).toEqual(mockNotificaciones);
    });
  });

  describe('getById', () => {
    it('debe obtener una notificación por ID', async () => {
      const mockNotificacion: Notificacion = {
        id: '1',
        destinatario_email: 'test@example.com',
        asunto: 'Test',
        contenido: 'Contenido de prueba',
        estado: 'enviado',
      };

      (api.get as any).mockResolvedValue({
        data: {
          success: true,
          data: mockNotificacion,
        } as ApiResponse<Notificacion>,
      });

      const result = await notificacionesService.getById('1');

      expect(api.get).toHaveBeenCalledWith('/notificaciones/1');
      expect(result).toEqual(mockNotificacion);
    });
  });

  describe('create', () => {
    it('debe crear una nueva notificación', async () => {
      const newNotificacion = {
        destinatario_email: 'test@example.com',
        asunto: 'Test',
        contenido: 'Contenido de prueba',
        tipo: 'turno',
      };

      const mockCreated: Notificacion = {
        id: '1',
        ...newNotificacion,
        estado: 'pendiente',
      };

      (api.post as any).mockResolvedValue({
        data: {
          success: true,
          data: mockCreated,
        } as ApiResponse<Notificacion>,
      });

      const result = await notificacionesService.create(newNotificacion);

      expect(api.post).toHaveBeenCalledWith('/notificaciones', newNotificacion);
      expect(result).toEqual(mockCreated);
    });
  });

  describe('update', () => {
    it('debe actualizar una notificación', async () => {
      const updateData = {
        asunto: 'Asunto actualizado',
      };

      const mockUpdated: Notificacion = {
        id: '1',
        destinatario_email: 'test@example.com',
        asunto: 'Asunto actualizado',
        contenido: 'Contenido de prueba',
        estado: 'enviado',
      };

      (api.put as any).mockResolvedValue({
        data: {
          success: true,
          data: mockUpdated,
        } as ApiResponse<Notificacion>,
      });

      const result = await notificacionesService.update('1', updateData);

      expect(api.put).toHaveBeenCalledWith('/notificaciones/1', updateData);
      expect(result).toEqual(mockUpdated);
    });
  });

  describe('send', () => {
    it('debe enviar una notificación', async () => {
      const mockSent: Notificacion = {
        id: '1',
        destinatario_email: 'test@example.com',
        asunto: 'Test',
        contenido: 'Contenido de prueba',
        estado: 'enviado',
        fecha_envio: '2024-01-01T10:00:00',
      };

      (api.post as any).mockResolvedValue({
        data: {
          success: true,
          data: mockSent,
        } as ApiResponse<Notificacion>,
      });

      const result = await notificacionesService.send('1');

      expect(api.post).toHaveBeenCalledWith('/notificaciones/1/send');
      expect(result).toEqual(mockSent);
    });
  });
});
