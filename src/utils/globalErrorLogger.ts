/**
 * Captura errores globales (window.onerror, unhandledrejection) y los envía al API de logs
 * con el stack trace para que aparezcan en la pestaña Detalle del modal de logs.
 */
import { getToken, getUser } from '@/utils/storage';

import { getApiBaseUrl } from '@/lib/api-base-url';

const API_URL = getApiBaseUrl();

function sendToLogs(payload: {
  mensaje: string;
  stack?: string | null;
  pantalla?: string | null;
  accion?: string | null;
}) {
  try {
    const user = getUser<{ id?: number; rol?: string }>();
    const body = {
      origen: 'front',
      usuario_id: user?.id ?? null,
      rol: user?.rol ?? null,
      pantalla: payload.pantalla ?? (typeof window !== 'undefined' ? window.location.pathname : ''),
      accion: payload.accion ?? 'error_global',
      mensaje: payload.mensaje,
      stack: payload.stack ?? null,
    };
    fetch(`${API_URL}/logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      },
      body: JSON.stringify(body),
    }).catch(() => {});
  } catch (_) {}
}

export function setupGlobalErrorLogger() {
  window.onerror = (message, source, lineno, colno, error) => {
    const mensaje = typeof message === 'string' ? message : String(message);
    const stackParts: string[] = [];
    if (error?.stack) {
      stackParts.push(`--- Stack trace ---\n${error.stack}`);
    }
    stackParts.push(`--- Ubicación ---\n${source || '?'}:${lineno ?? '?'}:${colno ?? '?'}`);
    const stack = stackParts.join('\n\n') || `${source}:${lineno}:${colno}`;
    sendToLogs({
      mensaje: mensaje || 'Error no capturado',
      stack: stack || `${source}:${lineno}:${colno}`,
      accion: 'window.onerror',
    });
    return false; // permitir que el error siga su curso
  };

  window.addEventListener('unhandledrejection', (event) => {
    const err = event.reason;
    const mensaje = err?.message ?? (typeof err === 'string' ? err : 'Promise rechazada');
    const stackParts: string[] = [];
    if (err?.stack) {
      stackParts.push(`--- Stack trace ---\n${err.stack}`);
    }
    if (err && typeof err === 'object' && !err.stack) {
      stackParts.push(`--- Detalle ---\n${JSON.stringify(err, null, 2)}`);
    }
    const stack = stackParts.length > 0 ? stackParts.join('\n\n') : null;
    sendToLogs({
      mensaje,
      stack,
      accion: 'unhandledrejection',
    });
  });
}
