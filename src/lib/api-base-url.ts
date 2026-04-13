/**
 * Base URL de axios: siempre el origen del API + `/api`. Las rutas en servicios son `/auth/login`, etc.,
 * así que la URL final queda `…/api/auth/login` (coincide con `app.use('/api', routes)` en el backend).
 *
 * Un **404 en OPTIONS** en el navegador casi siempre significa que esa URL no existe en el servidor
 * que recibió la petición (host mal en `VITE_API_URL`, o tráfico al sitio estático sin proxy), no un fallo
 * “de CORS” en sí.
 *
 * `VITE_API_URL` en Netlify / build:
 * - Recomendado: solo el origen de Render, **sin** barra final y **sin** `/api`
 *   (ej. `https://tu-servicio.onrender.com`). Aquí se normaliza a `…/api`.
 * - También válido: `https://tu-servicio.onrender.com/api` (se respeta).
 * - Vacío en el navegador: `window.location.origin + /api` (Netlify: proxy en `netlify.toml` → Render).
 * - Ruta absoluta en el mismo sitio: `/api` → `origin + /api`.
 */
export function getApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_URL as string | undefined;
  const trimmed = typeof raw === 'string' ? raw.trim() : '';

  if (!trimmed) {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/api`;
    }
    return 'http://localhost:5000/api';
  }

  if (trimmed.startsWith('/')) {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}${trimmed}`;
    }
    return `http://localhost:3000${trimmed}`;
  }

  const u = trimmed.replace(/\/+$/, '');
  if (/\/api(\/|$)/.test(u)) return u;
  return `${u}/api`;
}
