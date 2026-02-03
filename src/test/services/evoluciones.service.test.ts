import { describe, it, expect, beforeEach, vi } from 'vitest';
import { evolucionesService } from '@/services/evoluciones.service';
import api, { getData } from '@/services/api';
import type { Evolucion, ApiResponse } from '@/types';

// Mock del módulo api
vi.mock('@/services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
  getData: vi.fn((response) => response.data?.data || null),
}));

describe('EvolucionesService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAll', () => {
    it('debe obtener todas las evoluciones sin filtros', async () => {
      const mockEvoluciones: Evolucion[] = [
        {
          id: '1',
          paciente_id: 'pac-1',
          profesional_id: 'prof-1',
          fecha_consulta: '2024-01-01T10:00:00',
        },
      ];

      (api.get as any).mockResolvedValue({
        data: {
          success: true,
          data: mockEvoluciones,
        } as ApiResponse<Evolucion[]>,
      });

      const result = await evolucionesService.getAll();

      expect(api.get).toHaveBeenCalledWith('/evoluciones');
      expect(result).toEqual(mockEvoluciones);
    });
  });

  describe('getByPaciente', () => {
    it('debe obtener evoluciones de un paciente', async () => {
      const mockEvoluciones: Evolucion[] = [];
      (api.get as any).mockResolvedValue({
        data: {
          success: true,
          data: mockEvoluciones,
        } as ApiResponse<Evolucion[]>,
      });

      await evolucionesService.getByPaciente('pac-1');

      expect(api.get).toHaveBeenCalledWith('/evoluciones/paciente/pac-1');
    });
  });

  describe('create', () => {
    it('debe crear una nueva evolución', async () => {
      const newEvolucion = {
        paciente_id: 'pac-1',
        profesional_id: 'prof-1',
        fecha_consulta: '2024-01-01T10:00:00',
        motivo_consulta: 'Consulta de rutina',
      };

      const mockCreatedEvolucion: Evolucion = {
        id: '1',
        ...newEvolucion,
      };

      (api.post as any).mockResolvedValue({
        data: {
          success: true,
          data: mockCreatedEvolucion,
        } as ApiResponse<Evolucion>,
      });

      const result = await evolucionesService.create(newEvolucion);

      expect(api.post).toHaveBeenCalledWith('/evoluciones', newEvolucion);
      expect(result).toEqual(mockCreatedEvolucion);
    });
  });

  describe('update', () => {
    it('debe actualizar una evolución', async () => {
      const updateData = {
        diagnostico: 'Diagnóstico actualizado',
      };

      const mockUpdatedEvolucion: Evolucion = {
        id: '1',
        paciente_id: 'pac-1',
        profesional_id: 'prof-1',
        fecha_consulta: '2024-01-01T10:00:00',
        diagnostico: 'Diagnóstico actualizado',
      };

      (api.put as any).mockResolvedValue({
        data: {
          success: true,
          data: mockUpdatedEvolucion,
        } as ApiResponse<Evolucion>,
      });

      const result = await evolucionesService.update('1', updateData);

      expect(api.put).toHaveBeenCalledWith('/evoluciones/1', updateData);
      expect(result).toEqual(mockUpdatedEvolucion);
    });
  });

  describe('delete', () => {
    it('debe eliminar una evolución', async () => {
      (api.delete as any).mockResolvedValue({
        data: {
          success: true,
        } as ApiResponse<void>,
      });

      await evolucionesService.delete('1');

      expect(api.delete).toHaveBeenCalledWith('/evoluciones/1');
    });
  });
});
