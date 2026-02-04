import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import AdminPacientes from '@/pages/Pacientes/List';
import { pacientesService } from '@/services/pacientes.service';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import type { Paciente } from '@/types';

// Mock del servicio
vi.mock('@/services/pacientes.service', () => ({
  pacientesService: {
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    activate: vi.fn(),
    deactivate: vi.fn(),
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
    return permission === 'pacientes.leer';
  }),
}));

const mockPacientes: Paciente[] = [
  {
    id: '1',
    dni: '12345678',
    nombre: 'Juan',
    apellido: 'Pérez',
    telefono: '1234567890',
    email: 'juan@example.com',
    obra_social: 'OSDE',
    activo: true,
    fecha_creacion: '2024-01-01',
  },
  {
    id: '2',
    dni: '87654321',
    nombre: 'María',
    apellido: 'González',
    telefono: '0987654321',
    email: 'maria@example.com',
    obra_social: 'Swiss Medical',
    activo: false,
    fecha_creacion: '2024-01-02',
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

describe('AdminPacientes', () => {
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
    (pacientesService.getAll as any).mockResolvedValue(mockPacientes);
  });

  it('debe renderizar el título y el botón de nuevo paciente', async () => {
    renderWithProviders(<AdminPacientes />);

    expect(screen.getByText('Pacientes')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /nuevo paciente/i })).toBeInTheDocument();
  });

  it('debe mostrar la lista de pacientes', async () => {
    renderWithProviders(<AdminPacientes />);

    await waitFor(() => {
      // Buscar por DNI que es más específico
      expect(screen.getByText('12345678')).toBeInTheDocument();
      expect(screen.getByText('87654321')).toBeInTheDocument();
    });
  });

  it('debe mostrar el estado de carga', () => {
    (pacientesService.getAll as any).mockImplementation(() => new Promise(() => {}));

    renderWithProviders(<AdminPacientes />);

    expect(screen.getByText(/cargando pacientes/i)).toBeInTheDocument();
  });

  it('debe mostrar mensaje cuando no hay pacientes', async () => {
    (pacientesService.getAll as any).mockResolvedValue([]);

    renderWithProviders(<AdminPacientes />);

    await waitFor(() => {
      expect(screen.getByText(/no hay pacientes/i)).toBeInTheDocument();
    });
  });

  it('debe filtrar pacientes por búsqueda', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminPacientes />);

    await waitFor(() => {
      expect(screen.getByText('12345678')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/buscar por nombre/i);
    await user.type(searchInput, 'María');

    await waitFor(() => {
      // Verificar que el DNI de María está visible y el de Juan no
      expect(screen.getByText('87654321')).toBeInTheDocument();
      expect(screen.queryByText('12345678')).not.toBeInTheDocument();
    });
  });

  it('debe abrir el modal de crear paciente', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminPacientes />);

    const createButtons = screen.getAllByRole('button', { name: /nuevo paciente/i });
    await user.click(createButtons[0]);

    await waitFor(() => {
      // Buscar el título del modal específicamente
      expect(screen.getByRole('heading', { name: /nuevo paciente/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/dni/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/nombre/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/apellido/i)).toBeInTheDocument();
    });
  });

  it('debe crear un nuevo paciente', async () => {
    const user = userEvent.setup();
    const mockCreatedPaciente: Paciente = {
      id: '3',
      dni: '11111111',
      nombre: 'Nuevo',
      apellido: 'Paciente',
      activo: true,
    };

    (pacientesService.create as any).mockResolvedValue(mockCreatedPaciente);

    renderWithProviders(<AdminPacientes />);

    // Abrir modal
    const createButton = screen.getByRole('button', { name: /nuevo paciente/i });
    await user.click(createButton);

    await waitFor(() => {
      expect(screen.getByLabelText(/dni/i)).toBeInTheDocument();
    });

    // Llenar formulario
    await user.type(screen.getByLabelText(/dni/i), '11111111');
    await user.type(screen.getByLabelText(/nombre/i), 'Nuevo');
    await user.type(screen.getByLabelText(/apellido/i), 'Paciente');

    // Enviar
    const submitButton = screen.getByRole('button', { name: /crear paciente/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(pacientesService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          dni: '11111111',
          nombre: 'Nuevo',
          apellido: 'Paciente',
        })
      );
    });
  });

  it('debe mostrar el menú de acciones para cada paciente', async () => {
    renderWithProviders(<AdminPacientes />);

    await waitFor(() => {
      // Verificar que hay botones de menú (MoreHorizontal icons)
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(1);
    });
  });

  it('debe mostrar los badges de estado correctamente', async () => {
    renderWithProviders(<AdminPacientes />);

    await waitFor(() => {
      const badges = screen.getAllByText(/activo|inactivo/i);
      expect(badges.length).toBeGreaterThan(0);
    });
  });

  it('debe mostrar el selector de obra social', async () => {
    renderWithProviders(<AdminPacientes />);

    await waitFor(() => {
      // Verificar que el selector existe
      const selects = screen.getAllByRole('combobox');
      expect(selects.length).toBeGreaterThan(0);
    });
  });

  it('debe ocultar el botón de crear si no tiene permiso', async () => {
    const userSinPermiso = {
      ...mockUser,
      rol: 'profesional' as const,
    };
    (useAuth as any).mockReturnValue({ user: userSinPermiso });

    renderWithProviders(<AdminPacientes />);

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /nuevo paciente/i })).not.toBeInTheDocument();
    });
  });

  it('debe mostrar el DNI en la tabla', async () => {
    renderWithProviders(<AdminPacientes />);

    await waitFor(() => {
      expect(screen.getByText('12345678')).toBeInTheDocument();
      expect(screen.getByText('87654321')).toBeInTheDocument();
    });
  });

  it('debe mostrar la obra social en la tabla', async () => {
    renderWithProviders(<AdminPacientes />);

    await waitFor(() => {
      expect(screen.getByText('OSDE')).toBeInTheDocument();
      expect(screen.getByText('Swiss Medical')).toBeInTheDocument();
    });
  });
});
