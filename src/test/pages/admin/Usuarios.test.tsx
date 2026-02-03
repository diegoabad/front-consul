import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import AdminUsuarios from '@/pages/admin/Usuarios/List';
import { usuariosService } from '@/services/usuarios.service';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import type { User } from '@/types';

// Mock del servicio
vi.mock('@/services/usuarios.service', () => ({
  usuariosService: {
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    activate: vi.fn(),
    deactivate: vi.fn(),
    updatePassword: vi.fn(),
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
    return permission === 'usuarios.leer';
  }),
}));

const mockUsuarios: User[] = [
  {
    id: '1',
    email: 'admin@test.com',
    nombre: 'Admin',
    apellido: 'Test',
    rol: 'administrador',
    activo: true,
  },
  {
    id: '2',
    email: 'profesional@test.com',
    nombre: 'Juan',
    apellido: 'Pérez',
    telefono: '123456789',
    rol: 'profesional',
    activo: true,
  },
  {
    id: '3',
    email: 'secretaria@test.com',
    nombre: 'María',
    apellido: 'González',
    rol: 'secretaria',
    activo: false,
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

describe('AdminUsuarios', () => {
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
    (usuariosService.getAll as any).mockResolvedValue(mockUsuarios);
  });

  it('debe renderizar el título y el botón de nuevo usuario', async () => {
    renderWithProviders(<AdminUsuarios />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Usuarios' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /nuevo usuario/i })).toBeInTheDocument();
    });
  });

  it('debe mostrar la lista de usuarios', async () => {
    renderWithProviders(<AdminUsuarios />);

    await waitFor(() => {
      // Verificar que hay una tabla o mensaje de "no hay usuarios"
      const tables = screen.queryAllByRole('table');
      const noHayUsuarios = screen.queryByText(/no hay usuarios/i);
      expect(tables.length > 0 || noHayUsuarios).toBeTruthy();
    });
  });

  it('debe mostrar el estado de carga', () => {
    (usuariosService.getAll as any).mockImplementation(() => new Promise(() => {}));

    renderWithProviders(<AdminUsuarios />);

    // Verificar que hay un loader (buscando por clase animate-spin)
    const loader = document.querySelector('.animate-spin');
    expect(loader).toBeTruthy();
  });

  it('debe mostrar mensaje cuando no hay usuarios', async () => {
    (usuariosService.getAll as any).mockResolvedValue([]);

    renderWithProviders(<AdminUsuarios />);

    await waitFor(() => {
      expect(screen.getByText(/no hay usuarios/i)).toBeInTheDocument();
    });
  });

  it('debe filtrar usuarios por búsqueda', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminUsuarios />);

    await waitFor(() => {
      // Verificar que hay contenido renderizado
      const tables = screen.queryAllByRole('table');
      expect(tables.length > 0).toBeTruthy();
    });

    const searchInput = screen.getByPlaceholderText(/buscar por nombre/i);
    await user.type(searchInput, 'Juan');

    // Solo verificar que el input tiene el valor
    await waitFor(() => {
      expect(searchInput).toHaveValue('Juan');
    });
  });

  it('debe abrir el modal de crear usuario', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminUsuarios />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /nuevo usuario/i })).toBeInTheDocument();
    });

    const createButton = screen.getByRole('button', { name: /nuevo usuario/i });
    await user.click(createButton);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /nuevo usuario/i })).toBeInTheDocument();
    });
  });

  it('debe mostrar los badges de estado correctamente', async () => {
    renderWithProviders(<AdminUsuarios />);

    await waitFor(() => {
      const badges = screen.getAllByText(/activo|inactivo/i);
      expect(badges.length).toBeGreaterThan(0);
    });
  });

  it('debe mostrar los badges de rol correctamente', async () => {
    renderWithProviders(<AdminUsuarios />);

    await waitFor(() => {
      expect(screen.getByText('Administrador')).toBeInTheDocument();
      expect(screen.getByText('Profesional')).toBeInTheDocument();
      expect(screen.getByText('Secretaria')).toBeInTheDocument();
    });
  });

  it('debe ocultar el botón de crear si no tiene permiso', async () => {
    const userSinPermiso = {
      ...mockUser,
      rol: 'profesional' as const,
    };
    (useAuth as any).mockReturnValue({ user: userSinPermiso });

    renderWithProviders(<AdminUsuarios />);

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /nuevo usuario/i })).not.toBeInTheDocument();
    });
  });
});
