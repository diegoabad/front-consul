import api from './api';

export interface DashboardStats {
  totalPacientes: number;
  totalProfesionales: number;
  turnosEsteMes: number;
  conContrato: number;
  pagosPagadosCount: number;
  pagosPagadosTotal: number;
}

export const dashboardService = {
  getStats: async (): Promise<DashboardStats> => {
    const res = await api.get<{ success: boolean; data: DashboardStats }>('/dashboard/stats');
    return res.data.data;
  },
};
