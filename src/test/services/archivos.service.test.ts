import { describe, it, expect, beforeEach, vi } from 'vitest';
import { archivosService } from '@/services/archivos.service';
import api, { getData } from '@/services/api';
import type { Archivo, ApiResponse } from '@/types';

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

describe('ArchivosService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAll', () => {
    it('debe obtener todos los archivos sin filtros', async () => {
      const mockArchivos: Archivo[] = [
        {
          id: '1',
          paciente_id: 'pac-1',
          profesional_id: 'prof-1',
          nombre_archivo: 'test.pdf',
          url_archivo: '/uploads/test.pdf',
        },
      ];

      (api.get as any).mockResolvedValue({
        data: {
          success: true,
          data: mockArchivos,
        } as ApiResponse<Archivo[]>,
      });

      const result = await archivosService.getAll();

      expect(api.get).toHaveBeenCalledWith('/archivos');
      expect(result).toEqual(mockArchivos);
    });

    it('debe obtener archivos con filtros', async () => {
      const mockArchivos: Archivo[] = [];
      (api.get as any).mockResolvedValue({
        data: {
          success: true,
          data: mockArchivos,
        } as ApiResponse<Archivo[]>,
      });

      await archivosService.getAll({ paciente_id: 'pac-1' });

      expect(api.get).toHaveBeenCalledWith('/archivos?paciente_id=pac-1');
    });
  });

  describe('getByPaciente', () => {
    it('debe obtener archivos de un paciente', async () => {
      const mockArchivos: Archivo[] = [];
      (api.get as any).mockResolvedValue({
        data: {
          success: true,
          data: mockArchivos,
        } as ApiResponse<Archivo[]>,
      });

      await archivosService.getByPaciente('pac-1');

      expect(api.get).toHaveBeenCalledWith('/archivos/paciente/pac-1');
    });
  });

  describe('upload', () => {
    it('debe subir un archivo', async () => {
      const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
      const mockArchivo: Archivo = {
        id: '1',
        paciente_id: 'pac-1',
        profesional_id: 'prof-1',
        nombre_archivo: 'test.pdf',
        url_archivo: '/uploads/test.pdf',
      };

      (api.post as any).mockResolvedValue({
        data: {
          success: true,
          data: mockArchivo,
        } as ApiResponse<Archivo>,
      });

      const result = await archivosService.upload({
        paciente_id: 'pac-1',
        profesional_id: 'prof-1',
        archivo: file,
      });

      expect(api.post).toHaveBeenCalled();
      expect(result).toEqual(mockArchivo);
    });
  });

  describe('delete', () => {
    it('debe eliminar un archivo', async () => {
      (api.delete as any).mockResolvedValue({
        data: {
          success: true,
        } as ApiResponse<void>,
      });

      await archivosService.delete('1');

      expect(api.delete).toHaveBeenCalledWith('/archivos/1');
    });
  });
});
