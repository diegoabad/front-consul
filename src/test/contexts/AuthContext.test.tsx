import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { authService } from '@/services/auth.service';
import type { LoginResponse, User } from '@/types';

// Mock authService
vi.mock('@/services/auth.service', () => ({
  authService: {
    login: vi.fn(),
    getProfile: vi.fn(),
  },
}));

// Mock useToast
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

// Test component
function TestComponent() {
  const { user, isAuthenticated, login, logout } = useAuth();

  return (
    <div>
      <div data-testid="user">{user ? user.email : 'No user'}</div>
      <div data-testid="authenticated">{isAuthenticated ? 'true' : 'false'}</div>
      <button onClick={() => login('test@example.com', 'password')}>
        Login
      </button>
      <button onClick={logout}>Logout</button>
    </div>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('debería inicializar sin usuario', () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    expect(screen.getByTestId('user')).toHaveTextContent('No user');
    expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
  });

  it('debería cargar usuario del localStorage', async () => {
    const mockUser: User = {
      id: '1',
      email: 'saved@example.com',
      nombre: 'Saved',
      apellido: 'User',
      rol: 'administrador',
      activo: true,
    };

    localStorage.setItem('token', 'saved-token');
    localStorage.setItem('user', JSON.stringify(mockUser));

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('saved@example.com');
      expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
    });
  });

  it('debería hacer login exitosamente', async () => {
    const user = userEvent.setup();
    const mockLoginResponse: LoginResponse = {
      token: 'test-token',
      user: {
        id: '1',
        email: 'test@example.com',
        rol: 'administrador',
      },
    };

    const mockProfile: User = {
      id: '1',
      email: 'test@example.com',
      nombre: 'Test',
      apellido: 'User',
      rol: 'administrador',
      activo: true,
    };

    (authService.login as any).mockResolvedValue(mockLoginResponse);
    (authService.getProfile as any).mockResolvedValue(mockProfile);

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    const loginButton = screen.getByText('Login');
    await user.click(loginButton);

    await waitFor(() => {
      expect(authService.login).toHaveBeenCalledWith('test@example.com', 'password');
      expect(localStorage.getItem('token')).toBe('test-token');
    });
  });

  it('debería hacer logout correctamente', async () => {
    const user = userEvent.setup();
    const mockUser: User = {
      id: '1',
      email: 'test@example.com',
      nombre: 'Test',
      apellido: 'User',
      rol: 'administrador',
      activo: true,
    };

    localStorage.setItem('token', 'test-token');
    localStorage.setItem('user', JSON.stringify(mockUser));

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
    });

    const logoutButton = screen.getByText('Logout');
    await user.click(logoutButton);

    await waitFor(() => {
      expect(localStorage.getItem('token')).toBeNull();
      expect(localStorage.getItem('user')).toBeNull();
      expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
    });
  });
});
