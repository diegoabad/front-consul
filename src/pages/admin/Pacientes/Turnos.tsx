import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Clock, Loader2, User, Calendar } from 'lucide-react';
import { turnosService } from '@/services/turnos.service';
import { profesionalesService } from '@/services/profesionales.service';
import { useAuth } from '@/contexts/AuthContext';

interface PacienteTurnosProps {
  pacienteId: string;
}

function getEstadoBadge(estado: string) {
  switch (estado) {
    case 'confirmado':
      return (
        <Badge className="bg-[#D1FAE5] text-[#065F46] border-[#6EE7B7] hover:bg-[#A7F3D0] rounded-full px-3 py-1 text-xs font-medium">
          Confirmado
        </Badge>
      );
    case 'pendiente':
      return (
        <Badge className="bg-[#FEF3C7] text-[#92400E] border-[#FDE047] hover:bg-[#FDE68A] rounded-full px-3 py-1 text-xs font-medium">
          Pendiente
        </Badge>
      );
    case 'cancelado':
      return (
        <Badge className="bg-[#FEE2E2] text-[#991B1B] border-[#FECACA] hover:bg-[#FCA5A5] rounded-full px-3 py-1 text-xs font-medium">
          Cancelado
        </Badge>
      );
    case 'completado':
      return (
        <Badge className="bg-[#DBEAFE] text-[#1E40AF] border-[#BFDBFE] hover:bg-[#93C5FD] rounded-full px-3 py-1 text-xs font-medium">
          Completado
        </Badge>
      );
    default:
      return (
        <Badge className="bg-[#F3F4F6] text-[#4B5563] border-[#D1D5DB] rounded-full px-3 py-1 text-xs font-medium">
          {estado}
        </Badge>
      );
  }
}

function getEstadoIcon(estado: string) {
  switch (estado) {
    case 'confirmado':
      return 'bg-[#10B981]';
    case 'pendiente':
      return 'bg-[#F59E0B]';
    case 'cancelado':
      return 'bg-[#EF4444]';
    case 'completado':
      return 'bg-[#3B82F6]';
    default:
      return 'bg-[#9CA3AF]';
  }
}

export default function PacienteTurnos({ pacienteId }: PacienteTurnosProps) {
  const { user } = useAuth();

  // Obtener el profesional asociado al usuario logueado si es profesional
  const { data: profesionales = [] } = useQuery({
    queryKey: ['profesionales', 'for-filter-turnos'],
    queryFn: () => profesionalesService.getAll({ bloqueado: false }),
  });

  const profesionalLogueado = profesionales.find(p => p.usuario_id === user?.id);
  const isProfesional = user?.rol === 'profesional';

  const { data: turnos = [], isLoading } = useQuery({
    queryKey: ['turnos', 'paciente', pacienteId, profesionalLogueado?.id],
    queryFn: () => {
      // Si es profesional, filtrar por profesional_id
      if (isProfesional && profesionalLogueado) {
        return turnosService.getAll({
          paciente_id: pacienteId,
          profesional_id: profesionalLogueado.id,
        });
      }
      // Si no es profesional, obtener todos los turnos del paciente
      return turnosService.getByPaciente(pacienteId);
    },
    enabled: !isProfesional || !!profesionalLogueado,
  });

  // Ordenar por fecha más reciente
  const sortedTurnos = [...turnos].sort((a, b) => {
    return new Date(b.fecha_hora_inicio).getTime() - new Date(a.fecha_hora_inicio).getTime();
  });

  // Estadísticas
  const stats = {
    total: turnos.length,
    confirmados: turnos.filter(t => t.estado === 'confirmado').length,
    pendientes: turnos.filter(t => t.estado === 'pendiente').length,
    completados: turnos.filter(t => t.estado === 'completado').length,
    cancelados: turnos.filter(t => t.estado === 'cancelado').length,
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-16">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-[#7C3AED]" />
          <p className="text-[#6B7280] font-['Inter']">Cargando historial de turnos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-[24px] font-bold text-[#111827] font-['Poppins'] mb-0">
            Historial de Turnos
          </h2>
          <p className="text-base text-[#6B7280] mt-1 font-['Inter']">
            {sortedTurnos.length} {sortedTurnos.length === 1 ? 'turno registrado' : 'turnos registrados'}
          </p>
        </div>
      </div>

      {/* Estadísticas */}
      {turnos.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border border-[#E5E7EB] rounded-[12px] shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-[#DBEAFE] flex items-center justify-center">
                  <Clock className="h-5 w-5 text-[#3B82F6] stroke-[2]" />
                </div>
                <div>
                  <p className="text-[24px] font-bold text-[#111827] font-['Poppins']">
                    {stats.total}
                  </p>
                  <p className="text-xs text-[#6B7280] font-['Inter']">
                    Total
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-[#E5E7EB] rounded-[12px] shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-[#D1FAE5] flex items-center justify-center">
                  <div className="h-3 w-3 rounded-full bg-[#10B981]" />
                </div>
                <div>
                  <p className="text-[24px] font-bold text-[#111827] font-['Poppins']">
                    {stats.confirmados}
                  </p>
                  <p className="text-xs text-[#6B7280] font-['Inter']">
                    Confirmados
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-[#E5E7EB] rounded-[12px] shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-[#DBEAFE] flex items-center justify-center">
                  <div className="h-3 w-3 rounded-full bg-[#3B82F6]" />
                </div>
                <div>
                  <p className="text-[24px] font-bold text-[#111827] font-['Poppins']">
                    {stats.completados}
                  </p>
                  <p className="text-xs text-[#6B7280] font-['Inter']">
                    Completados
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-[#E5E7EB] rounded-[12px] shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-[#FEF3C7] flex items-center justify-center">
                  <div className="h-3 w-3 rounded-full bg-[#F59E0B]" />
                </div>
                <div>
                  <p className="text-[24px] font-bold text-[#111827] font-['Poppins']">
                    {stats.pendientes}
                  </p>
                  <p className="text-xs text-[#6B7280] font-['Inter']">
                    Pendientes
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Empty State o Tabla */}
      {sortedTurnos.length === 0 ? (
        <Card className="border border-[#E5E7EB] rounded-[16px] shadow-sm">
          <CardContent className="p-16 text-center">
            <div className="h-20 w-20 rounded-full bg-[#EDE9FE] flex items-center justify-center mx-auto mb-4">
              <Clock className="h-10 w-10 text-[#7C3AED] stroke-[2]" />
            </div>
            <h3 className="text-lg font-semibold mb-2 text-[#374151] font-['Inter']">
              No hay turnos
            </h3>
            <p className="text-[#6B7280] font-['Inter']">
              Aún no se han registrado turnos para este paciente
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border border-[#E5E7EB] rounded-[16px] shadow-sm overflow-hidden">
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-[#F9FAFB] z-10">
                <TableRow className="bg-[#F9FAFB] border-b-2 border-[#E5E7EB] hover:bg-[#F9FAFB]">
                  <TableHead className="font-['Inter'] font-medium text-[14px] text-[#374151] py-4">
                    Fecha y Hora
                  </TableHead>
                  <TableHead className="font-['Inter'] font-medium text-[14px] text-[#374151]">
                    Profesional
                  </TableHead>
                  <TableHead className="font-['Inter'] font-medium text-[14px] text-[#374151]">
                    Estado
                  </TableHead>
                  <TableHead className="font-['Inter'] font-medium text-[14px] text-[#374151]">
                    Motivo
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedTurnos.map((turno) => (
                  <TableRow
                    key={turno.id}
                    className="border-b border-[#E5E7EB] hover:bg-[#F9FAFB] transition-colors duration-150"
                  >
                    <TableCell className="py-4">
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-full bg-[#EDE9FE] flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Calendar className="h-5 w-5 text-[#7C3AED] stroke-[2]" />
                        </div>
                        <div>
                          <p className="text-[15px] font-semibold text-[#374151] font-['Inter']">
                            {format(new Date(turno.fecha_hora_inicio), "dd 'de' MMMM 'de' yyyy", { locale: es })}
                          </p>
                          <p className="text-sm text-[#6B7280] font-['Inter'] flex items-center gap-1.5 mt-0.5">
                            <Clock className="h-3.5 w-3.5 stroke-[2]" />
                            {format(new Date(turno.fecha_hora_inicio), 'HH:mm', { locale: es })} - {format(new Date(turno.fecha_hora_fin), 'HH:mm', { locale: es })}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#DBEAFE] to-[#BFDBFE] flex items-center justify-center shadow-sm">
                          <User className="h-4 w-4 text-[#3B82F6] stroke-[2]" />
                        </div>
                        <div>
                          <p className="text-[15px] font-medium text-[#374151] font-['Inter']">
                            {turno.profesional_nombre} {turno.profesional_apellido}
                          </p>
                          {turno.profesional_especialidad && (
                            <p className="text-xs text-[#6B7280] font-['Inter']">
                              {turno.profesional_especialidad}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className={`h-2 w-2 rounded-full ${getEstadoIcon(turno.estado)}`} />
                        {getEstadoBadge(turno.estado)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {turno.motivo ? (
                        <p className="text-[14px] text-[#374151] font-['Inter'] line-clamp-2">
                          {turno.motivo}
                        </p>
                      ) : (
                        <span className="text-[#9CA3AF] text-sm font-['Inter']">Sin motivo especificado</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}