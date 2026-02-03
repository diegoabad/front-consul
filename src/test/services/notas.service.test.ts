import { describe, it, expect, beforeEach, vi } from 'vitest';
import { notasService } from '@/services/notas.service';
import api, { getData } from '@/services/api';
import type { Nota, ApiResponse } from '@/types';

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

describe('NotasService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAll', () => {
    it('debe obtener todas las notas sin filtros', async () => {
      const mockNotas: Nota[] = [
        {
          id: '1',
          paciente_id: 'pac-1',
          profesional_id: 'prof-1',
          contenido: 'Nota de prueba',
        },
      ];

      (api.get as any).mockResolvedValue({
        data: {
          success: true,
          data: mockNotas,
        } as ApiResponse<Nota[]>,
      });

      const result = await notasService.getAll();

      expect(api.get).toHaveBeenCalledWith('/notas');
      expect(result).toEqual(mockNotas);
    });
  });

  describe('getByPaciente', () => {
    it('debe obtener notas de un paciente', async () => {
      const mockNotas: Nota[] = [];
      (api.get as any).mockResolvedValue({
        data: {
          success: true,
          data: mockNotas,
        } as ApiResponse<Nota[]>,
      });

      await notasService.getByPaciente('pac-1');

      expect(api.get).toHaveBeenCalledWith('/notas/paciente/pac-1');
    });
  });

  describe('create', () => {
    it('debe crear una nueva nota', async () => {
      const newNota = {
        paciente_id: 'pac-1',
        profesional_id: 'prof-1',
        contenido: 'Nueva nota',
      };

      const mockCreatedNota: Nota = {
        id: '1',
        ...newNota,
      };

      (api.post as any).mockResolvedValue({
        data: {
          success: true,
          data: mockCreatedNota,
        } as ApiResponse<Nota>,
      });

      const result = await notasService.create(newNota);

      expect(api.post).toHaveBeenCalledWith('/notas', newNota);
      expect(result).toEqual(mockCreatedNota);
    });
  });

  describe('update', () => {
    it('debe actualizar una nota', async () => {
      const updateData = {
        contenido: 'Nota actualizada',
      };

      const mockUpdatedNota: Nota = {
        id: '1',
        paciente_id: 'pac-1',
        profesional_id: 'prof-1',
        contenido: 'Nota actualizada',
      };

      (api.put as any).mockResolvedValue({
        data: {
          success: true,
          data: mockUpdatedNota,
        } as ApiResponse<Nota>,
      });

      const result = await notasService.update('1', updateData);

      expect(api.put).toHaveBeenCalledWith('/notas/1', updateData);
      expect(result).toEqual(mockUpdatedNota);
    });
  });

  describe('delete', () => {
    it('debe eliminar una nota', async () => {
      (api.delete as any).mockResolvedValue({
        data: {
          success: true,
        } as ApiResponse<void>,
      });

      await notasService.delete('1');

      expect(api.delete).toHaveBeenCalledWith('/notas/1');
    });
  });
});
