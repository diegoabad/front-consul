import { http, HttpResponse } from 'msw';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const handlers = [
  // Login success
  http.post(`${API_URL}/auth/login`, async ({ request }) => {
    const body = await request.json() as { email: string; password: string };
    
    // Mock successful login
    if (body.email && body.password) {
      return HttpResponse.json({
        success: true,
        data: {
          token: 'mock-jwt-token-123',
          user: {
            id: '1',
            email: body.email,
            rol: body.email.includes('admin') ? 'administrador' : 
                 body.email.includes('profesional') ? 'profesional' : 'secretaria',
          },
        },
        message: 'Login exitoso',
      });
    }
    
    return HttpResponse.json(
      {
        success: false,
        message: 'Credenciales inválidas',
      },
      { status: 401 }
    );
  }),

  // Get profile
  http.get(`${API_URL}/auth/profile`, () => {
    return HttpResponse.json({
      success: true,
      data: {
        id: '1',
        email: 'test@example.com',
        nombre: 'Test',
        apellido: 'User',
        telefono: '1234567890',
        rol: 'administrador',
        activo: true,
      },
    });
  }),

  // Login failure
  http.post(`${API_URL}/auth/login`, async ({ request }) => {
    const body = await request.json() as { email: string; password: string };
    
    if (body.email === 'invalid@example.com') {
      return HttpResponse.json(
        {
          success: false,
          message: 'Credenciales inválidas',
        },
        { status: 401 }
      );
    }
  }),
];
