import { describe, it, expect, beforeEach, vi } from 'vitest';
import { agendaService } from '@/services/agenda.service';
import api, { getData } from '@/services/api';
import type { ConfiguracionAgenda, BloqueNoDisponible, ApiResponse } from '@/types';

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

describe('AgendaService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAllAgenda', () => {
    it('debe obtener todas las configuraciones de agenda sin filtros', async () => {
      const mockAgendas: ConfiguracionAgenda[] = [
        {
          id: '1',
          profesional_id: 'prof-1',
          dia_semana: 1,
          hora_inicio: '09:00:00',
          hora_fin: '18:00:00',
          duracion_turno_minutos: 30,
          activo: true,
        },
      ];

      (api.get as any).mockResolvedValue({
        data: {
          success: true,
          data: mockAgendas,
        } as ApiResponse<ConfiguracionAgenda[]>,
      });

      const result = await agendaService.getAllAgenda();

      expect(api.get).toHaveBeenCalledWith('/agenda');
      expect(result).toEqual(mockAgendas);
    });

    it('debe obtener configuraciones de agenda con filtros', async () => {
      const mockAgendas: ConfiguracionAgenda[] = [];
      (api.get as any).mockResolvedValue({
        data: {
          success: true,
          data: mockAgendas,
        } as ApiResponse<ConfiguracionAgenda[]>,
      });

      const result = await agendaService.getAllAgenda({
        profesional_id: 'prof-1',
        dia_semana: 1,
        activo: true,
      });

      expect(api.get).toHaveBeenCalledWith(expect.stringContaining('/agenda?'));
      expect(api.get).toHaveBeenCalledWith(expect.stringContaining('profesional_id=prof-1'));
      expect(api.get).toHaveBeenCalledWith(expect.stringContaining('dia_semana=1'));
      expect(api.get).toHaveBeenCalledWith(expect.stringContaining('activo=true'));
      expect(result).toEqual(mockAgendas);
    });
  });

  describe('getAgendaByProfesional', () => {
    it('debe obtener configuraciones de agenda de un profesional', async () => {
      const mockAgendas: ConfiguracionAgenda[] = [
        {
          id: '1',
          profesional_id: 'prof-1',
          dia_semana: 1,
          hora_inicio: '09:00:00',
          hora_fin: '18:00:00',
          duracion_turno_minutos: 30,
          activo: true,
        },
      ];

      (api.get as any).mockResolvedValue({
        data: {
          success: true,
          data: mockAgendas,
        } as ApiResponse<ConfiguracionAgenda[]>,
      });

      const result = await agendaService.getAgendaByProfesional('prof-1');

      expect(api.get).toHaveBeenCalledWith('/agenda/profesional/prof-1');
      expect(result).toEqual(mockAgendas);
    });

    it('debe obtener solo configuraciones activas si se especifica', async () => {
      const mockAgendas: ConfiguracionAgenda[] = [];
      (api.get as any).mockResolvedValue({
        data: {
          success: true,
          data: mockAgendas,
        } as ApiResponse<ConfiguracionAgenda[]>,
      });

      const result = await agendaService.getAgendaByProfesional('prof-1', true);

      expect(api.get).toHaveBeenCalledWith(expect.stringContaining('/agenda/profesional/prof-1'));
      expect(api.get).toHaveBeenCalledWith(expect.stringContaining('solo_activos=true'));
      expect(result).toEqual(mockAgendas);
    });
  });

  describe('getAgendaById', () => {
    it('debe obtener una configuración de agenda por ID', async () => {
      const mockAgenda: ConfiguracionAgenda = {
        id: '1',
        profesional_id: 'prof-1',
        dia_semana: 1,
        hora_inicio: '09:00:00',
        hora_fin: '18:00:00',
        duracion_turno_minutos: 30,
        activo: true,
      };

      (api.get as any).mockResolvedValue({
        data: {
          success: true,
          data: mockAgenda,
        } as ApiResponse<ConfiguracionAgenda>,
      });

      const result = await agendaService.getAgendaById('1');

      expect(api.get).toHaveBeenCalledWith('/agenda/1');
      expect(result).toEqual(mockAgenda);
    });
  });

  describe('createAgenda', () => {
    it('debe crear una nueva configuración de agenda', async () => {
      const newAgenda = {
        profesional_id: 'prof-1',
        dia_semana: 1,
        hora_inicio: '09:00',
        hora_fin: '18:00',
        duracion_turno_minutos: 30,
        activo: true,
      };

      const mockCreated: ConfiguracionAgenda = {
        id: '1',
        ...newAgenda,
        hora_inicio: '09:00:00',
        hora_fin: '18:00:00',
      };

      (api.post as any).mockResolvedValue({
        data: {
          success: true,
          data: mockCreated,
        } as ApiResponse<ConfiguracionAgenda>,
      });

      const result = await agendaService.createAgenda(newAgenda);

      expect(api.post).toHaveBeenCalledWith('/agenda', {
        profesional_id: 'prof-1',
        dia_semana: 1,
        hora_inicio: '09:00:00',
        hora_fin: '18:00:00',
        duracion_turno_minutos: 30,
        activo: true,
      });
      expect(result).toEqual(mockCreated);
    });
  });

  describe('updateAgenda', () => {
    it('debe actualizar una configuración de agenda', async () => {
      const updateData = {
        hora_inicio: '10:00',
        hora_fin: '19:00',
      };

      const mockUpdated: ConfiguracionAgenda = {
        id: '1',
        profesional_id: 'prof-1',
        dia_semana: 1,
        hora_inicio: '10:00:00',
        hora_fin: '19:00:00',
        duracion_turno_minutos: 30,
        activo: true,
      };

      (api.put as any).mockResolvedValue({
        data: {
          success: true,
          data: mockUpdated,
        } as ApiResponse<ConfiguracionAgenda>,
      });

      const result = await agendaService.updateAgenda('1', updateData);

      expect(api.put).toHaveBeenCalledWith('/agenda/1', {
        hora_inicio: '10:00:00',
        hora_fin: '19:00:00',
      });
      expect(result).toEqual(mockUpdated);
    });
  });

  describe('deleteAgenda', () => {
    it('debe eliminar una configuración de agenda', async () => {
      (api.delete as any).mockResolvedValue({
        data: {
          success: true,
          data: null,
        } as ApiResponse<void>,
      });

      await agendaService.deleteAgenda('1');

      expect(api.delete).toHaveBeenCalledWith('/agenda/1');
    });
  });

  describe('activateAgenda', () => {
    it('debe activar una configuración de agenda', async () => {
      const mockActivated: ConfiguracionAgenda = {
        id: '1',
        profesional_id: 'prof-1',
        dia_semana: 1,
        hora_inicio: '09:00:00',
        hora_fin: '18:00:00',
        duracion_turno_minutos: 30,
        activo: true,
      };

      (api.patch as any).mockResolvedValue({
        data: {
          success: true,
          data: mockActivated,
        } as ApiResponse<ConfiguracionAgenda>,
      });

      const result = await agendaService.activateAgenda('1');

      expect(api.patch).toHaveBeenCalledWith('/agenda/1/activate');
      expect(result).toEqual(mockActivated);
    });
  });

  describe('deactivateAgenda', () => {
    it('debe desactivar una configuración de agenda', async () => {
      const mockDeactivated: ConfiguracionAgenda = {
        id: '1',
        profesional_id: 'prof-1',
        dia_semana: 1,
        hora_inicio: '09:00:00',
        hora_fin: '18:00:00',
        duracion_turno_minutos: 30,
        activo: false,
      };

      (api.patch as any).mockResolvedValue({
        data: {
          success: true,
          data: mockDeactivated,
        } as ApiResponse<ConfiguracionAgenda>,
      });

      const result = await agendaService.deactivateAgenda('1');

      expect(api.patch).toHaveBeenCalledWith('/agenda/1/deactivate');
      expect(result).toEqual(mockDeactivated);
    });
  });

  describe('getAllBloques', () => {
    it('debe obtener todos los bloques no disponibles sin filtros', async () => {
      const mockBloques: BloqueNoDisponible[] = [
        {
          id: '1',
          profesional_id: 'prof-1',
          fecha_hora_inicio: '2024-01-01T00:00:00',
          fecha_hora_fin: '2024-01-07T23:59:59',
          motivo: 'Vacaciones',
        },
      ];

      (api.get as any).mockResolvedValue({
        data: {
          success: true,
          data: mockBloques,
        } as ApiResponse<BloqueNoDisponible[]>,
      });

      const result = await agendaService.getAllBloques();

      expect(api.get).toHaveBeenCalledWith('/agenda/bloques');
      expect(result).toEqual(mockBloques);
    });

    it('debe obtener bloques con filtros', async () => {
      const mockBloques: BloqueNoDisponible[] = [];
      (api.get as any).mockResolvedValue({
        data: {
          success: true,
          data: mockBloques,
        } as ApiResponse<BloqueNoDisponible[]>,
      });

      const result = await agendaService.getAllBloques({
        profesional_id: 'prof-1',
        fecha_inicio: '2024-01-01',
        fecha_fin: '2024-01-31',
      });

      expect(api.get).toHaveBeenCalledWith(expect.stringContaining('/agenda/bloques?'));
      expect(api.get).toHaveBeenCalledWith(expect.stringContaining('profesional_id=prof-1'));
      expect(result).toEqual(mockBloques);
    });
  });

  describe('getBloquesByProfesional', () => {
    it('debe obtener bloques no disponibles de un profesional', async () => {
      const mockBloques: BloqueNoDisponible[] = [
        {
          id: '1',
          profesional_id: 'prof-1',
          fecha_hora_inicio: '2024-01-01T00:00:00',
          fecha_hora_fin: '2024-01-07T23:59:59',
          motivo: 'Vacaciones',
        },
      ];

      (api.get as any).mockResolvedValue({
        data: {
          success: true,
          data: mockBloques,
        } as ApiResponse<BloqueNoDisponible[]>,
      });

      const result = await agendaService.getBloquesByProfesional('prof-1');

      expect(api.get).toHaveBeenCalledWith('/agenda/bloques/profesional/prof-1');
      expect(result).toEqual(mockBloques);
    });
  });

  describe('getBloqueById', () => {
    it('debe obtener un bloque no disponible por ID', async () => {
      const mockBloque: BloqueNoDisponible = {
        id: '1',
        profesional_id: 'prof-1',
        fecha_hora_inicio: '2024-01-01T00:00:00',
        fecha_hora_fin: '2024-01-07T23:59:59',
        motivo: 'Vacaciones',
      };

      (api.get as any).mockResolvedValue({
        data: {
          success: true,
          data: mockBloque,
        } as ApiResponse<BloqueNoDisponible>,
      });

      const result = await agendaService.getBloqueById('1');

      expect(api.get).toHaveBeenCalledWith('/agenda/bloques/1');
      expect(result).toEqual(mockBloque);
    });
  });

  describe('createBloque', () => {
    it('debe crear un nuevo bloque no disponible', async () => {
      const newBloque = {
        profesional_id: 'prof-1',
        fecha_hora_inicio: '2024-01-01T00:00:00',
        fecha_hora_fin: '2024-01-07T23:59:59',
        motivo: 'Vacaciones',
      };

      const mockCreated: BloqueNoDisponible = {
        id: '1',
        ...newBloque,
      };

      (api.post as any).mockResolvedValue({
        data: {
          success: true,
          data: mockCreated,
        } as ApiResponse<BloqueNoDisponible>,
      });

      const result = await agendaService.createBloque(newBloque);

      expect(api.post).toHaveBeenCalledWith('/agenda/bloques', newBloque);
      expect(result).toEqual(mockCreated);
    });
  });

  describe('updateBloque', () => {
    it('debe actualizar un bloque no disponible', async () => {
      const updateData = {
        motivo: 'Licencia médica',
      };

      const mockUpdated: BloqueNoDisponible = {
        id: '1',
        profesional_id: 'prof-1',
        fecha_hora_inicio: '2024-01-01T00:00:00',
        fecha_hora_fin: '2024-01-07T23:59:59',
        motivo: 'Licencia médica',
      };

      (api.put as any).mockResolvedValue({
        data: {
          success: true,
          data: mockUpdated,
        } as ApiResponse<BloqueNoDisponible>,
      });

      const result = await agendaService.updateBloque('1', updateData);

      expect(api.put).toHaveBeenCalledWith('/agenda/bloques/1', updateData);
      expect(result).toEqual(mockUpdated);
    });
  });

  describe('deleteBloque', () => {
    it('debe eliminar un bloque no disponible', async () => {
      (api.delete as any).mockResolvedValue({
        data: {
          success: true,
          data: null,
        } as ApiResponse<void>,
      });

      await agendaService.deleteBloque('1');

      expect(api.delete).toHaveBeenCalledWith('/agenda/bloques/1');
    });
  });
});
