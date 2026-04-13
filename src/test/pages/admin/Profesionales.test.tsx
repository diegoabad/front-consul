import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import AdminUsuarios from '@/pages/Usuarios/List';
import { usuariosService } from '@/services/usuarios.service';
import { useAuth } from '@/contexts/AuthContext';

vi.mock('@/services/profesionales.service', () => ({
  profesionalesService: {
    getByUsuarioId: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}));

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

vi.mock('@/services/especialidades.service', () => ({
  especialidadesService: { getAll: vi.fn().mockResolvedValue([]) },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/utils/permissions', () => ({
  hasPermission: vi.fn((user) => user?.rol === 'administrador'),
}));

function renderWithProviders(component: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{component}</BrowserRouter>
    </QueryClientProvider>
  );
}

describe('AdminUsuarios (lista unificada)', () => {
  const mockAdmin = {
    id: '1',
    email: 'admin@test.com',
    nombre: 'Admin',
    apellido: 'Test',
    rol: 'administrador' as const,
    activo: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useAuth as any).mockReturnValue({ user: mockAdmin });
    (usuariosService.getAll as any).mockResolvedValue({
      data: [
        {
          id: 'u1',
          email: 'prof@test.com',
          nombre: 'Ana',
          apellido: 'López',
          rol: 'profesional',
          activo: true,
          profesional_id: 'p1',
          recordatorio_whatsapp_permitido_admin: true,
        },
      ],
      total: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
    });
  });

  it('muestra título Usuarios del Sistema y columna WhatsApp', async () => {
    renderWithProviders(<AdminUsuarios />);

    expect(screen.getByRole('heading', { name: 'Usuarios del Sistema' })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/Ana\s+López/i)).toBeInTheDocument();
    });
    expect(screen.getByText('WhatsApp')).toBeInTheDocument();
  });

  it('para secretaría no muestra el control WhatsApp (solo admin)', async () => {
    (useAuth as any).mockReturnValue({
      user: { ...mockAdmin, rol: 'secretaria' as const },
    });

    renderWithProviders(<AdminUsuarios />);

    await waitFor(() => {
      expect(screen.getByText(/Ana\s+López/i)).toBeInTheDocument();
    });

    const waButtons = screen.queryAllByRole('button', {
      name: /recordatorios por WhatsApp/i,
    });
    expect(waButtons.length).toBe(0);
  });
});
