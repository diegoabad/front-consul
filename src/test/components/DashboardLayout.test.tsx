import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { AuthProvider } from '@/contexts/AuthContext';
import * as authService from '@/services/auth.service';

// Mock del auth service
vi.mock('@/services/auth.service', () => ({
  authService: {
    getProfile: vi.fn(),
  },
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

describe('DashboardLayout', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('debe redirigir a login si no está autenticado', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <DashboardLayout>
              <div>Test Content</div>
            </DashboardLayout>
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });
  });

  it('debe mostrar el layout cuando el usuario está autenticado', async () => {
    const mockUser = {
      id: '1',
      email: 'admin@test.com',
      nombre: 'Admin',
      apellido: 'Test',
      rol: 'administrador' as const,
      activo: true,
    };

    localStorage.setItem('token', 'test-token');
    localStorage.setItem('user', JSON.stringify(mockUser));

    vi.mocked(authService.authService.getProfile).mockResolvedValue(mockUser);

    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <DashboardLayout>
              <div>Test Content</div>
            </DashboardLayout>
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Test Content')).toBeInTheDocument();
    });
  });

  it('muestra contenido para cualquier rol (layout unificado)', async () => {
    const mockUser = {
      id: '1',
      email: 'profesional@test.com',
      nombre: 'Profesional',
      apellido: 'Test',
      rol: 'profesional' as const,
      activo: true,
    };

    localStorage.setItem('token', 'test-token');
    localStorage.setItem('user', JSON.stringify(mockUser));

    vi.mocked(authService.authService.getProfile).mockResolvedValue(mockUser);

    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <DashboardLayout>
              <div>Test Content</div>
            </DashboardLayout>
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Test Content')).toBeInTheDocument();
    });
  });
});
