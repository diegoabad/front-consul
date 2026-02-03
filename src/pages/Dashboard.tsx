import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;

    // Redirigir según el rol
    if (user.rol === 'administrador') {
      navigate('/admin/pacientes', { replace: true });
    } else if (user.rol === 'secretaria') {
      navigate('/secretaria/turnos', { replace: true });
    } else if (user.rol === 'profesional') {
      navigate('/profesional/pacientes', { replace: true });
    }
  }, [user, navigate]);

  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle>Dashboard</CardTitle>
          <CardDescription>Redirigiendo...</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Cargando...</p>
        </CardContent>
      </Card>
    </div>
  );
}
