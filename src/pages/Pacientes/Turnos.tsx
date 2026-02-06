import { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock, Loader2, User, Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { turnosService } from '@/services/turnos.service';
import { profesionalesService } from '@/services/profesionales.service';
import { useAuth } from '@/contexts/AuthContext';
import { formatDisplayText } from '@/lib/utils';

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
    queryKey: ['turnos', 'paciente', pacienteId, isProfesional ? profesionalLogueado?.id : 'todos'],
    queryFn: () => {
      // Profesional: solo turnos de este paciente con este profesional
      if (isProfesional && profesionalLogueado) {
        return turnosService.getAll({
          paciente_id: pacienteId,
          profesional_id: profesionalLogueado.id,
        });
      }
      // Admin/secretaria: todos los turnos del paciente
      return turnosService.getByPaciente(pacienteId);
    },
    enabled: !isProfesional || !!profesionalLogueado,
  });

  const [filterProfesionalId, setFilterProfesionalId] = useState<string>('todos');
  const [filterEstado, setFilterEstado] = useState<string>('todos');
  const [filterFechaDesde, setFilterFechaDesde] = useState<string>('');
  const [filterFechaHasta, setFilterFechaHasta] = useState<string>('');

  // Si es profesional, fijar el filtro a su id y no permitir cambiarlo
  useEffect(() => {
    if (isProfesional && profesionalLogueado) {
      setFilterProfesionalId(profesionalLogueado.id);
    }
  }, [isProfesional, profesionalLogueado?.id]);

  const [datePickerDesdeOpen, setDatePickerDesdeOpen] = useState(false);
  const [datePickerHastaOpen, setDatePickerHastaOpen] = useState(false);
  const [datePickerDesdeMonth, setDatePickerDesdeMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [datePickerHastaMonth, setDatePickerHastaMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [datePickerDesdeAnchor, setDatePickerDesdeAnchor] = useState<DOMRect | null>(null);
  const [datePickerHastaAnchor, setDatePickerHastaAnchor] = useState<DOMRect | null>(null);
  const datePickerDesdeButtonRef = useRef<HTMLButtonElement>(null);
  const datePickerHastaButtonRef = useRef<HTMLButtonElement>(null);
  const datePickerDesdeRef = useRef<HTMLDivElement>(null);
  const datePickerHastaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!datePickerDesdeOpen) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (datePickerDesdeButtonRef.current?.contains(target)) return;
      if (datePickerDesdeRef.current?.contains(target)) return;
      if ((e.target as Element).closest?.('[data-calendar-desde-portal]')) return;
      setDatePickerDesdeOpen(false);
      setDatePickerDesdeAnchor(null);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [datePickerDesdeOpen]);

  useEffect(() => {
    if (!datePickerHastaOpen) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (datePickerHastaButtonRef.current?.contains(target)) return;
      if (datePickerHastaRef.current?.contains(target)) return;
      if ((e.target as Element).closest?.('[data-calendar-hasta-portal]')) return;
      setDatePickerHastaOpen(false);
      setDatePickerHastaAnchor(null);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [datePickerHastaOpen]);

  // Ordenar por fecha más reciente
  const sortedTurnos = useMemo(() => {
    return [...turnos].sort((a, b) => new Date(b.fecha_hora_inicio).getTime() - new Date(a.fecha_hora_inicio).getTime());
  }, [turnos]);

  // Profesionales únicos que aparecen en los turnos del paciente
  const profesionalesEnTurnos = useMemo(() => {
    const seen = new Set<string>();
    return turnos
      .filter(t => {
        if (seen.has(t.profesional_id)) return false;
        seen.add(t.profesional_id);
        return true;
      })
      .map(t => ({ id: t.profesional_id, nombre: t.profesional_nombre ?? '', apellido: t.profesional_apellido ?? '' }));
  }, [turnos]);

  const filteredTurnos = useMemo(() => {
    let list = sortedTurnos;
    if (filterProfesionalId && filterProfesionalId !== 'todos') {
      list = list.filter(t => t.profesional_id === filterProfesionalId);
    }
    if (filterEstado && filterEstado !== 'todos') {
      list = list.filter(t => t.estado === filterEstado);
    }
    if (filterFechaDesde) {
      const desde = filterFechaDesde + 'T00:00:00';
      list = list.filter(t => t.fecha_hora_inicio >= desde);
    }
    if (filterFechaHasta) {
      const hasta = filterFechaHasta + 'T23:59:59.999';
      list = list.filter(t => t.fecha_hora_inicio <= hasta);
    }
    return list;
  }, [sortedTurnos, filterProfesionalId, filterEstado, filterFechaDesde, filterFechaHasta]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-16">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-[#2563eb]" />
          <p className="text-[#6B7280] font-['Inter']">Cargando historial de turnos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-[24px] font-bold text-[#111827] font-['Poppins'] mb-0">
          Historial de Turnos
        </h2>
        <p className="text-base text-[#6B7280] mt-1 font-['Inter']">
          {filteredTurnos.length} {filteredTurnos.length === 1 ? 'turno' : 'turnos'}
        </p>
      </div>

      {/* Filtros en recuadro */}
      {turnos.length > 0 && (
        <Card className="border border-[#E5E7EB] rounded-[16px] shadow-sm">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-4">
              <div className="flex-1 min-w-[280px]">
                <Select
                  value={isProfesional ? (profesionalLogueado?.id ?? filterProfesionalId) : filterProfesionalId}
                  onValueChange={setFilterProfesionalId}
                  disabled={isProfesional}
                >
                  <SelectTrigger className="h-12 w-full min-w-0 rounded-[12px] border-[#E5E7EB] font-['Inter'] text-[15px] disabled:opacity-100 disabled:cursor-default">
                    <SelectValue placeholder="Profesional" />
                  </SelectTrigger>
                  <SelectContent className="rounded-[12px]">
                    <SelectItem value="todos">Todos los profesionales</SelectItem>
                    {profesionalesEnTurnos.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {formatDisplayText(p.nombre)} {formatDisplayText(p.apellido)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 min-w-[200px] sm:max-w-[280px]">
                <Select value={filterEstado} onValueChange={setFilterEstado}>
                  <SelectTrigger className="h-12 w-full min-w-0 rounded-[12px] border-[#E5E7EB] font-['Inter'] text-[15px]">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent className="rounded-[12px]">
                    <SelectItem value="todos">Todos los estados</SelectItem>
                    <SelectItem value="confirmado">Confirmado</SelectItem>
                    <SelectItem value="pendiente">Pendiente</SelectItem>
                    <SelectItem value="completado">Completado</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 min-w-[200px] relative flex items-center gap-2" ref={datePickerDesdeRef}>
                <button
                  ref={datePickerDesdeButtonRef}
                  type="button"
                  onClick={() => {
                    const willOpen = !datePickerDesdeOpen;
                    setDatePickerDesdeOpen(willOpen);
                    if (willOpen) {
                      setDatePickerHastaOpen(false);
                      setDatePickerDesdeMonth(filterFechaDesde ? startOfMonth(new Date(filterFechaDesde + 'T12:00:00')) : startOfMonth(new Date()));
                      setDatePickerDesdeAnchor(datePickerDesdeButtonRef.current?.getBoundingClientRect() ?? null);
                    } else {
                      setDatePickerDesdeAnchor(null);
                    }
                  }}
                  className="h-12 flex-1 min-w-0 flex items-center gap-2 px-4 border border-[#E5E7EB] rounded-[12px] text-[15px] font-['Inter'] text-left bg-white hover:border-[#9CA3AF] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all"
                >
                  <Calendar className="h-4 w-4 text-[#6B7280] stroke-[2] flex-shrink-0" />
                  <span className="text-[#374151] truncate">
                    {filterFechaDesde ? format(new Date(filterFechaDesde + 'T12:00:00'), "d 'de' MMMM yyyy", { locale: es }) : 'Fecha desde'}
                  </span>
                  <ChevronRight className={`h-4 w-4 text-[#6B7280] ml-auto flex-shrink-0 transition-transform ${datePickerDesdeOpen ? 'rotate-90' : ''}`} />
                </button>
                {filterFechaDesde && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setFilterFechaDesde('')}
                    className="h-12 w-12 shrink-0 rounded-[12px] text-[#6B7280] hover:text-[#374151] hover:bg-[#FEE2E2]"
                    aria-label="Quitar fecha desde"
                  >
                    <X className="h-5 w-5 stroke-[2]" />
                  </Button>
                )}
              </div>
              <div className="flex-1 min-w-[200px] relative flex items-center gap-2" ref={datePickerHastaRef}>
                <button
                  ref={datePickerHastaButtonRef}
                  type="button"
                  onClick={() => {
                    const willOpen = !datePickerHastaOpen;
                    setDatePickerHastaOpen(willOpen);
                    if (willOpen) {
                      setDatePickerDesdeOpen(false);
                      setDatePickerHastaMonth(filterFechaHasta ? startOfMonth(new Date(filterFechaHasta + 'T12:00:00')) : startOfMonth(new Date()));
                      setDatePickerHastaAnchor(datePickerHastaButtonRef.current?.getBoundingClientRect() ?? null);
                    } else {
                      setDatePickerHastaAnchor(null);
                    }
                  }}
                  className="h-12 flex-1 min-w-0 flex items-center gap-2 px-4 border border-[#E5E7EB] rounded-[12px] text-[15px] font-['Inter'] text-left bg-white hover:border-[#9CA3AF] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all"
                >
                  <Calendar className="h-4 w-4 text-[#6B7280] stroke-[2] flex-shrink-0" />
                  <span className="text-[#374151] truncate">
                    {filterFechaHasta ? format(new Date(filterFechaHasta + 'T12:00:00'), "d 'de' MMMM yyyy", { locale: es }) : 'Fecha hasta'}
                  </span>
                  <ChevronRight className={`h-4 w-4 text-[#6B7280] ml-auto flex-shrink-0 transition-transform ${datePickerHastaOpen ? 'rotate-90' : ''}`} />
                </button>
                {filterFechaHasta && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setFilterFechaHasta('')}
                    className="h-12 w-12 shrink-0 rounded-[12px] text-[#6B7280] hover:text-[#374151] hover:bg-[#FEE2E2]"
                    aria-label="Quitar fecha hasta"
                  >
                    <X className="h-5 w-5 stroke-[2]" />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State o Tabla */}
      {filteredTurnos.length === 0 ? (
        <Card className="border border-[#E5E7EB] rounded-[16px] shadow-sm">
          <CardContent className="p-16 text-center">
            <div className="h-20 w-20 rounded-full bg-[#dbeafe] flex items-center justify-center mx-auto mb-4">
              <Clock className="h-10 w-10 text-[#2563eb] stroke-[2]" />
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
                {filteredTurnos.map((turno) => (
                  <TableRow
                    key={turno.id}
                    className="border-b border-[#E5E7EB] hover:bg-[#F9FAFB] transition-colors duration-150"
                  >
                    <TableCell className="py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-[#dbeafe] flex items-center justify-center flex-shrink-0">
                          <Calendar className="h-5 w-5 text-[#2563eb] stroke-[2]" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[15px] font-semibold text-[#374151] font-['Inter'] mb-0">
                            {format(new Date(turno.fecha_hora_inicio), "dd 'de' MMMM 'de' yyyy", { locale: es })}
                          </p>
                          <p className="text-sm text-[#6B7280] font-['Inter'] flex items-center gap-1.5 mt-0.5 mb-0">
                            <Clock className="h-3.5 w-3.5 stroke-[2]" />
                            {format(new Date(turno.fecha_hora_inicio), 'HH:mm', { locale: es })} - {format(new Date(turno.fecha_hora_fin), 'HH:mm', { locale: es })}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#DBEAFE] to-[#BFDBFE] flex items-center justify-center shadow-sm flex-shrink-0">
                          <User className="h-4 w-4 text-[#3B82F6] stroke-[2]" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[15px] font-medium text-[#374151] font-['Inter'] mb-0">
                            {turno.profesional_nombre} {turno.profesional_apellido}
                          </p>
                          {turno.profesional_especialidad && (
                            <p className="text-xs text-[#6B7280] font-['Inter'] mt-0">
                              {turno.profesional_especialidad}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      {getEstadoBadge(turno.estado)}
                    </TableCell>
                    <TableCell>
                      {turno.motivo ? (
                        <p className="text-[14px] text-[#374151] font-['Inter'] line-clamp-2 mb-0">
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

      {/* Calendario Fecha desde (portal) */}
      {datePickerDesdeOpen && datePickerDesdeAnchor && createPortal(
        <div
          data-calendar-desde-portal
          className="bg-white border border-[#E5E7EB] rounded-[16px] shadow-xl p-4 z-[9999] pointer-events-auto min-w-[280px] max-w-[450px]"
          style={{ position: 'fixed', top: datePickerDesdeAnchor.bottom + 8, left: datePickerDesdeAnchor.left, width: Math.min(Math.max(datePickerDesdeAnchor.width, 280), 450) }}
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-[16px] font-semibold text-[#111827] font-['Poppins']">
              {format(datePickerDesdeMonth, 'MMMM yyyy', { locale: es }).charAt(0).toUpperCase() + format(datePickerDesdeMonth, 'MMMM yyyy', { locale: es }).slice(1)}
            </span>
            <div className="flex gap-1">
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-[8px] hover:bg-[#dbeafe] text-[#2563eb]" onClick={() => setDatePickerDesdeMonth((m) => subMonths(m, 1))}>
                <ChevronLeft className="h-4 w-4 stroke-[2]" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-[8px] hover:bg-[#dbeafe] text-[#2563eb]" onClick={() => setDatePickerDesdeMonth((m) => addMonths(m, 1))}>
                <ChevronRight className="h-4 w-4 stroke-[2]" />
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'].map((d) => (
              <span key={d} className="text-[11px] font-medium text-[#6B7280] font-['Inter'] py-1">{d}</span>
            ))}
            {(() => {
              const monthStart = datePickerDesdeMonth;
              const monthEnd = endOfMonth(datePickerDesdeMonth);
              const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
              const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
              const days = eachDayOfInterval({ start: calStart, end: calEnd });
              const selectedDate = filterFechaDesde ? new Date(filterFechaDesde + 'T12:00:00') : null;
              return days.map((day) => {
                const isCurrentMonth = isSameMonth(day, datePickerDesdeMonth);
                const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => {
                      setFilterFechaDesde(format(day, 'yyyy-MM-dd'));
                      setDatePickerDesdeMonth(startOfMonth(day));
                      setDatePickerDesdeOpen(false);
                      setDatePickerDesdeAnchor(null);
                    }}
                    className={`h-9 rounded-[10px] text-[13px] font-medium font-['Inter'] transition-all
                      ${isSelected ? 'bg-[#2563eb] text-white hover:bg-[#1d4ed8]' : ''}
                      ${!isSelected && !isCurrentMonth ? 'text-[#9CA3AF] hover:bg-[#F3F4F6] cursor-pointer' : ''}
                      ${!isSelected && isCurrentMonth ? 'text-[#374151] hover:bg-[#dbeafe] cursor-pointer' : ''}`}
                  >
                    {format(day, 'd')}
                  </button>
                );
              });
            })()}
          </div>
        </div>,
        document.body
      )}

      {/* Calendario Fecha hasta (portal) */}
      {datePickerHastaOpen && datePickerHastaAnchor && createPortal(
        <div
          data-calendar-hasta-portal
          className="bg-white border border-[#E5E7EB] rounded-[16px] shadow-xl p-4 z-[9999] pointer-events-auto min-w-[280px] max-w-[450px]"
          style={{ position: 'fixed', top: datePickerHastaAnchor.bottom + 8, left: datePickerHastaAnchor.left, width: Math.min(Math.max(datePickerHastaAnchor.width, 280), 450) }}
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-[16px] font-semibold text-[#111827] font-['Poppins']">
              {format(datePickerHastaMonth, 'MMMM yyyy', { locale: es }).charAt(0).toUpperCase() + format(datePickerHastaMonth, 'MMMM yyyy', { locale: es }).slice(1)}
            </span>
            <div className="flex gap-1">
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-[8px] hover:bg-[#dbeafe] text-[#2563eb]" onClick={() => setDatePickerHastaMonth((m) => subMonths(m, 1))}>
                <ChevronLeft className="h-4 w-4 stroke-[2]" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-[8px] hover:bg-[#dbeafe] text-[#2563eb]" onClick={() => setDatePickerHastaMonth((m) => addMonths(m, 1))}>
                <ChevronRight className="h-4 w-4 stroke-[2]" />
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'].map((d) => (
              <span key={d} className="text-[11px] font-medium text-[#6B7280] font-['Inter'] py-1">{d}</span>
            ))}
            {(() => {
              const monthStart = datePickerHastaMonth;
              const monthEnd = endOfMonth(datePickerHastaMonth);
              const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
              const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
              const days = eachDayOfInterval({ start: calStart, end: calEnd });
              const selectedDate = filterFechaHasta ? new Date(filterFechaHasta + 'T12:00:00') : null;
              return days.map((day) => {
                const isCurrentMonth = isSameMonth(day, datePickerHastaMonth);
                const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => {
                      setFilterFechaHasta(format(day, 'yyyy-MM-dd'));
                      setDatePickerHastaMonth(startOfMonth(day));
                      setDatePickerHastaOpen(false);
                      setDatePickerHastaAnchor(null);
                    }}
                    className={`h-9 rounded-[10px] text-[13px] font-medium font-['Inter'] transition-all
                      ${isSelected ? 'bg-[#2563eb] text-white hover:bg-[#1d4ed8]' : ''}
                      ${!isSelected && !isCurrentMonth ? 'text-[#9CA3AF] hover:bg-[#F3F4F6] cursor-pointer' : ''}
                      ${!isSelected && isCurrentMonth ? 'text-[#374151] hover:bg-[#dbeafe] cursor-pointer' : ''}`}
                  >
                    {format(day, 'd')}
                  </button>
                );
              });
            })()}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}