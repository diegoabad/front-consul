/**
 * STORAGE.UTILS.TS - Utilidades centralizadas para localStorage
 * 
 * Maneja de forma eficiente y segura el almacenamiento y recuperación
 * de datos del usuario y otros estados de la aplicación
 */

const STORAGE_KEYS = {
  TOKEN: 'token',
  USER: 'user',
  REMEMBER_ME: 'remember_me',
  LAST_ROUTE: 'last_route',
} as const;

/**
 * Obtener token del localStorage
 */
export const getToken = (): string | null => {
  try {
    return localStorage.getItem(STORAGE_KEYS.TOKEN);
  } catch (error) {
    console.error('Error al obtener token:', error);
    return null;
  }
};

/**
 * Guardar token en localStorage
 */
export const setToken = (token: string): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.TOKEN, token);
  } catch (error) {
    console.error('Error al guardar token:', error);
  }
};

/**
 * Eliminar token del localStorage
 */
export const removeToken = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
  } catch (error) {
    console.error('Error al eliminar token:', error);
  }
};

/**
 * Obtener usuario del localStorage
 */
export const getUser = <T = any>(): T | null => {
  try {
    const userStr = localStorage.getItem(STORAGE_KEYS.USER);
    if (!userStr) return null;
    return JSON.parse(userStr) as T;
  } catch (error) {
    console.error('Error al obtener usuario:', error);
    removeUser();
    return null;
  }
};

/**
 * Guardar usuario en localStorage
 */
export const setUser = <T = any>(user: T): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
  } catch (error) {
    console.error('Error al guardar usuario:', error);
  }
};

/**
 * Eliminar usuario del localStorage
 */
export const removeUser = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEYS.USER);
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
  }
};

/**
 * Limpiar toda la información de autenticación
 */
export const clearAuth = (): void => {
  removeToken();
  removeUser();
};

/**
 * Verificar si hay una sesión activa
 */
export const hasActiveSession = (): boolean => {
  return !!(getToken() && getUser());
};

/**
 * Guardar preferencia de "Recordarme"
 */
export const setRememberMe = (remember: boolean): void => {
  try {
    if (remember) {
      localStorage.setItem(STORAGE_KEYS.REMEMBER_ME, 'true');
    } else {
      localStorage.removeItem(STORAGE_KEYS.REMEMBER_ME);
    }
  } catch (error) {
    console.error('Error al guardar preferencia de recordarme:', error);
  }
};

/**
 * Obtener preferencia de "Recordarme"
 */
export const getRememberMe = (): boolean => {
  try {
    return localStorage.getItem(STORAGE_KEYS.REMEMBER_ME) === 'true';
  } catch (error) {
    return false;
  }
};

/**
 * Guardar última ruta visitada
 */
export const setLastRoute = (route: string): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.LAST_ROUTE, route);
  } catch (error) {
    console.error('Error al guardar última ruta:', error);
  }
};

/**
 * Obtener última ruta visitada
 */
export const getLastRoute = (): string | null => {
  try {
    return localStorage.getItem(STORAGE_KEYS.LAST_ROUTE);
  } catch (error) {
    return null;
  }
};

/**
 * Limpiar última ruta visitada
 */
export const clearLastRoute = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEYS.LAST_ROUTE);
  } catch (error) {
    console.error('Error al limpiar última ruta:', error);
  }
};
