import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Bell,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Loader2,
  Send,
  CheckCircle2,
  Clock,
  XCircle,
  PhoneOff,
  Eye,
  Trash2,
  BellOff,
} from 'lucide-react';
import { toast as reactToastify } from 'react-toastify';
import { format } from 'date-fns';
import { recordatoriosService, type RecordatorioEntry, type EstadoRecordatorio } from '@/services/recordatorios.service';
import { profesionalesService } from '@/services/profesionales.service';
import { formatDisplayText } from '@/lib/utils';

// ─── helpers ────────────────────────────────────────────────────────────────

function formatFecha(iso: string | null | undefined) {
  if (!iso) return '—';
  try {
    const d = new Date(iso.endsWith('Z') ? iso : iso + 'Z');
    return d.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

function calcRecordatorioProgramado(iso: string | null | undefined) {
  if (!iso) return '—';
  try {
    const d = new Date(iso.endsWith('Z') ? iso : iso + 'Z');
    return d.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso ?? '—';
  }
}

// ─── Badge de estado ─────────────────────────────────────────────────────────

interface EstadoBadgeProps { estado: EstadoRecordatorio }

function EstadoBadge({ estado }: EstadoBadgeProps) {
  if (estado === 'enviado') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-semibold bg-[#D1FAE5] text-[#065F46] font-['Inter']">
        <CheckCircle2 className="h-3.5 w-3.5" /> Enviado
      </span>
    );
  }
  if (estado === 'pendiente') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-semibold bg-[#DBEAFE] text-[#1E40AF] font-['Inter']">
        <Clock className="h-3.5 w-3.5" /> Pendiente
      </span>
    );
  }
  if (estado === 'fallido') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-semibold bg-[#FEE2E2] text-[#991B1B] font-['Inter']">
        <XCircle className="h-3.5 w-3.5" /> Fallido
      </span>
    );
  }
  if (estado === 'sin_numero') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-semibold bg-[#F3F4F6] text-[#6B7280] font-['Inter']">
        <PhoneOff className="h-3.5 w-3.5" /> Sin número
      </span>
    );
  }
  if (estado === 'anulado') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-semibold bg-[#FEF3C7] text-[#92400E] font-['Inter']">
        <BellOff className="h-3.5 w-3.5" /> Anulado
      </span>
    );
  }
  return null;
}

// ─── Componente principal ────────────────────────────────────────────────────

export default function RecordatoriosList() {
  const queryClient = useQueryClient();
  const [limit, setLimit] = useState(10);

  const [profesionalId, setProfesionalId] = useState('');
  const [fechaTurnoDesde, setFechaTurnoDesde] = useState('');
  const [fechaTurnoHasta, setFechaTurnoHasta] = useState('');
  const [fechaProgramadoDesde, setFechaProgramadoDesde] = useState('');
  const [fechaProgramadoHasta, setFechaProgramadoHasta] = useState('');
  const [fechaUltimoEnvioDesde, setFechaUltimoEnvioDesde] = useState('');
  const [fechaUltimoEnvioHasta, setFechaUltimoEnvioHasta] = useState('');
  const [estado, setEstado] = useState<EstadoRecordatorio | 'todos'>('todos');
  const [page, setPage] = useState(1);
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  const [detalle, setDetalle] = useState<RecordatorioEntry | null>(null);
  const [enviandoId, setEnviandoId] = useState<string | null>(null);

  // Carga de profesionales para el filtro
  const { data: profesionales = [] } = useQuery({
    queryKey: ['profesionales'],
    queryFn: () => profesionalesService.getAll(),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['recordatorios', profesionalId, fechaTurnoDesde, fechaTurnoHasta, fechaProgramadoDesde, fechaProgramadoHasta, fechaUltimoEnvioDesde, fechaUltimoEnvioHasta, estado, page, limit],
    queryFn: () =>
      recordatoriosService.list({
        profesional_id: profesionalId || undefined,
        fecha_turno_desde: fechaTurnoDesde || undefined,
        fecha_turno_hasta: fechaTurnoHasta || undefined,
        fecha_programado_desde: fechaProgramadoDesde || undefined,
        fecha_programado_hasta: fechaProgramadoHasta || undefined,
        fecha_ultimo_envio_desde: fechaUltimoEnvioDesde || undefined,
        fecha_ultimo_envio_hasta: fechaUltimoEnvioHasta || undefined,
        estado: estado !== 'todos' ? estado : undefined,
        page,
        limit,
      }),
  });

  const recordatorios = data?.recordatorios ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 0;

  const handleRecargar = () => {
    queryClient.invalidateQueries({ queryKey: ['recordatorios'] });
    reactToastify.success('Datos actualizados', { position: 'top-right', autoClose: 2000 });
  };

  const handleEnviarManual = async (r: RecordatorioEntry) => {
    setEnviandoId(r.id);
    try {
      await recordatoriosService.enviarManual(r.id);
      queryClient.invalidateQueries({ queryKey: ['recordatorios'] });
      reactToastify.success(
        `Recordatorio enviado a ${formatDisplayText(r.paciente_nombre)} ${formatDisplayText(r.paciente_apellido)}`,
        { position: 'top-right', autoClose: 3000 }
      );
    } catch {
      // El interceptor de la API ya muestra el toast de error; no duplicar
    } finally {
      setEnviandoId(null);
    }
  };

  const puedeEnviar = (r: RecordatorioEntry) =>
    r.estado_recordatorio !== 'sin_numero' &&
    r.estado_recordatorio !== 'anulado' &&
    !r.turno_eliminado &&
    r.recordatorio_activo !== false &&
    r.paciente_notificaciones_activas !== false &&
    !!r.paciente_whatsapp?.trim();

  return (
    <div className="flex-1 flex flex-col space-y-8 max-lg:space-y-4 relative min-h-0">
      {/* Header */}
      <div>
        <h1 className="text-[32px] font-bold text-[#111827] font-['Poppins'] leading-tight tracking-[-0.02em] mb-0">
          Recordatorios
        </h1>
        <p className="text-base text-[#6B7280] mt-2 font-['Inter']">
          {isLoading
            ? 'Cargando...'
            : totalPages > 0
              ? `Mostrando ${(page - 1) * limit + 1}–${Math.min(page * limit, total)} de ${total} registros`
              : `${total} ${total === 1 ? 'registro' : 'registros'}`}
        </p>
      </div>

      {/* Filtros */}
      <Card className="border border-[#E5E7EB] rounded-[16px] shadow-sm">
        <CardContent className="p-6 space-y-4">

          {/* Fila principal: Profesional + Estado + Fecha turno + Recargar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto] gap-4 items-end">
            <div className="space-y-2 min-w-0">
              <Label className="text-[14px] font-medium text-[#374151] font-['Inter']">Profesional</Label>
              <Select value={profesionalId || 'todos'} onValueChange={(v) => { setProfesionalId(v === 'todos' ? '' : v); setPage(1); }}>
                <SelectTrigger className="h-10 w-full border-[#D1D5DB] rounded-[10px] font-['Inter'] text-[14px] focus:border-[#2563eb] focus:ring-[#2563eb]/20">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {profesionales.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {formatDisplayText(p.nombre)} {formatDisplayText(p.apellido)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 min-w-0">
              <Label className="text-[14px] font-medium text-[#374151] font-['Inter']">Estado</Label>
              <Select value={estado} onValueChange={(v) => { setEstado(v as EstadoRecordatorio | 'todos'); setPage(1); }}>
                <SelectTrigger className="h-10 w-full border-[#D1D5DB] rounded-[10px] font-['Inter'] text-[14px] focus:border-[#2563eb] focus:ring-[#2563eb]/20">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="pendiente">Pendiente</SelectItem>
                  <SelectItem value="enviado">Enviado</SelectItem>
                  <SelectItem value="fallido">Fallido</SelectItem>
                  <SelectItem value="anulado">Anulado</SelectItem>
                  <SelectItem value="sin_numero">Sin número</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 min-w-0 max-lg:hidden">
              <Label className="text-[14px] font-medium text-[#374151] font-['Inter']">Fecha turno — desde</Label>
              <DatePicker
                value={fechaTurnoDesde}
                onChange={(v) => { setFechaTurnoDesde(v); setPage(1); }}
                placeholder="Seleccionar fecha"
                className="h-10 w-full border-[#D1D5DB] rounded-[10px] text-[14px] font-['Inter']"
              />
            </div>

            <div className="space-y-2 min-w-0 max-lg:hidden">
              <Label className="text-[14px] font-medium text-[#374151] font-['Inter']">Fecha turno — hasta</Label>
              <DatePicker
                value={fechaTurnoHasta}
                onChange={(v) => { setFechaTurnoHasta(v); setPage(1); }}
                placeholder="Seleccionar fecha"
                min={fechaTurnoDesde || undefined}
                className="h-10 w-full border-[#D1D5DB] rounded-[10px] text-[14px] font-['Inter']"
              />
            </div>

            <Button
              variant="outline"
              onClick={handleRecargar}
              disabled={isLoading}
              className="h-10 rounded-[10px] border-[#6B7280] text-[#6B7280] hover:bg-[#F3F4F6] hover:border-[#6B7280] hover:text-[#374151] focus-visible:ring-0 font-['Inter'] self-end"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Recargar
            </Button>
          </div>

          {/* Toggle "Más filtros" */}
          <button
            type="button"
            onClick={() => setShowMoreFilters((v) => !v)}
            className="flex items-center gap-1.5 text-[13px] font-medium text-[#2563eb] hover:text-[#1d4ed8] transition-colors font-['Inter'] select-none"
          >
            <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${showMoreFilters ? 'rotate-180' : ''}`} />
            {showMoreFilters ? 'Ocultar filtros' : 'Más filtros'}
            {/* Indicador de filtros activos */}
            {(fechaTurnoDesde || fechaTurnoHasta || fechaProgramadoDesde || fechaProgramadoHasta || fechaUltimoEnvioDesde || fechaUltimoEnvioHasta) && (
              <span className="ml-1 h-2 w-2 rounded-full bg-[#2563eb] inline-block" />
            )}
          </button>

          {/* Filtros adicionales colapsables */}
          {showMoreFilters && (
            <div className="space-y-4 pt-1 border-t border-[#E5E7EB]">

              {/* Fecha turno — solo en mobile (en desktop está en la fila principal) */}
              <div className="max-lg:block lg:hidden">
                <p className="text-[12px] font-semibold text-[#6B7280] uppercase tracking-wide font-['Inter'] mb-2">Fecha turno</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5 min-w-0">
                    <Label className="text-[13px] font-medium text-[#374151] font-['Inter']">Desde</Label>
                    <DatePicker
                      value={fechaTurnoDesde}
                      onChange={(v) => { setFechaTurnoDesde(v); setPage(1); }}
                      placeholder="Seleccionar fecha"
                      className="h-10 w-full border-[#D1D5DB] rounded-[10px] text-[14px] font-['Inter']"
                    />
                  </div>
                  <div className="space-y-1.5 min-w-0">
                    <Label className="text-[13px] font-medium text-[#374151] font-['Inter']">Hasta</Label>
                    <DatePicker
                      value={fechaTurnoHasta}
                      onChange={(v) => { setFechaTurnoHasta(v); setPage(1); }}
                      placeholder="Seleccionar fecha"
                      min={fechaTurnoDesde || undefined}
                      className="h-10 w-full border-[#D1D5DB] rounded-[10px] text-[14px] font-['Inter']"
                    />
                  </div>
                </div>
              </div>

              {/* Fecha programado */}
              <div>
                <p className="text-[12px] font-semibold text-[#6B7280] uppercase tracking-wide font-['Inter'] mb-2">Fecha programado</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5 min-w-0">
                    <Label className="text-[13px] font-medium text-[#374151] font-['Inter']">Desde</Label>
                    <DatePicker
                      value={fechaProgramadoDesde}
                      onChange={(v) => { setFechaProgramadoDesde(v); setPage(1); }}
                      placeholder="Seleccionar fecha"
                      className="h-10 w-full border-[#D1D5DB] rounded-[10px] text-[14px] font-['Inter']"
                    />
                  </div>
                  <div className="space-y-1.5 min-w-0">
                    <Label className="text-[13px] font-medium text-[#374151] font-['Inter']">Hasta</Label>
                    <DatePicker
                      value={fechaProgramadoHasta}
                      onChange={(v) => { setFechaProgramadoHasta(v); setPage(1); }}
                      placeholder="Seleccionar fecha"
                      min={fechaProgramadoDesde || undefined}
                      className="h-10 w-full border-[#D1D5DB] rounded-[10px] text-[14px] font-['Inter']"
                    />
                  </div>
                </div>
              </div>

              {/* Último envío */}
              <div>
                <p className="text-[12px] font-semibold text-[#6B7280] uppercase tracking-wide font-['Inter'] mb-2">Último envío</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5 min-w-0">
                    <Label className="text-[13px] font-medium text-[#374151] font-['Inter']">Desde</Label>
                    <DatePicker
                      value={fechaUltimoEnvioDesde}
                      onChange={(v) => { setFechaUltimoEnvioDesde(v); setPage(1); }}
                      placeholder="Seleccionar fecha"
                      className="h-10 w-full border-[#D1D5DB] rounded-[10px] text-[14px] font-['Inter']"
                    />
                  </div>
                  <div className="space-y-1.5 min-w-0">
                    <Label className="text-[13px] font-medium text-[#374151] font-['Inter']">Hasta</Label>
                    <DatePicker
                      value={fechaUltimoEnvioHasta}
                      onChange={(v) => { setFechaUltimoEnvioHasta(v); setPage(1); }}
                      placeholder="Seleccionar fecha"
                      min={fechaUltimoEnvioDesde || undefined}
                      className="h-10 w-full border-[#D1D5DB] rounded-[10px] text-[14px] font-['Inter']"
                    />
                  </div>
                </div>
              </div>

            </div>
          )}

        </CardContent>
      </Card>

      {/* Tabla / estados vacíos */}
      {isLoading ? (
        <Card className="flex-1 border border-[#E5E7EB] rounded-[16px] shadow-sm">
          <CardContent className="p-16 text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-[#2563eb]" />
            <p className="text-[#6B7280] font-['Inter'] text-base">Cargando recordatorios...</p>
          </CardContent>
        </Card>
      ) : recordatorios.length === 0 ? (
        <Card className="flex-1 border border-[#E5E7EB] rounded-[16px] shadow-sm">
          <CardContent className="p-16 text-center">
            <div className="h-20 w-20 rounded-full bg-[#dbeafe] flex items-center justify-center mx-auto mb-4">
              <Bell className="h-10 w-10 text-[#2563eb] stroke-[1.5]" />
            </div>
            <h3 className="text-lg font-semibold mb-2 text-[#374151] font-['Inter']">
              Sin recordatorios
            </h3>
            <p className="text-[#6B7280] font-['Inter']">
              No hay turnos para los filtros seleccionados.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="flex-1 flex flex-col overflow-hidden min-h-0 border border-[#E5E7EB] rounded-[16px] shadow-sm max-lg:min-h-[380px]">
          <div className="flex-1 overflow-auto min-h-0 max-lg:min-h-[300px]">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-[#F9FAFB]">
                <TableRow className="bg-[#F9FAFB] border-b-2 border-[#E5E7EB] hover:bg-[#F9FAFB]">
                  <TableHead className="font-['Inter'] font-medium text-[14px] text-[#374151] py-4 w-[130px]">Paciente</TableHead>
                  <TableHead className="font-['Inter'] font-medium text-[14px] text-[#374151] w-[120px]">WhatsApp</TableHead>
                  <TableHead className="font-['Inter'] font-medium text-[14px] text-[#374151] w-[120px]">Profesional</TableHead>
                  <TableHead className="font-['Inter'] font-medium text-[14px] text-[#374151] w-[80px] text-center">Anticip.</TableHead>
                  <TableHead className="font-['Inter'] font-medium text-[14px] text-[#374151] w-[120px]">Fecha turno</TableHead>
                  <TableHead className="font-['Inter'] font-medium text-[14px] text-[#374151] w-[120px]">Programado</TableHead>
                  <TableHead className="font-['Inter'] font-medium text-[14px] text-[#374151] w-[100px]">Estado</TableHead>
                  <TableHead className="font-['Inter'] font-medium text-[14px] text-[#374151] w-[120px]">Último envío</TableHead>
                  <TableHead className="font-['Inter'] font-medium text-[14px] text-[#374151] w-[50px] text-center">Int.</TableHead>
                  <TableHead className="font-['Inter'] font-medium text-[14px] text-[#374151] w-[100px] text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recordatorios.map((r) => (
                  <TableRow
                    key={r.id}
                    className="border-b border-[#E5E7EB] hover:bg-[#F9FAFB] transition-colors duration-150"
                  >
                    {/* Paciente */}
                    <TableCell className="font-['Inter'] text-[14px] text-[#111827] py-4 font-medium">
                      {formatDisplayText(r.paciente_nombre)} {formatDisplayText(r.paciente_apellido)}
                    </TableCell>

                    {/* WhatsApp */}
                    <TableCell className="font-['Inter'] text-[13px] text-[#6B7280] py-4">
                      {r.paciente_whatsapp
                        ? <span className="text-[#374151]">{r.paciente_whatsapp}</span>
                        : <span className="text-[#9CA3AF] italic">Sin número</span>
                      }
                    </TableCell>

                    {/* Profesional */}
                    <TableCell className="font-['Inter'] text-[14px] text-[#374151] py-4">
                      {formatDisplayText(r.profesional_nombre)} {formatDisplayText(r.profesional_apellido)}
                    </TableCell>

                    {/* Horas antes configuradas — siempre se muestra el valor guardado */}
                    <TableCell className="text-center py-4">
                      {r.recordatorio_horas_antes != null
                        ? <span className={`text-[13px] font-semibold ${r.recordatorio_activo ? 'text-[#2563eb]' : 'text-[#9CA3AF]'}`}>
                            {r.recordatorio_horas_antes}h
                          </span>
                        : <span className="text-[12px] text-[#9CA3AF]">—</span>
                      }
                    </TableCell>

                    {/* Fecha turno */}
                    <TableCell className="text-[#6B7280] text-[13px] whitespace-nowrap font-['Inter'] py-4">
                      {formatFecha(r.fecha_hora_inicio)}
                    </TableCell>

                    {/* Fecha programada */}
                    <TableCell className="text-[#6B7280] text-[13px] whitespace-nowrap font-['Inter'] py-4">
                      {calcRecordatorioProgramado(r.recordatorio_programado_at)}
                    </TableCell>

                    {/* Estado */}
                    <TableCell className="py-4">
                      <div className="flex flex-col gap-1">
                        <EstadoBadge estado={r.estado_recordatorio} />
                        {r.turno_eliminado && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#F3F4F6] text-[#6B7280] font-['Inter'] w-fit">
                            <Trash2 className="h-3 w-3" /> Turno eliminado
                          </span>
                        )}
                      </div>
                    </TableCell>

                    {/* Fecha enviado */}
                    <TableCell className="text-[#6B7280] text-[13px] whitespace-nowrap font-['Inter'] py-4">
                      {r.recordatorio_enviado_at ? formatFecha(r.recordatorio_enviado_at) : '—'}
                    </TableCell>

                    {/* Intentos */}
                    <TableCell className="text-center py-4">
                      <span className={`text-sm font-semibold font-['Inter'] ${
                        r.recordatorio_intentos >= 3 ? 'text-[#DC2626]' : r.recordatorio_intentos > 0 ? 'text-[#D97706]' : 'text-[#6B7280]'
                      }`}>
                        {r.recordatorio_intentos}
                      </span>
                    </TableCell>

                    {/* Acciones */}
                    <TableCell className="py-4 text-right">
                      <TooltipProvider>
                        <div className="flex items-center justify-end gap-1">
                          {(r.recordatorio_ultimo_error || r.estado_recordatorio === 'fallido') && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={() => setDetalle(r)}
                                  className="h-8 w-8 rounded-[8px] hover:bg-[#dbeafe] text-[#2563eb] hover:text-[#1d4ed8]">
                                  <Eye className="h-4 w-4 stroke-[2]" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent className="bg-[#111827] text-white text-xs font-['Inter'] rounded-[8px] px-3 py-2">
                                <p className="text-white">Ver error</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                disabled={!puedeEnviar(r) || enviandoId === r.id}
                                onClick={() => handleEnviarManual(r)}
                                className="h-8 w-8 rounded-[8px] hover:bg-[#dbeafe] text-[#2563eb] hover:text-[#1d4ed8] disabled:opacity-50 disabled:pointer-events-none"
                              >
                                {enviandoId === r.id
                                  ? <Loader2 className="h-4 w-4 animate-spin" />
                                  : <Send className="h-4 w-4 stroke-[2]" />
                                }
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent className="bg-[#111827] text-white text-xs font-['Inter'] rounded-[8px] px-3 py-2">
                              <p className="text-white">Enviar</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </TooltipProvider>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Paginación */}
          {totalPages >= 1 && !isLoading && (
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-[#E5E7EB] bg-[#F9FAFB]">
              <div className="flex items-center gap-6">
                <p className="text-sm text-[#6B7280] font-['Inter'] m-0">
                  Página {page} de {totalPages || 1}
                </p>
                <div className="flex items-center gap-1.5">
                  <span className="max-lg:hidden text-sm text-[#6B7280] font-['Inter']">Cantidad de elementos</span>
                  <Select value={String(limit)} onValueChange={(v) => { setLimit(Number(v)); setPage(1); }}>
                    <SelectTrigger className="h-7 w-[80px] border-[#D1D5DB] rounded-[6px] font-['Inter'] text-[12px] focus:ring-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="h-9 rounded-[8px] border-[#D1D5DB] font-['Inter'] m-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="max-lg:hidden">Anterior</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="h-9 rounded-[8px] border-[#D1D5DB] font-['Inter'] m-0"
                >
                  <span className="max-lg:hidden">Siguiente</span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Modal detalle del error */}
      <Dialog open={!!detalle} onOpenChange={(open) => !open && setDetalle(null)}>
        <DialogContent className="max-w-[620px] w-[95vw] rounded-[20px] p-0 border border-[#E5E7EB] shadow-2xl flex flex-col overflow-hidden">
          <DialogHeader className="flex-shrink-0 px-8 pt-8 pb-6 border-b border-[#E5E7EB] bg-gradient-to-b from-white to-[#F9FAFB] mb-0">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-[#DC2626] to-[#B91C1C] flex items-center justify-center shadow-lg shadow-[#DC2626]/20">
                <XCircle className="h-6 w-6 text-white stroke-[2]" />
              </div>
              <div>
                <DialogTitle className="text-[22px] font-bold text-[#111827] font-['Poppins'] leading-tight mb-0">
                  Error en recordatorio
                </DialogTitle>
                {detalle && (
                  <p className="text-sm text-[#6B7280] font-['Inter'] mt-1 mb-0">
                    {formatDisplayText(detalle.paciente_nombre)} {formatDisplayText(detalle.paciente_apellido)}
                    {' · '}
                    {formatFecha(detalle.fecha_hora_inicio)}
                  </p>
                )}
              </div>
            </div>
          </DialogHeader>

          {detalle && (
            <div className="px-8 py-6 space-y-4 overflow-y-auto max-h-[60vh]">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-[13px] font-medium text-[#374151] font-['Inter']">Intentos realizados</Label>
                  <div className="h-10 border-[1.5px] border-[#E5E7EB] rounded-[10px] bg-[#F9FAFB] px-4 flex items-center font-['Inter'] text-[15px] text-[#DC2626] font-semibold">
                    {detalle.recordatorio_intentos} / 3
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[13px] font-medium text-[#374151] font-['Inter']">Número de contacto</Label>
                  <div className="h-10 border-[1.5px] border-[#E5E7EB] rounded-[10px] bg-[#F9FAFB] px-4 flex items-center font-['Inter'] text-[15px] text-[#374151]">
                    {detalle.paciente_whatsapp || detalle.paciente_telefono || '—'}
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-[13px] font-medium text-[#374151] font-['Inter']">Último error</Label>
                <pre className="m-0 p-4 border-[1.5px] border-[#FCA5A5] rounded-[10px] bg-[#FEF2F2] overflow-x-auto text-[13px] whitespace-pre-wrap break-words font-mono text-[#991B1B] min-h-[80px]">
                  {detalle.recordatorio_ultimo_error || '—'}
                </pre>
              </div>
            </div>
          )}

          <DialogFooter className="flex-shrink-0 flex-row justify-between gap-0 px-8 py-3 border-t border-[#E5E7EB] mt-0">
            <Button
              variant="outline"
              onClick={() => setDetalle(null)}
              className="rounded-[10px] border border-[#D1D5DB] font-['Inter'] text-[15px] px-6 h-10"
            >
              Cerrar
            </Button>
            {detalle && puedeEnviar(detalle) && (
              <Button
                disabled={enviandoId === detalle.id}
                onClick={() => { handleEnviarManual(detalle); setDetalle(null); }}
                className="rounded-[10px] bg-[#059669] hover:bg-[#047857] text-white font-['Inter'] text-[15px] px-6 h-10 gap-2"
              >
                {enviandoId === detalle.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 stroke-[2]" />
                )}
                Reintentar envío
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
