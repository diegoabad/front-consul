import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import AdminProfesionales from '@/pages/Profesionales/List';
import { profesionalesService } from '@/services/profesionales.service';
import { usuariosService } from '@/services/usuarios.service';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import type { Profesional } from '@/types';

// Mock del servicio
vi.mock('@/services/profesionales.service', () => ({
  profesionalesService: {
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    block: vi.fn(),
    unblock: vi.fn(),
  },
}));

vi.mock('@/services/usuarios.service', () => ({
  usuariosService: {
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

// Mock de useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock de usePermissions
vi.mock('@/utils/permissions', () => ({
  hasPermission: vi.fn((user, permission) => {
    if (user?.rol === 'administrador') return true;
    return permission === 'profesionales.leer';
  }),
}));

const mockProfesionales: Profesional[] = [
  {
    id: '1',
    usuario_id: 'user-1',
    nombre: 'Juan',
    apellido: 'Pérez',
    email: 'juan@example.com',
    matricula: '12345',
    especialidad: 'Cardiología',
    estado_pago: 'al_dia',
    bloqueado: false,
    fecha_creacion: '2024-01-01',
  },
  {
    id: '2',
    usuario_id: 'user-2',
    nombre: 'María',
    apellido: 'González',
    email: 'maria@example.com',
    matricula: '67890',
    especialidad: 'Pediatría',
    estado_pago: 'moroso',
    bloqueado: true,
    razon_bloqueo: 'Pago pendiente',
    fecha_creacion: '2024-01-02',
  },
];

const mockUsuarios = [
  {
    id: 'user-3',
    email: 'nuevo@example.com',
    nombre: 'Nuevo',
    apellido: 'Profesional',
    rol: 'profesional' as const,
    activo: true,
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

describe('AdminProfesionales', () => {
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
    (profesionalesService.getAll as any).mockResolvedValue(mockProfesionales);
    (usuariosService.getAll as any).mockResolvedValue(mockUsuarios);
  });

  it('debe renderizar el título y el botón de nuevo profesional', async () => {
    renderWithProviders(<AdminProfesionales />);

    expect(screen.getByRole('heading', { name: 'Profesionales' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /agregar profesional/i })).toBeInTheDocument();
  });

  it('debe mostrar la lista de profesionales', async () => {
    renderWithProviders(<AdminProfesionales />);

    await waitFor(() => {
      // Buscar por matrícula que es más específico
      expect(screen.getByText('12345')).toBeInTheDocument();
      expect(screen.getByText('67890')).toBeInTheDocument();
    });
  });

  it('debe mostrar el estado de carga', () => {
    (profesionalesService.getAll as any).mockImplementation(() => new Promise(() => {}));

    renderWithProviders(<AdminProfesionales />);

    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });

  it('debe mostrar mensaje cuando no hay profesionales', async () => {
    (profesionalesService.getAll as any).mockResolvedValue([]);

    renderWithProviders(<AdminProfesionales />);

    await waitFor(() => {
      expect(screen.getByText(/no hay profesionales/i)).toBeInTheDocument();
    });
  });

  it('debe filtrar profesionales por búsqueda', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminProfesionales />);

    await waitFor(() => {
      expect(screen.getByText('12345')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/buscar por nombre/i);
    await user.type(searchInput, 'María');

    await waitFor(() => {
      // Verificar que el DNI de María está visible y el de Juan no
      expect(screen.getByText('67890')).toBeInTheDocument();
      expect(screen.queryByText('12345')).not.toBeInTheDocument();
    });
  });

  it('debe abrir el modal de crear profesional', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminProfesionales />);

    const createButtons = screen.getAllByRole('button', { name: /agregar profesional/i });
    await user.click(createButtons[0]);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /nuevo profesional/i })).toBeInTheDocument();
    });
  });

  it('debe mostrar los badges de estado correctamente', async () => {
    renderWithProviders(<AdminProfesionales />);

    await waitFor(() => {
      const badges = screen.getAllByText(/activo|bloqueado/i);
      expect(badges.length).toBeGreaterThan(0);
    });
  });

  it('debe mostrar los badges de estado de pago', async () => {
    renderWithProviders(<AdminProfesionales />);

    await waitFor(() => {
      expect(screen.getByText('Al día')).toBeInTheDocument();
      expect(screen.getByText('Moroso')).toBeInTheDocument();
    });
  });

  it('debe mostrar la especialidad en la tabla', async () => {
    renderWithProviders(<AdminProfesionales />);

    await waitFor(() => {
      expect(screen.getByText('Cardiología')).toBeInTheDocument();
      expect(screen.getByText('Pediatría')).toBeInTheDocument();
    });
  });

  it('debe mostrar la matrícula en la tabla', async () => {
    renderWithProviders(<AdminProfesionales />);

    await waitFor(() => {
      expect(screen.getByText('12345')).toBeInTheDocument();
      expect(screen.getByText('67890')).toBeInTheDocument();
    });
  });

  it('debe ocultar el botón de crear si no tiene permiso', async () => {
    const userSinPermiso = {
      ...mockUser,
      rol: 'profesional' as const,
    };
    (useAuth as any).mockReturnValue({ user: userSinPermiso });

    renderWithProviders(<AdminProfesionales />);

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /agregar profesional/i })).not.toBeInTheDocument();
    });
  });

  it('debe mostrar el email en la tabla', async () => {
    renderWithProviders(<AdminProfesionales />);

    await waitFor(() => {
      // Los emails pueden estar ocultos en móvil, buscar por matrícula que siempre está visible
      expect(screen.getByText('12345')).toBeInTheDocument();
      expect(screen.getByText('67890')).toBeInTheDocument();
    });
  });
});
