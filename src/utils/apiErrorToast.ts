import { toast as reactToastify } from 'react-toastify';

const COOLDOWN_MS = 4000;

const lastShown: Record<string, number> = {};

/**
 * Muestra un toast de error solo si no se mostró uno del mismo tipo en los últimos COOLDOWN_MS.
 * Evita múltiples toasts cuando varias peticiones fallan a la vez (ej. backend dormido en Render).
 */
export function showApiErrorToast(key: string, message: string): void {
  const now = Date.now();
  if (now - (lastShown[key] ?? 0) < COOLDOWN_MS) {
    return;
  }
  lastShown[key] = now;
  reactToastify.error(message, {
    position: 'top-right',
    autoClose: 4000,
  });
}
