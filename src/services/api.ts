import axios from 'axios';
import { toast as reactToastify } from 'react-toastify';
import type { ApiResponse } from '@/types';
import { getToken, clearAuth } from '@/utils/storage';
import { showApiErrorToast } from '@/utils/apiErrorToast';

// Vite solo expone variables que empiezan con VITE_. En Netlify la variable DEBE llamarse exactamente VITE_API_URL.
const API_URL = import.meta.env.VITE_API_URL || 'https://consul-mm.onrender.com/api';

// Diagnóstico: abrí la consola del navegador (F12 → Console). Si no ves la URL esperada, la variable no se leyó en el build (nombre o redeploy).
if (typeof window !== 'undefined') {
  console.info('[Consultorio] API base:', API_URL);
}

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

    // En login no mostramos toast aquí: solo el AuthContext muestra un único mensaje
    if (isLoginEndpoint) {
      return Promise.reject(error);
    }
    
    if (error.response?.status === 401) {
      clearAuth();
      reactToastify.error('Sesión expirada. Por favor, inicia sesión nuevamente', {
        position: 'top-right',
        autoClose: 3000,
      });
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    } else if (error.response?.status === 403) {
      showApiErrorToast('403', 'No tienes permisos para realizar esta acción');
    } else if (error.response?.status === 404) {
      const isPacienteByDni = requestUrl.includes('pacientes') && (requestUrl.includes('by-dni') || requestUrl.includes('by_dni'));
      showApiErrorToast('404', isPacienteByDni ? 'Paciente no encontrado' : 'Recurso no encontrado');
    } else if (error.response?.status === 409) {
      showApiErrorToast('409', errorMessage);
    } else if (error.response?.status >= 500) {
      showApiErrorToast('server', 'Error del servidor. Por favor, intenta más tarde');
    } else if (error.response?.status === 400) {
      // No mostrar toast para errores 400 (validación)
    } else if (error.response?.status) {
      showApiErrorToast('other', errorMessage);
    } else {
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
