/**
 * Base URL del backend para axios. Debe incluir el prefijo `/api` donde están montadas las rutas.
 * Si en Netlify/Render ponés solo el host (sin `/api`), se añade automáticamente.
 */
export function getApiBaseUrl(): string {
  const fallback = 'https://consul-mm.onrender.com/api';
  const raw = import.meta.env.VITE_API_URL;
  if (!raw?.trim()) return fallback;
  let u = raw.trim().replace(/\/+$/, '');
  if (/\/api(\/|$)/.test(u)) return u;
  return `${u}/api`;
}
