import { toast } from 'react-toastify';

/** Errores de servidor / sin respuesta (timeout, Render dormido): un solo toast a la vez y sin spam cada pocos segundos */
const COOLDOWN_TRANSIENT_MS = 60000;

const TRANSIENT_TOAST_ID = 'api-error-transient';

const COOLDOWN_DEFAULT_MS = 4000;

const lastShown: Record<string, number> = {};

/**
 * Muestra un toast de error con deduplicación.
 * - Clave `server`: mismo toastId fijo + cooldown largo + no repetir si el toast sigue visible
 *   (evita bucle por retry de React Query tras timeout ~10s o muchas queries fallando).
 * - Otras claves: cooldown corto entre mensajes distintos.
 */
export function showApiErrorToast(key: string, message: string): void {
  const now = Date.now();

  if (key === 'server') {
    if (toast.isActive(TRANSIENT_TOAST_ID)) {
      return;
    }
    if (now - (lastShown.server ?? 0) < COOLDOWN_TRANSIENT_MS) {
      return;
    }
    lastShown.server = now;
    toast.error(message, {
      toastId: TRANSIENT_TOAST_ID,
      position: 'top-right',
      autoClose: 5000,
    });
    return;
  }

  if (now - (lastShown[key] ?? 0) < COOLDOWN_DEFAULT_MS) {
    return;
  }
  lastShown[key] = now;
  toast.error(message, {
    position: 'top-right',
    autoClose: 4000,
  });
}
