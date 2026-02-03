import { useQuery } from '@tanstack/react-query';
import { startOfMonth, endOfMonth, parseISO, isWithinInterval } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { pacientesService } from '@/services/pacientes.service';
import { profesionalesService } from '@/services/profesionales.service';
import { turnosService } from '@/services/turnos.service';
import { pagosService } from '@/services/pagos.service';
import { Users, Stethoscope, Calendar, FileText, DollarSign } from 'lucide-react';

export default function AdminDashboard() {
  const { data: pacientes } = useQuery({
    queryKey: ['pacientes'],
    queryFn: () => pacientesService.getAll(),
  });

  const { data: profesionales } = useQuery({
    queryKey: ['profesionales'],
    queryFn: () => profesionalesService.getAll(),
  });

  const { data: turnos } = useQuery({
    queryKey: ['turnos'],
    queryFn: () => turnosService.getAll(),
  });

  const { data: pagos = [] } = useQuery({
    queryKey: ['pagos', 'all'],
    queryFn: () => pagosService.getAll(),
  });

  const totalPacientes = pacientes?.length || 0;
  const totalProfesionales = profesionales?.length || 0;

  const hoy = new Date();
  const inicioMes = startOfMonth(hoy);
  const finMes = endOfMonth(hoy);
  const turnosEsteMes =
    turnos?.filter((t) => {
      try {
        const fecha = parseISO(t.fecha_hora_inicio);
        return isWithinInterval(fecha, { start: inicioMes, end: finMes });
      } catch {
        return false;
      }
    }).length ?? 0;
  const conContrato =
    profesionales?.filter(
      (p) =>
        p.fecha_inicio_contrato?.trim() &&
        p.monto_mensual != null &&
        Number(p.monto_mensual) > 0
    ).length ?? 0;

  const pagosPagados = pagos.filter((p) => p.estado === 'pagado');
  const cantidadPagosPagados = pagosPagados.length;
  const totalPagado =
    pagosPagados.reduce((sum, p) => sum + (parseFloat(String(p.monto)) || 0), 0) || 0;
  const formatoMoneda = (n: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-[32px] font-bold text-[#111827] font-['Poppins'] leading-tight tracking-[-0.02em] mb-0">
          Dashboard
        </h1>
        <p className="text-[#6B7280] text-base mt-2 font-['Inter']">
          Vista general de métricas y estado del sistema
        </p>
      </div>

      {/* Indicadores: actividad → recursos → finanzas */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
        {/* 1. Turnos este mes — actividad del mes */}
        <Card className="border-2 border-[#7C3AED] rounded-[16px] shadow-lg hover:shadow-xl transition-all duration-200 overflow-hidden group relative">
          <div className="absolute inset-0 bg-gradient-to-br from-[#EDE9FE] via-white to-[#F9FAFB] opacity-60" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 relative z-10">
            <CardTitle className="text-sm font-semibold text-[#7C3AED] font-['Inter']">
              Turnos este mes
            </CardTitle>
            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#6D28D9] flex items-center justify-center shadow-md shadow-[#7C3AED]/30 group-hover:shadow-lg group-hover:shadow-[#7C3AED]/40 transition-all duration-200">
              <Calendar className="h-5 w-5 text-white stroke-[2]" />
            </div>
          </CardHeader>
          <CardContent className="pt-0 relative z-10">
            <div className="text-[32px] font-bold text-[#7C3AED] mb-1 font-['Poppins']">
              {turnosEsteMes}
            </div>
            <p className="text-xs text-[#6D28D9] font-medium font-['Inter']">
              {turnosEsteMes === 1 ? 'turno en el mes' : 'turnos en el mes'}
            </p>
          </CardContent>
        </Card>

        {/* 2. Pacientes activos */}
        <Card className="border border-[#E5E7EB] rounded-[16px] shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden group">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 bg-gradient-to-br from-white to-[#EDE9FE]/30">
            <CardTitle className="text-sm font-medium text-[#374151] font-['Inter']">
              Pacientes activos
            </CardTitle>
            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-[#EDE9FE] to-[#DDD6FE] flex items-center justify-center shadow-sm group-hover:shadow-md transition-all duration-200">
              <Users className="h-5 w-5 text-[#7C3AED] stroke-[2]" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-[32px] font-bold text-[#111827] mb-1 font-['Poppins']">
              {totalPacientes}
            </div>
            <p className="text-xs text-[#6B7280] font-['Inter']">
              En el sistema
            </p>
          </CardContent>
        </Card>

        {/* 3. Profesionales */}
        <Card className="border border-[#E5E7EB] rounded-[16px] shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden group">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 bg-gradient-to-br from-white to-[#DBEAFE]/30">
            <CardTitle className="text-sm font-medium text-[#374151] font-['Inter']">
              Profesionales
            </CardTitle>
            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-[#DBEAFE] to-[#BFDBFE] flex items-center justify-center shadow-sm group-hover:shadow-md transition-all duration-200">
              <Stethoscope className="h-5 w-5 text-[#3B82F6] stroke-[2]" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-[32px] font-bold text-[#111827] mb-1 font-['Poppins']">
              {totalProfesionales}
            </div>
            <p className="text-xs text-[#6B7280] font-['Inter']">
              Activos en el sistema
            </p>
          </CardContent>
        </Card>

        {/* 4. Contratos */}
        <Card className="border border-[#E5E7EB] rounded-[16px] shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden group">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 bg-gradient-to-br from-white to-[#D1FAE5]/30">
            <CardTitle className="text-sm font-medium text-[#374151] font-['Inter']">
              Contratos
            </CardTitle>
            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-[#D1FAE5] to-[#A7F3D0] flex items-center justify-center shadow-sm group-hover:shadow-md transition-all duration-200">
              <FileText className="h-5 w-5 text-[#059669] stroke-[2]" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-[32px] font-bold text-[#111827] mb-1 font-['Poppins']">
              {conContrato}
            </div>
            <p className="text-xs text-[#6B7280] font-['Inter']">
              Con fecha y monto
            </p>
          </CardContent>
        </Card>

        {/* 5. Pagos pagados */}
        <Card className="border border-[#E5E7EB] rounded-[16px] shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden group">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 bg-gradient-to-br from-white to-[#FEF3C7]/30">
            <CardTitle className="text-sm font-medium text-[#374151] font-['Inter']">
              Pagos pagados
            </CardTitle>
            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-[#FEF3C7] to-[#FDE047] flex items-center justify-center shadow-sm group-hover:shadow-md transition-all duration-200">
              <DollarSign className="h-5 w-5 text-[#D97706] stroke-[2]" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-[32px] font-bold text-[#111827] mb-1 font-['Poppins']">
              {cantidadPagosPagados}
            </div>
            <p className="text-xs text-[#6B7280] font-['Inter']">
              Total {formatoMoneda(totalPagado)}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}