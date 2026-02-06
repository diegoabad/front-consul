import { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ConfirmDeleteModal } from '@/components/shared/ConfirmDeleteModal';
import { DatePicker } from '@/components/ui/date-picker';
import { Edit, Loader2, Trash2, Plus, X } from 'lucide-react';
import { agendaService, type CreateExcepcionAgendaData, type CreateBloqueData, type ExcepcionAgenda, type BloqueNoDisponible } from '@/services/agenda.service';
import type { ConfiguracionAgenda } from '@/types';
import { formatDisplayText } from '@/lib/utils';
import { toast as reactToastify } from 'react-toastify';
import { startOfMonth, endOfMonth, addMonths, subMonths, addDays } from 'date-fns';
import { DIAS_SEMANA, formatTime, formatDiasYHorarios, formatFechaSafe } from '../utils';

export interface GestionarAgendaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profesionalId: string;
  profesionalNombre: string;
  profesionalApellido: string;
  onSuccess?: () => void;
}

type HorarioSemanaItem = { dia_semana: number; atiende: boolean; hora_inicio: string; hora_fin: string; configId?: string };

export function GestionarAgendaModal({
  open,
  onOpenChange,
  profesionalId,
  profesionalNombre,
  profesionalApellido,
  onSuccess,
}: GestionarAgendaModalProps) {
  const queryClient = useQueryClient();

  /** Evita bucle de refs (Presence/compose-refs): montar contenido pesado un frame después de abrir */
  const [contentReady, setContentReady] = useState(false);
  useEffect(() => {
    if (open) {
      const id = requestAnimationFrame(() => setContentReady(true));
      return () => cancelAnimationFrame(id);
    } else {
      setContentReady(false);
    }
  }, [open]);

  const [horariosSemanaForm, setHorariosSemanaForm] = useState<HorarioSemanaItem[]>(() =>
    DIAS_SEMANA.map((d) => ({ dia_semana: d.value, atiende: d.value >= 1 && d.value <= 5, hora_inicio: '09:00', hora_fin: '18:00' }))
  );
  const [vigenciaDesdeGuardar, setVigenciaDesdeGuardar] = useState<string>(() => format(new Date(), 'yyyy-MM-dd'));
  const [horariosEnModoEdicion, setHorariosEnModoEdicion] = useState(false);
  const [showConfirmGuardarHorariosModal, setShowConfirmGuardarHorariosModal] = useState(false);
  const [isSavingHorariosSemana, setIsSavingHorariosSemana] = useState(false);

  const [showExcepcionModal, setShowExcepcionModal] = useState(false);
  const [excepcionToDelete, setExcepcionToDelete] = useState<ExcepcionAgenda | null>(null);
  const [showDeleteExcepcionModal, setShowDeleteExcepcionModal] = useState(false);
  const [excepcionForm, setExcepcionForm] = useState<CreateExcepcionAgendaData & { profesional_id: string }>({
    profesional_id: '',
    fecha: format(new Date(), 'yyyy-MM-dd'),
    hora_inicio: '09:00',
    hora_fin: '13:00',
    duracion_turno_minutos: 30,
    observaciones: '',
  });

  const [activeTab, setActiveTab] = useState('horarios');
  const tabsListScrollRef = useRef<HTMLDivElement>(null);
  const horariosScrollRef = useRef<HTMLDivElement>(null);
  const fechasScrollRef = useRef<HTMLDivElement>(null);
  const bloqueosScrollRef = useRef<HTMLDivElement>(null);

  const centerActiveTabInBar = () => {
    const container = tabsListScrollRef.current;
    if (!container) return;
    const activeTrigger = container.querySelector<HTMLElement>('[data-state="active"]');
    if (!activeTrigger) return;
    const containerWidth = container.clientWidth;
    const triggerLeft = activeTrigger.offsetLeft;
    const triggerWidth = activeTrigger.offsetWidth;
    const scrollLeft = triggerLeft - containerWidth / 2 + triggerWidth / 2;
    const maxScroll = container.scrollWidth - containerWidth;
    container.scrollLeft = Math.max(0, Math.min(scrollLeft, maxScroll));
  };

  const [showBloqueModal, setShowBloqueModal] = useState(false);
  const [bloqueToDelete, setBloqueToDelete] = useState<BloqueNoDisponible | null>(null);
  const [showDeleteBloqueModal, setShowDeleteBloqueModal] = useState(false);
  const [bloqueForm, setBloqueForm] = useState({
    profesional_id: '',
    fecha: format(new Date(), 'yyyy-MM-dd'),
    hora_inicio: '09:00',
    hora_fin: '12:00',
    motivo: '',
  });
  const [bloqueTodoElDia, setBloqueTodoElDia] = useState(false);

  const excepcionesDateRange = useMemo(() => {
    const start = startOfMonth(subMonths(new Date(), 3));
    const end = endOfMonth(addMonths(new Date(), 12));
    return { fecha_desde: format(start, 'yyyy-MM-dd'), fecha_hasta: format(end, 'yyyy-MM-dd') };
  }, []);

  const { data: agendasDelProfesionalConHistorico = [], isLoading: loadingAgendasGestionar } = useQuery({
    queryKey: ['agendas', profesionalId, 'historico'],
    queryFn: () => agendaService.getAllAgenda({ profesional_id: profesionalId, vigente: false }),
    enabled: open && Boolean(profesionalId),
  });

  const { data: excepcionesDelProfesional = [], isLoading: loadingExcepcionesGestionar } = useQuery({
    queryKey: ['excepciones', profesionalId, excepcionesDateRange.fecha_desde, excepcionesDateRange.fecha_hasta],
    queryFn: () =>
      agendaService.getExcepcionesByProfesional(profesionalId, excepcionesDateRange.fecha_desde, excepcionesDateRange.fecha_hasta),
    enabled: open && Boolean(profesionalId),
  });

  const { data: bloquesDelProfesional = [], isLoading: loadingBloquesGestionar } = useQuery({
    queryKey: ['bloques', profesionalId, excepcionesDateRange.fecha_desde, excepcionesDateRange.fecha_hasta],
    queryFn: () =>
      agendaService.getBloquesByProfesional(profesionalId, excepcionesDateRange.fecha_desde, excepcionesDateRange.fecha_hasta),
    enabled: open && Boolean(profesionalId),
  });

  const loadingDatosGestionar = loadingAgendasGestionar || loadingExcepcionesGestionar || loadingBloquesGestionar;

  const currentConfigs = useMemo(() => {
    return (agendasDelProfesionalConHistorico as ConfiguracionAgenda[]).filter(
      (a) => a.profesional_id === profesionalId && !a.vigencia_hasta
    );
  }, [agendasDelProfesionalConHistorico, profesionalId]);

  // Clave estable para evitar que el efecto corra en cada render cuando la ref del array cambia
  const currentConfigsKey = useMemo(
    () =>
      currentConfigs
        .map((c) => `${c.dia_semana}:${c.activo}:${c.hora_inicio}:${c.hora_fin}:${c.id}`)
        .join('|'),
    [currentConfigs]
  );

  useEffect(() => {
    if (!open || !profesionalId) return;
    const byDia = new Map<number, ConfiguracionAgenda>();
    for (const c of currentConfigs) {
      if (!byDia.has(c.dia_semana)) byDia.set(c.dia_semana, c);
    }
    setHorariosSemanaForm(
      DIAS_SEMANA.map((d) => {
        const config = byDia.get(d.value);
        return {
          dia_semana: d.value,
          atiende: Boolean(config?.activo),
          hora_inicio: config ? formatTime(config.hora_inicio) : '09:00',
          hora_fin: config ? formatTime(config.hora_fin) : '18:00',
          configId: config?.id,
        };
      })
    );
  }, [open, profesionalId, currentConfigsKey]);

  useEffect(() => {
    if (open && profesionalId) {
      setVigenciaDesdeGuardar(format(new Date(), 'yyyy-MM-dd'));
      setHorariosEnModoEdicion(false);
    }
  }, [open, profesionalId]);

  useEffect(() => {
    if (open && profesionalId) {
      setExcepcionForm((f) => ({ ...f, profesional_id: profesionalId }));
      setBloqueForm((f) => ({ ...f, profesional_id: profesionalId }));
    }
  }, [open, profesionalId]);

  const resumenHorariosForm = useMemo(() => {
    const items = horariosSemanaForm.filter((i) => i.atiende);
    if (items.length === 0) return 'Ningún día';
    const fakeAgendas: ConfiguracionAgenda[] = items.map((i) => ({
      profesional_id: '',
      dia_semana: i.dia_semana,
      hora_inicio: i.hora_inicio.length >= 5 ? i.hora_inicio : i.hora_inicio + ':00',
      hora_fin: i.hora_fin.length >= 5 ? i.hora_fin : i.hora_fin + ':00',
      duracion_turno_minutos: 30,
      activo: true,
    })) as ConfiguracionAgenda[];
    return formatDiasYHorarios(fakeAgendas);
  }, [horariosSemanaForm]);

  /** Días de la semana en que el profesional atiende (0=domingo, 1=lunes, ..., 6=sábado). Para bloques solo se puede elegir estos días. */
  const diasHabilitadosParaBloque = useMemo(() => {
    const dias = currentConfigs.filter((c) => c.activo).map((c) => c.dia_semana);
    return [...new Set(dias)];
  }, [currentConfigs]);

  const vigenciasAgrupadas = useMemo(() => {
    const configsDelProf = (agendasDelProfesionalConHistorico as ConfiguracionAgenda[]).filter(
      (a) => a.profesional_id === profesionalId
    );
    const byVigencia = new Map<string, ConfiguracionAgenda[]>();
    for (const c of configsDelProf) {
      const desde = c.vigencia_desde ?? '';
      const hasta = c.vigencia_hasta ?? 'vigente';
      const key = `${desde}|${hasta}`;
      if (!byVigencia.has(key)) byVigencia.set(key, []);
      byVigencia.get(key)!.push(c);
    }
    return Array.from(byVigencia.entries())
      .map(([key, configs]) => {
        const [desdeStr, hastaStr] = key.split('|');
        const vigente = hastaStr === 'vigente';
        const texto = formatDiasYHorarios(configs);
        return { desdeStr, hastaStr, vigente, texto, configs };
      })
      .sort((a, b) => {
        if (a.vigente && !b.vigente) return -1;
        if (!a.vigente && b.vigente) return 1;
        return (b.desdeStr || '').localeCompare(a.desdeStr || '');
      });
  }, [agendasDelProfesionalConHistorico, profesionalId]);

  /** Fecha mínima para "A partir de": día siguiente al vigente (evita solapamiento) y nunca antes de hoy. */
  const minFechaNuevoPeriodo = useMemo(() => {
    const hoy = format(new Date(), 'yyyy-MM-dd');
    const vigente = vigenciasAgrupadas.find((v) => v.vigente);
    if (!vigente?.desdeStr) return hoy;
    try {
      const diaDespuesVigente = format(addDays(new Date(vigente.desdeStr + 'T12:00:00'), 1), 'yyyy-MM-dd');
      return diaDespuesVigente > hoy ? diaDespuesVigente : hoy;
    } catch {
      return hoy;
    }
  }, [vigenciasAgrupadas]);

  useEffect(() => {
    if (horariosEnModoEdicion && minFechaNuevoPeriodo) {
      setVigenciaDesdeGuardar((prev) => (!prev || prev < minFechaNuevoPeriodo ? minFechaNuevoPeriodo : prev));
    }
  }, [horariosEnModoEdicion, minFechaNuevoPeriodo]);

  const createExcepcionMutation = useMutation({
    mutationFn: (data: CreateExcepcionAgendaData) => agendaService.createExcepcion(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['excepciones'] });
      queryClient.invalidateQueries({ queryKey: ['agendas'] });
      setShowExcepcionModal(false);
      setExcepcionForm((f) => ({ ...f, fecha: format(new Date(), 'yyyy-MM-dd'), hora_inicio: '09:00', hora_fin: '13:00', observaciones: '' }));
      reactToastify.success('Día puntual agregado correctamente', { position: 'top-right', autoClose: 3000 });
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      reactToastify.error(err?.response?.data?.message || 'Error al agregar día puntual', { position: 'top-right', autoClose: 3000 });
    },
  });

  const deleteExcepcionMutation = useMutation({
    mutationFn: (id: string) => agendaService.deleteExcepcion(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['excepciones'] });
      queryClient.invalidateQueries({ queryKey: ['agendas'] });
      setShowDeleteExcepcionModal(false);
      setExcepcionToDelete(null);
      reactToastify.success('Día puntual eliminado correctamente', { position: 'top-right', autoClose: 3000 });
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      reactToastify.error(err?.response?.data?.message || 'Error al eliminar día puntual', { position: 'top-right', autoClose: 3000 });
    },
  });

  const createBloqueMutation = useMutation({
    mutationFn: (data: CreateBloqueData) => agendaService.createBloque(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bloques'] });
      setShowBloqueModal(false);
      setBloqueForm((f) => ({ ...f, fecha: format(new Date(), 'yyyy-MM-dd'), hora_inicio: '09:00', hora_fin: '12:00', motivo: '' }));
      reactToastify.success('Bloqueo agregado correctamente', { position: 'top-right', autoClose: 3000 });
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      reactToastify.error(err?.response?.data?.message || 'Error al crear bloqueo', { position: 'top-right', autoClose: 3000 });
    },
  });

  const deleteBloqueMutation = useMutation({
    mutationFn: (id: string) => agendaService.deleteBloque(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bloques'] });
      setShowDeleteBloqueModal(false);
      setBloqueToDelete(null);
      reactToastify.success('Bloqueo eliminado correctamente', { position: 'top-right', autoClose: 3000 });
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      reactToastify.error(err?.response?.data?.message || 'Error al eliminar bloqueo', { position: 'top-right', autoClose: 3000 });
    },
  });

  const handleConfirmGuardarHorarios = async () => {
    const fechaDesde = vigenciaDesdeGuardar || format(new Date(), 'yyyy-MM-dd');
    if (minFechaNuevoPeriodo && fechaDesde < minFechaNuevoPeriodo) {
      reactToastify.error(
        `La fecha "A partir de" debe ser posterior al período vigente (mínimo ${formatDisplayText(formatFechaSafe(minFechaNuevoPeriodo))}).`,
        { position: 'top-right', autoClose: 4000 }
      );
      return;
    }
    setIsSavingHorariosSemana(true);
    try {
      const horariosPayload = horariosSemanaForm
        .filter((item) => item.atiende)
        .map((item) => ({
          dia_semana: item.dia_semana,
          hora_inicio: item.hora_inicio.length >= 5 ? item.hora_inicio : item.hora_inicio + ':00',
          hora_fin: item.hora_fin.length >= 5 ? item.hora_fin : item.hora_fin + ':00',
        }));
      try {
        await agendaService.guardarHorariosSemana(profesionalId, horariosPayload, fechaDesde);
      } catch (_) {
        for (const config of currentConfigs) {
          await agendaService.deactivateAgenda(config.id);
        }
        for (const item of horariosSemanaForm) {
          if (!item.atiende) continue;
          await agendaService.createAgenda({
            profesional_id: profesionalId,
            dia_semana: item.dia_semana,
            hora_inicio: item.hora_inicio.length >= 5 ? item.hora_inicio : item.hora_inicio + ':00',
            hora_fin: item.hora_fin.length >= 5 ? item.hora_fin : item.hora_fin + ':00',
            duracion_turno_minutos: 30,
            activo: true,
            vigencia_desde: fechaDesde,
          });
        }
      }
      queryClient.invalidateQueries({ queryKey: ['agendas'] });
      queryClient.invalidateQueries({ queryKey: ['agendas', profesionalId, 'historico'] });
      setShowConfirmGuardarHorariosModal(false);
      setHorariosEnModoEdicion(false);
      reactToastify.success('Horarios de la semana guardados correctamente.', { position: 'top-right', autoClose: 3000 });
      onSuccess?.();
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Error al guardar';
      reactToastify.error(msg, { position: 'top-right', autoClose: 3000 });
    } finally {
      setIsSavingHorariosSemana(false);
    }
  };

  // Cerrar con Escape (ref evita que onOpenChange en deps dispare el efecto en cada render del padre)
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChangeRef.current(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  if (!open) return null;

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="gestionar-agenda-title">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
        aria-hidden
      />
      <div className="relative z-50 max-w-[960px] w-[95vw] h-[72vh] min-h-[500px] sm:min-h-[420px] max-h-[88vh] rounded-[20px] p-0 border border-[#E5E7EB] bg-white shadow-2xl flex flex-col overflow-hidden my-4">
        <div className="px-6 pt-6 pb-4 border-b border-[#E5E7EB] flex-shrink-0 mb-0 flex items-start justify-between gap-4">
          <div>
            <h2 id="gestionar-agenda-title" className="text-[22px] font-bold text-[#111827] font-['Poppins'] mb-0">
              Agenda de {formatDisplayText(profesionalNombre)} {formatDisplayText(profesionalApellido)}
            </h2>
            <p className="text-sm text-[#6B7280] font-['Inter'] mt-1 mb-0">
              Horarios de la semana, fechas puntuales y bloqueos
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
            className="hidden sm:flex h-10 w-10 rounded-full hover:bg-[#F3F4F6] flex-shrink-0"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5 text-[#6B7280] stroke-[2]" />
          </Button>
        </div>

        {!contentReady ? (
            <div className="flex-1 min-h-[460px] flex flex-col items-center justify-center gap-4 px-6 pb-6">
              <Loader2 className="h-10 w-10 text-[#2563eb] animate-spin stroke-[2]" />
              <p className="text-[14px] text-[#6B7280] font-['Inter']">Abriendo...</p>
            </div>
          ) : loadingDatosGestionar ? (
            <div className="flex-1 min-h-[460px] flex flex-col items-center justify-center gap-4 px-6 pb-6">
              <Loader2 className="h-10 w-10 text-[#2563eb] animate-spin stroke-[2]" />
              <p className="text-[14px] text-[#6B7280] font-['Inter']">Cargando horarios, fechas puntuales y bloqueos...</p>
            </div>
          ) : (
            <Tabs
              value={activeTab}
              onValueChange={(v) => {
                setActiveTab(v);
                requestAnimationFrame(() => {
                  if (v === 'horarios') horariosScrollRef.current?.scrollTo(0, 0);
                  else if (v === 'fechas') fechasScrollRef.current?.scrollTo(0, 0);
                  else if (v === 'bloqueos') bloqueosScrollRef.current?.scrollTo(0, 0);
                  requestAnimationFrame(centerActiveTabInBar);
                });
              }}
              className="flex-1 min-h-0 flex flex-col px-6 pb-6 overflow-hidden"
            >
              <div ref={tabsListScrollRef} className="w-full min-w-0 overflow-x-auto sm:overflow-visible flex-shrink-0 mt-4 mb-4">
                <TabsList className="w-full grid grid-cols-3 h-11 rounded-[10px] bg-[#F9FAFB] border border-[#E5E7EB] p-1">
                  <TabsTrigger value="horarios" className="rounded-[8px] text-[14px] font-medium data-[state=active]:bg-[#2563eb] data-[state=active]:text-white min-w-0 whitespace-normal text-center">
                    Horarios de la semana
                  </TabsTrigger>
                  <TabsTrigger value="fechas" className="rounded-[8px] text-[14px] font-medium data-[state=active]:bg-[#2563eb] data-[state=active]:text-white min-w-0 whitespace-normal text-center">
                    Fechas puntuales
                  </TabsTrigger>
                  <TabsTrigger value="bloqueos" className="rounded-[8px] text-[14px] font-medium data-[state=active]:bg-[#2563eb] data-[state=active]:text-white min-w-0 whitespace-normal text-center">
                    Bloqueos
                  </TabsTrigger>
                </TabsList>
              </div>
              <div className="flex-1 min-h-0 flex flex-col min-w-0 w-full">
                <TabsContent value="horarios" className="flex-1 min-h-0 min-w-0 w-full overflow-auto mt-0 data-[state=inactive]:hidden flex flex-col">
                  {!horariosEnModoEdicion ? (
                    <>
                      <div ref={horariosScrollRef} className="flex-1 min-h-0 overflow-auto pb-4">
                        <div className="flex-shrink-0 mb-4 p-3 sm:p-4 rounded-[12px] border-2 border-[#2563eb] bg-[#EFF6FF]">
                          <p className="text-[12px] font-medium text-[#2563eb] font-['Inter'] uppercase tracking-wide mb-1">Vigente</p>
                          {vigenciasAgrupadas.length > 0 && vigenciasAgrupadas[0]?.vigente ? (
                            <p className="text-[14px] sm:text-[16px] font-semibold text-[#111827] font-['Inter'] mb-0">{vigenciasAgrupadas[0].texto}</p>
                          ) : vigenciasAgrupadas.length > 0 ? (
                            <p className="text-[14px] text-[#6B7280] font-['Inter'] mb-0">No hay horarios vigentes (solo historial).</p>
                          ) : (
                            <p className="text-[14px] text-[#6B7280] font-['Inter'] mb-0">Aún no hay horarios de semana configurados.</p>
                          )}
                        </div>
                        <p className="text-[15px] font-medium text-[#374151] font-['Inter'] mb-2">Historial</p>
                        <div className="py-3 w-full min-w-0 overflow-x-auto">
                          {vigenciasAgrupadas.filter((v) => !v.vigente).length > 0 ? (
                            <Table className="w-full min-w-[520px]">
                              <TableHeader>
                                <TableRow className="bg-[#F3F4F6] border-[#E5E7EB] hover:bg-[#F3F4F6]">
                                  <TableHead className="font-['Inter'] text-[12px] font-medium text-[#374151] py-2.5 min-w-[110px] w-[110px]">Desde</TableHead>
                                  <TableHead className="font-['Inter'] text-[12px] font-medium text-[#374151] py-2.5 min-w-[110px] w-[110px]">Hasta</TableHead>
                                  <TableHead className="font-['Inter'] text-[12px] font-medium text-[#374151] py-2.5 min-w-[300px]">Días y horarios</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {vigenciasAgrupadas
                                  .filter((v) => !v.vigente)
                                  .map((v) => (
                                    <TableRow key={`${v.desdeStr}|${v.hastaStr}`} className="border-[#E5E7EB]">
                                      <TableCell className="font-['Inter'] text-[13px] text-[#374151] py-2 min-w-[110px] w-[110px]">{formatDisplayText(formatFechaSafe(v.desdeStr))}</TableCell>
                                      <TableCell className="font-['Inter'] text-[13px] text-[#374151] py-2 min-w-[110px] w-[110px]">{formatDisplayText(formatFechaSafe(v.hastaStr))}</TableCell>
                                      <TableCell className="font-['Inter'] text-[13px] text-[#6B7280] py-2 min-w-[300px] break-words">{v.texto}</TableCell>
                                    </TableRow>
                                  ))}
                              </TableBody>
                            </Table>
                          ) : (
                            <p className="text-[14px] text-[#6B7280] font-['Inter'] py-1">No hay historial de horarios.</p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end flex-shrink-0 pt-4 border-t border-[#E5E7EB]">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => onOpenChangeRef.current(false)}
                          className="rounded-[10px] font-['Inter'] w-full sm:w-auto order-1"
                        >
                          Cerrar
                        </Button>
                        <Button
                          onClick={() => setHorariosEnModoEdicion(true)}
                          className="rounded-[10px] font-['Inter'] bg-[#2563eb] hover:bg-[#1d4ed8] w-full sm:w-auto order-2"
                        >
                          <span className="hidden sm:inline-flex mr-2">
                            <Edit className="h-4 w-4 stroke-[2]" />
                          </span>
                          Modificar horarios
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="mb-4 flex items-center gap-2 flex-wrap">
                        <Label className="text-[14px] font-medium text-[#374151] font-['Inter'] whitespace-nowrap">A partir de:</Label>
                        <DatePicker
                          value={vigenciaDesdeGuardar}
                          onChange={(v) => setVigenciaDesdeGuardar(v || format(new Date(), 'yyyy-MM-dd'))}
                          placeholder="Fecha"
                          className="h-10 min-w-[160px] border-[1.5px] border-[#D1D5DB] rounded-[10px] font-['Inter'] text-[14px]"
                          min={minFechaNuevoPeriodo}
                        />
                      </div>
                      <div className="flex-1 min-h-0 overflow-auto border border-[#E5E7EB] rounded-[12px] mb-4">
                        <Table className="w-full min-w-[480px]">
                          <TableHeader>
                            <TableRow className="bg-[#F9FAFB] border-[#E5E7EB]">
                              <TableHead className="font-['Inter'] text-[13px] text-[#374151] w-[18%] min-w-[70px]">Atiende</TableHead>
                              <TableHead className="font-['Inter'] text-[13px] text-[#374151] w-[22%] min-w-[80px]">Día</TableHead>
                              <TableHead className="font-['Inter'] text-[13px] text-[#374151] min-w-[120px]">Hora inicio</TableHead>
                              <TableHead className="font-['Inter'] text-[13px] text-[#374151] min-w-[120px]">Hora fin</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {horariosSemanaForm.map((item) => (
                              <TableRow key={item.dia_semana} className="border-[#E5E7EB]">
                                <TableCell className="py-2 w-[18%] min-w-[70px]">
                                  <Switch
                                    checked={item.atiende}
                                    onCheckedChange={(checked) => {
                                      setHorariosSemanaForm((prev) =>
                                        prev.map((p) => (p.dia_semana === item.dia_semana ? { ...p, atiende: checked } : p))
                                      );
                                    }}
                                    className="data-[state=checked]:bg-[#2563eb]"
                                  />
                                </TableCell>
                                <TableCell className="font-['Inter'] text-[14px] text-[#374151] py-2 w-[22%] min-w-[80px]">
                                  {DIAS_SEMANA.find((d) => d.value === item.dia_semana)?.label ?? ''}
                                </TableCell>
                                <TableCell className="py-2 min-w-[120px]">
                                  <Input
                                    type="time"
                                    value={item.hora_inicio}
                                    onChange={(e) =>
                                      setHorariosSemanaForm((prev) =>
                                        prev.map((p) => (p.dia_semana === item.dia_semana ? { ...p, hora_inicio: e.target.value } : p))
                                      )
                                    }
                                    className="h-9 w-full min-w-[100px] border-[#D1D5DB] rounded-[8px] font-['Inter'] text-[14px]"
                                    disabled={!item.atiende}
                                  />
                                </TableCell>
                                <TableCell className="py-2 min-w-[120px]">
                                  <Input
                                    type="time"
                                    value={item.hora_fin}
                                    onChange={(e) =>
                                      setHorariosSemanaForm((prev) =>
                                        prev.map((p) => (p.dia_semana === item.dia_semana ? { ...p, hora_fin: e.target.value } : p))
                                      )
                                    }
                                    className="h-9 w-full min-w-[100px] border-[#D1D5DB] rounded-[8px] font-['Inter'] text-[14px]"
                                    disabled={!item.atiende}
                                  />
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between flex-shrink-0">
                        <Button type="button" variant="outline" onClick={() => setHorariosEnModoEdicion(false)} className="rounded-[10px] font-['Inter'] w-full sm:w-auto">
                          Volver
                        </Button>
                        <Button
                          onClick={() => setShowConfirmGuardarHorariosModal(true)}
                          disabled={!horariosSemanaForm.some((i) => i.atiende)}
                          className="rounded-[10px] font-['Inter'] bg-[#2563eb] hover:bg-[#1d4ed8] w-full sm:w-auto"
                        >
                          Guardar
                        </Button>
                      </div>
                    </>
                  )}
                </TabsContent>

                <TabsContent value="fechas" className="flex-1 min-h-0 min-w-0 w-full overflow-auto mt-0 data-[state=inactive]:hidden flex flex-col">
                  <div ref={fechasScrollRef} className="flex-1 min-h-0 min-w-0 overflow-auto pb-4">
                    {excepcionesDelProfesional.length === 0 ? (
                      <p className="text-[14px] text-[#6B7280] font-['Inter'] py-2">No hay fechas puntuales.</p>
                    ) : (
                      <div className="min-w-0 overflow-x-auto">
                      <Table className="w-full min-w-[520px]">
                        <TableHeader>
                          <TableRow className="bg-[#F9FAFB] border-[#E5E7EB]">
                            <TableHead className="font-['Inter'] text-[13px] text-[#374151] min-w-[120px]">Fecha</TableHead>
                            <TableHead className="font-['Inter'] text-[13px] text-[#374151] min-w-[140px]">Horario</TableHead>
                            <TableHead className="font-['Inter'] text-[13px] text-[#374151] min-w-[100px]">Duración</TableHead>
                            <TableHead className="font-['Inter'] text-[13px] text-[#374151] min-w-[80px] w-[80px] text-center">Acciones</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {[...excepcionesDelProfesional]
                            .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''))
                            .map((ex) => (
                              <TableRow key={ex.id} className="border-[#E5E7EB]">
                                <TableCell className="font-['Inter'] text-[14px] text-[#374151] py-2 min-w-[120px]">{formatFechaSafe(ex.fecha)}</TableCell>
                                <TableCell className="font-['Inter'] text-[14px] text-[#6B7280] py-2 min-w-[140px]">
                                  {formatTime(ex.hora_inicio)} - {formatTime(ex.hora_fin)}
                                </TableCell>
                                <TableCell className="font-['Inter'] text-[14px] text-[#6B7280] py-2 min-w-[100px]">{ex.duracion_turno_minutos ?? 30} min</TableCell>
                                <TableCell className="py-2 text-right min-w-[80px] w-[80px]">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      setExcepcionToDelete(ex);
                                      setShowDeleteExcepcionModal(true);
                                    }}
                                    className="h-8 w-8 rounded-[8px] hover:bg-[#FEE2E2] text-[#EF4444]"
                                  >
                                    <Trash2 className="h-4 w-4 stroke-[2]" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end flex-shrink-0 pt-4 border-t border-[#E5E7EB]">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => onOpenChangeRef.current(false)}
                      className="rounded-[10px] font-['Inter'] w-full sm:w-auto order-1"
                    >
                      Cerrar
                    </Button>
                    <Button
                      onClick={() => setShowExcepcionModal(true)}
                      className="rounded-[10px] font-['Inter'] bg-[#2563eb] hover:bg-[#1d4ed8] w-full sm:w-auto order-2"
                    >
                      <span className="hidden sm:inline-flex mr-2">
                        <Plus className="h-4 w-4 stroke-[2]" />
                      </span>
                      Agregar fecha puntual
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="bloqueos" className="flex-1 min-h-0 min-w-0 w-full overflow-auto mt-0 data-[state=inactive]:hidden flex flex-col">
                  <div ref={bloqueosScrollRef} className="flex-1 min-h-0 min-w-0 overflow-auto pb-4">
                    {bloquesDelProfesional.length === 0 ? (
                      <p className="text-[14px] text-[#6B7280] font-['Inter'] py-2">No hay bloqueos.</p>
                    ) : (
                      <div className="min-w-0 overflow-x-auto">
                      <Table className="w-full min-w-[640px]">
                        <TableHeader>
                          <TableRow className="bg-[#F9FAFB] border-[#E5E7EB]">
                            <TableHead className="font-['Inter'] text-[13px] text-[#374151] min-w-[180px]">Desde</TableHead>
                            <TableHead className="font-['Inter'] text-[13px] text-[#374151] min-w-[180px]">Hasta</TableHead>
                            <TableHead className="font-['Inter'] text-[13px] text-[#374151] min-w-[180px]">Motivo</TableHead>
                            <TableHead className="font-['Inter'] text-[13px] text-[#374151] min-w-[80px] w-[80px] text-center">Acciones</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {[...bloquesDelProfesional]
                            .sort((a, b) => (a.fecha_hora_inicio || '').localeCompare(b.fecha_hora_inicio || ''))
                            .map((bloque) => {
                              const desde = bloque.fecha_hora_inicio ? new Date(bloque.fecha_hora_inicio) : null;
                              const hasta = bloque.fecha_hora_fin ? new Date(bloque.fecha_hora_fin) : null;
                              return (
                                <TableRow key={bloque.id} className="border-[#E5E7EB]">
                                  <TableCell className="font-['Inter'] text-[14px] text-[#374151] py-2 min-w-[180px]">
                                    {desde ? formatDisplayText(format(desde, 'd MMM yyyy HH:mm', { locale: es })) : '-'}
                                  </TableCell>
                                  <TableCell className="font-['Inter'] text-[14px] text-[#374151] py-2 min-w-[180px]">
                                    {hasta ? formatDisplayText(format(hasta, 'd MMM yyyy HH:mm', { locale: es })) : '-'}
                                  </TableCell>
                                  <TableCell className="font-['Inter'] text-[14px] text-[#6B7280] py-2 min-w-[180px]">{bloque.motivo || '-'}</TableCell>
                                  <TableCell className="py-2 text-right min-w-[80px] w-[80px]">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => {
                                        setBloqueToDelete(bloque);
                                        setShowDeleteBloqueModal(true);
                                      }}
                                      className="h-8 w-8 rounded-[8px] hover:bg-[#FEE2E2] text-[#EF4444]"
                                    >
                                      <Trash2 className="h-4 w-4 stroke-[2]" />
                                  </Button>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                        </TableBody>
                      </Table>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end flex-shrink-0 pt-4 border-t border-[#E5E7EB]">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => onOpenChangeRef.current(false)}
                      className="rounded-[10px] font-['Inter'] w-full sm:w-auto order-1"
                    >
                      Cerrar
                    </Button>
                    <Button
                      onClick={() => setShowBloqueModal(true)}
                      className="rounded-[10px] font-['Inter'] bg-[#2563eb] hover:bg-[#1d4ed8] w-full sm:w-auto order-2"
                    >
                      <span className="hidden sm:inline-flex mr-2">
                        <Plus className="h-4 w-4 stroke-[2]" />
                      </span>
                      Agregar bloqueo
                    </Button>
                  </div>
                </TabsContent>
              </div>
            </Tabs>
          )}
      </div>
    </div>
  );

  return (
    <>
      {createPortal(modalContent, document.body)}

      {/* Sub-modales */}
      <Dialog open={showExcepcionModal} onOpenChange={setShowExcepcionModal}>
        <DialogContent className="max-w-[480px] rounded-[20px] border border-[#E5E7EB] shadow-2xl p-6">
          <DialogHeader className="mb-4 pb-0 border-b-0">
            <DialogTitle className="text-[22px] font-bold text-[#111827] font-['Poppins'] mb-0">Agregar fecha puntual</DialogTitle>
            <DialogDescription className="text-sm text-[#6B7280] font-['Inter'] mt-1 mb-0">
              Fecha puntual en que el profesional atiende (ej. un miércoles que no suele trabajar)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[14px] font-medium text-[#374151] font-['Inter']">Fecha</Label>
              <DatePicker
                value={excepcionForm.fecha}
                onChange={(fecha) => setExcepcionForm((f) => ({ ...f, fecha }))}
                placeholder="Seleccionar fecha"
                min={format(new Date(), 'yyyy-MM-dd')}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[14px] font-medium text-[#374151] font-['Inter']">Hora inicio</Label>
                <Input
                  type="time"
                  value={excepcionForm.hora_inicio}
                  onChange={(e) => setExcepcionForm((f) => ({ ...f, hora_inicio: e.target.value }))}
                  className="h-[48px] border-[1.5px] border-[#D1D5DB] rounded-[10px] font-['Inter']"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[14px] font-medium text-[#374151] font-['Inter']">Hora fin</Label>
                <Input
                  type="time"
                  value={excepcionForm.hora_fin}
                  onChange={(e) => setExcepcionForm((f) => ({ ...f, hora_fin: e.target.value }))}
                  className="h-[48px] border-[1.5px] border-[#D1D5DB] rounded-[10px] font-['Inter']"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[14px] font-medium text-[#374151] font-['Inter']">Duración del turno (min)</Label>
              <Input
                type="number"
                min={5}
                max={480}
                value={excepcionForm.duracion_turno_minutos ?? 30}
                onChange={(e) => setExcepcionForm((f) => ({ ...f, duracion_turno_minutos: parseInt(e.target.value) || 30 }))}
                className="h-[48px] border-[1.5px] border-[#D1D5DB] rounded-[10px] font-['Inter']"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[14px] font-medium text-[#374151] font-['Inter']">Observaciones (opcional)</Label>
              <Input
                type="text"
                value={excepcionForm.observaciones ?? ''}
                onChange={(e) => setExcepcionForm((f) => ({ ...f, observaciones: e.target.value || undefined }))}
                placeholder="Ej. Consulta especial"
                className="h-[48px] border-[1.5px] border-[#D1D5DB] rounded-[10px] font-['Inter']"
              />
            </div>
          </div>
          <DialogFooter className="mt-6 pt-4 border-t border-[#E5E7EB] flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setShowExcepcionModal(false)} className="rounded-[12px] font-['Inter'] order-1 sm:order-2 w-full sm:w-auto">
              Cancelar
            </Button>
            <Button
              className="rounded-[12px] font-['Inter'] bg-[#2563eb] hover:bg-[#1d4ed8] order-2 sm:order-1 w-full sm:w-auto"
              disabled={createExcepcionMutation.isPending || !excepcionForm.profesional_id || !excepcionForm.fecha}
              onClick={() => {
                const { profesional_id, fecha, hora_inicio, hora_fin, duracion_turno_minutos, observaciones } = excepcionForm;
                createExcepcionMutation.mutate({
                  profesional_id,
                  fecha,
                  hora_inicio,
                  hora_fin,
                  duracion_turno_minutos: duracion_turno_minutos ?? 30,
                  observaciones: observaciones || undefined,
                });
              }}
            >
              {createExcepcionMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Agregar fecha puntual
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showConfirmGuardarHorariosModal} onOpenChange={setShowConfirmGuardarHorariosModal}>
        <DialogContent className="max-w-[440px] rounded-[20px] border border-[#E5E7EB] shadow-2xl p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-[#E5E7EB] mb-0">
            <DialogTitle className="text-[20px] font-bold text-[#111827] font-['Poppins'] mb-0">Confirmar cambios</DialogTitle>
          </DialogHeader>
          <div className="px-6 py-5">
            <p className="text-sm text-[#6B7280] font-['Inter'] mb-0 leading-relaxed">
              A partir del <span className="font-semibold text-[#374151]">{formatDisplayText(formatFechaSafe(vigenciaDesdeGuardar))}</span> serán estos días y horarios:{' '}
              <span className="font-semibold text-[#374151]">{resumenHorariosForm}</span>. ¿Confirmar?
            </p>
          </div>
          <DialogFooter className="px-6 py-4 mt-0 pt-0 flex gap-2 bg-[#F9FAFB]">
            <Button variant="outline" onClick={() => setShowConfirmGuardarHorariosModal(false)} className="rounded-[12px] font-['Inter']">
              Cancelar
            </Button>
            <Button
              className="rounded-[12px] font-['Inter'] bg-[#2563eb] hover:bg-[#1d4ed8]"
              disabled={isSavingHorariosSemana}
              onClick={handleConfirmGuardarHorarios}
            >
              {isSavingHorariosSemana ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteModal
        open={showDeleteExcepcionModal}
        onOpenChange={setShowDeleteExcepcionModal}
        title="Eliminar fecha puntual"
        description={
          excepcionToDelete ? (
            <>
              ¿Estás seguro de que deseas eliminar la fecha puntual del{' '}
              <span className="font-semibold text-[#374151]">{formatFechaSafe(excepcionToDelete.fecha)}</span> (
              {formatTime(excepcionToDelete.hora_inicio)} - {formatTime(excepcionToDelete.hora_fin)})?
            </>
          ) : (
            ''
          )
        }
        onConfirm={() => {
          if (excepcionToDelete) deleteExcepcionMutation.mutate(excepcionToDelete.id);
        }}
        isLoading={deleteExcepcionMutation.isPending}
      />

      <Dialog open={showBloqueModal} onOpenChange={(open) => { setShowBloqueModal(open); if (!open) setBloqueTodoElDia(false); }}>
        <DialogContent className="max-w-[440px] rounded-[20px] border border-[#E5E7EB] shadow-2xl p-6">
          <DialogHeader className="mb-4 pb-0 border-b-0">
            <DialogTitle className="text-[22px] font-bold text-[#111827] font-['Poppins'] mb-0">Agregar bloqueo</DialogTitle>
            <DialogDescription className="text-sm text-[#6B7280] font-['Inter'] mt-1 mb-0">
              Período en que el profesional no atiende (vacaciones, licencia, etc.)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[14px] font-medium text-[#374151] font-['Inter']">Fecha</Label>
              <DatePicker
                value={bloqueForm.fecha}
                onChange={(fecha) => setBloqueForm((f) => ({ ...f, fecha }))}
                placeholder="Seleccionar fecha"
                min={format(new Date(), 'yyyy-MM-dd')}
                allowedDaysOfWeek={diasHabilitadosParaBloque}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="bloque-todo-el-dia"
                checked={bloqueTodoElDia}
                onCheckedChange={(checked) => setBloqueTodoElDia(Boolean(checked))}
                className="data-[state=checked]:bg-[#2563eb] data-[state=checked]:border-[#2563eb]"
              />
              <Label htmlFor="bloque-todo-el-dia" className="text-[14px] font-medium text-[#374151] font-['Inter'] cursor-pointer">
                Todo el día
              </Label>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[14px] font-medium text-[#374151] font-['Inter']">Hora inicio</Label>
                <Input
                  type="time"
                  value={bloqueForm.hora_inicio}
                  onChange={(e) => setBloqueForm((f) => ({ ...f, hora_inicio: e.target.value }))}
                  className="h-[48px] border-[1.5px] border-[#D1D5DB] rounded-[10px] font-['Inter']"
                  disabled={bloqueTodoElDia}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[14px] font-medium text-[#374151] font-['Inter']">Hora fin</Label>
                <Input
                  type="time"
                  value={bloqueForm.hora_fin}
                  onChange={(e) => setBloqueForm((f) => ({ ...f, hora_fin: e.target.value }))}
                  className="h-[48px] border-[1.5px] border-[#D1D5DB] rounded-[10px] font-['Inter']"
                  disabled={bloqueTodoElDia}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[14px] font-medium text-[#374151] font-['Inter']">Motivo (opcional)</Label>
              <Input
                type="text"
                value={bloqueForm.motivo}
                onChange={(e) => setBloqueForm((f) => ({ ...f, motivo: e.target.value }))}
                placeholder="Ej. Vacaciones, licencia"
                className="h-[48px] border-[1.5px] border-[#D1D5DB] rounded-[10px] font-['Inter']"
              />
            </div>
          </div>
          <DialogFooter className="mt-6 pt-4 border-t border-[#E5E7EB] flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setShowBloqueModal(false)} className="rounded-[12px] font-['Inter'] order-1 sm:order-2 w-full sm:w-auto">
              Cancelar
            </Button>
            <Button
              className="rounded-[12px] font-['Inter'] bg-[#2563eb] hover:bg-[#1d4ed8] order-2 sm:order-1 w-full sm:w-auto"
              disabled={createBloqueMutation.isPending || !bloqueForm.profesional_id || !bloqueForm.fecha}
              onClick={() => {
                const horaInicio = bloqueTodoElDia ? '00:00' : bloqueForm.hora_inicio;
                const horaFin = bloqueTodoElDia ? '23:59' : bloqueForm.hora_fin;
                const inicio = new Date(bloqueForm.fecha + 'T' + horaInicio + ':00');
                const fin = new Date(bloqueForm.fecha + 'T' + horaFin + ':00');
                createBloqueMutation.mutate({
                  profesional_id: bloqueForm.profesional_id,
                  fecha_hora_inicio: inicio.toISOString(),
                  fecha_hora_fin: fin.toISOString(),
                  motivo: bloqueForm.motivo || undefined,
                });
              }}
            >
              {createBloqueMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Agregar bloqueo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteModal
        open={showDeleteBloqueModal}
        onOpenChange={setShowDeleteBloqueModal}
        title="Eliminar bloqueo"
        description={
          bloqueToDelete ? (
            <>
              ¿Estás seguro de que deseas eliminar este bloqueo (
              <span className="font-semibold text-[#374151]">
                {bloqueToDelete.fecha_hora_inicio ? formatDisplayText(format(new Date(bloqueToDelete.fecha_hora_inicio), 'd MMM yyyy HH:mm', { locale: es })) : ''}
              </span>
              {' – '}
              <span className="font-semibold text-[#374151]">
                {bloqueToDelete.fecha_hora_fin ? formatDisplayText(format(new Date(bloqueToDelete.fecha_hora_fin), 'd MMM yyyy HH:mm', { locale: es })) : ''}
              </span>
              )?
            </>
          ) : (
            ''
          )
        }
        onConfirm={() => {
          if (bloqueToDelete) deleteBloqueMutation.mutate(bloqueToDelete.id);
        }}
        isLoading={deleteBloqueMutation.isPending}
      />
    </>
  );
}
