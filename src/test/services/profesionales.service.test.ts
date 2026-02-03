import { describe, it, expect, beforeEach, vi } from 'vitest';
import { profesionalesService } from '@/services/profesionales.service';
import api, { getData } from '@/services/api';
import type { Profesional, ApiResponse } from '@/types';

// Mock del módulo api
vi.mock('@/services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
  },
  getData: vi.fn((response) => response.data?.data || null),
}));

describe('ProfesionalesService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAll', () => {
    it('debe obtener todos los profesionales sin filtros', async () => {
      const mockProfesionales: Profesional[] = [
        {
          id: '1',
          usuario_id: 'user-1',
          nombre: 'Juan',
          apellido: 'Pérez',
          email: 'juan@test.com',
          especialidad: 'Cardiología',
          estado_pago: 'al_dia',
          bloqueado: false,
        },
      ];

      (api.get as any).mockResolvedValue({
        data: {
          success: true,
          data: mockProfesionales,
        } as ApiResponse<Profesional[]>,
      });

      const result = await profesionalesService.getAll();

      expect(api.get).toHaveBeenCalledWith('/profesionales');
      expect(result).toEqual(mockProfesionales);
    });

    it('debe obtener profesionales con filtros', async () => {
      const mockProfesionales: Profesional[] = [];
      (api.get as any).mockResolvedValue({
        data: {
          success: true,
          data: mockProfesionales,
        } as ApiResponse<Profesional[]>,
      });

      await profesionalesService.getAll({ bloqueado: true, especialidad: 'Cardiología' });

      expect(api.get).toHaveBeenCalledWith(expect.stringContaining('/profesionales?bloqueado=true&especialidad='));
    });
  });

  describe('getBlocked', () => {
    it('debe obtener profesionales bloqueados', async () => {
      const mockProfesionales: Profesional[] = [
        {
          id: '1',
          usuario_id: 'user-1',
          bloqueado: true,
          estado_pago: 'moroso',
        },
      ];

      (api.get as any).mockResolvedValue({
        data: {
          success: true,
          data: mockProfesionales,
        } as ApiResponse<Profesional[]>,
      });

      const result = await profesionalesService.getBlocked();

      expect(api.get).toHaveBeenCalledWith('/profesionales/blocked');
      expect(result).toEqual(mockProfesionales);
    });
  });

  describe('getById', () => {
    it('debe obtener un profesional por ID', async () => {
      const mockProfesional: Profesional = {
        id: '1',
        usuario_id: 'user-1',
        nombre: 'Juan',
        apellido: 'Pérez',
        estado_pago: 'al_dia',
        bloqueado: false,
      };

      (api.get as any).mockResolvedValue({
        data: {
          success: true,
          data: mockProfesional,
        } as ApiResponse<Profesional>,
      });

      const result = await profesionalesService.getById('1');

      expect(api.get).toHaveBeenCalledWith('/profesionales/1');
      expect(result).toEqual(mockProfesional);
    });
  });

  describe('create', () => {
    it('debe crear un nuevo profesional', async () => {
      const newProfesional = {
        usuario_id: 'user-1',
        matricula: '12345',
        especialidad: 'Cardiología',
      };

      const mockCreatedProfesional: Profesional = {
        id: '1',
        ...newProfesional,
        estado_pago: 'al_dia',
        bloqueado: false,
      };

      (api.post as any).mockResolvedValue({
        data: {
          success: true,
          data: mockCreatedProfesional,
        } as ApiResponse<Profesional>,
      });

      const result = await profesionalesService.create(newProfesional);

      expect(api.post).toHaveBeenCalledWith('/profesionales', newProfesional);
      expect(result).toEqual(mockCreatedProfesional);
    });
  });

  describe('update', () => {
    it('debe actualizar un profesional', async () => {
      const updateData = {
        especialidad: 'Neurología',
      };

      const mockUpdatedProfesional: Profesional = {
        id: '1',
        usuario_id: 'user-1',
        especialidad: 'Neurología',
        estado_pago: 'al_dia',
        bloqueado: false,
      };

      (api.put as any).mockResolvedValue({
        data: {
          success: true,
          data: mockUpdatedProfesional,
        } as ApiResponse<Profesional>,
      });

      const result = await profesionalesService.update('1', updateData);

      expect(api.put).toHaveBeenCalledWith('/profesionales/1', updateData);
      expect(result).toEqual(mockUpdatedProfesional);
    });
  });

  describe('delete', () => {
    it('debe eliminar un profesional', async () => {
      (api.delete as any).mockResolvedValue({
        data: {
          success: true,
        } as ApiResponse<void>,
      });

      await profesionalesService.delete('1');

      expect(api.delete).toHaveBeenCalledWith('/profesionales/1');
    });
  });

  describe('block', () => {
    it('debe bloquear un profesional', async () => {
      const blockData = {
        razon_bloqueo: 'Pago pendiente',
      };

      const mockProfesional: Profesional = {
        id: '1',
        usuario_id: 'user-1',
        bloqueado: true,
        razon_bloqueo: 'Pago pendiente',
        estado_pago: 'moroso',
      };

      (api.patch as any).mockResolvedValue({
        data: {
          success: true,
          data: mockProfesional,
        } as ApiResponse<Profesional>,
      });

      const result = await profesionalesService.block('1', blockData);

      expect(api.patch).toHaveBeenCalledWith('/profesionales/1/block', blockData);
      expect(result).toEqual(mockProfesional);
    });
  });

  describe('unblock', () => {
    it('debe desbloquear un profesional', async () => {
      const mockProfesional: Profesional = {
        id: '1',
        usuario_id: 'user-1',
        bloqueado: false,
        estado_pago: 'al_dia',
      };

      (api.patch as any).mockResolvedValue({
        data: {
          success: true,
          data: mockProfesional,
        } as ApiResponse<Profesional>,
      });

      const result = await profesionalesService.unblock('1');

      expect(api.patch).toHaveBeenCalledWith('/profesionales/1/unblock');
      expect(result).toEqual(mockProfesional);
    });
  });
});
