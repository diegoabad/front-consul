import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { 
  Calendar, Plus, Edit, Trash2, Loader2, Clock, User, CalendarDays
} from 'lucide-react';
import { agendaService, type CreateAgendaData, type CreateExcepcionAgendaData, type ExcepcionAgenda, type BloqueNoDisponible, type CreateBloqueData } from '@/services/agenda.service';
import { profesionalesService } from '@/services/profesionales.service';
import type { ConfiguracionAgenda } from '@/types';
import { toast as reactToastify } from 'react-toastify';
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';

// Orden: Lunes primero (1), luego Martes... Sábado (6), Domingo (0) al final
const DIAS_SEMANA = [
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sábado' },
  { value: 0, label: 'Domingo' },
];

// Etiquetas cortas para agrupación: Lu, Ma, Mi, Ju, Vi, Sá, Do
const DIAS_CORTOS: Record<number, string> = {
  1: 'Lu', 2: 'Ma', 3: 'Mi', 4: 'Ju', 5: 'Vi', 6: 'Sá', 0: 'Do',
};

function getDiaSemanaLabel(dia: number): string {
  return DIAS_SEMANA.find(d => d.value === dia)?.label || '';
}

/** Agrupa configuraciones por (hora_inicio, hora_fin) y devuelve texto tipo "Lu-Ma-Mi 09:00-18:00 · Ju-Vi 08:00-14:00" */
function formatDiasYHorarios(agendas: ConfiguracionAgenda[]): string {
  if (agendas.length === 0) return '—';
  const bySlot = new Map<string, number[]>();
  for (const a of agendas) {
    const key = `${formatTime(a.hora_inicio)}-${formatTime(a.hora_fin)}`;
    if (!bySlot.has(key)) bySlot.set(key, []);
    bySlot.get(key)!.push(a.dia_semana);
  }
  const ordenDias = [1, 2, 3, 4, 5, 6, 0];
  const parts: string[] = [];
  bySlot.forEach((dias, slot) => {
    dias.sort((a, b) => ordenDias.indexOf(a) - ordenDias.indexOf(b));
    const labels = dias.map(d => DIAS_CORTOS[d] ?? '').filter(Boolean);
    parts.push(`${labels.join('-')} ${slot}`);
  });
  return parts.join(' · ');
}

function formatTime(time: string): string {
  return time.substring(0, 5);
}

/** Formatea una fecha para mostrar (d MMM yyyy). Si viene en ISO, usa solo la parte YYYY-MM-DD. */
function formatFechaSafe(fecha: string | null | undefined): string {
  if (!fecha) return '-';
  const dateOnly = typeof fecha === 'string' && fecha.length >= 10 ? fecha.slice(0, 10) : fecha;
  const d = new Date(dateOnly + 'T12:00:00');
  if (Number.isNaN(d.getTime())) return '-';
  return format(d, 'd MMM yyyy', { locale: es });
}

function getEstadoBadge(activo: boolean) {
  return activo ? (
    <Badge className="bg-[#D1FAE5] text-[#065F46] border-[#6EE7B7] hover:bg-[#A7F3D0] rounded-full px-3 py-1 text-xs font-medium">
      Activo
    </Badge>
  ) : (
    <Badge className="bg-[#F3F4F6] text-[#4B5563] border-[#D1D5DB] hover:bg-[#E5E7EB] rounded-full px-3 py-1 text-xs font-medium">
      Inactivo
    </Badge>
  );
}

/** Devuelve true si [a1, a2] y [b1, b2] se solapan (horas en formato HH:mm). */
function horariosSeSolapan(a1: string, a2: string, b1: string, b2: string): boolean {
  const toMin = (t: string) => {
    const [h, m] = t.substring(0, 5).split(':').map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
  };
  const startA = toMin(a1);
  const endA = toMin(a2);
  const startB = toMin(b1);
  const endB = toMin(b2);
  return startA < endB && startB < endA;
}

export default function AdminAgendas() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [profesionalFilter, setProfesionalFilter] = useState<string>('todos');
  
  const [showAgendaModal, setShowAgendaModal] = useState(false);
  const [showGestionarModal, setShowGestionarModal] = useState(false);
  const [_gestionarTab, _setGestionarTab] = useState<'horarios' | 'puntuales'>('horarios');
  const [showDeleteAgendaModal, setShowDeleteAgendaModal] = useState(false);
  const [agendaToDelete, setAgendaToDelete] = useState<ConfiguracionAgenda | null>(null);
  const [profesionalGestionar, setProfesionalGestionar] = useState<{ id: string; nombre: string; apellido: string } | null>(null);
  const [editingAgenda, setEditingAgenda] = useState<ConfiguracionAgenda | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [agendaForm, setAgendaForm] = useState<CreateAgendaData & { vigencia_desde?: string }>({
    profesional_id: '',
    dia_semana: 1,
    hora_inicio: '09:00',
    hora_fin: '18:00',
    duracion_turno_minutos: 30,
    activo: true,
    vigencia_desde: format(new Date(), 'yyyy-MM-dd'),
  });
  const [diasHorarios, setDiasHorarios] = useState<Record<number, { hora_inicio: string; hora_fin: string }>>(
    () => Object.fromEntries(DIAS_SEMANA.map(d => [d.value, { hora_inicio: '09:00', hora_fin: '18:00' }]))
  );
  // Lunes(1)-Viernes(5) activos por defecto, Sábado(6) y Domingo(0) no
  const [diasActivos, setDiasActivos] = useState<Record<number, boolean>>(
    () => Object.fromEntries(DIAS_SEMANA.map(d => [d.value, d.value >= 1 && d.value <= 5]))
  );

  /** Al crear nueva agenda: true = días fijos por semana (tabla Lu–Do), false = solo días puntuales */
  const [diasFijosSemana, setDiasFijosSemana] = useState(true);
  /** Primera fecha puntual (obligatoria cuando "solo días puntuales") */
  const [primeraFechaPuntual, setPrimeraFechaPuntual] = useState<{
    fecha: string;
    hora_inicio: string;
    hora_fin: string;
    duracion_turno_minutos: number;
  }>({
    fecha: format(new Date(), 'yyyy-MM-dd'),
    hora_inicio: '09:00',
    hora_fin: '18:00',
    duracion_turno_minutos: 30,
  });

  // Días puntuales (fechas concretas en que el profesional atiende)
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
  // Bloqueos (no disponible)
  const [showBloqueModal, setShowBloqueModal] = useState(false);
  const [bloqueToDelete, setBloqueToDelete] = useState<BloqueNoDisponible | null>(null);
  const [showDeleteBloqueModal, setShowDeleteBloqueModal] = useState(false);
  const [bloqueForm, setBloqueForm] = useState<{
    profesional_id: string;
    fecha: string;
    hora_inicio: string;
    hora_fin: string;
    motivo: string;
  }>({
    profesional_id: '',
    fecha: format(new Date(), 'yyyy-MM-dd'),
    hora_inicio: '09:00',
    hora_fin: '12:00',
    motivo: '',
  });

  /** Formulario de los 7 días en el modal Gestionar (Horarios de la semana). Un item por día. */
  type HorarioSemanaItem = { dia_semana: number; atiende: boolean; hora_inicio: string; hora_fin: string; configId?: string };
  const [horariosSemanaForm, setHorariosSemanaForm] = useState<HorarioSemanaItem[]>(() =>
    DIAS_SEMANA.map(d => ({ dia_semana: d.value, atiende: d.value >= 1 && d.value <= 5, hora_inicio: '09:00', hora_fin: '18:00' }))
  );
  const [showConfirmDesactivarDia, setShowConfirmDesactivarDia] = useState(false);
  const [diaDesactivarPending, setDiaDesactivarPending] = useState<number | null>(null);
  const [isSavingHorariosSemana, setIsSavingHorariosSemana] = useState(false);

  // Queries
  const { data: profesionales = [], isLoading: loadingProfesionales } = useQuery({
    queryKey: ['profesionales'],
    queryFn: () => profesionalesService.getAll(),
  });

  const { data: agendas = [], isLoading: loadingAgendas } = useQuery({
    queryKey: ['agendas', profesionalFilter],
    queryFn: () => {
      const filters: Record<string, string | boolean> = {};
      if (profesionalFilter !== 'todos') filters.profesional_id = profesionalFilter;
      return agendaService.getAllAgenda(filters);
    },
  });

  // Profesionales que ya tienen agenda (configs o excepciones) para deshabilitarlos en Nueva Agenda
  const { data: todasLasAgendas = [] } = useQuery({
    queryKey: ['agendas', 'todos-para-nueva'],
    queryFn: () => agendaService.getAllAgenda({ activo: true, vigente: false }),
  });
  const excepcionesDateRangeLista = useMemo(() => {
    const start = startOfMonth(subMonths(new Date(), 12));
    const end = endOfMonth(addMonths(new Date(), 24));
    return { fecha_desde: format(start, 'yyyy-MM-dd'), fecha_hasta: format(end, 'yyyy-MM-dd') };
  }, []);
  const { data: todasLasExcepciones = [] } = useQuery({
    queryKey: ['excepciones', 'todos-para-lista', excepcionesDateRangeLista.fecha_desde, excepcionesDateRangeLista.fecha_hasta],
    queryFn: () => agendaService.getAllExcepciones(excepcionesDateRangeLista),
  });
  const profesionalesConAgendaIds = useMemo(
    () => new Set([
      ...todasLasAgendas.map((a) => a.profesional_id),
      ...todasLasExcepciones.map((e) => e.profesional_id),
    ]),
    [todasLasAgendas, todasLasExcepciones]
  );

  // Sincronizar formulario de 7 días cuando se abre el modal de gestionar
  useEffect(() => {
    if (!showGestionarModal || !profesionalGestionar) return;
    const configsDelProf = (agendas as ConfiguracionAgenda[]).filter(a => a.profesional_id === profesionalGestionar.id);
    const byDia = new Map<number, ConfiguracionAgenda>();
    for (const c of configsDelProf) {
      if (!byDia.has(c.dia_semana)) byDia.set(c.dia_semana, c);
    }
    setHorariosSemanaForm(
      DIAS_SEMANA.map(d => {
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
  }, [showGestionarModal, profesionalGestionar?.id, agendas]);

  const excepcionesDateRange = useMemo(() => {
    const start = startOfMonth(subMonths(new Date(), 3));
    const end = endOfMonth(addMonths(new Date(), 12));
    return { fecha_desde: format(start, 'yyyy-MM-dd'), fecha_hasta: format(end, 'yyyy-MM-dd') };
  }, []);
  const { data: excepcionesDelProfesional = [] } = useQuery({
    queryKey: ['excepciones', profesionalGestionar?.id, excepcionesDateRange.fecha_desde, excepcionesDateRange.fecha_hasta],
    queryFn: () =>
      profesionalGestionar
        ? agendaService.getExcepcionesByProfesional(
            profesionalGestionar.id,
            excepcionesDateRange.fecha_desde,
            excepcionesDateRange.fecha_hasta
          )
        : Promise.resolve([]),
    enabled: Boolean(profesionalGestionar?.id),
  });

  const { data: bloquesDelProfesional = [] } = useQuery({
    queryKey: ['bloques', profesionalGestionar?.id, excepcionesDateRange.fecha_desde, excepcionesDateRange.fecha_hasta],
    queryFn: () =>
      profesionalGestionar
        ? agendaService.getBloquesByProfesional(
            profesionalGestionar.id,
            excepcionesDateRange.fecha_desde,
            excepcionesDateRange.fecha_hasta
          )
        : Promise.resolve([]),
    enabled: Boolean(profesionalGestionar?.id),
  });

  // Mutations
  const updateAgendaMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateAgendaData> }) =>
      agendaService.updateAgenda(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agendas'] });
      setShowAgendaModal(false);
      setEditingAgenda(null);
      resetAgendaForm();
      reactToastify.success('Configuración de agenda actualizada correctamente', {
        position: 'top-right',
        autoClose: 3000,
      });
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      const errorMessage = err?.response?.data?.message || 'Error al actualizar configuración de agenda';
      reactToastify.error(errorMessage, {
        position: 'top-right',
        autoClose: 3000,
      });
    },
  });

  const deleteAgendaMutation = useMutation({
    mutationFn: (id: string) => agendaService.deleteAgenda(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agendas'] });
      setShowDeleteAgendaModal(false);
      setAgendaToDelete(null);
      reactToastify.success('Configuración de agenda eliminada correctamente', {
        position: 'top-right',
        autoClose: 3000,
      });
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      const errorMessage = err?.response?.data?.message || 'Error al eliminar configuración de agenda';
      reactToastify.error(errorMessage, {
        position: 'top-right',
        autoClose: 3000,
      });
    },
  });

  const createExcepcionMutation = useMutation({
    mutationFn: (data: CreateExcepcionAgendaData) => agendaService.createExcepcion(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['excepciones'] });
      setShowExcepcionModal(false);
      setExcepcionForm((f) => ({ ...f, fecha: format(new Date(), 'yyyy-MM-dd'), hora_inicio: '09:00', hora_fin: '13:00', observaciones: '' }));
      reactToastify.success('Día puntual agregado correctamente', {
        position: 'top-right',
        autoClose: 3000,
      });
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

  const filteredAgendas = useMemo(() => agendas, [agendas]);

  /** Agrupado por profesional para la tabla: incluye configs y profesionales con solo excepciones */
  const agendasPorProfesional = useMemo(() => {
    const byProf = new Map<string, { profesional_id: string; profesional_nombre: string; profesional_apellido: string; profesional_especialidad?: string; agendas: ConfiguracionAgenda[]; soloExcepciones?: boolean }>();
    for (const a of filteredAgendas) {
      const key = a.profesional_id;
      if (!byProf.has(key)) {
        byProf.set(key, {
          profesional_id: a.profesional_id,
          profesional_nombre: a.profesional_nombre ?? '',
          profesional_apellido: a.profesional_apellido ?? '',
          profesional_especialidad: a.profesional_especialidad,
          agendas: [],
        });
      }
      byProf.get(key)!.agendas.push(a);
    }
    const profIdsConExcepcion = new Set(todasLasExcepciones.map((e) => e.profesional_id));
    for (const profId of profIdsConExcepcion) {
      if (byProf.has(profId)) continue;
      const prof = profesionales.find((p) => p.id === profId);
      if (prof) {
        byProf.set(profId, {
          profesional_id: profId,
          profesional_nombre: prof.nombre ?? '',
          profesional_apellido: prof.apellido ?? '',
          profesional_especialidad: prof.especialidad,
          agendas: [],
          soloExcepciones: true,
        });
      }
    }
    return Array.from(byProf.values());
  }, [filteredAgendas, todasLasExcepciones, profesionales]);

  // Handlers
  const resetAgendaForm = () => {
    setAgendaForm({
      profesional_id: '',
      dia_semana: 1,
      hora_inicio: '09:00',
      hora_fin: '18:00',
      duracion_turno_minutos: 30,
      activo: true,
      vigencia_desde: format(new Date(), 'yyyy-MM-dd'),
    });
    setDiasHorarios(Object.fromEntries(DIAS_SEMANA.map(d => [d.value, { hora_inicio: '09:00', hora_fin: '18:00' }])));
    setDiasActivos(Object.fromEntries(DIAS_SEMANA.map(d => [d.value, false])));
    setEditingAgenda(null);
    setDiasFijosSemana(true);
    setPrimeraFechaPuntual({
      fecha: format(new Date(), 'yyyy-MM-dd'),
      hora_inicio: '09:00',
      hora_fin: '18:00',
      duracion_turno_minutos: 30,
    });
  };

  const handleOpenAgendaModal = (agenda?: ConfiguracionAgenda) => {
    if (agenda) {
      setEditingAgenda(agenda);
      setAgendaForm({
        profesional_id: agenda.profesional_id,
        dia_semana: agenda.dia_semana,
        hora_inicio: formatTime(agenda.hora_inicio),
        hora_fin: formatTime(agenda.hora_fin),
        duracion_turno_minutos: agenda.duracion_turno_minutos,
        activo: agenda.activo,
      });
    } else {
      resetAgendaForm();
      setDiasFijosSemana(true);
    }
    setShowAgendaModal(true);
  };

  const handleSubmitAgenda = async () => {
    if (!agendaForm.profesional_id) {
      reactToastify.error('Selecciona un profesional', { position: 'top-right', autoClose: 3000 });
      return;
    }
    if (!editingAgenda && diasFijosSemana) {
      const algunDiaActivo = DIAS_SEMANA.some((d) => diasActivos[d.value]);
      if (!algunDiaActivo) {
        reactToastify.error('Seleccioná al menos un día de la semana', { position: 'top-right', autoClose: 3000 });
        return;
      }
    }
    if (!editingAgenda && !diasFijosSemana) {
      if (!primeraFechaPuntual.fecha) {
        reactToastify.error('Ingresá la primera fecha en que atiende el profesional', { position: 'top-right', autoClose: 3000 });
        return;
      }
      const hi = primeraFechaPuntual.hora_inicio.trim();
      const hf = primeraFechaPuntual.hora_fin.trim();
      if (!hi || !hf || hi >= hf) {
        reactToastify.error('La hora fin debe ser posterior a la hora inicio', { position: 'top-right', autoClose: 3000 });
        return;
      }
    }
    setIsSubmitting(true);
    try {
      if (editingAgenda) {
        await updateAgendaMutation.mutateAsync({ id: editingAgenda.id, data: agendaForm });
      } else if (!diasFijosSemana) {
        await agendaService.createExcepcion({
          profesional_id: agendaForm.profesional_id,
          fecha: primeraFechaPuntual.fecha,
          hora_inicio: primeraFechaPuntual.hora_inicio.length >= 5 ? primeraFechaPuntual.hora_inicio : primeraFechaPuntual.hora_inicio + ':00',
          hora_fin: primeraFechaPuntual.hora_fin.length >= 5 ? primeraFechaPuntual.hora_fin : primeraFechaPuntual.hora_fin + ':00',
          duracion_turno_minutos: primeraFechaPuntual.duracion_turno_minutos ?? 30,
        });
        queryClient.invalidateQueries({ queryKey: ['excepciones'] });
        reactToastify.success('Agenda creada con la primera fecha puntual. Podés agregar más desde Gestionar → Fechas puntuales.', {
          position: 'top-right',
          autoClose: 4000,
        });
        setShowAgendaModal(false);
        resetAgendaForm();
      } else {
        const agendasExistentes = await agendaService.getAgendaByProfesional(agendaForm.profesional_id);
        const diasConSolapamiento: string[] = [];

        for (const dia of DIAS_SEMANA) {
          if (!diasActivos[dia.value]) continue;
          const { hora_inicio, hora_fin } = diasHorarios[dia.value] ?? { hora_inicio: '09:00', hora_fin: '18:00' };
          if (!hora_inicio || !hora_fin || hora_inicio >= hora_fin) continue;

          const existentesDelDia = agendasExistentes.filter((a) => a.dia_semana === dia.value);
          // Si vamos a actualizar una existente, solo comprobamos solapamiento con las demás del mismo día
          const configsAComparar = existentesDelDia.length > 0 ? existentesDelDia.slice(1) : existentesDelDia;
          const solapa = configsAComparar.some(
            (a) => horariosSeSolapan(hora_inicio, hora_fin, formatTime(a.hora_inicio), formatTime(a.hora_fin))
          );
          if (solapa) {
            diasConSolapamiento.push(getDiaSemanaLabel(dia.value));
          }
        }

        if (diasConSolapamiento.length > 0) {
          reactToastify.error(
            `El profesional ya tiene horarios en: ${diasConSolapamiento.join(', ')}. No se pueden superponer.`,
            { position: 'top-right', autoClose: 5000 }
          );
          return;
        }

        let creados = 0;
        let actualizados = 0;
        for (const dia of DIAS_SEMANA) {
          if (!diasActivos[dia.value]) continue;
          const { hora_inicio, hora_fin } = diasHorarios[dia.value] ?? { hora_inicio: '09:00', hora_fin: '18:00' };
          if (!hora_inicio || !hora_fin || hora_inicio >= hora_fin) continue;

          const existentesDelDia = agendasExistentes.filter((a) => a.dia_semana === dia.value);
          const dataDia = {
            hora_inicio,
            hora_fin,
            duracion_turno_minutos: agendaForm.duracion_turno_minutos ?? 30,
            activo: agendaForm.activo ?? true,
          };

          if (existentesDelDia.length > 0) {
            await agendaService.updateAgenda(existentesDelDia[0].id, dataDia);
            actualizados++;
          } else {
            await agendaService.createAgenda({
              profesional_id: agendaForm.profesional_id,
              dia_semana: dia.value,
              ...dataDia,
              vigencia_desde: agendaForm.vigencia_desde ?? format(new Date(), 'yyyy-MM-dd'),
            });
            creados++;
          }
        }
        if (creados > 0 || actualizados > 0) {
          queryClient.invalidateQueries({ queryKey: ['agendas'] });
          const mensajes: string[] = [];
          if (creados > 0) mensajes.push(creados === 1 ? '1 día creado' : `${creados} días creados`);
          if (actualizados > 0) mensajes.push(actualizados === 1 ? '1 día actualizado' : `${actualizados} días actualizados`);
          reactToastify.success(`Agenda guardada: ${mensajes.join(', ')}.`, {
            position: 'top-right',
            autoClose: 3000,
          });
          setShowAgendaModal(false);
          resetAgendaForm();
        }
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Error al guardar la agenda';
      reactToastify.error(msg, { position: 'top-right', autoClose: 4000 });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLoading = loadingAgendas || loadingProfesionales;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[32px] font-bold text-[#111827] font-['Poppins'] leading-tight tracking-[-0.02em] mb-0">
            Agendas
          </h1>
          <p className="text-base text-[#6B7280] mt-2 font-['Inter']">
            Horarios de trabajo por profesional
          </p>
        </div>
        <Button
          onClick={() => handleOpenAgendaModal()}
          className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-md shadow-[#2563eb]/20 hover:shadow-lg hover:shadow-[#2563eb]/30 transition-all duration-200 rounded-[12px] px-6 py-3 h-auto font-medium"
        >
          <Plus className="h-5 w-5 mr-2 stroke-[2]" />
          Nueva Agenda
        </Button>
      </div>

      {/* Filtros */}
      <Card className="border border-[#E5E7EB] rounded-[16px] shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <Select value={profesionalFilter} onValueChange={setProfesionalFilter}>
              <SelectTrigger className="h-12 border-[#D1D5DB] rounded-[10px] font-['Inter'] text-[15px] focus:border-[#2563eb] focus:ring-[#2563eb]/20 sm:min-w-[280px]">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-[#6B7280] stroke-[2]" />
                  <SelectValue placeholder="Todos los profesionales" />
                </div>
              </SelectTrigger>
              <SelectContent className="rounded-[12px]">
                <SelectItem value="todos" className="font-['Inter']">Todos los profesionales</SelectItem>
                {profesionales.map(p => (
                  <SelectItem key={p.id} value={p.id} className="font-['Inter']">
                    {p.nombre} {p.apellido}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

          {/* Tabla o Empty State */}
          {isLoading ? (
            <Card className="border border-[#E5E7EB] rounded-[16px] shadow-sm">
              <CardContent className="p-16 text-center">
                <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-[#2563eb]" />
                <p className="text-[#6B7280] font-['Inter'] text-base">Cargando configuraciones...</p>
              </CardContent>
            </Card>
          ) : agendasPorProfesional.length === 0 ? (
            <Card className="border border-[#E5E7EB] rounded-[16px] shadow-sm">
              <CardContent className="p-16 text-center">
                <div className="h-20 w-20 rounded-full bg-[#dbeafe] flex items-center justify-center mx-auto mb-4">
                  <Calendar className="h-10 w-10 text-[#2563eb] stroke-[2]" />
                </div>
                <h3 className="text-lg font-semibold mb-2 text-[#374151] font-['Inter']">
                  No hay configuraciones de agenda
                </h3>
                <p className="text-[#6B7280] mb-6 font-['Inter']">
                  {profesionalFilter !== 'todos' ? 'No hay configuraciones para el profesional seleccionado' : 'Crea una nueva agenda para comenzar'}
                </p>
                <Button
                  onClick={() => handleOpenAgendaModal()}
                  className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-md shadow-[#2563eb]/20 hover:shadow-lg hover:shadow-[#2563eb]/30 transition-all duration-200 rounded-[12px] px-6 py-3 h-auto font-medium"
                >
                  <Plus className="h-5 w-5 mr-2 stroke-[2]" />
                  Nueva Agenda
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="border border-[#E5E7EB] rounded-[16px] shadow-sm overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#F9FAFB] border-b-2 border-[#E5E7EB] hover:bg-[#F9FAFB]">
                    <TableHead className="font-['Inter'] font-medium text-[14px] text-[#374151] py-4">
                      Profesional
                    </TableHead>
                    <TableHead className="font-['Inter'] font-medium text-[14px] text-[#374151]">
                      Días y horarios
                    </TableHead>
                    <TableHead className="font-['Inter'] font-medium text-[14px] text-[#374151]">
                      Duración
                    </TableHead>
                    <TableHead className="font-['Inter'] font-medium text-[14px] text-[#374151]">
                      Estado
                    </TableHead>
                    <TableHead className="font-['Inter'] font-medium text-[14px] text-[#374151] w-[120px]">
                      Acciones
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agendasPorProfesional.map((grupo) => (
                    <TableRow
                      key={grupo.profesional_id}
                      className="border-b border-[#E5E7EB] hover:bg-[#F9FAFB] transition-colors duration-150"
                    >
                      <TableCell className="py-4">
                        <div>
                          <p className="font-medium text-[#374151] font-['Inter'] text-[15px] mb-0">
                            {grupo.profesional_nombre} {grupo.profesional_apellido}
                          </p>
                          {grupo.profesional_especialidad && (
                            <p className="text-sm text-[#6B7280] font-['Inter'] mb-0">
                              {grupo.profesional_especialidad}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-[#374151] font-['Inter'] text-[14px] flex-wrap">
                          <Clock className="h-4 w-4 text-[#6B7280] stroke-[2] flex-shrink-0" />
                          {grupo.soloExcepciones ? (
                            <span className="text-[#6B7280] italic">Solo días puntuales</span>
                          ) : (
                            formatDiasYHorarios(grupo.agendas)
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-[#6B7280] font-['Inter'] text-[14px]">
                          {grupo.soloExcepciones
                            ? '—'
                            : grupo.agendas.some((a) => a.duracion_turno_minutos !== grupo.agendas[0]?.duracion_turno_minutos)
                              ? 'Varia'
                              : `${grupo.agendas[0]?.duracion_turno_minutos ?? 30} min`}
                        </span>
                      </TableCell>
                      <TableCell>
                        {getEstadoBadge(grupo.soloExcepciones ? true : grupo.agendas.every((a) => a.activo))}
                      </TableCell>
                      <TableCell className="text-right">
                        <TooltipProvider>
                          <div className="flex items-center justify-end gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => navigate(`/turnos?profesional=${grupo.profesional_id}`)}
                                  className="h-8 w-8 rounded-[8px] hover:bg-[#DBEAFE] transition-all duration-200 text-[#1E40AF] hover:text-[#1D4ED8]"
                                >
                                  <Calendar className="h-4 w-4 stroke-[2]" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent className="bg-[#111827] text-white text-xs font-['Inter'] rounded-[8px] px-3 py-2 [&>p]:text-white">
                                <p className="text-white">Ir a la agenda</p>
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setProfesionalGestionar({
                                      id: grupo.profesional_id,
                                      nombre: grupo.profesional_nombre,
                                      apellido: grupo.profesional_apellido,
                                    });
                                    setShowGestionarModal(true);
                                  }}
                                  className="h-8 w-8 rounded-[8px] hover:bg-[#dbeafe] transition-all duration-200 text-[#2563eb] hover:text-[#1d4ed8]"
                                >
                                  <Edit className="h-4 w-4 stroke-[2]" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent className="bg-[#111827] text-white text-xs font-['Inter'] rounded-[8px] px-3 py-2 [&>p]:text-white">
                                <p className="text-white">Editar configuración</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </TooltipProvider>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}

      {/* Modal: Gestionar agenda de un profesional (pestañas: Horarios / Fechas puntuales / Bloqueos) */}
      <Dialog open={showGestionarModal} onOpenChange={setShowGestionarModal}>
        <DialogContent className="max-w-[960px] w-[95vw] h-[720px] max-h-[90vh] rounded-[20px] p-0 border border-[#E5E7EB] shadow-2xl flex flex-col overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-[#E5E7EB] mb-0 flex-shrink-0">
            <DialogTitle className="text-[22px] font-bold text-[#111827] font-['Poppins'] mb-0">
              Agenda de {profesionalGestionar?.nombre} {profesionalGestionar?.apellido}
            </DialogTitle>
            <DialogDescription className="text-sm text-[#6B7280] font-['Inter'] mt-1 mb-0">
              Horarios de la semana, fechas puntuales y bloqueos
            </DialogDescription>
          </DialogHeader>
          {profesionalGestionar && (
            <Tabs defaultValue="horarios" className="flex-1 min-h-[540px] flex flex-col px-6 pb-6 overflow-hidden">
              <TabsList className="w-full grid grid-cols-3 h-11 rounded-[10px] bg-[#F9FAFB] border border-[#E5E7EB] p-1 mb-4 flex-shrink-0">
                <TabsTrigger value="horarios" className="rounded-[8px] text-[14px] font-medium data-[state=active]:bg-[#2563eb] data-[state=active]:text-white">
                  Horarios de la semana
                </TabsTrigger>
                <TabsTrigger value="fechas" className="rounded-[8px] text-[14px] font-medium data-[state=active]:bg-[#2563eb] data-[state=active]:text-white">
                  Fechas puntuales
                </TabsTrigger>
                <TabsTrigger value="bloqueos" className="rounded-[8px] text-[14px] font-medium data-[state=active]:bg-[#2563eb] data-[state=active]:text-white">
                  Bloqueos
                </TabsTrigger>
              </TabsList>
              <div className="flex-1 min-h-[460px] overflow-hidden flex flex-col">
                <TabsContent value="horarios" className="flex-1 min-h-0 overflow-y-auto mt-0 data-[state=inactive]:hidden flex flex-col">
                  <p className="text-[13px] text-[#6B7280] font-['Inter'] mb-3">
                    Mostrá los siete días. Si desactivás un día, a partir de ahora no se podrán crear turnos para ese día; los turnos ya existentes se mantienen. Los cambios se aplican al guardar.
                  </p>
                  <div className="flex-1 min-h-0 overflow-y-auto border border-[#E5E7EB] rounded-[12px] overflow-hidden">
                    <Table className="w-full table-fixed">
                      <TableHeader>
                        <TableRow className="bg-[#F9FAFB] border-[#E5E7EB]">
                          <TableHead className="font-['Inter'] text-[13px] text-[#374151] w-[22%]">Día</TableHead>
                          <TableHead className="font-['Inter'] text-[13px] text-[#374151] w-[18%]">Atiende</TableHead>
                          <TableHead className="font-['Inter'] text-[13px] text-[#374151] w-[30%]">Hora inicio</TableHead>
                          <TableHead className="font-['Inter'] text-[13px] text-[#374151] w-[30%]">Hora fin</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {horariosSemanaForm.map((item) => (
                          <TableRow key={item.dia_semana} className="border-[#E5E7EB]">
                            <TableCell className="font-['Inter'] text-[14px] text-[#374151] py-2 w-[22%]">
                              {getDiaSemanaLabel(item.dia_semana)}
                            </TableCell>
                            <TableCell className="py-2 w-[18%]">
                              <Switch
                                checked={item.atiende}
                                onCheckedChange={(checked) => {
                                  if (item.atiende && !checked) {
                                    setDiaDesactivarPending(item.dia_semana);
                                    setShowConfirmDesactivarDia(true);
                                  } else {
                                    setHorariosSemanaForm(prev => prev.map(p => p.dia_semana === item.dia_semana ? { ...p, atiende: checked } : p));
                                  }
                                }}
                                className="data-[state=checked]:bg-[#2563eb]"
                              />
                            </TableCell>
                            <TableCell className="py-2 w-[30%]">
                              <Input
                                type="time"
                                value={item.hora_inicio}
                                onChange={(e) => setHorariosSemanaForm(prev => prev.map(p => p.dia_semana === item.dia_semana ? { ...p, hora_inicio: e.target.value } : p))}
                                className="h-9 w-full max-w-[140px] border-[#D1D5DB] rounded-[8px] font-['Inter'] text-[14px]"
                                disabled={!item.atiende}
                              />
                            </TableCell>
                            <TableCell className="py-2 w-[30%]">
                              <Input
                                type="time"
                                value={item.hora_fin}
                                onChange={(e) => setHorariosSemanaForm(prev => prev.map(p => p.dia_semana === item.dia_semana ? { ...p, hora_fin: e.target.value } : p))}
                                className="h-9 w-full max-w-[140px] border-[#D1D5DB] rounded-[8px] font-['Inter'] text-[14px]"
                                disabled={!item.atiende}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <Button
                      onClick={async () => {
                        if (!profesionalGestionar) return;
                        setIsSavingHorariosSemana(true);
                        try {
                          const horariosPayload = horariosSemanaForm
                            .filter(item => item.atiende)
                            .map(item => ({
                              dia_semana: item.dia_semana,
                              hora_inicio: item.hora_inicio.length >= 5 ? item.hora_inicio : item.hora_inicio + ':00',
                              hora_fin: item.hora_fin.length >= 5 ? item.hora_fin : item.hora_fin + ':00',
                            }));
                          try {
                            await agendaService.guardarHorariosSemana(profesionalGestionar.id, horariosPayload, format(new Date(), 'yyyy-MM-dd'));
                          } catch (_) {
                            // Si el backend no tiene vigencia (migración 009), fallback: desactivar todos y crear nuevos
                            const configsDelProf = (agendas as ConfiguracionAgenda[]).filter(a => a.profesional_id === profesionalGestionar.id);
                            for (const config of configsDelProf) {
                              await agendaService.deactivateAgenda(config.id);
                            }
                            const fechaDesdeFallback = format(new Date(), 'yyyy-MM-dd');
                            for (const item of horariosSemanaForm) {
                              if (!item.atiende) continue;
                              await agendaService.createAgenda({
                                profesional_id: profesionalGestionar.id,
                                dia_semana: item.dia_semana,
                                hora_inicio: item.hora_inicio.length >= 5 ? item.hora_inicio : item.hora_inicio + ':00',
                                hora_fin: item.hora_fin.length >= 5 ? item.hora_fin : item.hora_fin + ':00',
                                duracion_turno_minutos: 30,
                                activo: true,
                                vigencia_desde: fechaDesdeFallback,
                              });
                            }
                          }
                          queryClient.invalidateQueries({ queryKey: ['agendas'] });
                          reactToastify.success('Horarios de la semana guardados correctamente.', { position: 'top-right', autoClose: 3000 });
                        } catch (err) {
                          const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Error al guardar';
                          reactToastify.error(msg, { position: 'top-right', autoClose: 3000 });
                        } finally {
                          setIsSavingHorariosSemana(false);
                        }
                      }}
                      disabled={isSavingHorariosSemana}
                      className="rounded-[10px] font-['Inter'] bg-[#2563eb] hover:bg-[#1d4ed8]"
                    >
                      {isSavingHorariosSemana ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Guardar cambios
                    </Button>
                  </div>
                </TabsContent>
                <TabsContent value="fechas" className="flex-1 min-h-0 overflow-hidden mt-0 data-[state=inactive]:hidden flex flex-col">
                  <div className="flex-1 min-h-0 overflow-y-auto">
                    {excepcionesDelProfesional.length === 0 ? (
                      <p className="text-[14px] text-[#6B7280] font-['Inter'] py-2">No hay fechas puntuales.</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-[#F9FAFB] border-[#E5E7EB]">
                            <TableHead className="font-['Inter'] text-[13px] text-[#374151]">Fecha</TableHead>
                            <TableHead className="font-['Inter'] text-[13px] text-[#374151]">Horario</TableHead>
                            <TableHead className="font-['Inter'] text-[13px] text-[#374151]">Duración</TableHead>
                            <TableHead className="font-['Inter'] text-[13px] text-[#374151] w-[70px]">Acciones</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {excepcionesDelProfesional
                            .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''))
                            .map((ex) => (
                              <TableRow key={ex.id} className="border-[#E5E7EB]">
                                <TableCell className="font-['Inter'] text-[14px] text-[#374151] py-2">
                                  {formatFechaSafe(ex.fecha)}
                                </TableCell>
                                <TableCell className="font-['Inter'] text-[14px] text-[#6B7280] py-2">
                                  {formatTime(ex.hora_inicio)} - {formatTime(ex.hora_fin)}
                                </TableCell>
                                <TableCell className="font-['Inter'] text-[14px] text-[#6B7280] py-2">{ex.duracion_turno_minutos ?? 30} min</TableCell>
                                <TableCell className="py-2 text-right">
                                  <Button variant="ghost" size="icon" onClick={() => { setExcepcionToDelete(ex); setShowDeleteExcepcionModal(true); }} className="h-8 w-8 rounded-[8px] hover:bg-[#FEE2E2] text-[#EF4444]">
                                    <Trash2 className="h-4 w-4 stroke-[2]" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                </TabsContent>
                <TabsContent value="bloqueos" className="flex-1 min-h-0 overflow-hidden mt-0 data-[state=inactive]:hidden flex flex-col">
                  <div className="flex-1 min-h-0 overflow-y-auto">
                    {bloquesDelProfesional.length === 0 ? (
                      <p className="text-[14px] text-[#6B7280] font-['Inter'] py-2">No hay bloqueos.</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-[#F9FAFB] border-[#E5E7EB]">
                            <TableHead className="font-['Inter'] text-[13px] text-[#374151]">Desde</TableHead>
                            <TableHead className="font-['Inter'] text-[13px] text-[#374151]">Hasta</TableHead>
                            <TableHead className="font-['Inter'] text-[13px] text-[#374151]">Motivo</TableHead>
                            <TableHead className="font-['Inter'] text-[13px] text-[#374151] w-[70px]">Acciones</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {bloquesDelProfesional
                            .sort((a, b) => (a.fecha_hora_inicio || '').localeCompare(b.fecha_hora_inicio || ''))
                            .map((bloque) => {
                              const desde = bloque.fecha_hora_inicio ? new Date(bloque.fecha_hora_inicio) : null;
                              const hasta = bloque.fecha_hora_fin ? new Date(bloque.fecha_hora_fin) : null;
                              return (
                                <TableRow key={bloque.id} className="border-[#E5E7EB]">
                                  <TableCell className="font-['Inter'] text-[14px] text-[#374151] py-2">
                                    {desde ? format(desde, "d MMM yyyy HH:mm", { locale: es }) : '-'}
                                  </TableCell>
                                  <TableCell className="font-['Inter'] text-[14px] text-[#6B7280] py-2">
                                    {hasta ? format(hasta, "d MMM yyyy HH:mm", { locale: es }) : '-'}
                                  </TableCell>
                                  <TableCell className="font-['Inter'] text-[14px] text-[#6B7280] py-2">{bloque.motivo || '-'}</TableCell>
                                  <TableCell className="py-2 text-right">
                                    <Button variant="ghost" size="icon" onClick={() => { setBloqueToDelete(bloque); setShowDeleteBloqueModal(true); }} className="h-8 w-8 rounded-[8px] hover:bg-[#FEE2E2] text-[#EF4444]">
                                      <Trash2 className="h-4 w-4 stroke-[2]" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                </TabsContent>
              </div>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal: Agregar fecha puntual */}
      <Dialog open={showExcepcionModal} onOpenChange={setShowExcepcionModal}>
        <DialogContent className="max-w-[480px] rounded-[20px] border border-[#E5E7EB] shadow-2xl p-6">
          <DialogHeader className="mb-4 pb-0 border-b-0">
            <DialogTitle className="text-[22px] font-bold text-[#111827] font-['Poppins'] mb-0">
              Agregar fecha puntual
            </DialogTitle>
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
          <DialogFooter className="mt-6 pt-4 border-t border-[#E5E7EB] flex gap-2">
            <Button variant="outline" onClick={() => setShowExcepcionModal(false)} className="rounded-[12px] font-['Inter']">
              Cancelar
            </Button>
            <Button
              className="rounded-[12px] font-['Inter'] bg-[#2563eb] hover:bg-[#1d4ed8]"
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

      <ConfirmDeleteModal
        open={showConfirmDesactivarDia}
        onOpenChange={(open) => { setShowConfirmDesactivarDia(open); if (!open) setDiaDesactivarPending(null); }}
        title="Desactivar día en la agenda"
        description={
          diaDesactivarPending !== null ? (
            <>
              Este cambio es <strong>permanente en la agenda</strong>: a partir de ahora no se podrán crear turnos para{' '}
              <span className="font-semibold text-[#374151]">{getDiaSemanaLabel(diaDesactivarPending)}</span>. Los turnos ya existentes se mantienen y podés seguir viendo el historial. ¿Continuar?
            </>
          ) : (
            ''
          )
        }
        confirmLabel="Desactivar día"
        onConfirm={() => {
          if (diaDesactivarPending !== null) {
            setHorariosSemanaForm(prev => prev.map(p => p.dia_semana === diaDesactivarPending ? { ...p, atiende: false } : p));
            setShowConfirmDesactivarDia(false);
            setDiaDesactivarPending(null);
          }
        }}
        isLoading={false}
      />

      <ConfirmDeleteModal
        open={showDeleteExcepcionModal}
        onOpenChange={setShowDeleteExcepcionModal}
        title="Eliminar fecha puntual"
        description={excepcionToDelete ? <>¿Estás seguro de que deseas eliminar la fecha puntual del <span className="font-semibold text-[#374151]">{formatFechaSafe(excepcionToDelete.fecha)}</span> ({formatTime(excepcionToDelete.hora_inicio)} - {formatTime(excepcionToDelete.hora_fin)})?</> : ''}
        onConfirm={() => { if (excepcionToDelete) deleteExcepcionMutation.mutate(excepcionToDelete.id); }}
        isLoading={deleteExcepcionMutation.isPending}
      />

      {/* Modal: Agregar bloqueo */}
      <Dialog open={showBloqueModal} onOpenChange={setShowBloqueModal}>
        <DialogContent className="max-w-[440px] rounded-[20px] border border-[#E5E7EB] shadow-2xl p-6">
          <DialogHeader className="mb-4 pb-0 border-b-0">
            <DialogTitle className="text-[22px] font-bold text-[#111827] font-['Poppins'] mb-0">
              Agregar bloqueo
            </DialogTitle>
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
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[14px] font-medium text-[#374151] font-['Inter']">Hora inicio</Label>
                <Input
                  type="time"
                  value={bloqueForm.hora_inicio}
                  onChange={(e) => setBloqueForm((f) => ({ ...f, hora_inicio: e.target.value }))}
                  className="h-[48px] border-[1.5px] border-[#D1D5DB] rounded-[10px] font-['Inter']"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[14px] font-medium text-[#374151] font-['Inter']">Hora fin</Label>
                <Input
                  type="time"
                  value={bloqueForm.hora_fin}
                  onChange={(e) => setBloqueForm((f) => ({ ...f, hora_fin: e.target.value }))}
                  className="h-[48px] border-[1.5px] border-[#D1D5DB] rounded-[10px] font-['Inter']"
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
          <DialogFooter className="mt-6 pt-4 border-t border-[#E5E7EB] flex gap-2">
            <Button variant="outline" onClick={() => setShowBloqueModal(false)} className="rounded-[12px] font-['Inter']">
              Cancelar
            </Button>
            <Button
              className="rounded-[12px] font-['Inter'] bg-[#2563eb] hover:bg-[#1d4ed8]"
              disabled={createBloqueMutation.isPending || !bloqueForm.profesional_id || !bloqueForm.fecha}
              onClick={() => {
                const inicio = new Date(bloqueForm.fecha + 'T' + bloqueForm.hora_inicio + ':00');
                const fin = new Date(bloqueForm.fecha + 'T' + bloqueForm.hora_fin + ':00');
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
        description={bloqueToDelete ? <>¿Estás seguro de que deseas eliminar este bloqueo (<span className="font-semibold text-[#374151]">{bloqueToDelete.fecha_hora_inicio ? format(new Date(bloqueToDelete.fecha_hora_inicio), "d MMM yyyy HH:mm", { locale: es }) : ''}</span> – <span className="font-semibold text-[#374151]">{bloqueToDelete.fecha_hora_fin ? format(new Date(bloqueToDelete.fecha_hora_fin), "d MMM yyyy HH:mm", { locale: es }) : ''}</span>)?</> : ''}
        onConfirm={() => { if (bloqueToDelete) deleteBloqueMutation.mutate(bloqueToDelete.id); }}
        isLoading={deleteBloqueMutation.isPending}
      />

      {/* Modal: Crear/Editar Configuración de Agenda */}
      <Dialog open={showAgendaModal} onOpenChange={setShowAgendaModal}>
        <DialogContent className="max-w-[900px] max-h-[90vh] rounded-[20px] p-0 border border-[#E5E7EB] shadow-2xl gap-0 flex flex-col overflow-hidden">
          <DialogHeader className="flex-shrink-0 px-8 pt-8 pb-4 border-b border-[#E5E7EB] bg-gradient-to-b from-white to-[#F9FAFB] mb-0">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] flex items-center justify-center shadow-lg shadow-[#2563eb]/20">
                <Calendar className="h-6 w-6 text-white stroke-[2]" />
              </div>
              <div>
                <DialogTitle className="text-[28px] font-bold text-[#111827] font-['Poppins'] leading-tight mb-0">
                  {editingAgenda ? 'Editar configuración' : 'Nueva Agenda'}
                </DialogTitle>
                <DialogDescription className="text-base text-[#6B7280] font-['Inter'] mt-1 mb-0">
                  {editingAgenda 
                    ? 'Modifica horario y duración del turno'
                    : 'Configura los horarios disponibles por día'}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto px-8 py-6 space-y-5">
            {editingAgenda ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <Label className="text-[15px] font-medium text-[#374151] font-['Inter']">Día</Label>
                    <p className="h-[52px] flex items-center text-[#374151] font-['Inter']">
                      {getDiaSemanaLabel(agendaForm.dia_semana)}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <Label className="text-[15px] font-medium text-[#374151] font-['Inter']">Hora inicio</Label>
                      <Input
                        type="time"
                        value={agendaForm.hora_inicio}
                        onChange={(e) => setAgendaForm({ ...agendaForm, hora_inicio: e.target.value })}
                        className="h-[52px] border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[16px] font-['Inter']"
                      />
                    </div>
                    <div className="space-y-3">
                      <Label className="text-[15px] font-medium text-[#374151] font-['Inter']">Hora fin</Label>
                      <Input
                        type="time"
                        value={agendaForm.hora_fin}
                        onChange={(e) => setAgendaForm({ ...agendaForm, hora_fin: e.target.value })}
                        className="h-[52px] border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[16px] font-['Inter']"
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-3 max-w-[200px]">
                  <Label htmlFor="duracion_turno_minutos" className="text-[15px] font-medium text-[#374151] font-['Inter']">Duración del turno (min)</Label>
                  <Input
                    id="duracion_turno_minutos"
                    type="number"
                    min={5}
                    max={480}
                    value={agendaForm.duracion_turno_minutos}
                    onChange={(e) => setAgendaForm({ ...agendaForm, duracion_turno_minutos: parseInt(e.target.value) || 30 })}
                    className="h-[52px] border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[16px] font-['Inter']"
                    placeholder="30"
                  />
                </div>
              </>
            ) : (
              <>
                <div className="space-y-3">
                  <Label className="text-[15px] font-medium text-[#374151] font-['Inter']">¿Cómo atiende este profesional?</Label>
                  <div className="flex items-center gap-4 p-4 rounded-[12px] border border-[#E5E7EB] bg-[#F9FAFB]">
                    <Switch
                      id="dias-fijos-switch"
                      checked={diasFijosSemana}
                      onCheckedChange={setDiasFijosSemana}
                      className="data-[state=checked]:bg-[#2563eb]"
                    />
                    <div className="flex-1">
                      <label htmlFor="dias-fijos-switch" className="font-['Inter'] text-[14px] text-[#374151] cursor-pointer mb-0 block">
                        {diasFijosSemana
                          ? 'Días fijos por semana (Lu, Ma, Mi…). Configurá horarios por día.'
                          : 'Solo días puntuales. Irá habilitando fechas cuando las defina (desde Gestionar > Días puntuales).'}
                      </label>
                    </div>
                  </div>
                </div>

                {diasFijosSemana ? (
                  <>
                    <div className="grid grid-cols-[minmax(200px,1fr)_300px_120px] gap-x-4 gap-y-3 items-end">
                      <div className="space-y-3">
                        <Label htmlFor="profesional_id" className="text-[15px] font-medium text-[#374151] font-['Inter'] flex items-center gap-2">
                          <User className="h-4 w-4 text-[#6B7280] stroke-[2] flex-shrink-0" />
                          Profesional
                          <span className="text-[#EF4444]">*</span>
                        </Label>
                        <Select
                          value={agendaForm.profesional_id}
                          onValueChange={(value) => setAgendaForm({ ...agendaForm, profesional_id: value })}
                        >
                          <SelectTrigger className="h-[52px] border-[1.5px] border-[#D1D5DB] rounded-[10px] font-['Inter'] text-[16px] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200">
                            <SelectValue placeholder="Seleccionar profesional" />
                          </SelectTrigger>
                          <SelectContent className="rounded-[12px] border-[#E5E7EB] shadow-xl max-h-[300px]">
                            {profesionales.map((prof) => {
                              const yaTieneAgenda = profesionalesConAgendaIds.has(prof.id);
                              return (
                                <SelectItem
                                  key={prof.id}
                                  value={prof.id}
                                  disabled={yaTieneAgenda}
                                  className="font-['Inter'] rounded-[8px] text-[15px] py-3"
                                >
                                  <span className="truncate">{prof.nombre} {prof.apellido}{prof.especialidad ? ` - ${prof.especialidad}` : ''}</span>
                                  {yaTieneAgenda && (
                                    <span className="ml-2 text-xs text-[#6B7280] whitespace-nowrap">— Ya tiene agenda</span>
                                  )}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-3">
                        <Label className="text-[15px] font-medium text-[#374151] font-['Inter'] flex items-center gap-2">
                          <CalendarDays className="h-4 w-4 text-[#6B7280] stroke-[2] flex-shrink-0" />
                          Vigente desde
                        </Label>
                        <DatePicker
                          id="agenda-vigencia-desde"
                          value={agendaForm.vigencia_desde ?? format(new Date(), 'yyyy-MM-dd')}
                          onChange={(v) => setAgendaForm({ ...agendaForm, vigencia_desde: v })}
                          placeholder="Elegir fecha"
                          className="h-[52px] w-full text-[#374151]"
                        />
                      </div>
                      <div className="space-y-3">
                        <Label htmlFor="duracion_turno_minutos_new" className="text-[15px] font-medium text-[#374151] font-['Inter']">Duración (min)</Label>
                        <Input
                          id="duracion_turno_minutos_new"
                          type="number"
                          min={5}
                          max={480}
                          value={agendaForm.duracion_turno_minutos}
                          onChange={(e) => setAgendaForm({ ...agendaForm, duracion_turno_minutos: parseInt(e.target.value) || 30 })}
                          className="h-[52px] border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[16px] font-['Inter']"
                          placeholder="30"
                        />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <Label className="text-[15px] font-medium text-[#374151] font-['Inter']">Horario por día (marca los días que trabaja)</Label>
                      <div className="rounded-[12px] border border-[#E5E7EB] overflow-hidden">
                        <Table className="table-fixed w-full">
                          <TableHeader>
                            <TableRow className="bg-[#F9FAFB] border-[#E5E7EB]">
                              <TableHead className="font-['Inter'] text-[14px] text-[#374151] w-[18%]">Trabaja</TableHead>
                              <TableHead className="font-['Inter'] text-[14px] text-[#374151] w-[22%]">Día</TableHead>
                              <TableHead className="font-['Inter'] text-[14px] text-[#374151] w-[30%]">Hora inicio</TableHead>
                              <TableHead className="font-['Inter'] text-[14px] text-[#374151] w-[30%]">Hora fin</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {DIAS_SEMANA.map((dia) => (
                              <TableRow key={dia.value} className="border-[#E5E7EB]">
                                <TableCell className="py-2 w-[18%]">
                                  <Switch
                                    id={`dia-${dia.value}`}
                                    checked={!!diasActivos[dia.value]}
                                    onCheckedChange={(checked) => setDiasActivos(prev => ({ ...prev, [dia.value]: checked }))}
                                  />
                                </TableCell>
                                <TableCell className="font-['Inter'] text-[15px] text-[#374151] py-3 w-[22%]">
                                  {dia.label}
                                </TableCell>
                                <TableCell className="py-2 w-[30%]">
                                  <Input
                                    type="time"
                                    value={diasHorarios[dia.value]?.hora_inicio ?? '09:00'}
                                    onChange={(e) => setDiasHorarios(prev => ({
                                      ...prev,
                                      [dia.value]: { ...prev[dia.value], hora_inicio: e.target.value, hora_fin: prev[dia.value]?.hora_fin ?? '18:00' },
                                    }))}
                                    disabled={!diasActivos[dia.value]}
                                    className="h-10 border-[#D1D5DB] rounded-[8px] text-[14px] font-['Inter'] w-full disabled:opacity-50 disabled:bg-[#F9FAFB]"
                                  />
                                </TableCell>
                                <TableCell className="py-2 w-[30%]">
                                  <Input
                                    type="time"
                                    value={diasHorarios[dia.value]?.hora_fin ?? '18:00'}
                                    onChange={(e) => setDiasHorarios(prev => ({
                                      ...prev,
                                      [dia.value]: { hora_inicio: prev[dia.value]?.hora_inicio ?? '09:00', hora_fin: e.target.value },
                                    }))}
                                    disabled={!diasActivos[dia.value]}
                                    className="h-10 border-[#D1D5DB] rounded-[8px] text-[14px] font-['Inter'] w-full disabled:opacity-50 disabled:bg-[#F9FAFB]"
                                  />
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-3">
                      <Label htmlFor="profesional_id_puntual" className="text-[15px] font-medium text-[#374151] font-['Inter'] flex items-center gap-2">
                        <User className="h-4 w-4 text-[#6B7280] stroke-[2]" />
                        Profesional <span className="text-[#EF4444]">*</span>
                      </Label>
                      <Select
                        value={agendaForm.profesional_id}
                        onValueChange={(value) => setAgendaForm({ ...agendaForm, profesional_id: value })}
                      >
                        <SelectTrigger id="profesional_id_puntual" className="h-[52px] border-[1.5px] border-[#D1D5DB] rounded-[10px] font-['Inter'] text-[16px] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200">
                          <SelectValue placeholder="Seleccionar profesional" />
                        </SelectTrigger>
                        <SelectContent className="rounded-[12px] border-[#E5E7EB] shadow-xl max-h-[300px]">
                          {profesionales.map((prof) => {
                            const yaTieneAgenda = profesionalesConAgendaIds.has(prof.id);
                            return (
                              <SelectItem
                                key={prof.id}
                                value={prof.id}
                                disabled={yaTieneAgenda}
                                className="font-['Inter'] rounded-[8px] text-[15px] py-3"
                              >
                                <span className="truncate">{prof.nombre} {prof.apellido}{prof.especialidad ? ` - ${prof.especialidad}` : ''}</span>
                                {yaTieneAgenda && (
                                  <span className="ml-2 text-xs text-[#6B7280] whitespace-nowrap">— Ya tiene agenda</span>
                                )}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="rounded-[12px] border border-[#E5E7EB] bg-[#F9FAFB] p-4 space-y-4">
                      <p className="text-[14px] font-medium text-[#374151] font-['Inter']">
                        Primera fecha puntual <span className="text-[#EF4444]">*</span>
                      </p>
                      <p className="text-[13px] text-[#6B7280] font-['Inter'] -mt-2">
                        Ingresá la primera fecha en que el profesional atiende. Después podés agregar más desde Gestionar → Fechas puntuales.
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-[14px] font-['Inter']">Fecha</Label>
                          <DatePicker
                            value={primeraFechaPuntual.fecha}
                            onChange={(v) => setPrimeraFechaPuntual((prev) => ({ ...prev, fecha: v ?? '' }))}
                            placeholder="Elegir fecha"
                            className="h-[48px] border-[1.5px] border-[#D1D5DB] rounded-[10px] font-['Inter'] text-[15px]"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label className="text-[14px] font-['Inter']">Hora inicio</Label>
                            <Input
                              type="time"
                              value={primeraFechaPuntual.hora_inicio}
                              onChange={(e) => setPrimeraFechaPuntual((prev) => ({ ...prev, hora_inicio: e.target.value }))}
                              className="h-[48px] border-[1.5px] border-[#D1D5DB] rounded-[10px] font-['Inter']"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[14px] font-['Inter']">Hora fin</Label>
                            <Input
                              type="time"
                              value={primeraFechaPuntual.hora_fin}
                              onChange={(e) => setPrimeraFechaPuntual((prev) => ({ ...prev, hora_fin: e.target.value }))}
                              className="h-[48px] border-[1.5px] border-[#D1D5DB] rounded-[10px] font-['Inter']"
                            />
                          </div>
                        </div>
                        <div className="space-y-2 sm:col-span-2 max-w-[140px]">
                          <Label className="text-[14px] font-['Inter']">Duración (min)</Label>
                          <Input
                            type="number"
                            min={5}
                            max={480}
                            value={primeraFechaPuntual.duracion_turno_minutos}
                            onChange={(e) => setPrimeraFechaPuntual((prev) => ({ ...prev, duracion_turno_minutos: parseInt(e.target.value) || 30 }))}
                            className="h-[48px] border-[1.5px] border-[#D1D5DB] rounded-[10px] font-['Inter']"
                          />
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          <DialogFooter className="flex-shrink-0 px-8 py-4 border-t border-[#E5E7EB] bg-[#F9FAFB] flex flex-row justify-end gap-3 mt-0 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowAgendaModal(false);
                resetAgendaForm();
              }}
              className="h-[48px] px-6 rounded-[12px] border-[1.5px] border-[#D1D5DB] font-medium font-['Inter'] text-[15px] hover:bg-white hover:border-[#9CA3AF] transition-all duration-200"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmitAgenda}
              disabled={
                isSubmitting ||
                (!editingAgenda && diasFijosSemana && !DIAS_SEMANA.some((d) => diasActivos[d.value])) ||
                (!editingAgenda && !diasFijosSemana && (!agendaForm.profesional_id || !primeraFechaPuntual.fecha || primeraFechaPuntual.hora_inicio >= primeraFechaPuntual.hora_fin))
              }
              className="h-[48px] px-8 rounded-[12px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-lg shadow-[#2563eb]/30 font-semibold font-['Inter'] text-[15px] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin stroke-[2.5]" />
                  Guardando...
                </>
              ) : (
                editingAgenda ? 'Actualizar' : 'Crear'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteModal
        open={showDeleteAgendaModal}
        onOpenChange={(open) => { setShowDeleteAgendaModal(open); if (!open) setAgendaToDelete(null); }}
        title="Eliminar configuración de agenda"
        description={agendaToDelete ? (
          <>
            ¿Estás seguro de que deseas eliminar la configuración del día <span className="font-semibold text-[#374151]">{getDiaSemanaLabel(agendaToDelete.dia_semana)}</span> ({formatTime(agendaToDelete.hora_inicio)} - {formatTime(agendaToDelete.hora_fin)})?
            <p className="mt-3 text-sm text-[#6B7280] font-['Inter']">
              Al eliminar, ya no se podrán crear nuevos turnos para este día y horario. Los turnos existentes no se eliminan. Los días puntuales y otras configuraciones del profesional no se modifican.
            </p>
          </>
        ) : ''}
        onConfirm={() => { if (agendaToDelete) deleteAgendaMutation.mutate(agendaToDelete.id); }}
        isLoading={deleteAgendaMutation.isPending}
      />
    </div>
  );
}