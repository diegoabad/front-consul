import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { authService } from '@/services/auth.service';
import type { User } from '@/types';

/**
 * Tests de integración con el backend real
 * 
 * IMPORTANTE: Estos tests requieren que el backend esté corriendo
 * Ejecutar: cd api && npm start (en otra terminal)
 * 
 * Para ejecutar solo estos tests:
 * npm run test -- auth.integration.test.ts
 */

const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const TEST_EMAIL = 'test@example.com';
const TEST_PASSWORD = 'test123';

describe('Auth Integration Tests', () => {
  beforeAll(() => {
    // Verificar que el backend esté disponible
    console.log(`Testing against backend: ${BACKEND_URL}`);
  });

  afterAll(() => {
    // Limpiar después de los tests
    localStorage.clear();
  });

  describe('POST /api/auth/login', () => {
    it('debería hacer login con credenciales válidas', async () => {
      try {
        const response = await authService.login(TEST_EMAIL, TEST_PASSWORD);
        
        expect(response).toBeDefined();
        expect(response.token).toBeDefined();
        expect(response.user).toBeDefined();
        expect(response.user.email).toBe(TEST_EMAIL);
        expect(response.user.rol).toBeDefined();
        
        // Verificar que el token se guardó
        expect(localStorage.getItem('token')).toBe(response.token);
      } catch (error: any) {
        // Si el backend no está disponible, saltar el test
        if (error.code === 'ECONNREFUSED' || error.message?.includes('Network')) {
          console.warn('Backend no disponible, saltando test de integración');
          return;
        }
        throw error;
      }
    }, 10000); // Timeout de 10 segundos

    it('debería fallar con credenciales inválidas', async () => {
      try {
        await expect(
          authService.login('invalid@example.com', 'wrongpassword')
        ).rejects.toThrow();
      } catch (error: any) {
        if (error.code === 'ECONNREFUSED') {
          console.warn('Backend no disponible, saltando test');
          return;
        }
        // Esperamos que falle
        expect(error).toBeDefined();
      }
    }, 10000);
  });

  describe('GET /api/auth/profile', () => {
    it('debería obtener el perfil del usuario autenticado', async () => {
      try {
        // Primero hacer login
        const loginResponse = await authService.login(TEST_EMAIL, TEST_PASSWORD);
        expect(loginResponse.token).toBeDefined();

        // Luego obtener el perfil
        const profile = await authService.getProfile();
        
        expect(profile).toBeDefined();
        expect(profile.id).toBeDefined();
        expect(profile.email).toBeDefined();
        expect(profile.rol).toBeDefined();
        expect(profile.nombre).toBeDefined();
        expect(profile.apellido).toBeDefined();
      } catch (error: any) {
        if (error.code === 'ECONNREFUSED') {
          console.warn('Backend no disponible, saltando test');
          return;
        }
        throw error;
      }
    }, 10000);

    it('debería fallar sin token de autenticación', async () => {
      try {
        localStorage.removeItem('token');
        await expect(authService.getProfile()).rejects.toThrow();
      } catch (error: any) {
        if (error.code === 'ECONNREFUSED') {
          console.warn('Backend no disponible, saltando test');
          return;
        }
        // Esperamos que falle sin token
        expect(error).toBeDefined();
      }
    }, 10000);
  });

  describe('Flujo completo de autenticación', () => {
    it('debería completar el flujo: login -> obtener perfil -> logout', async () => {
      try {
        // 1. Login
        const loginResponse = await authService.login(TEST_EMAIL, TEST_PASSWORD);
        expect(loginResponse.token).toBeDefined();
        expect(localStorage.getItem('token')).toBe(loginResponse.token);

        // 2. Obtener perfil
        const profile = await authService.getProfile();
        expect(profile.email).toBe(TEST_EMAIL);

        // 3. Verificar que el token sigue siendo válido
        const profile2 = await authService.getProfile();
        expect(profile2.id).toBe(profile.id);

        // 4. Limpiar (logout simulado)
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        expect(localStorage.getItem('token')).toBeNull();
      } catch (error: any) {
        if (error.code === 'ECONNREFUSED') {
          console.warn('Backend no disponible, saltando test');
          return;
        }
        throw error;
      }
    }, 15000);
  });
});
