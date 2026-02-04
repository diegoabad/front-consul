import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Redirige según rol: admin → /dashboard, secretaria y profesional → /turnos.
 */
export default function DefaultRedirect() {
  const { user } = useAuth();
  if (user?.rol === 'administrador') return <Navigate to="/dashboard" replace />;
  return <Navigate to="/turnos" replace />;
}
