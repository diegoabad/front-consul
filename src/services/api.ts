import axios from 'axios';
import { toast as reactToastify } from 'react-toastify';
import type { ApiResponse } from '@/types';
import { getToken, clearAuth } from '@/utils/storage';
import { showApiErrorToast } from '@/utils/apiErrorToast';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para agregar token
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor para manejar errores y mostrar toasts
api.interceptors.response.use(
  (response) => {
    // No mostrar toasts automáticamente en respuestas exitosas
    // Los toasts de éxito se manejan explícitamente en las mutaciones
    return response;
  },
  (error) => {
    // Manejar errores y mostrar toast
    const errorMessage = error.response?.data?.message || error.message || 'Error en la solicitud';
    const requestUrl = error.config?.url || '';
    const isLoginEndpoint = requestUrl.includes('/auth/login');
    
    if (error.response?.status === 401) {
      // No mostrar toast de "Sesión expirada" en el login
      // El AuthContext ya maneja el mensaje de error para credenciales incorrectas
      if (!isLoginEndpoint) {
        clearAuth();
        reactToastify.error('Sesión expirada. Por favor, inicia sesión nuevamente', {
          position: 'top-right',
          autoClose: 3000,
        });
        // Usar window.location solo si no estamos ya en login
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
      // Si es el endpoint de login, no hacer nada aquí, dejar que AuthContext maneje el error
    } else if (error.response?.status === 403) {
      showApiErrorToast('403', 'No tienes permisos para realizar esta acción');
    } else if (error.response?.status === 404) {
      showApiErrorToast('404', 'Recurso no encontrado');
    } else if (error.response?.status >= 500) {
      showApiErrorToast('server', 'Error del servidor. Por favor, intenta más tarde');
    } else if (error.response?.status === 400) {
      // No mostrar toast para errores 400 (validación)
      // Los componentes manejan estos errores con mensajes más descriptivos
    } else if (error.response?.status) {
      showApiErrorToast('other', errorMessage);
    } else {
      // Error de red / timeout / servidor no responde (ej. backend dormido)
      showApiErrorToast('server', 'Error de conexión. Verifica tu conexión o intenta en unos segundos.');
    }
    
    return Promise.reject(error);
  }
);

export default api;

// Helper para obtener data de la respuesta
export const getData = <T>(response: { data: ApiResponse<T> }): T | null => {
  return response.data.success ? response.data.data || null : null;
};
