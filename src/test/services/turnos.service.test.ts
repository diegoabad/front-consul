import { describe, it, expect, beforeEach, vi } from 'vitest';
import { turnosService } from '@/services/turnos.service';
import api, { getData } from '@/services/api';
import type { Turno, ApiResponse } from '@/types';

// Mock del módulo api
vi.mock('@/services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
  },
  getData: vi.fn((response) => response.data?.data || null),
}));

describe('TurnosService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAll', () => {
    it('debe obtener todos los turnos sin filtros', async () => {
      const mockTurnos: Turno[] = [
        {
          id: '1',
          profesional_id: 'prof-1',
          paciente_id: 'pac-1',
          fecha_hora_inicio: '2024-01-01T10:00:00',
          fecha_hora_fin: '2024-01-01T10:30:00',
          estado: 'pendiente',
        },
      ];

      (api.get as any).mockResolvedValue({
        data: {
          success: true,
          data: mockTurnos,
        } as ApiResponse<Turno[]>,
      });

      const result = await turnosService.getAll();

      expect(api.get).toHaveBeenCalledWith('/turnos');
      expect(result).toEqual(mockTurnos);
    });

    it('debe obtener turnos con filtros', async () => {
      const mockTurnos: Turno[] = [];
      (api.get as any).mockResolvedValue({
        data: {
          success: true,
          data: mockTurnos,
        } as ApiResponse<Turno[]>,
      });

      await turnosService.getAll({ profesional_id: 'prof-1', estado: 'confirmado' });

      expect(api.get).toHaveBeenCalledWith(expect.stringContaining('/turnos?profesional_id=prof-1&estado=confirmado'));
    });
  });

  describe('checkAvailability', () => {
    it('debe verificar disponibilidad de un horario', async () => {
      (api.get as any).mockResolvedValue({
        data: {
          success: true,
          data: { disponible: true },
        } as ApiResponse<{ disponible: boolean }>,
      });

      const result = await turnosService.checkAvailability({
        profesional_id: 'prof-1',
        fecha_hora_inicio: '2024-01-01T10:00:00',
        fecha_hora_fin: '2024-01-01T10:30:00',
      });

      expect(api.get).toHaveBeenCalled();
      expect(result.disponible).toBe(true);
    });
  });

  describe('getByProfesional', () => {
    it('debe obtener turnos de un profesional', async () => {
      const mockTurnos: Turno[] = [];
      (api.get as any).mockResolvedValue({
        data: {
          success: true,
          data: mockTurnos,
        } as ApiResponse<Turno[]>,
      });

      await turnosService.getByProfesional('prof-1');

      expect(api.get).toHaveBeenCalledWith('/turnos/profesional/prof-1');
    });
  });

  describe('create', () => {
    it('debe crear un nuevo turno', async () => {
      const newTurno = {
        profesional_id: 'prof-1',
        paciente_id: 'pac-1',
        fecha_hora_inicio: '2024-01-01T10:00:00',
        fecha_hora_fin: '2024-01-01T10:30:00',
      };

      const mockCreatedTurno: Turno = {
        id: '1',
        ...newTurno,
        estado: 'pendiente',
      };

      (api.post as any).mockResolvedValue({
        data: {
          success: true,
          data: mockCreatedTurno,
        } as ApiResponse<Turno>,
      });

      const result = await turnosService.create(newTurno);

      expect(api.post).toHaveBeenCalledWith('/turnos', newTurno);
      expect(result).toEqual(mockCreatedTurno);
    });
  });

  describe('cancel', () => {
    it('debe cancelar un turno', async () => {
      const cancelData = {
        razon_cancelacion: 'Paciente canceló',
      };

      const mockTurno: Turno = {
        id: '1',
        profesional_id: 'prof-1',
        paciente_id: 'pac-1',
        fecha_hora_inicio: '2024-01-01T10:00:00',
        fecha_hora_fin: '2024-01-01T10:30:00',
        estado: 'cancelado',
        razon_cancelacion: 'Paciente canceló',
      };

      (api.patch as any).mockResolvedValue({
        data: {
          success: true,
          data: mockTurno,
        } as ApiResponse<Turno>,
      });

      const result = await turnosService.cancel('1', cancelData);

      expect(api.patch).toHaveBeenCalledWith('/turnos/1/cancel', cancelData);
      expect(result).toEqual(mockTurno);
    });
  });

  describe('confirm', () => {
    it('debe confirmar un turno', async () => {
      const mockTurno: Turno = {
        id: '1',
        profesional_id: 'prof-1',
        paciente_id: 'pac-1',
        fecha_hora_inicio: '2024-01-01T10:00:00',
        fecha_hora_fin: '2024-01-01T10:30:00',
        estado: 'confirmado',
      };

      (api.patch as any).mockResolvedValue({
        data: {
          success: true,
          data: mockTurno,
        } as ApiResponse<Turno>,
      });

      const result = await turnosService.confirm('1');

      expect(api.patch).toHaveBeenCalledWith('/turnos/1/confirm');
      expect(result).toEqual(mockTurno);
    });
  });

  describe('complete', () => {
    it('debe completar un turno', async () => {
      const mockTurno: Turno = {
        id: '1',
        profesional_id: 'prof-1',
        paciente_id: 'pac-1',
        fecha_hora_inicio: '2024-01-01T10:00:00',
        fecha_hora_fin: '2024-01-01T10:30:00',
        estado: 'completado',
      };

      (api.patch as any).mockResolvedValue({
        data: {
          success: true,
          data: mockTurno,
        } as ApiResponse<Turno>,
      });

      const result = await turnosService.complete('1');

      expect(api.patch).toHaveBeenCalledWith('/turnos/1/complete');
      expect(result).toEqual(mockTurno);
    });
  });
});
