import { describe, it, expect, beforeEach, vi } from 'vitest';
import { pacientesService } from '@/services/pacientes.service';
import api, { getData } from '@/services/api';
import type { Paciente, ApiResponse } from '@/types';

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

describe('PacientesService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAll', () => {
    it('debe obtener todos los pacientes sin filtros', async () => {
      const mockPacientes: Paciente[] = [
        {
          id: '1',
          dni: '12345678',
          nombre: 'Juan',
          apellido: 'Pérez',
          activo: true,
        },
      ];

      (api.get as any).mockResolvedValue({
        data: {
          success: true,
          data: mockPacientes,
        } as ApiResponse<Paciente[]>,
      });

      const result = await pacientesService.getAll();

      expect(api.get).toHaveBeenCalledWith('/pacientes');
      expect(result).toEqual(mockPacientes);
    });

    it('debe obtener pacientes con filtro de activo', async () => {
      const mockPacientes: Paciente[] = [
        {
          id: '1',
          dni: '12345678',
          nombre: 'Juan',
          apellido: 'Pérez',
          activo: true,
        },
      ];

      (api.get as any).mockResolvedValue({
        data: {
          success: true,
          data: mockPacientes,
        } as ApiResponse<Paciente[]>,
      });

      const result = await pacientesService.getAll({ activo: true });

      expect(api.get).toHaveBeenCalledWith('/pacientes?activo=true');
      expect(result).toEqual(mockPacientes);
    });

    it('debe obtener pacientes con filtro de obra social', async () => {
      const mockPacientes: Paciente[] = [
        {
          id: '1',
          dni: '12345678',
          nombre: 'Juan',
          apellido: 'Pérez',
          obra_social: 'OSDE',
          activo: true,
        },
      ];

      (api.get as any).mockResolvedValue({
        data: {
          success: true,
          data: mockPacientes,
        } as ApiResponse<Paciente[]>,
      });

      const result = await pacientesService.getAll({ obra_social: 'OSDE' });

      expect(api.get).toHaveBeenCalledWith('/pacientes?obra_social=OSDE');
      expect(result).toEqual(mockPacientes);
    });

    it('debe retornar array vacío si no hay datos', async () => {
      (api.get as any).mockResolvedValue({
        data: {
          success: true,
          data: null,
        } as ApiResponse<Paciente[]>,
      });

      const result = await pacientesService.getAll();

      expect(result).toEqual([]);
    });
  });

  describe('search', () => {
    it('debe buscar pacientes por término', async () => {
      const mockPacientes: Paciente[] = [
        {
          id: '1',
          dni: '12345678',
          nombre: 'Juan',
          apellido: 'Pérez',
          activo: true,
        },
      ];

      (api.get as any).mockResolvedValue({
        data: {
          success: true,
          data: mockPacientes,
        } as ApiResponse<Paciente[]>,
      });

      const result = await pacientesService.search('Juan');

      expect(api.get).toHaveBeenCalledWith('/pacientes/search?q=Juan');
      expect(result).toEqual(mockPacientes);
    });

    it('debe codificar correctamente el término de búsqueda', async () => {
      (api.get as any).mockResolvedValue({
        data: {
          success: true,
          data: [],
        } as ApiResponse<Paciente[]>,
      });

      await pacientesService.search('Juan Pérez');

      expect(api.get).toHaveBeenCalledWith('/pacientes/search?q=Juan%20P%C3%A9rez');
    });
  });

  describe('getById', () => {
    it('debe obtener un paciente por ID', async () => {
      const mockPaciente: Paciente = {
        id: '1',
        dni: '12345678',
        nombre: 'Juan',
        apellido: 'Pérez',
        activo: true,
      };

      (api.get as any).mockResolvedValue({
        data: {
          success: true,
          data: mockPaciente,
        } as ApiResponse<Paciente>,
      });

      const result = await pacientesService.getById('1');

      expect(api.get).toHaveBeenCalledWith('/pacientes/1');
      expect(result).toEqual(mockPaciente);
    });

    it('debe retornar null si no se encuentra el paciente', async () => {
      (api.get as any).mockResolvedValue({
        data: {
          success: false,
          data: null,
        } as ApiResponse<Paciente>,
      });

      const result = await pacientesService.getById('999');

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('debe crear un nuevo paciente', async () => {
      const newPaciente = {
        dni: '12345678',
        nombre: 'Juan',
        apellido: 'Pérez',
      };

      const mockCreatedPaciente: Paciente = {
        id: '1',
        ...newPaciente,
        activo: true,
      };

      (api.post as any).mockResolvedValue({
        data: {
          success: true,
          data: mockCreatedPaciente,
        } as ApiResponse<Paciente>,
      });

      const result = await pacientesService.create(newPaciente);

      expect(api.post).toHaveBeenCalledWith('/pacientes', newPaciente);
      expect(result).toEqual(mockCreatedPaciente);
    });

    it('debe lanzar error si la creación falla', async () => {
      (api.post as any).mockResolvedValue({
        data: {
          success: false,
          data: null,
        } as ApiResponse<Paciente>,
      });

      await expect(
        pacientesService.create({
          dni: '12345678',
          nombre: 'Juan',
          apellido: 'Pérez',
        })
      ).rejects.toThrow('Error al crear paciente');
    });
  });

  describe('update', () => {
    it('debe actualizar un paciente', async () => {
      const updateData = {
        nombre: 'Juan Carlos',
      };

      const mockUpdatedPaciente: Paciente = {
        id: '1',
        dni: '12345678',
        nombre: 'Juan Carlos',
        apellido: 'Pérez',
        activo: true,
      };

      (api.put as any).mockResolvedValue({
        data: {
          success: true,
          data: mockUpdatedPaciente,
        } as ApiResponse<Paciente>,
      });

      const result = await pacientesService.update('1', updateData);

      expect(api.put).toHaveBeenCalledWith('/pacientes/1', updateData);
      expect(result).toEqual(mockUpdatedPaciente);
    });

    it('debe lanzar error si la actualización falla', async () => {
      (api.put as any).mockResolvedValue({
        data: {
          success: false,
          data: null,
        } as ApiResponse<Paciente>,
      });

      await expect(
        pacientesService.update('1', { nombre: 'Juan' })
      ).rejects.toThrow('Error al actualizar paciente');
    });
  });

  describe('delete', () => {
    it('debe eliminar un paciente', async () => {
      (api.delete as any).mockResolvedValue({
        data: {
          success: true,
        } as ApiResponse<void>,
      });

      await pacientesService.delete('1');

      expect(api.delete).toHaveBeenCalledWith('/pacientes/1');
    });
  });

  describe('activate', () => {
    it('debe activar un paciente', async () => {
      const mockPaciente: Paciente = {
        id: '1',
        dni: '12345678',
        nombre: 'Juan',
        apellido: 'Pérez',
        activo: true,
      };

      (api.patch as any).mockResolvedValue({
        data: {
          success: true,
          data: mockPaciente,
        } as ApiResponse<Paciente>,
      });

      const result = await pacientesService.activate('1');

      expect(api.patch).toHaveBeenCalledWith('/pacientes/1/activate');
      expect(result).toEqual(mockPaciente);
    });

    it('debe lanzar error si la activación falla', async () => {
      (api.patch as any).mockResolvedValue({
        data: {
          success: false,
          data: null,
        } as ApiResponse<Paciente>,
      });

      await expect(pacientesService.activate('1')).rejects.toThrow('Error al activar paciente');
    });
  });

  describe('deactivate', () => {
    it('debe desactivar un paciente', async () => {
      const mockPaciente: Paciente = {
        id: '1',
        dni: '12345678',
        nombre: 'Juan',
        apellido: 'Pérez',
        activo: false,
      };

      (api.patch as any).mockResolvedValue({
        data: {
          success: true,
          data: mockPaciente,
        } as ApiResponse<Paciente>,
      });

      const result = await pacientesService.deactivate('1');

      expect(api.patch).toHaveBeenCalledWith('/pacientes/1/deactivate');
      expect(result).toEqual(mockPaciente);
    });

    it('debe lanzar error si la desactivación falla', async () => {
      (api.patch as any).mockResolvedValue({
        data: {
          success: false,
          data: null,
        } as ApiResponse<Paciente>,
      });

      await expect(pacientesService.deactivate('1')).rejects.toThrow('Error al desactivar paciente');
    });
  });
});
