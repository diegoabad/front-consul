import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import Login from '@/pages/Login';
import { AuthProvider } from '@/contexts/AuthContext';
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

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function renderLogin() {
  return render(
    <BrowserRouter>
      <AuthProvider>
        <Login />
      </AuthProvider>
    </BrowserRouter>
  );
}

describe('Login Page', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mockNavigate.mockClear();
  });

  it('debería renderizar el formulario de login', () => {
    renderLogin();

    expect(screen.getByText('Cogniare')).toBeInTheDocument();
    expect(screen.getByLabelText('Correo electrónico')).toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ingresar/i })).toBeInTheDocument();
  });

  it('debería validar campos requeridos', async () => {
    const user = userEvent.setup();
    renderLogin();

    const submitButton = screen.getByRole('button', { name: /ingresar/i });
    await user.click(submitButton);

    // El navegador mostrará el mensaje de validación HTML5
    const emailInput = screen.getByLabelText('Correo electrónico') as HTMLInputElement;
    expect(emailInput.validity.valueMissing).toBe(true);
  });

  it('debería hacer login exitosamente', async () => {
    const user = userEvent.setup();
    const mockLoginResponse: LoginResponse = {
      token: 'test-token',
      user: {
        id: '1',
        email: 'admin@example.com',
        rol: 'administrador',
      },
    };

    const mockProfile: User = {
      id: '1',
      email: 'admin@example.com',
      nombre: 'Admin',
      apellido: 'User',
      rol: 'administrador',
      activo: true,
    };

    (authService.login as any).mockResolvedValue(mockLoginResponse);
    (authService.getProfile as any).mockResolvedValue(mockProfile);

    renderLogin();

    const emailInput = screen.getByLabelText('Correo electrónico');
    const passwordInput = screen.getByLabelText('Contraseña');
    const submitButton = screen.getByRole('button', { name: /ingresar/i });

    await user.type(emailInput, 'admin@example.com');
    await user.type(passwordInput, 'password123');
    await user.click(submitButton);

    await waitFor(() => {
      expect(authService.login).toHaveBeenCalledWith('admin@example.com', 'password123');
      expect(localStorage.getItem('token')).toBe('test-token');
    });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('debería redirigir según el rol del usuario', async () => {
    const user = userEvent.setup();
    
    // Test para secretaria
    const secretariaResponse: LoginResponse = {
      token: 'test-token',
      user: {
        id: '2',
        email: 'secretaria@example.com',
        rol: 'secretaria',
      },
    };

    (authService.login as any).mockResolvedValue(secretariaResponse);
    (authService.getProfile as any).mockResolvedValue({
      id: '2',
      email: 'secretaria@example.com',
      nombre: 'Secretaria',
      apellido: 'User',
      rol: 'secretaria',
      activo: true,
    });

    renderLogin();

    await user.type(screen.getByLabelText('Correo electrónico'), 'secretaria@example.com');
    await user.type(screen.getByLabelText('Contraseña'), 'password');
    await user.click(screen.getByRole('button', { name: /ingresar/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('debería mostrar/ocultar contraseña', async () => {
    const user = userEvent.setup();
    renderLogin();

    const passwordInput = screen.getByLabelText('Contraseña') as HTMLInputElement;
    const toggleButton = passwordInput.parentElement?.querySelector('button');

    expect(passwordInput.type).toBe('password');

    if (toggleButton) {
      await user.click(toggleButton);
      expect(passwordInput.type).toBe('text');

      await user.click(toggleButton);
      expect(passwordInput.type).toBe('password');
    }
  });

  it('debería manejar errores de login', async () => {
    const user = userEvent.setup();
    (authService.login as any).mockRejectedValue({
      response: {
        data: {
          message: 'Credenciales inválidas',
        },
      },
    });

    renderLogin();

    await user.type(screen.getByLabelText('Correo electrónico'), 'wrong@example.com');
    await user.type(screen.getByLabelText('Contraseña'), 'wrong');
    await user.click(screen.getByRole('button', { name: /ingresar/i }));

    await waitFor(() => {
      expect(authService.login).toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });
});
