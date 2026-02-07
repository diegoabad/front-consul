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
import { Label } from '@/components/ui/label';
import { Loader2, Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { turnosService } from '@/services/turnos.service';
import { profesionalesService } from '@/services/profesionales.service';
import { useAuth } from '@/contexts/AuthContext';
import { formatDisplayText } from '@/lib/utils';
import { PAGE_SIZE } from '@/lib/constants';

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
  const { data: profesionalesData = [] } = useQuery({
    queryKey: ['profesionales', 'for-filter-turnos'],
    queryFn: () => profesionalesService.getAll({ bloqueado: false }),
  });
  const profesionales = Array.isArray(profesionalesData) ? profesionalesData : [];

  const profesionalLogueado = profesionales.find(p => p.usuario_id === user?.id);
  const isProfesional = user?.rol === 'profesional';

  const [filterProfesionalId, setFilterProfesionalId] = useState<string>('todos');
  const [filterEstado, setFilterEstado] = useState<string>('todos');
  const [filterFechaDesde, setFilterFechaDesde] = useState<string>('');
  const [filterFechaHasta, setFilterFechaHasta] = useState<string>('');
  const [page, setPage] = useState(1);
  const limit = PAGE_SIZE;

  // Filtros para la API (paginación y filtros en backend)
  const turnosQueryFilters = useMemo(() => {
    const profesionalId = isProfesional && profesionalLogueado
      ? profesionalLogueado.id
      : (filterProfesionalId !== 'todos' ? filterProfesionalId : undefined);
    const fechaInicio = filterFechaDesde ? `${filterFechaDesde}T00:00:00` : undefined;
    const fechaFin = filterFechaHasta ? `${filterFechaHasta}T23:59:59.999` : undefined;
    return {
      paciente_id: pacienteId,
      profesional_id: profesionalId,
      estado: (filterEstado !== 'todos' ? filterEstado : undefined) as 'pendiente' | 'confirmado' | 'cancelado' | 'completado' | 'ausente' | undefined,
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
      page,
      limit,
    };
  }, [pacienteId, isProfesional, profesionalLogueado, filterProfesionalId, filterEstado, filterFechaDesde, filterFechaHasta, page, limit]);

  const { data: paginatedResponse, isLoading } = useQuery({
    queryKey: ['turnos', 'paciente', pacienteId, turnosQueryFilters],
    queryFn: () => turnosService.getAllPaginated(turnosQueryFilters),
    enabled: !isProfesional || !!profesionalLogueado,
  });

  const turnos = Array.isArray(paginatedResponse?.data) ? paginatedResponse.data : [];
  const total = paginatedResponse?.total ?? 0;
  const totalPages = paginatedResponse?.totalPages ?? 0;

  // Si es profesional, fijar el filtro a su id y no permitir cambiarlo
  useEffect(() => {
    if (isProfesional && profesionalLogueado) {
      setFilterProfesionalId(profesionalLogueado.id);
    }
  }, [isProfesional, profesionalLogueado?.id]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [filterProfesionalId, filterEstado, filterFechaDesde, filterFechaHasta]);

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

  // Opciones del filtro Profesional: todos los profesionales (para poder filtrar aunque no estén en la página actual)
  const opcionesFiltroProfesional = useMemo(() => {
    if (isProfesional && profesionalLogueado) {
      return [profesionalLogueado];
    }
    return profesionales;
  }, [isProfesional, profesionalLogueado, profesionales]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-[24px] font-bold text-[#111827] font-['Poppins'] mb-0">
          Historial de Turnos
        </h2>
        <p className="text-base text-[#6B7280] mt-1 font-['Inter']">
          {isLoading ? 'Cargando historial de turnos...' : (totalPages > 0 ? `Mostrando ${(page - 1) * limit + 1}-${Math.min(page * limit, total)} de ${total} turnos` : `${total} ${total === 1 ? 'turno' : 'turnos'}`)}
        </p>
      </div>

      {/* Filtros: siempre visibles para no perder selección al cargar */}
      <Card className="border border-[#E5E7EB] rounded-[16px] shadow-sm">
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-4">
              <div className="flex-1 min-w-[200px]">
                <Label className="text-[13px] font-medium text-[#374151] font-['Inter'] mb-1.5 block">Profesional</Label>
                <Select
                  value={isProfesional ? (profesionalLogueado?.id ?? filterProfesionalId) : filterProfesionalId}
                  onValueChange={setFilterProfesionalId}
                  disabled={!!(isProfesional && profesionalLogueado)}
                >
                  <SelectTrigger className="h-11 w-full rounded-[10px] border-[#E5E7EB] font-['Inter'] text-[14px] disabled:opacity-90 disabled:cursor-default">
                    <SelectValue placeholder="Todos los profesionales" />
                  </SelectTrigger>
                  <SelectContent className="rounded-[12px]">
                    <SelectItem value="todos">Todos los profesionales</SelectItem>
                    {opcionesFiltroProfesional.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {formatDisplayText(p.nombre)} {formatDisplayText(p.apellido)}
                        {p.especialidad ? ` — ${formatDisplayText(p.especialidad)}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 min-w-[200px]">
                <Label className="text-[13px] font-medium text-[#374151] font-['Inter'] mb-1.5 block">Estado</Label>
                <Select value={filterEstado} onValueChange={setFilterEstado}>
                  <SelectTrigger className="h-11 w-full rounded-[10px] border-[#E5E7EB] font-['Inter'] text-[14px]">
                    <SelectValue placeholder="Todos los estados" />
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
              <div className="flex-1 min-w-[200px] relative flex flex-col gap-1.5" ref={datePickerDesdeRef}>
                <Label className="text-[13px] font-medium text-[#374151] font-['Inter']">Fecha desde</Label>
                <div className="flex items-center gap-2">
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
                    className="h-11 flex-1 min-w-0 flex items-center gap-2 px-4 border border-[#E5E7EB] rounded-[10px] text-[14px] font-['Inter'] text-left bg-white hover:border-[#9CA3AF] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all"
                  >
                    <Calendar className="h-4 w-4 text-[#6B7280] stroke-[2] flex-shrink-0" />
                    <span className="text-[#374151] truncate">
                      {filterFechaDesde ? format(new Date(filterFechaDesde + 'T12:00:00'), "d 'de' MMMM yyyy", { locale: es }) : 'Seleccionar'}
                    </span>
                    <ChevronRight className={`h-4 w-4 text-[#6B7280] ml-auto flex-shrink-0 transition-transform ${datePickerDesdeOpen ? 'rotate-90' : ''}`} />
                  </button>
                  {filterFechaDesde && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setFilterFechaDesde('')}
                      className="h-11 w-11 shrink-0 rounded-[10px] text-[#6B7280] hover:text-[#374151] hover:bg-[#FEE2E2]"
                      aria-label="Quitar fecha desde"
                    >
                      <X className="h-5 w-5 stroke-[2]" />
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex-1 min-w-[200px] relative flex flex-col gap-1.5" ref={datePickerHastaRef}>
                <Label className="text-[13px] font-medium text-[#374151] font-['Inter']">Fecha hasta</Label>
                <div className="flex items-center gap-2">
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
                    className="h-11 flex-1 min-w-0 flex items-center gap-2 px-4 border border-[#E5E7EB] rounded-[10px] text-[14px] font-['Inter'] text-left bg-white hover:border-[#9CA3AF] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all"
                  >
                    <Calendar className="h-4 w-4 text-[#6B7280] stroke-[2] flex-shrink-0" />
                    <span className="text-[#374151] truncate">
                      {filterFechaHasta ? format(new Date(filterFechaHasta + 'T12:00:00'), "d 'de' MMMM yyyy", { locale: es }) : 'Seleccionar'}
                    </span>
                    <ChevronRight className={`h-4 w-4 text-[#6B7280] ml-auto flex-shrink-0 transition-transform ${datePickerHastaOpen ? 'rotate-90' : ''}`} />
                  </button>
                  {filterFechaHasta && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setFilterFechaHasta('')}
                      className="h-11 w-11 shrink-0 rounded-[10px] text-[#6B7280] hover:text-[#374151] hover:bg-[#FEE2E2]"
                      aria-label="Quitar fecha hasta"
                    >
                      <X className="h-5 w-5 stroke-[2]" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

      {/* Tabla siempre visible: carga o "No hay turnos" solo en el cuerpo, filtros no se mueven */}
      <Card className="border border-[#E5E7EB] rounded-[16px] shadow-sm overflow-hidden">
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <Table className="table-fixed w-full max-lg:table-auto max-lg:min-w-[940px]">
              <TableHeader className="sticky top-0 bg-[#F9FAFB] z-10">
                <TableRow className="bg-[#F9FAFB] border-b-2 border-[#E5E7EB] hover:bg-[#F9FAFB]">
                  <TableHead className="font-['Inter'] font-medium text-[14px] text-[#374151] py-4 w-1/6 min-w-0 max-lg:w-[150px] max-lg:min-w-[150px]">
                    Fecha
                  </TableHead>
                  <TableHead className="font-['Inter'] font-medium text-[14px] text-[#374151] py-4 w-1/6 min-w-0 max-lg:w-[150px] max-lg:min-w-[150px]">
                    Hora
                  </TableHead>
                  <TableHead className="font-['Inter'] font-medium text-[14px] text-[#374151] py-4 w-1/6 min-w-0 max-lg:w-[190px] max-lg:min-w-[190px]">
                    Profesional
                  </TableHead>
                  <TableHead className="font-['Inter'] font-medium text-[14px] text-[#374151] py-4 w-1/6 min-w-0 max-lg:w-[150px] max-lg:min-w-[150px]">
                    Especialidad
                  </TableHead>
                  <TableHead className="font-['Inter'] font-medium text-[14px] text-[#374151] py-4 w-1/6 min-w-0 max-lg:w-[150px] max-lg:min-w-[150px]">
                    Estado
                  </TableHead>
                  <TableHead className="font-['Inter'] font-medium text-[14px] text-[#374151] py-4 w-1/6 min-w-0 max-lg:w-[150px] max-lg:min-w-[150px]">
                    Motivo
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-16 text-center">
                      <Loader2 className="h-10 w-10 animate-spin mx-auto mb-2 text-[#2563eb]" />
                      <p className="text-[#6B7280] font-['Inter'] text-sm m-0">Cargando historial de turnos...</p>
                    </TableCell>
                  </TableRow>
                ) : turnos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-12 text-center">
                      <p className="text-[#374151] font-['Inter'] font-medium m-0">No hay turnos</p>
                      <p className="text-[#6B7280] text-sm mt-1 m-0">Cambiá los filtros para ver otros resultados.</p>
                    </TableCell>
                  </TableRow>
                ) : (
                turnos.map((turno) => (
                  <TableRow
                    key={turno.id}
                    className="border-b border-[#E5E7EB] hover:bg-[#F9FAFB] transition-colors duration-150"
                  >
                    <TableCell className="py-4 w-1/6 min-w-0 max-lg:w-[150px] max-lg:min-w-[150px]">
                      <span className="text-[15px] text-[#374151] font-['Inter']">
                        {formatDisplayText(format(new Date(turno.fecha_hora_inicio), 'd MMM yyyy', { locale: es }))}
                      </span>
                    </TableCell>
                    <TableCell className="py-4 w-1/6 min-w-0 max-lg:w-[150px] max-lg:min-w-[150px]">
                      <span className="text-[14px] text-[#374151] font-['Inter']">
                        {format(new Date(turno.fecha_hora_inicio), 'HH:mm', { locale: es })} - {format(new Date(turno.fecha_hora_fin), 'HH:mm', { locale: es })}
                      </span>
                    </TableCell>
                    <TableCell className="py-4 w-1/6 min-w-0 max-lg:w-[190px] max-lg:min-w-[190px]">
                      <p className="text-[15px] text-[#374151] font-['Inter'] mb-0 truncate" title={`${turno.profesional_nombre ?? ''} ${turno.profesional_apellido ?? ''}`.trim()}>
                        {formatDisplayText(turno.profesional_nombre)} {formatDisplayText(turno.profesional_apellido)}
                      </p>
                    </TableCell>
                    <TableCell className="py-4 w-1/6 min-w-0 max-lg:w-[150px] max-lg:min-w-[150px]">
                      <span className="text-[14px] text-[#374151] font-['Inter'] truncate block" title={turno.profesional_especialidad ?? ''}>
                        {turno.profesional_especialidad ? formatDisplayText(turno.profesional_especialidad) : '—'}
                      </span>
                    </TableCell>
                    <TableCell className="py-4 w-1/6 min-w-0 max-lg:w-[150px] max-lg:min-w-[150px]">
                      {getEstadoBadge(turno.estado)}
                    </TableCell>
                    <TableCell className="py-4 w-1/6 min-w-0 max-lg:w-[150px] max-lg:min-w-[150px]">
                      {turno.motivo ? (
                        <p className="text-[14px] text-[#374151] font-['Inter'] line-clamp-2 mb-0 break-words" title={turno.motivo}>
                          {turno.motivo}
                        </p>
                      ) : (
                        <span className="text-[#9CA3AF] text-sm font-['Inter']">Sin motivo especificado</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
                )}
              </TableBody>
            </Table>
          </div>
          {(totalPages >= 1) && !isLoading && turnos.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-4 border-t border-[#E5E7EB] bg-[#F9FAFB]">
              <p className="text-sm text-[#6B7280] font-['Inter'] m-0">
                Página {page} de {totalPages || 1}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="h-9 rounded-[8px] border-[#D1D5DB] font-['Inter'] m-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="h-9 rounded-[8px] border-[#D1D5DB] font-['Inter'] m-0"
                >
                  Siguiente
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>

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