import { Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { dashboardService } from '@/services/dashboard.service';
import { Users, Stethoscope, Calendar, FileText, DollarSign, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function AdminDashboard() {
  const { user } = useAuth();
  if (user?.rol !== 'administrador') return <Navigate to="/turnos" replace />;

  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: () => dashboardService.getStats(),
    staleTime: 2 * 60 * 1000, // considerar fresh por 2 minutos
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[280px]">
        <Loader2 className="h-10 w-10 text-[#2563eb] animate-spin" aria-hidden />
      </div>
    );
  }

  const formatoMoneda = (n: number) =>
    new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(n);

  return (
    <div className="space-y-8 max-lg:space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-[32px] font-bold text-[#111827] font-['Poppins'] leading-tight tracking-[-0.02em] mb-0">
          Dashboard
        </h1>
        <p className="text-[#6B7280] text-base mt-2 font-['Inter']">
          Vista general de métricas y estado del sistema
        </p>
      </div>

      {/* Fila 1: 3 indicadores (actividad y recursos) */}
      <div className="grid gap-6 grid-cols-1 md:grid-cols-3">
        {/* 1. Turnos este mes */}
        <Card className="border-2 border-[#2563eb] rounded-[16px] shadow-lg hover:shadow-xl transition-all duration-200 overflow-hidden group relative">
          <div className="absolute inset-0 bg-gradient-to-br from-[#dbeafe] via-white to-[#F9FAFB] opacity-60" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 relative z-10">
            <CardTitle className="text-sm font-semibold text-[#2563eb] font-['Inter']">
              Turnos del mes
            </CardTitle>
            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] flex items-center justify-center shadow-md shadow-[#2563eb]/30 group-hover:shadow-lg group-hover:shadow-[#2563eb]/40 transition-all duration-200">
              <Calendar className="h-5 w-5 text-white stroke-[2]" />
            </div>
          </CardHeader>
          <CardContent className="pt-0 relative z-10">
            <div className="text-[32px] font-bold text-[#2563eb] mb-1 font-['Poppins']">
              {stats?.turnosEsteMes ?? 0}
            </div>
            <p className="text-sm text-[#1d4ed8] font-medium font-['Inter']">
              Turnos realizados o programados en el mes actual
            </p>
          </CardContent>
        </Card>

        {/* 2. Pacientes activos */}
        <Card className="border border-[#E5E7EB] rounded-[16px] shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden group">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 bg-gradient-to-br from-white to-[#dbeafe]/30">
            <CardTitle className="text-sm font-medium text-[#374151] font-['Inter']">
              Pacientes activos
            </CardTitle>
            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-[#dbeafe] to-[#bfdbfe] flex items-center justify-center shadow-sm group-hover:shadow-md transition-all duration-200">
              <Users className="h-5 w-5 text-[#2563eb] stroke-[2]" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-[32px] font-bold text-[#111827] mb-1 font-['Poppins']">
              {stats?.totalPacientes ?? 0}
            </div>
            <p className="text-sm text-[#6B7280] font-['Inter']">
              Pacientes registrados en el sistema
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
              {stats?.totalProfesionales ?? 0}
            </div>
            <p className="text-sm text-[#6B7280] font-['Inter']">
              Profesionales activos en el consultorio
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Fila 2: 2 indicadores más anchos (contratos y finanzas) */}
      <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
        {/* 4. Contratos */}
        <Card className="border border-[#E5E7EB] rounded-[16px] shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden group">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 bg-gradient-to-br from-white to-[#D1FAE5]/30">
            <CardTitle className="text-sm font-medium text-[#374151] font-['Inter']">
              Contratos vigentes
            </CardTitle>
            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-[#D1FAE5] to-[#A7F3D0] flex items-center justify-center shadow-sm group-hover:shadow-md transition-all duration-200">
              <FileText className="h-5 w-5 text-[#059669] stroke-[2]" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-[32px] font-bold text-[#111827] mb-1 font-['Poppins']">
              {stats?.conContrato ?? 0}
            </div>
            <p className="text-sm text-[#6B7280] font-['Inter']">
              Profesionales con contrato (fecha de inicio y monto mensual definidos)
            </p>
          </CardContent>
        </Card>

        {/* 5. Contratos pagados del mes */}
        <Card className="border border-[#E5E7EB] rounded-[16px] shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden group">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 bg-gradient-to-br from-white to-[#FEF3C7]/30">
            <CardTitle className="text-sm font-medium text-[#374151] font-['Inter']">
              Contratos pagados del mes
            </CardTitle>
            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-[#FEF3C7] to-[#FDE047] flex items-center justify-center shadow-sm group-hover:shadow-md transition-all duration-200">
              <DollarSign className="h-5 w-5 text-[#D97706] stroke-[2]" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-[32px] font-bold text-[#111827] mb-1 font-['Poppins']">
              {stats?.pagosPagadosCount ?? 0}
            </div>
            <p className="text-sm text-[#6B7280] font-['Inter']">
              Órdenes de pago cobradas · Total: {formatoMoneda(stats?.pagosPagadosTotal ?? 0)}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
