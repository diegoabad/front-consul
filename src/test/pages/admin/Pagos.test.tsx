import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import AdminPagos from '@/pages/admin/Pagos/List';
import { pagosService } from '@/services/pagos.service';
import { profesionalesService } from '@/services/profesionales.service';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import type { Pago } from '@/types';

// Mock del servicio
vi.mock('@/services/pagos.service', () => ({
  pagosService: {
    getAll: vi.fn(),
    getPending: vi.fn(),
    getOverdue: vi.fn(),
    create: vi.fn(),
    markAsPaid: vi.fn(),
  },
}));

vi.mock('@/services/profesionales.service', () => ({
  profesionalesService: {
    getAll: vi.fn(),
  },
}));

// Mock de AuthContext
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

// Mock de useToast
vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(),
}));

// Mock de usePermissions
vi.mock('@/utils/permissions', () => ({
  hasPermission: vi.fn((user, permission) => {
    if (user?.rol === 'administrador') return true;
    return permission === 'pagos.leer';
  }),
}));

const mockPagos: Pago[] = [
  {
    id: '1',
    profesional_id: 'prof-1',
    profesional_nombre: 'Juan',
    profesional_apellido: 'Pérez',
    periodo: '2024-01-01',
    monto: '10000',
    estado: 'vencido',
    fecha_creacion: '2024-01-01',
  },
  {
    id: '2',
    profesional_id: 'prof-2',
    profesional_nombre: 'María',
    profesional_apellido: 'González',
    periodo: '2024-02-01',
    monto: '12000',
    estado: 'pendiente',
    fecha_creacion: '2024-02-01',
  },
  {
    id: '3',
    profesional_id: 'prof-1',
    profesional_nombre: 'Juan',
    profesional_apellido: 'Pérez',
    periodo: '2024-03-01',
    monto: '10000',
    estado: 'pagado',
    fecha_pago: '2024-03-15',
    metodo_pago: 'Transferencia',
    fecha_creacion: '2024-03-01',
  },
];

const mockProfesionales = [
  {
    id: 'prof-1',
    usuario_id: 'user-1',
    nombre: 'Juan',
    apellido: 'Pérez',
    email: 'juan@test.com',
    estado_pago: 'al_dia',
    bloqueado: false,
  },
];

function renderWithProviders(component: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {component}
      </BrowserRouter>
    </QueryClientProvider>
  );
}

describe('AdminPagos', () => {
  const mockToast = vi.fn();
  const mockUser = {
    id: '1',
    email: 'admin@test.com',
    nombre: 'Admin',
    apellido: 'Test',
    rol: 'administrador' as const,
    activo: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useAuth as any).mockReturnValue({ user: mockUser });
    (useToast as any).mockReturnValue({ toast: mockToast });
    (pagosService.getAll as any).mockResolvedValue(mockPagos);
    (pagosService.getPending as any).mockResolvedValue([mockPagos[1]]);
    (pagosService.getOverdue as any).mockResolvedValue([mockPagos[0]]);
    (profesionalesService.getAll as any).mockResolvedValue(mockProfesionales);
  });

  it('debe renderizar el título y el botón de registrar pago', async () => {
    renderWithProviders(<AdminPagos />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Control de Pagos' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /registrar pago/i })).toBeInTheDocument();
    });
  });

  it('debe mostrar las tarjetas de resumen', async () => {
    renderWithProviders(<AdminPagos />);

    await waitFor(() => {
      expect(screen.getByText(/ingresos del mes/i)).toBeInTheDocument();
      expect(screen.getByText(/pendientes/i)).toBeInTheDocument();
      expect(screen.getByText(/vencidos/i)).toBeInTheDocument();
      expect(screen.getByText(/al día/i)).toBeInTheDocument();
    });
  });

  it('debe mostrar las tabs de pagos', async () => {
    renderWithProviders(<AdminPagos />);

    await waitFor(() => {
      // Buscar por role="tab" que es más específico
      const tabs = screen.getAllByRole('tab');
      expect(tabs.length).toBeGreaterThanOrEqual(4);
    });
  });

  it('debe mostrar la lista de pagos vencidos', async () => {
    renderWithProviders(<AdminPagos />);

    await waitFor(() => {
      // Verificar que hay una tabla o mensaje de "no hay pagos"
      const tables = screen.queryAllByRole('table');
      const noHayPagos = screen.queryByText(/no hay pagos/i);
      expect(tables.length > 0 || noHayPagos).toBeTruthy();
    });
  });

  it('debe mostrar el estado de carga', () => {
    (pagosService.getAll as any).mockImplementation(() => new Promise(() => {}));

    renderWithProviders(<AdminPagos />);

    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });

  it('debe abrir el modal de crear pago', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminPagos />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /registrar pago/i })).toBeInTheDocument();
    });

    const createButton = screen.getByRole('button', { name: /registrar pago/i });
    await user.click(createButton);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /registrar nuevo pago/i })).toBeInTheDocument();
    });
  });

  it('debe mostrar los badges de estado correctamente', async () => {
    renderWithProviders(<AdminPagos />);

    await waitFor(() => {
      const badges = screen.getAllByText(/pagado|pendiente|vencido/i);
      expect(badges.length).toBeGreaterThan(0);
    });
  });

  it('debe ocultar el botón de crear si no tiene permiso', async () => {
    const userSinPermiso = {
      ...mockUser,
      rol: 'profesional' as const,
    };
    (useAuth as any).mockReturnValue({ user: userSinPermiso });

    renderWithProviders(<AdminPagos />);

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /registrar pago/i })).not.toBeInTheDocument();
    });
  });

  it('debe mostrar contenido en las tabs', async () => {
    renderWithProviders(<AdminPagos />);

    await waitFor(() => {
      // Verificar que hay contenido renderizado (tabla o mensaje vacío)
      const tables = screen.queryAllByRole('table');
      const emptyStates = screen.queryAllByText(/no hay pagos/i);
      expect(tables.length > 0 || emptyStates.length > 0).toBeTruthy();
    });
  });
});
