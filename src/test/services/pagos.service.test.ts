import { describe, it, expect, beforeEach, vi } from 'vitest';
import { pagosService } from '@/services/pagos.service';
import api, { getData } from '@/services/api';
import type { Pago, ApiResponse } from '@/types';

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

describe('PagosService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAll', () => {
    it('debe obtener todos los pagos sin filtros', async () => {
      const mockPagos: Pago[] = [
        {
          id: '1',
          profesional_id: 'prof-1',
          periodo: '2024-01-01',
          monto: '10000',
          estado: 'pendiente',
        },
      ];

      (api.get as any).mockResolvedValue({
        data: {
          success: true,
          data: mockPagos,
        } as ApiResponse<Pago[]>,
      });

      const result = await pagosService.getAll();

      expect(api.get).toHaveBeenCalledWith('/pagos');
      expect(result).toEqual(mockPagos);
    });

    it('debe obtener pagos con filtros', async () => {
      const mockPagos: Pago[] = [];
      (api.get as any).mockResolvedValue({
        data: {
          success: true,
          data: mockPagos,
        } as ApiResponse<Pago[]>,
      });

      await pagosService.getAll({ profesional_id: 'prof-1', estado: 'pendiente' });

      expect(api.get).toHaveBeenCalledWith('/pagos?profesional_id=prof-1&estado=pendiente');
    });
  });

  describe('getPending', () => {
    it('debe obtener pagos pendientes', async () => {
      const mockPagos: Pago[] = [
        {
          id: '1',
          profesional_id: 'prof-1',
          periodo: '2024-01-01',
          monto: '10000',
          estado: 'pendiente',
        },
      ];

      (api.get as any).mockResolvedValue({
        data: {
          success: true,
          data: mockPagos,
        } as ApiResponse<Pago[]>,
      });

      const result = await pagosService.getPending();

      expect(api.get).toHaveBeenCalledWith('/pagos/pending');
      expect(result).toEqual(mockPagos);
    });
  });

  describe('getOverdue', () => {
    it('debe obtener pagos vencidos', async () => {
      const mockPagos: Pago[] = [
        {
          id: '1',
          profesional_id: 'prof-1',
          periodo: '2024-01-01',
          monto: '10000',
          estado: 'vencido',
        },
      ];

      (api.get as any).mockResolvedValue({
        data: {
          success: true,
          data: mockPagos,
        } as ApiResponse<Pago[]>,
      });

      const result = await pagosService.getOverdue();

      expect(api.get).toHaveBeenCalledWith('/pagos/overdue');
      expect(result).toEqual(mockPagos);
    });
  });

  describe('getByProfesional', () => {
    it('debe obtener pagos de un profesional', async () => {
      const mockPagos: Pago[] = [
        {
          id: '1',
          profesional_id: 'prof-1',
          periodo: '2024-01-01',
          monto: '10000',
          estado: 'pendiente',
        },
      ];

      (api.get as any).mockResolvedValue({
        data: {
          success: true,
          data: mockPagos,
        } as ApiResponse<Pago[]>,
      });

      const result = await pagosService.getByProfesional('prof-1');

      expect(api.get).toHaveBeenCalledWith('/pagos/profesional/prof-1');
      expect(result).toEqual(mockPagos);
    });
  });

  describe('getById', () => {
    it('debe obtener un pago por ID', async () => {
      const mockPago: Pago = {
        id: '1',
        profesional_id: 'prof-1',
        periodo: '2024-01-01',
        monto: '10000',
        estado: 'pendiente',
      };

      (api.get as any).mockResolvedValue({
        data: {
          success: true,
          data: mockPago,
        } as ApiResponse<Pago>,
      });

      const result = await pagosService.getById('1');

      expect(api.get).toHaveBeenCalledWith('/pagos/1');
      expect(result).toEqual(mockPago);
    });
  });

  describe('create', () => {
    it('debe crear un nuevo pago', async () => {
      const newPago = {
        profesional_id: 'prof-1',
        periodo: '2024-01-01',
        monto: 10000,
      };

      const mockCreatedPago: Pago = {
        id: '1',
        ...newPago,
        monto: '10000',
        estado: 'pendiente',
      };

      (api.post as any).mockResolvedValue({
        data: {
          success: true,
          data: mockCreatedPago,
        } as ApiResponse<Pago>,
      });

      const result = await pagosService.create(newPago);

      expect(api.post).toHaveBeenCalledWith('/pagos', newPago);
      expect(result).toEqual(mockCreatedPago);
    });
  });

  describe('update', () => {
    it('debe actualizar un pago', async () => {
      const updateData = {
        monto: 12000,
      };

      const mockUpdatedPago: Pago = {
        id: '1',
        profesional_id: 'prof-1',
        periodo: '2024-01-01',
        monto: '12000',
        estado: 'pendiente',
      };

      (api.put as any).mockResolvedValue({
        data: {
          success: true,
          data: mockUpdatedPago,
        } as ApiResponse<Pago>,
      });

      const result = await pagosService.update('1', updateData);

      expect(api.put).toHaveBeenCalledWith('/pagos/1', updateData);
      expect(result).toEqual(mockUpdatedPago);
    });
  });

  describe('markAsPaid', () => {
    it('debe marcar un pago como pagado', async () => {
      const markData = {
        fecha_pago: '2024-01-15',
        metodo_pago: 'Transferencia',
      };

      const mockPago: Pago = {
        id: '1',
        profesional_id: 'prof-1',
        periodo: '2024-01-01',
        monto: '10000',
        estado: 'pagado',
        fecha_pago: '2024-01-15',
        metodo_pago: 'Transferencia',
      };

      (api.patch as any).mockResolvedValue({
        data: {
          success: true,
          data: mockPago,
        } as ApiResponse<Pago>,
      });

      const result = await pagosService.markAsPaid('1', markData);

      expect(api.patch).toHaveBeenCalledWith('/pagos/1/pay', markData);
      expect(result).toEqual(mockPago);
    });
  });
});
