import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { turnosService } from '@/services/turnos.service';
import { Calendar, Clock, CheckCircle2 } from 'lucide-react';

export default function ProfesionalDashboard() {
  const { user } = useAuth();
  
  // Obtener turnos del profesional
  const { data: turnos } = useQuery({
    queryKey: ['turnos', 'profesional', user?.id],
    queryFn: () => turnosService.getByProfesional(user?.id || ''),
    enabled: !!user?.id,
  });

  const totalTurnos = turnos?.length || 0;
  const turnosPendientes = turnos?.filter(t => t.estado === 'pendiente').length || 0;
  const turnosConfirmados = turnos?.filter(t => t.estado === 'confirmado').length || 0;
  const turnosHoy = turnos?.filter(t => {
    const hoy = new Date();
    const fechaTurno = new Date(t.fecha_hora_inicio);
    return fechaTurno.toDateString() === hoy.toDateString();
  }).length || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[28px] font-bold text-[#374151] font-['Poppins'] leading-tight tracking-[-0.02em] mb-4">Mi Panel de Control</h1>
        <p className="text-[#6B7280] text-sm mt-1 mb-6">Resumen de mis turnos y agenda</p>
      </div>

      {/* Estadísticas con gradientes */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-0 shadow-lg overflow-hidden">
          <div className="gradient-purple h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold text-white">Total Turnos</CardTitle>
              <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white mb-1">{totalTurnos}</div>
              <p className="text-[11px] text-white/90">Todos mis turnos</p>
            </CardContent>
          </div>
        </Card>

        <Card className="border-0 shadow-lg overflow-hidden">
          <div className="gradient-blue h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold text-sky-900">Hoy</CardTitle>
              <div className="h-10 w-10 rounded-full bg-sky-200/60 flex items-center justify-center">
                <Clock className="h-5 w-5 text-sky-800" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-sky-900 mb-1">{turnosHoy}</div>
              <p className="text-[11px] text-sky-800/80">Turnos de hoy</p>
            </CardContent>
          </div>
        </Card>

        <Card className="border-0 shadow-lg overflow-hidden">
          <div className="gradient-purple h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold text-white">Pendientes</CardTitle>
              <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">
                <Clock className="h-5 w-5 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white mb-1">{turnosPendientes}</div>
              <p className="text-[11px] text-white/90">Esperando confirmación</p>
            </CardContent>
          </div>
        </Card>

        <Card className="border-0 shadow-lg overflow-hidden">
          <div className="gradient-green h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold text-emerald-900">Confirmados</CardTitle>
              <div className="h-10 w-10 rounded-full bg-emerald-200/60 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-emerald-800" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-900 mb-1">{turnosConfirmados}</div>
              <p className="text-[11px] text-emerald-800/80">Turnos confirmados</p>
            </CardContent>
          </div>
        </Card>
      </div>
    </div>
  );
}
