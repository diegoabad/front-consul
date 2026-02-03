import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { turnosService } from '@/services/turnos.service';
import { Calendar, Clock, CheckCircle2, XCircle } from 'lucide-react';

export default function SecretariaDashboard() {
  // Obtener estadísticas de turnos
  const { data: turnos } = useQuery({
    queryKey: ['turnos'],
    queryFn: () => turnosService.getAll(),
  });

  const totalTurnos = turnos?.length || 0;
  const turnosPendientes = turnos?.filter(t => t.estado === 'pendiente').length || 0;
  const turnosConfirmados = turnos?.filter(t => t.estado === 'confirmado').length || 0;
  const turnosCancelados = turnos?.filter(t => t.estado === 'cancelado').length || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[28px] font-bold text-[#374151] font-['Poppins'] leading-tight tracking-[-0.02em] mb-4">Mi Panel de Control</h1>
        <p className="text-[#6B7280] text-sm mt-1 mb-6">Resumen de turnos y agenda</p>
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
              <p className="text-[11px] text-white/90">Todos los turnos</p>
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

        <Card className="border-0 shadow-lg overflow-hidden">
          <div className="gradient-red h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold text-red-900">Cancelados</CardTitle>
              <div className="h-10 w-10 rounded-full bg-red-200/60 flex items-center justify-center">
                <XCircle className="h-5 w-5 text-red-800" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-900 mb-1">{turnosCancelados}</div>
              <p className="text-[11px] text-red-800/80">Turnos cancelados</p>
            </CardContent>
          </div>
        </Card>
      </div>
    </div>
  );
}
