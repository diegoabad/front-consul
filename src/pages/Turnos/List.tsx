import { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, isToday, addMonths, subMonths, isBefore, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ConfirmDeleteModal } from '@/components/shared/ConfirmDeleteModal';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { 
  Calendar, CalendarPlus, Clock, User, Eye, X, Plus, 
  Loader2, Filter, FileText, Stethoscope, ChevronLeft, ChevronRight, Search, Phone, Trash2, Lock, Pencil
} from 'lucide-react';
import { toast as reactToastify } from 'react-toastify';
import { turnosService, type CreateTurnoData, type CancelTurnoData, type UpdateTurnoData } from '@/services/turnos.service';
import { profesionalesService } from '@/services/profesionales.service';
import { pacientesService } from '@/services/pacientes.service';
import { agendaService, type CreateBloqueData, type BloqueNoDisponible, type UpdateBloqueData, type CreateExcepcionAgendaData } from '@/services/agenda.service';
import { DatePicker } from '@/components/ui/date-picker';
import type { Turno, Paciente } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/utils/permissions';

const estadoOptions = [
  { value: 'todos', label: 'Todos los estados' },
  { value: 'pendiente', label: 'A confirmar' },
  { value: 'confirmado', label: 'Confirmados' },
  { value: 'completado', label: 'Atendidos' },
  { value: 'cancelado', label: 'Cancelados' },
  { value: 'ausente', label: 'Ausentes' },
];

// Opciones para cambiar estado en la grilla (valor backend → etiqueta)
const estadoOpcionesGrilla = [
  { value: 'pendiente', label: 'A confirmar' },
  { value: 'confirmado', label: 'Confirmado' },
  { value: 'completado', label: 'Atendido' },
  { value: 'cancelado', label: 'Cancelado' },
  { value: 'ausente', label: 'Ausente' },
];

function getEstadoLabel(estado: string): string {
  const opt = estadoOpcionesGrilla.find((o) => o.value === estado);
  return opt?.label ?? estado;
}

/** Formatea DNI con separador de miles (ej: 12345678 → 12.345.678) */
function formatDni(dni: string | number | undefined | null): string {
  if (dni === undefined || dni === null) return '';
  const s = String(dni).replace(/\D/g, '');
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Clases del SelectTrigger de estado: hover y flecha según color del estado (sin violeta) */
function getEstadoSelectTriggerClass(estado: string): string {
  const base = "h-8 w-auto max-w-[140px] min-w-0 rounded-full border shadow-none font-['Inter'] text-[13px] py-1 pl-2.5 pr-8 text-left focus:outline-none [&>svg]:!right-2 [&>svg]:!h-3.5 [&>svg]:!w-3.5";
  switch (estado) {
    case 'confirmado':
      return `${base} bg-[#D1FAE5] text-[#065F46] border-[#6EE7B7] hover:bg-[#A7F3D0] hover:border-[#6EE7B7] focus:border-[#6EE7B7] focus:ring-2 focus:ring-[#065F46]/20 [&>svg]:!text-[#065F46]`;
    case 'pendiente':
      return `${base} bg-[#FEF3C7] text-[#92400E] border-[#FDE047] hover:bg-[#FDE68A] hover:border-[#FDE047] focus:border-[#FDE047] focus:ring-2 focus:ring-[#92400E]/20 [&>svg]:!text-[#92400E]`;
    case 'cancelado':
      return `${base} bg-[#FEE2E2] text-[#991B1B] border-[#FECACA] hover:bg-[#FCA5A5] hover:border-[#FECACA] focus:border-[#FECACA] focus:ring-2 focus:ring-[#991B1B]/20 [&>svg]:!text-[#991B1B]`;
    case 'completado':
      return `${base} bg-[#DBEAFE] text-[#1E40AF] border-[#BAE6FD] hover:bg-[#BFDBFE] hover:border-[#BAE6FD] focus:border-[#BAE6FD] focus:ring-2 focus:ring-[#1E40AF]/20 [&>svg]:!text-[#1E40AF]`;
    case 'ausente':
      return `${base} bg-[#E5E7EB] text-[#4B5563] border-[#D1D5DB] hover:bg-[#D1D5DB] hover:border-[#D1D5DB] focus:border-[#D1D5DB] focus:ring-2 focus:ring-[#4B5563]/20 [&>svg]:!text-[#4B5563]`;
    default:
      return `${base} bg-[#E5E7EB] text-[#4B5563] border-[#D1D5DB] hover:bg-[#D1D5DB] focus:border-[#D1D5DB] focus:ring-2 focus:ring-[#4B5563]/20 [&>svg]:!text-[#4B5563]`;
  }
}

function getEstadoBadge(estado: string, className = '') {
  const base = 'rounded-full px-3 py-1 text-xs font-medium ' + className;
  switch (estado) {
    case 'confirmado':
      return (
        <Badge className={`bg-[#D1FAE5] text-[#065F46] border-[#6EE7B7] hover:bg-[#A7F3D0] ${base}`}>
          Confirmado
        </Badge>
      );
    case 'pendiente':
      return (
        <Badge className={`bg-[#FEF3C7] text-[#92400E] border-[#FDE047] hover:bg-[#FDE68A] ${base}`}>
          A confirmar
        </Badge>
      );
    case 'cancelado':
      return (
        <Badge className={`bg-[#FEE2E2] text-[#991B1B] border-[#FECACA] hover:bg-[#FCA5A5] ${base}`}>
          Cancelado
        </Badge>
      );
    case 'completado':
      return (
        <Badge className={`bg-[#DBEAFE] text-[#1E40AF] border-[#BAE6FD] hover:bg-[#BFDBFE] ${base}`}>
          Atendido
        </Badge>
      );
    case 'ausente':
      return (
        <Badge className={`bg-[#E5E7EB] text-[#4B5563] border-[#D1D5DB] hover:bg-[#D1D5DB] ${base}`}>
          Ausente
        </Badge>
      );
    default:
      return (
        <Badge className={`bg-[#F3F4F6] text-[#4B5563] border-[#D1D5DB] ${base}`}>
          {getEstadoLabel(estado)}
        </Badge>
      );
  }
}

/** Suma minutos a "HH:mm" y devuelve "HH:mm" */
function sumarMinutos(hora: string, minutos: number): string {
  const [h, m] = hora.split(':').map(Number);
  const total = (h ?? 0) * 60 + (m ?? 0) + minutos;
  const nh = Math.floor(total / 60) % 24;
  const nm = total % 60;
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
}

/** Diferencia en minutos entre dos horas "HH:mm" (fin - inicio). */
function minutosEntre(inicio: string, fin: string): number {
  const [h1, m1] = inicio.split(':').map(Number);
  const [h2, m2] = fin.split(':').map(Number);
  return (h2 ?? 0) * 60 + (m2 ?? 0) - ((h1 ?? 0) * 60 + (m1 ?? 0));
}

/** Genera opciones de hora desde inicio hasta fin (excluyendo fin) cada N minutos */
function generarOpcionesHora(inicio: string, finExcl: string, pasoMinutos: number): string[] {
  const opciones: string[] = [];
  let current = inicio;
  while (current < finExcl) {
    opciones.push(current);
    current = sumarMinutos(current, pasoMinutos);
  }
  return opciones;
}

export default function AdminTurnos() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();

  const [estadoFilter, setEstadoFilter] = useState('todos');
  const [profesionalFilter, setProfesionalFilter] = useState('');
  const profesionalFromUrl = searchParams.get('profesional');

  useEffect(() => {
    if (profesionalFromUrl) setProfesionalFilter(profesionalFromUrl);
  }, [profesionalFromUrl]);
  const [fechaFilter, setFechaFilter] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [calendarViewMonth, setCalendarViewMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDeleteTurnoModal, setShowDeleteTurnoModal] = useState(false);
  const [turnoToDelete, setTurnoToDelete] = useState<Turno | null>(null);
  const [selectedTurno, setSelectedTurno] = useState<Turno | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showBloqueModal, setShowBloqueModal] = useState(false);
  const [showGestionarBloqueModal, setShowGestionarBloqueModal] = useState(false);
  const [bloqueEditando, setBloqueEditando] = useState<BloqueNoDisponible | null>(null);
  const [bloqueEditForm, setBloqueEditForm] = useState<{ hora_inicio: string; hora_fin: string; motivo: string }>({ hora_inicio: '', hora_fin: '', motivo: '' });
  const [bloqueToDelete, setBloqueToDelete] = useState<BloqueNoDisponible | null>(null);
  const [isSubmittingBloque, setIsSubmittingBloque] = useState(false);
  const [bloqueForm, setBloqueForm] = useState<{
    profesional_id: string;
    fecha_inicio: string;
    fecha_fin: string;
    todo_el_dia: boolean;
    hora_inicio: string;
    hora_fin: string;
    motivo: string;
  }>(() => {
    const hoy = new Date().toISOString().slice(0, 10);
    return {
      profesional_id: '',
      fecha_inicio: hoy,
      fecha_fin: hoy,
      todo_el_dia: false,
      hora_inicio: '09:00',
      hora_fin: '12:00',
      motivo: '',
    };
  });
  const [bloqueDatePickerDesdeOpen, setBloqueDatePickerDesdeOpen] = useState(false);
  const [bloqueDatePickerHastaOpen, setBloqueDatePickerHastaOpen] = useState(false);
  const [bloqueDatePickerDesdeMonth, setBloqueDatePickerDesdeMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [bloqueDatePickerHastaMonth, setBloqueDatePickerHastaMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [bloqueDesdeAnchor, setBloqueDesdeAnchor] = useState<{ bottom: number; left: number; width: number } | null>(null);
  const [bloqueHastaAnchor, setBloqueHastaAnchor] = useState<{ bottom: number; left: number; width: number } | null>(null);
  const bloqueDesdeButtonRef = useRef<HTMLButtonElement>(null);
  const bloqueHastaButtonRef = useRef<HTMLButtonElement>(null);

  const [showDiaPuntualModal, setShowDiaPuntualModal] = useState(false);
  const [diaPuntualForm, setDiaPuntualForm] = useState<CreateExcepcionAgendaData & { profesional_id: string }>({
    profesional_id: '',
    fecha: format(new Date(), 'yyyy-MM-dd'),
    hora_inicio: '09:00',
    hora_fin: '13:00',
    duracion_turno_minutos: 30,
    observaciones: '',
  });

  // Al abrir el modal de crear: fijar profesional desde el filtro y fecha/horas desde el día del calendario
  useEffect(() => {
    if (showCreateModal) {
      if (profesionalFilter) {
        setCreateFormData((prev) => (prev.profesional_id !== profesionalFilter ? { ...prev, profesional_id: profesionalFilter } : prev));
      }
      setCreateFecha(fechaFilter);
      setCreateHoraInicio('09:00');
      setCreateHoraFin('09:30');
      setPacienteDniInput('');
      setPacienteFound(null);
      setShowQuickCreatePaciente(false);
      setQuickCreatePaciente({ dni: '', nombre: '', apellido: '', telefono: '' });
    }
  }, [showCreateModal, profesionalFilter, fechaFilter]);

  // Form state para crear turno
  const [createFormData, setCreateFormData] = useState<CreateTurnoData>({
    profesional_id: '',
    paciente_id: '',
    fecha_hora_inicio: '',
    fecha_hora_fin: '',
    estado: 'pendiente',
    motivo: '',
  });
  const [createFecha, setCreateFecha] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [createDatePickerOpen, setCreateDatePickerOpen] = useState(false);
  const [createDatePickerMonth, setCreateDatePickerMonth] = useState<Date>(() => startOfMonth(new Date()));
  const createDatePickerRef = useRef<HTMLDivElement>(null);
  const [createHoraInicio, setCreateHoraInicio] = useState('09:00');
  const [createHoraFin, setCreateHoraFin] = useState('09:30');
  const [pacienteDniInput, setPacienteDniInput] = useState('');
  const [pacienteFound, setPacienteFound] = useState<Paciente | null>(null);
  const [showQuickCreatePaciente, setShowQuickCreatePaciente] = useState(false);
  const [quickCreatePaciente, setQuickCreatePaciente] = useState({ dni: '', nombre: '', apellido: '', telefono: '' });
  const [isSearchingPaciente, setIsSearchingPaciente] = useState(false);
  const [isCreatingPaciente, setIsCreatingPaciente] = useState(false);

  // Form state para cancelar turno
  const [cancelData, setCancelData] = useState<CancelTurnoData>({
    razon_cancelacion: '',
  });

  // Fetch profesionales
  const { data: profesionales = [] } = useQuery({
    queryKey: ['profesionales', 'for-turnos'],
    queryFn: () => profesionalesService.getAll({ activo: true }),
  });

  // Fetch turnos con filtros
  const filters = useMemo(() => {
    const f: Record<string, string | undefined> = {};
    if (estadoFilter && estadoFilter !== 'todos') {
      f.estado = estadoFilter;
    }
    if (profesionalFilter) {
      f.profesional_id = profesionalFilter;
    }
    if (fechaFilter) {
      // Rango del día en hora local: 00:00:00 y 23:59:59.999 (evita desfase por UTC)
      const fechaInicio = new Date(fechaFilter + 'T00:00:00');
      const fechaFin = new Date(fechaFilter + 'T23:59:59.999');
      f.fecha_inicio = fechaInicio.toISOString();
      f.fecha_fin = fechaFin.toISOString();
    }
    return f;
  }, [estadoFilter, profesionalFilter, fechaFilter]);

  const { data: turnos = [], isLoading } = useQuery({
    queryKey: ['turnos', filters],
    queryFn: () => turnosService.getAll(filters),
  });

  const filteredTurnos = useMemo(() => turnos, [turnos]);

  // Todas las agendas (para saber qué profesionales tienen agenda y pueden ser elegidos en Turnos)
  const { data: todasLasAgendas = [] } = useQuery({
    queryKey: ['agendas', 'todos-profesionales'],
    queryFn: () => agendaService.getAllAgenda({ activo: true, vigente: false }),
  });
  const profesionalesConAgendaIds = useMemo(
    () => new Set(todasLasAgendas.map((a) => a.profesional_id)),
    [todasLasAgendas]
  );

  // Agenda del profesional (incluye histórico para que el calendario muestre correctamente pasado: Lu–Vi antes de quitar lunes)
  const { data: agendasDelProfesional = [] } = useQuery({
    queryKey: ['agendas', profesionalFilter, 'conHistorico'],
    queryFn: () => agendaService.getAllAgenda({ profesional_id: profesionalFilter!, activo: true, vigente: false }),
    enabled: Boolean(profesionalFilter),
  });

  // Días puntuales del profesional (rango: mes del calendario ± 1 mes)
  const excepcionesDateRange = useMemo(() => {
    const start = startOfMonth(subMonths(calendarViewMonth, 1));
    const end = endOfMonth(addMonths(calendarViewMonth, 1));
    return { fecha_desde: format(start, 'yyyy-MM-dd'), fecha_hasta: format(end, 'yyyy-MM-dd') };
  }, [calendarViewMonth]);
  const { data: excepcionesDelRango = [] } = useQuery({
    queryKey: ['excepciones', profesionalFilter, excepcionesDateRange.fecha_desde, excepcionesDateRange.fecha_hasta],
    queryFn: () =>
      agendaService.getExcepcionesByProfesional(
        profesionalFilter!,
        excepcionesDateRange.fecha_desde,
        excepcionesDateRange.fecha_hasta
      ),
    enabled: Boolean(profesionalFilter),
  });

  // Bloques no disponibles del profesional (para el mes de la fecha seleccionada)
  const fechaFilterMonthStart = useMemo(() => {
    if (!fechaFilter) return '';
    const d = new Date(fechaFilter + 'T12:00:00');
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}-01T00:00:00`;
  }, [fechaFilter]);
  const fechaFilterMonthEnd = useMemo(() => {
    if (!fechaFilter) return '';
    const d = new Date(fechaFilter + 'T12:00:00');
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const y = last.getFullYear();
    const m = String(last.getMonth() + 1).padStart(2, '0');
    const day = String(last.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}T23:59:59.999`;
  }, [fechaFilter]);
  const { data: bloquesDelMes = [] } = useQuery({
    queryKey: ['bloques', profesionalFilter, fechaFilterMonthStart],
    queryFn: () =>
      agendaService.getBloquesByProfesional(
        profesionalFilter!,
        new Date(fechaFilterMonthStart).toISOString(),
        new Date(fechaFilterMonthEnd).toISOString()
      ),
    enabled: Boolean(profesionalFilter) && Boolean(fechaFilterMonthStart),
  });

  /** Bloques del día listado (fechaFilter) para mostrar en la grilla */
  const bloquesDelDiaListado = useMemo(() => {
    if (!fechaFilter || !profesionalFilter) return [];
    const dayStart = new Date(fechaFilter + 'T00:00:00').getTime();
    const dayEnd = new Date(fechaFilter + 'T23:59:59.999').getTime();
    return bloquesDelMes.filter((b) => {
      const bStart = new Date(b.fecha_hora_inicio).getTime();
      const bEnd = new Date(b.fecha_hora_fin).getTime();
      return bStart < dayEnd && bEnd > dayStart;
    });
  }, [fechaFilter, profesionalFilter, bloquesDelMes]);

  /** Bloques del día seleccionado en el modal de crear (createFecha) */
  const bloquesDelDiaCreate = useMemo(() => {
    if (!createFecha || !profesionalFilter) return [];
    const dayStart = new Date(createFecha + 'T00:00:00').getTime();
    const dayEnd = new Date(createFecha + 'T23:59:59.999').getTime();
    return bloquesDelMes.filter((b) => {
      const bStart = new Date(b.fecha_hora_inicio).getTime();
      const bEnd = new Date(b.fecha_hora_fin).getTime();
      return bStart < dayEnd && bEnd > dayStart;
    });
  }, [createFecha, profesionalFilter, bloquesDelMes]);

  /** Verifica si el slot [slotStart, slotEnd] (Date) solapa con algún bloque */
  const slotSolapaConBloque = (slotStart: Date, slotEnd: Date, bloques: { fecha_hora_inicio: string; fecha_hora_fin: string }[]) => {
    const s = slotStart.getTime();
    const e = slotEnd.getTime();
    return bloques.some((b) => {
      const bStart = new Date(b.fecha_hora_inicio).getTime();
      const bEnd = new Date(b.fecha_hora_fin).getTime();
      return s < bEnd && e > bStart;
    });
  };

  /** Convierte HH:mm:ss a HH:mm */
  const horaToHHmm = (hora: string) => {
    const part = hora.split(':');
    return `${part[0] ?? '00'}:${part[1] ?? '00'}`;
  };

  /** Día de la semana en hora local (0=Dom, 1=Lun, ..., 6=Sab) para una fecha YYYY-MM-DD */
  const getDiaSemanaLocal = (fechaStr: string) => {
    const [y, m, d] = fechaStr.split('-').map(Number);
    return new Date(y, (m ?? 1) - 1, d ?? 1).getDay();
  };

  /** Para una fecha YYYY-MM-DD: si hay excepción ese día, devuelve esos horarios; si no, la agenda vigente EN ESA FECHA (histórico). */
  const getAgendaForDate = useMemo(() => {
    return (fechaStr: string): { hora_inicio: string; hora_fin: string; duracion_turno_minutos: number }[] => {
      const excepcionesDelDia = excepcionesDelRango.filter(
        (e) => (e.fecha && e.fecha.slice(0, 10) === fechaStr)
      );
      if (excepcionesDelDia.length > 0) {
        return excepcionesDelDia.map((e) => ({
          hora_inicio: e.hora_inicio,
          hora_fin: e.hora_fin,
          duracion_turno_minutos: e.duracion_turno_minutos ?? 30,
        }));
      }
      const diaSemana = getDiaSemanaLocal(fechaStr);
      /** Normalizar a YYYY-MM-DD para comparar sin efectos de zona horaria */
      const toDateStr = (v: unknown): string | null => {
        if (v == null || v === '') return null;
        if (typeof v === 'string') {
          const s = String(v).slice(0, 10);
          if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
          return null;
        }
        if (v instanceof Date && !Number.isNaN(v.getTime())) {
          const y = v.getFullYear(), m = String(v.getMonth() + 1).padStart(2, '0'), d = String(v.getDate()).padStart(2, '0');
          return `${y}-${m}-${d}`;
        }
        return null;
      };
      const vigentEnFecha = agendasDelProfesional.filter((a) => {
        if (a.dia_semana !== diaSemana || !a.activo) return false;
        const tieneVigencia = a.vigencia_desde != null && a.vigencia_desde !== '' || a.vigencia_hasta != null && a.vigencia_hasta !== '';
        if (!tieneVigencia) return true;
        const desdeStr = toDateStr(a.vigencia_desde);
        const hastaStr = toDateStr(a.vigencia_hasta);
        if (desdeStr && fechaStr < desdeStr) return false;
        if (hastaStr && fechaStr > hastaStr) return false;
        return true;
      });
      return vigentEnFecha.map((a) => ({
        hora_inicio: a.hora_inicio,
        hora_fin: a.hora_fin,
        duracion_turno_minutos: a.duracion_turno_minutos ?? 30,
      }));
    };
  }, [agendasDelProfesional, excepcionesDelRango]);

  /** Hora de fin del día de hoy según agenda o excepción (para deshabilitar "hoy" si ya pasó). */
  const horaFinHoyAgenda = useMemo(() => {
    const hoy = format(new Date(), 'yyyy-MM-dd');
    const agendasHoy = getAgendaForDate(hoy);
    if (agendasHoy.length === 0) return null;
    const horasFin = agendasHoy.map((a) => horaToHHmm(a.hora_fin)).sort();
    return horasFin[horasFin.length - 1] ?? null;
  }, [getAgendaForDate]);

  /** Rango y duración para la fecha seleccionada según agenda o excepción del profesional */
  const rangoHorarioCreate = useMemo(() => {
    if (!createFecha) return { min: undefined as string | undefined, max: undefined as string | undefined, duracionMinutos: 30 };
    const agendasDelDia = getAgendaForDate(createFecha);
    if (agendasDelDia.length === 0) return { min: undefined, max: undefined, duracionMinutos: 30 };
    const horasInicio = agendasDelDia.map((a) => horaToHHmm(a.hora_inicio));
    const horasFin = agendasDelDia.map((a) => horaToHHmm(a.hora_fin));
    const min = horasInicio.sort()[0];
    const max = horasFin.sort()[horasFin.length - 1];
    const duracionMinutos = Math.min(...agendasDelDia.map((a) => a.duracion_turno_minutos));
    return { min, max, duracionMinutos };
  }, [createFecha, getAgendaForDate]);

  /** Rango horario del día listado (fechaFilter) según agenda o excepción, para mostrar en el título */
  const horarioDelDiaListado = useMemo(() => {
    if (!fechaFilter || !profesionalFilter) return null;
    const agendasDelDia = getAgendaForDate(fechaFilter);
    if (agendasDelDia.length === 0) return null;
    const horasInicio = agendasDelDia.map((a) => horaToHHmm(a.hora_inicio));
    const horasFin = agendasDelDia.map((a) => horaToHHmm(a.hora_fin));
    const min = horasInicio.sort()[0];
    const max = horasFin.sort()[horasFin.length - 1];
    return { min, max };
  }, [fechaFilter, profesionalFilter, getAgendaForDate]);

  /** Si el día listado (fechaFilter) está completamente bloqueado (no hay slots libres) */
  const diaCompletamenteBloqueadoListado = useMemo(() => {
    if (!fechaFilter || !horarioDelDiaListado || bloquesDelDiaListado.length === 0) return false;
    const { min, max } = horarioDelDiaListado;
    const agendasDelDia = getAgendaForDate(fechaFilter);
    const duracion = agendasDelDia.length ? Math.min(...agendasDelDia.map((a) => a.duracion_turno_minutos)) : 30;
    const ultimoInicio = sumarMinutos(max, -duracion);
    if (min >= ultimoInicio) return true;
    const opciones = generarOpcionesHora(min, sumarMinutos(ultimoInicio, duracion), duracion);
    const disponibles = opciones.filter((h) => {
      const slotStart = new Date(fechaFilter + 'T' + h + ':00');
      const slotEnd = new Date(fechaFilter + 'T' + sumarMinutos(h, duracion) + ':00');
      return !slotSolapaConBloque(slotStart, slotEnd, bloquesDelDiaListado);
    });
    return disponibles.length === 0;
  }, [fechaFilter, horarioDelDiaListado, bloquesDelDiaListado, getAgendaForDate]);

  /** Días del mes visible (calendario izquierda) que están completamente bloqueados para el profesional */
  const diasCompletamenteBloqueadosCalendario = useMemo(() => {
    const set = new Set<string>();
    if (!profesionalFilter) return set;
    const monthStart = startOfMonth(calendarViewMonth);
    const monthEnd = endOfMonth(calendarViewMonth);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    for (const day of days) {
      const dateStr = format(day, 'yyyy-MM-dd');
      const agendasDelDia = getAgendaForDate(dateStr);
      if (agendasDelDia.length === 0) continue;
      const horasInicio = agendasDelDia.map((a) => horaToHHmm(a.hora_inicio));
      const horasFin = agendasDelDia.map((a) => horaToHHmm(a.hora_fin));
      const min = horasInicio.sort()[0];
      const max = horasFin.sort()[horasFin.length - 1];
      const duracion = Math.min(...agendasDelDia.map((a) => a.duracion_turno_minutos));
      const ultimoInicio = sumarMinutos(max, -duracion);
      if (min >= ultimoInicio) {
        set.add(dateStr);
        continue;
      }
      const dayStart = new Date(dateStr + 'T00:00:00').getTime();
      const dayEnd = new Date(dateStr + 'T23:59:59.999').getTime();
      const bloquesDelDia = bloquesDelMes.filter((b) => {
        const bStart = new Date(b.fecha_hora_inicio).getTime();
        const bEnd = new Date(b.fecha_hora_fin).getTime();
        return bStart < dayEnd && bEnd > dayStart;
      });
      if (bloquesDelDia.length === 0) continue;
      const opciones = generarOpcionesHora(min, sumarMinutos(ultimoInicio, duracion), duracion);
      const disponibles = opciones.filter((h) => {
        const slotStart = new Date(dateStr + 'T' + h + ':00');
        const slotEnd = new Date(dateStr + 'T' + sumarMinutos(h, duracion) + ':00');
        return !slotSolapaConBloque(slotStart, slotEnd, bloquesDelDia);
      });
      if (disponibles.length === 0) set.add(dateStr);
    }
    return set;
  }, [profesionalFilter, getAgendaForDate, calendarViewMonth, bloquesDelMes]);

  /** Opciones para hora inicio: desde min hasta max - duracion, cada duracion */
  const opcionesHoraInicio = useMemo(() => {
    const { min, max, duracionMinutos } = rangoHorarioCreate;
    if (min === undefined || max === undefined) {
      return generarOpcionesHora('08:00', '20:00', 30);
    }
    const ultimoInicio = sumarMinutos(max, -duracionMinutos);
    if (min > ultimoInicio) return [];
    const finExcl = sumarMinutos(ultimoInicio, duracionMinutos);
    return generarOpcionesHora(min, finExcl, duracionMinutos);
  }, [rangoHorarioCreate]);

  /** Opciones para hora fin: desde inicio + duracion hasta max, cada duracion */
  const opcionesHoraFin = useMemo(() => {
    const { max, duracionMinutos } = rangoHorarioCreate;
    const inicio = createHoraInicio;
    if (max === undefined) {
      return generarOpcionesHora('08:30', '20:30', 30);
    }
    const primerFin = sumarMinutos(inicio, duracionMinutos);
    if (primerFin > max) return [];
    return generarOpcionesHora(primerFin, sumarMinutos(max, 1), duracionMinutos);
  }, [rangoHorarioCreate, createHoraInicio]);

  /** Si la fecha del turno es hoy (para filtrar horarios ya pasados). */
  const esHoyCreate = createFecha === format(new Date(), 'yyyy-MM-dd');
  const horaActual = format(new Date(), 'HH:mm');
  const duracionCreate = rangoHorarioCreate.duracionMinutos ?? 30;
  /** Opciones de hora inicio: hoy sin pasados + excluir slots que solapan con bloques */
  const opcionesHoraInicioFiltradas = useMemo(() => {
    const list = esHoyCreate ? opcionesHoraInicio.filter((h) => h > horaActual) : opcionesHoraInicio;
    if (bloquesDelDiaCreate.length === 0) return list;
    return list.filter((h) => {
      const slotStart = new Date(createFecha + 'T' + h + ':00');
      const slotEnd = new Date(createFecha + 'T' + sumarMinutos(h, duracionCreate) + ':00');
      return !slotSolapaConBloque(slotStart, slotEnd, bloquesDelDiaCreate);
    });
  }, [opcionesHoraInicio, esHoyCreate, horaActual, createFecha, duracionCreate, bloquesDelDiaCreate]);
  /** Opciones de hora fin: hoy sin pasados + excluir slots que solapan con bloques */
  const opcionesHoraFinFiltradas = useMemo(() => {
    const list = esHoyCreate ? opcionesHoraFin.filter((h) => h > horaActual) : opcionesHoraFin;
    if (bloquesDelDiaCreate.length === 0) return list;
    return list.filter((h) => {
      const slotStart = new Date(createFecha + 'T' + createHoraInicio + ':00');
      const slotEnd = new Date(createFecha + 'T' + h + ':00');
      return !slotSolapaConBloque(slotStart, slotEnd, bloquesDelDiaCreate);
    });
  }, [opcionesHoraFin, createHoraInicio, esHoyCreate, horaActual, createFecha, bloquesDelDiaCreate]);

  /** Día completamente bloqueado para crear turno (no hay slots disponibles) */
  const diaCompletamenteBloqueadoCreate = useMemo(() => {
    if (!createFecha || bloquesDelDiaCreate.length === 0) return false;
    return opcionesHoraInicioFiltradas.length === 0;
  }, [createFecha, bloquesDelDiaCreate.length, opcionesHoraInicioFiltradas.length]);

  // Ajustar horas al cambiar fecha, rango o inicio: usar opciones FILTRADAS (bloques + hoy) para que hora fin tenga opciones cuando hay bloque parcial
  useEffect(() => {
    const inicioValido = opcionesHoraInicioFiltradas.includes(createHoraInicio);
    const finValido = opcionesHoraFinFiltradas.includes(createHoraFin) && createHoraFin > createHoraInicio;
    if (!inicioValido && opcionesHoraInicioFiltradas.length > 0) {
      setCreateHoraInicio(opcionesHoraInicioFiltradas[0]);
    }
    if (!finValido && opcionesHoraFinFiltradas.length > 0) {
      const primerFinValido = opcionesHoraFinFiltradas.find((h) => h > createHoraInicio) ?? opcionesHoraFinFiltradas[0];
      setCreateHoraFin(primerFinValido);
    }
  }, [createFecha, createHoraInicio, createHoraFin, opcionesHoraInicioFiltradas, opcionesHoraFinFiltradas]);


  // Cerrar date picker al hacer clic fuera
  useEffect(() => {
    if (!createDatePickerOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (createDatePickerRef.current && !createDatePickerRef.current.contains(e.target as Node)) {
        setCreateDatePickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [createDatePickerOpen]);

  // Cerrar calendarios del modal Bloquear cuando se cierra el modal
  useEffect(() => {
    if (!showBloqueModal) {
      setBloqueDatePickerDesdeOpen(false);
      setBloqueDatePickerHastaOpen(false);
      setBloqueDesdeAnchor(null);
      setBloqueHastaAnchor(null);
    }
  }, [showBloqueModal]);

  useEffect(() => {
    if (showDiaPuntualModal && profesionalFilter) {
      setDiaPuntualForm((prev) => ({
        ...prev,
        profesional_id: profesionalFilter,
        fecha: fechaFilter || format(new Date(), 'yyyy-MM-dd'),
      }));
    }
  }, [showDiaPuntualModal, profesionalFilter, fechaFilter]);

  // Cerrar modal Gestionar bloqueo cuando ya no hay bloques en el día
  useEffect(() => {
    if (showGestionarBloqueModal && fechaFilter && profesionalFilter && bloquesDelDiaListado.length === 0) {
      setShowGestionarBloqueModal(false);
      setBloqueEditando(null);
      setBloqueToDelete(null);
    }
  }, [showGestionarBloqueModal, fechaFilter, profesionalFilter, bloquesDelDiaListado.length]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: CreateTurnoData) => turnosService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['turnos'] });
      reactToastify.success('Turno creado correctamente', {
        position: 'top-right',
        autoClose: 3000,
      });
      setShowCreateModal(false);
      setCreateFormData({
        profesional_id: '',
        paciente_id: '',
        fecha_hora_inicio: '',
        fecha_hora_fin: '',
        estado: 'pendiente',
        motivo: '',
      });
      setCreateFecha(format(new Date(), 'yyyy-MM-dd'));
      setCreateHoraInicio('09:00');
      setCreateHoraFin('09:30');
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      const errorMessage = err.response?.data?.message || 'Error al crear turno';
      reactToastify.error(errorMessage, {
        position: 'top-right',
        autoClose: 3000,
      });
    },
  });

  const createBloqueMutation = useMutation({
    mutationFn: (data: CreateBloqueData) => agendaService.createBloque(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bloques'] });
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      reactToastify.error(err?.response?.data?.message || 'Error al crear bloque', {
        position: 'top-right',
        autoClose: 3000,
      });
    },
  });

  const deleteBloqueMutation = useMutation({
    mutationFn: (id: string) => agendaService.deleteBloque(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bloques'] });
      setBloqueToDelete(null);
      reactToastify.success('Bloque eliminado correctamente', { position: 'top-right', autoClose: 3000 });
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      reactToastify.error(err?.response?.data?.message || 'Error al eliminar bloque', {
        position: 'top-right',
        autoClose: 3000,
      });
    },
  });

  const updateBloqueMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateBloqueData }) => agendaService.updateBloque(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bloques'] });
      setBloqueEditando(null);
      reactToastify.success('Bloque actualizado correctamente', { position: 'top-right', autoClose: 3000 });
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      reactToastify.error(err?.response?.data?.message || 'Error al actualizar bloque', {
        position: 'top-right',
        autoClose: 3000,
      });
    },
  });

  const createExcepcionMutation = useMutation({
    mutationFn: (data: CreateExcepcionAgendaData) => agendaService.createExcepcion(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['excepciones'] });
      queryClient.invalidateQueries({ queryKey: ['agendas'] });
      setShowDiaPuntualModal(false);
      reactToastify.success('Día puntual habilitado correctamente', { position: 'top-right', autoClose: 3000 });
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      reactToastify.error(err?.response?.data?.message || 'Error al habilitar día puntual', {
        position: 'top-right',
        autoClose: 3000,
      });
    },
  });

  const handleOpenBloqueModal = () => {
    const hoy = new Date().toISOString().slice(0, 10);
    setBloqueForm({
      profesional_id: profesionalFilter || '',
      fecha_inicio: hoy,
      fecha_fin: hoy,
      todo_el_dia: false,
      hora_inicio: '09:00',
      hora_fin: '12:00',
      motivo: '',
    });
    setBloqueDatePickerDesdeMonth(startOfMonth(new Date()));
    setBloqueDatePickerHastaMonth(startOfMonth(new Date()));
    setShowBloqueModal(true);
  };

  const buildBloquePayload = (
    profesionalId: string,
    dateStr: string,
    todoElDia: boolean,
    horaInicio: string,
    horaFin: string
  ): CreateBloqueData => {
    if (todoElDia) {
      const inicio = new Date(`${dateStr}T00:00:00`);
      const fin = new Date(`${dateStr}T23:59:59.999`);
      return {
        profesional_id: profesionalId,
        fecha_hora_inicio: inicio.toISOString(),
        fecha_hora_fin: fin.toISOString(),
        motivo: bloqueForm.motivo.trim() || undefined,
      };
    }
    const inicio = new Date(`${dateStr}T${horaInicio}:00`);
    const fin = new Date(`${dateStr}T${horaFin}:00`);
    return {
      profesional_id: profesionalId,
      fecha_hora_inicio: inicio.toISOString(),
      fecha_hora_fin: fin.toISOString(),
      motivo: bloqueForm.motivo.trim() || undefined,
    };
  };

  const handleSubmitBloque = async () => {
    if (!bloqueForm.profesional_id) {
      reactToastify.error('Selecciona un profesional', { position: 'top-right', autoClose: 3000 });
      return;
    }
    const ini = new Date(bloqueForm.fecha_inicio);
    const fin = new Date(bloqueForm.fecha_fin);
    if (ini > fin) {
      reactToastify.error('La fecha "Hasta" debe ser igual o posterior a "Desde"', { position: 'top-right', autoClose: 3000 });
      return;
    }
    if (!bloqueForm.todo_el_dia && bloqueForm.hora_inicio >= bloqueForm.hora_fin) {
      reactToastify.error('La hora fin debe ser posterior a la hora inicio', { position: 'top-right', autoClose: 3000 });
      return;
    }
    setIsSubmittingBloque(true);
    try {
      const { profesional_id, fecha_inicio, fecha_fin, todo_el_dia, hora_inicio, hora_fin, motivo } = bloqueForm;
      const isUnDia = fecha_inicio === fecha_fin;
      if (isUnDia) {
        const payload = buildBloquePayload(profesional_id, fecha_inicio, todo_el_dia, hora_inicio, hora_fin);
        if (motivo.trim()) payload.motivo = motivo.trim();
        await createBloqueMutation.mutateAsync(payload);
        reactToastify.success('Bloque creado correctamente', { position: 'top-right', autoClose: 3000 });
      } else {
        const start = new Date(fecha_inicio);
        const end = new Date(fecha_fin);
        if (todo_el_dia) {
          const payload: CreateBloqueData = {
            profesional_id,
            fecha_hora_inicio: new Date(`${fecha_inicio}T00:00:00`).toISOString(),
            fecha_hora_fin: new Date(`${fecha_fin}T23:59:59.999`).toISOString(),
            motivo: motivo.trim() || undefined,
          };
          await createBloqueMutation.mutateAsync(payload);
          reactToastify.success('Bloque creado correctamente', { position: 'top-right', autoClose: 3000 });
        } else {
          let creados = 0;
          const current = new Date(start);
          current.setHours(0, 0, 0, 0);
          end.setHours(23, 59, 59, 999);
          while (current <= end) {
            const dateStr = current.toISOString().slice(0, 10);
            const payload = buildBloquePayload(profesional_id, dateStr, false, hora_inicio, hora_fin);
            try {
              await createBloqueMutation.mutateAsync(payload);
              creados++;
            } catch {
              // puede fallar por solapamiento
            }
            current.setDate(current.getDate() + 1);
          }
          if (creados > 0) {
            reactToastify.success(creados === 1 ? '1 bloque creado' : `${creados} bloques creados`, { position: 'top-right', autoClose: 3000 });
          }
        }
      }
      setShowBloqueModal(false);
    } finally {
      setIsSubmittingBloque(false);
    }
  };

  // Cancel mutation
  const cancelMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: CancelTurnoData }) =>
      turnosService.cancel(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['turnos'] });
      reactToastify.success('Turno cancelado correctamente', {
        position: 'top-right',
        autoClose: 3000,
      });
      setShowCancelModal(false);
      setSelectedTurno(null);
      setCancelData({ razon_cancelacion: '' });
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      const errorMessage = err.response?.data?.message || 'Error al cancelar turno';
      reactToastify.error(errorMessage, {
        position: 'top-right',
        autoClose: 3000,
      });
    },
  });

  // Update mutation (cambiar estado u otros campos)
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTurnoData }) =>
      turnosService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['turnos'] });
      reactToastify.success('Estado actualizado', {
        position: 'top-right',
        autoClose: 3000,
      });
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      reactToastify.error(err.response?.data?.message || 'Error al actualizar estado', {
        position: 'top-right',
        autoClose: 3000,
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => turnosService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['turnos'] });
      reactToastify.success('Turno eliminado', {
        position: 'top-right',
        autoClose: 3000,
      });
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      reactToastify.error(err.response?.data?.message || 'Error al eliminar turno', {
        position: 'top-right',
        autoClose: 3000,
      });
    },
  });

  const handleBuscarPacientePorDni = async () => {
    const dni = pacienteDniInput.trim();
    if (!dni) return;
    setIsSearchingPaciente(true);
    setPacienteFound(null);
    setShowQuickCreatePaciente(false);
    try {
      const pac = await pacientesService.getByDni(dni);
      if (pac) {
        setPacienteFound(pac);
        setCreateFormData((prev) => ({ ...prev, paciente_id: pac.id }));
      } else {
        setShowQuickCreatePaciente(true);
        setQuickCreatePaciente({ dni, nombre: '', apellido: '', telefono: '' });
      }
    } catch {
      reactToastify.error('Error al buscar paciente', { position: 'top-right', autoClose: 3000 });
    } finally {
      setIsSearchingPaciente(false);
    }
  };

  const handleQuickCreatePaciente = async () => {
    const { dni, nombre, apellido, telefono } = quickCreatePaciente;
    if (!dni.trim() || !nombre.trim() || !apellido.trim() || !telefono.trim()) {
      reactToastify.error('Complete DNI, nombre, apellido y teléfono', { position: 'top-right', autoClose: 3000 });
      return;
    }
    setIsCreatingPaciente(true);
    try {
      const nuevo = await pacientesService.create({
        dni: dni.trim(),
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        telefono: telefono.trim(),
      });
      queryClient.invalidateQueries({ queryKey: ['pacientes'] });
      setCreateFormData((prev) => ({ ...prev, paciente_id: nuevo.id }));
      setPacienteFound(nuevo);
      setShowQuickCreatePaciente(false);
      setQuickCreatePaciente({ dni: '', nombre: '', apellido: '', telefono: '' });
      reactToastify.success('Paciente creado', { position: 'top-right', autoClose: 3000 });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Error al crear paciente';
      reactToastify.error(msg, { position: 'top-right', autoClose: 3000 });
    } finally {
      setIsCreatingPaciente(false);
    }
  };

  const handleCreate = async () => {
    // Construir fecha/hora en hora local del usuario y enviar en ISO UTC para evitar desfase de día en el servidor
    const inicioLocal = new Date(`${createFecha}T${createHoraInicio}:00`);
    const finLocal = new Date(`${createFecha}T${createHoraFin}:00`);
    const fecha_hora_inicio = inicioLocal.toISOString();
    const fecha_hora_fin = finLocal.toISOString();
    if (!createFormData.profesional_id || !createFormData.paciente_id || !createFecha || !createHoraInicio || !createHoraFin) {
      reactToastify.error('Complete todos los campos requeridos', {
        position: 'top-right',
        autoClose: 3000,
      });
      return;
    }
    const ahora = new Date();
    if (inicioLocal.getTime() <= ahora.getTime()) {
      reactToastify.error('No se pueden crear turnos en días u horarios que ya pasaron', {
        position: 'top-right',
        autoClose: 3000,
      });
      return;
    }
    if (createHoraFin <= createHoraInicio) {
      reactToastify.error('La hora fin debe ser posterior a la hora inicio', {
        position: 'top-right',
        autoClose: 3000,
      });
      return;
    }
    const { min: minHora, max: maxHora } = rangoHorarioCreate;
    if (minHora !== undefined && maxHora !== undefined) {
      if (createHoraInicio < minHora || createHoraFin > maxHora) {
        reactToastify.error('El horario debe estar dentro de la agenda del profesional', {
          position: 'top-right',
          autoClose: 3000,
        });
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await createMutation.mutateAsync({
        ...createFormData,
        fecha_hora_inicio,
        fecha_hora_fin,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelSubmit = async () => {
    if (!selectedTurno || !cancelData.razon_cancelacion.trim()) {
      reactToastify.error('Ingrese la razón de cancelación', {
        position: 'top-right',
        autoClose: 3000,
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await cancelMutation.mutateAsync({
        id: selectedTurno.id,
        data: cancelData,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const canCreate = hasPermission(user, 'turnos.crear');
  const canCancel = hasPermission(user, 'turnos.cancelar');
  const canUpdate = hasPermission(user, 'turnos.actualizar');
  const canDelete = hasPermission(user, 'turnos.eliminar');

  const handleUpdateEstado = (turnoId: string, nuevoEstado: string) => {
    updateMutation.mutate({ id: turnoId, data: { estado: nuevoEstado as Turno['estado'] } });
  };

  const handleDelete = (turno: Turno) => {
    setTurnoToDelete(turno);
    setShowDeleteTurnoModal(true);
  };

  const handleConfirmDeleteTurno = () => {
    if (!turnoToDelete) return;
    deleteMutation.mutate(turnoToDelete.id, {
      onSuccess: () => {
        setShowDeleteTurnoModal(false);
        setTurnoToDelete(null);
      },
    });
  };

  const profesionalOptions = profesionales.map((prof) => ({
    value: prof.id,
    label: `${prof.nombre} ${prof.apellido} ${prof.especialidad ? `- ${prof.especialidad}` : ''}`,
    tieneAgenda: profesionalesConAgendaIds.has(prof.id),
  }));

  void Boolean(estadoFilter !== 'todos' || profesionalFilter);

  // Fecha seleccionada (para listado de turnos)
  const selectedDate = useMemo(() => new Date(fechaFilter + 'T12:00:00'), [fechaFilter]);
  // Calendario: mes mostrado (al cambiar flechas no cambia la fecha seleccionada)
  const calendarMonthStart = calendarViewMonth;
  const calendarMonthEnd = endOfMonth(calendarViewMonth);
  const calendarStart = startOfWeek(calendarMonthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(calendarMonthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const setCalendarMonth = (delta: number) => {
    setCalendarViewMonth((prev) => (delta === 1 ? addMonths(prev, 1) : subMonths(prev, 1)));
  };

  const handleCalendarDayClick = (day: Date) => {
    setFechaFilter(format(day, 'yyyy-MM-dd'));
    setCalendarViewMonth(startOfMonth(day));
  };

  const monthTitle = format(calendarMonthStart, 'MMMM yyyy', { locale: es });
  const monthTitleCapitalized = monthTitle.charAt(0).toUpperCase() + monthTitle.slice(1);

  return (
    <div className="flex flex-col gap-6 min-h-[calc(100vh-12rem)]">
      {/* Header: título y botones */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[32px] font-bold text-[#111827] font-['Poppins'] leading-tight tracking-[-0.02em] mb-0">
            Gestión de Turnos
          </h1>
          <p className="text-base text-[#6B7280] mt-2 font-['Inter']">
            {isLoading ? 'Cargando...' : `${filteredTurnos.length} ${filteredTurnos.length === 1 ? 'turno' : 'turnos'} del día seleccionado`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {profesionalFilter && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (fechaFilter && bloquesDelDiaListado.length > 0) {
                    setShowGestionarBloqueModal(true);
                    setBloqueEditando(null);
                    setBloqueToDelete(null);
                  } else {
                    handleOpenBloqueModal();
                  }
                }}
                className="border-[#6B7280] text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#374151] hover:border-[#6B7280] focus-visible:border-[#6B7280] rounded-[12px] px-4 py-2.5 h-11 font-medium font-['Inter']"
              >
                <Lock className="h-5 w-5 mr-2 stroke-[2]" />
                {fechaFilter && bloquesDelDiaListado.length > 0 ? 'Modificar / Desbloquear' : 'Bloquear día'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowDiaPuntualModal(true)}
                className="border-[#2563eb] text-[#2563eb] hover:bg-[#dbeafe] hover:text-[#1d4ed8] rounded-[12px] px-4 py-2.5 h-11 font-medium font-['Inter']"
              >
                <CalendarPlus className="h-5 w-5 mr-2 stroke-[2]" />
                Habilitar día
              </Button>
            </>
          )}
          {canCreate && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-block">
                    <Button
                      onClick={() => setShowCreateModal(true)}
                      disabled={!profesionalFilter}
                      className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-md shadow-[#2563eb]/20 hover:shadow-lg hover:shadow-[#2563eb]/30 transition-all duration-200 rounded-[12px] px-5 py-2.5 h-11 font-medium font-['Inter'] disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed"
                    >
                      <Plus className="h-5 w-5 mr-2 stroke-[2]" />
                      Nuevo Turno
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent className="bg-[#111827] text-white text-xs font-['Inter'] rounded-[8px] px-3 py-2">
                  {!profesionalFilter ? 'Seleccione un profesional para crear turnos' : 'Crear un nuevo turno'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>

      {/* Filtros: profesional y estado (mismo diseño que Usuarios / Pacientes) */}
      <Card className="border border-[#E5E7EB] rounded-[16px] shadow-sm">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[14px] font-medium text-[#374151] font-['Inter'] flex items-center gap-2">
                <Stethoscope className="h-4 w-4 text-[#6B7280] stroke-[2]" />
                Profesional
              </label>
              <Select value={profesionalFilter || undefined} onValueChange={setProfesionalFilter}>
                <SelectTrigger className="h-12 border-[#D1D5DB] rounded-[10px] font-['Inter'] text-[15px] w-full focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 pl-3">
                  <SelectValue placeholder="Seleccionar profesional" />
                </SelectTrigger>
                <SelectContent className="rounded-[12px]">
                  {profesionalOptions.map((opt) => (
                    <SelectItem
                      key={opt.value}
                      value={opt.value}
                      disabled={!opt.tieneAgenda}
                      className="font-['Inter']"
                    >
                      <span className="truncate">{opt.label}</span>
                      {!opt.tieneAgenda && (
                        <span className="ml-2 text-xs text-[#6B7280] whitespace-nowrap">— Debe crear agenda</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-[14px] font-medium text-[#374151] font-['Inter'] flex items-center gap-2">
                <Filter className="h-4 w-4 text-[#6B7280] stroke-[2]" />
                Estado
              </label>
              <Select value={estadoFilter} onValueChange={setEstadoFilter}>
                <SelectTrigger className="h-12 border-[#D1D5DB] rounded-[10px] font-['Inter'] text-[15px] w-full focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 pl-3">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent className="rounded-[12px]">
                  {estadoOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="font-['Inter']">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Layout: Calendario izquierda | Turnos derecha */}
      <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
        {/* Calendario - lado izquierdo: solo alto del contenido (números) */}
        <Card className="border border-[#E5E7EB] rounded-[16px] shadow-sm lg:w-[320px] flex-shrink-0 self-start">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[18px] font-semibold text-[#111827] font-['Poppins']">
                {monthTitleCapitalized}
              </h2>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-[8px] hover:bg-[#dbeafe] text-[#2563eb]"
                  onClick={() => setCalendarMonth(-1)}
                >
                  <ChevronLeft className="h-4 w-4 stroke-[2]" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-[8px] hover:bg-[#dbeafe] text-[#2563eb]"
                  onClick={() => setCalendarMonth(1)}
                >
                  <ChevronRight className="h-4 w-4 stroke-[2]" />
                </Button>
              </div>
            </div>
            <TooltipProvider>
            <div className="grid grid-cols-7 gap-1 text-center">
              {['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'].map((d) => (
                <span key={d} className="text-[11px] font-medium text-[#6B7280] font-['Inter'] py-1">
                  {d}
                </span>
              ))}
              {calendarDays.map((day) => {
                const isCurrentMonth = isSameMonth(day, calendarViewMonth);
                const isSelected = isSameDay(day, selectedDate);
                const isTodayDate = isToday(day);
                const dateStr = format(day, 'yyyy-MM-dd');
                const isLaborable = getAgendaForDate(dateStr).length > 0;
                const isDiaPuntual = excepcionesDelRango.some((e) => e.fecha && e.fecha.slice(0, 10) === dateStr);
                const isDisabled = !isLaborable;
                const isCompletamenteBloqueado = isLaborable && diasCompletamenteBloqueadosCalendario.has(dateStr);
                const dayButton = (
                  <button
                    type="button"
                    disabled={isDisabled}
                    onClick={() => !isDisabled && handleCalendarDayClick(day)}
                    className={`
                      h-9 rounded-[10px] text-[13px] font-medium font-['Inter'] transition-all
                      ${isSelected ? 'bg-[#2563eb] text-white hover:bg-[#1d4ed8]' : ''}
                      ${!isSelected && isDisabled ? 'text-[#9CA3AF] cursor-not-allowed opacity-50' : ''}
                      ${!isSelected && !isDisabled && !isCurrentMonth ? 'text-[#9CA3AF] hover:bg-[#F3F4F6]' : ''}
                      ${!isSelected && !isDisabled && isCurrentMonth && !isCompletamenteBloqueado && !isTodayDate && !isDiaPuntual ? 'text-[#374151] hover:bg-[#dbeafe]' : ''}
                      ${!isSelected && !isDisabled && isDiaPuntual && !isCompletamenteBloqueado ? 'bg-[#d1fae5] text-[#047857] font-medium ring-1 ring-[#059669]/40 hover:bg-[#a7f3d0]' : ''}
                      ${!isSelected && !isDisabled && isTodayDate && !isDiaPuntual ? 'bg-[#dbeafe] text-[#2563eb] font-semibold ring-1 ring-[#2563eb]/50' : ''}
                      ${!isSelected && !isDisabled && isTodayDate && isDiaPuntual ? 'bg-[#d1fae5] text-[#047857] font-semibold ring-1 ring-[#059669]/50' : ''}
                      ${!isSelected && !isDisabled && isCompletamenteBloqueado ? 'bg-gray-100 text-gray-600 font-medium ring-1 ring-gray-300' : ''}
                    `}
                  >
                    {format(day, 'd')}
                  </button>
                );
                const bloquesDelDiaTooltip = bloquesDelMes.filter((b) => {
                  const dayStart = new Date(dateStr + 'T00:00:00').getTime();
                  const dayEnd = new Date(dateStr + 'T23:59:59.999').getTime();
                  const bStart = new Date(b.fecha_hora_inicio).getTime();
                  const bEnd = new Date(b.fecha_hora_fin).getTime();
                  return bStart < dayEnd && bEnd > dayStart;
                });
                const motivosBloque = bloquesDelDiaTooltip.map((b) => b.motivo).filter((m): m is string => Boolean(m));
                const textoBloqueado = motivosBloque.length > 0 ? `Bloqueado — ${motivosBloque.join(' · ')}` : 'Bloqueado';
                const excepcionDelDia = excepcionesDelRango.find((e) => e.fecha && e.fecha.slice(0, 10) === dateStr);
                const textoDiaPuntual = excepcionDelDia?.observaciones ? `Día puntual — ${excepcionDelDia.observaciones}` : 'Día puntual';

                return (
                  <div key={dateStr} className="contents">
                    {isCompletamenteBloqueado ? (
                      <Tooltip>
                        <TooltipTrigger asChild>{dayButton}</TooltipTrigger>
                        <TooltipContent side="top" className="font-['Inter'] text-[13px]">
                          {textoBloqueado}
                        </TooltipContent>
                      </Tooltip>
                    ) : isDiaPuntual && !isCompletamenteBloqueado ? (
                      <Tooltip>
                        <TooltipTrigger asChild>{dayButton}</TooltipTrigger>
                        <TooltipContent side="top" className="font-['Inter'] text-[13px]">
                          {textoDiaPuntual}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      dayButton
                    )}
                  </div>
                );
              })}
            </div>
            </TooltipProvider>
          </CardContent>
        </Card>

        {/* Turnos del día - lado derecho: ocupa todo el alto disponible */}
        <Card className="border-0 rounded-[16px] shadow-none hover:!shadow-none hover:!translate-y-0 flex-1 min-w-0 flex flex-col min-h-0">
          <CardContent className="p-0 flex-1 flex flex-col min-h-0 overflow-auto">
            <div className="px-6 py-4 border-b border-[#E5E7EB] mb-4">
              <h2 className="text-[18px] font-semibold text-[#111827] font-['Poppins'] mb-0">
                Turnos del {format(selectedDate, "d 'de' MMMM", { locale: es }).replace(/\s+(\w+)$/, (_, month) => ' ' + month.charAt(0).toUpperCase() + month.slice(1))}
                {profesionalFilter ? (
                  horarioDelDiaListado ? (
                    <span className="font-normal text-[#6B7280]"> ({horarioDelDiaListado.min} - {horarioDelDiaListado.max})</span>
                  ) : (
                    <span className="font-normal text-[#9CA3AF]"> (Sin horario para este día)</span>
                  )
                ) : null}
              </h2>
              {profesionalFilter && bloquesDelDiaListado.length > 0 && (
                <p className="text-[14px] font-['Inter'] mt-1 mb-0">
                  {diaCompletamenteBloqueadoListado ? (
                    <span className="text-gray-600 font-medium flex items-center gap-1.5">
                      <Lock className="h-4 w-4 stroke-[2]" />
                      Día completamente bloqueado — no se pueden asignar turnos
                    </span>
                  ) : (
                    <span className="text-gray-600 flex items-center gap-1.5">
                      <Lock className="h-4 w-4 stroke-[2]" />
                      Horarios bloqueados: {bloquesDelDiaListado.map((b) => `${format(new Date(b.fecha_hora_inicio), 'HH:mm')} - ${format(new Date(b.fecha_hora_fin), 'HH:mm')}${b.motivo ? ` (${b.motivo})` : ''}`).join(' · ')}
                    </span>
                  )}
                </p>
              )}
            </div>
            {isLoading ? (
              <div className="p-16 text-center">
                <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-[#2563eb]" />
                <p className="text-[#6B7280] font-['Inter'] text-base">Cargando turnos...</p>
              </div>
            ) : filteredTurnos.length === 0 ? (
              <div className="p-16 text-center">
                <div className="h-20 w-20 rounded-full bg-[#dbeafe] flex items-center justify-center mx-auto mb-4">
                  <Calendar className="h-10 w-10 text-[#2563eb] stroke-[2]" />
                </div>
                {!profesionalFilter ? (
                  <>
                    <h3 className="text-lg font-semibold mb-2 text-[#374151] font-['Inter']">
                      Debe seleccionar un profesional
                    </h3>
                    <p className="text-[#6B7280] font-['Inter'] text-[15px] max-w-[320px] mx-auto">
                      Elija un profesional en el filtro superior para ver los turnos de este día y poder crear nuevos.
                    </p>
                  </>
                ) : (
                  <>
                    <h3 className="text-lg font-semibold mb-6 text-[#374151] font-['Inter']">
                      No hay turnos este día
                    </h3>
                    {canCreate && !diaCompletamenteBloqueadoListado && (
                      <Button
                        onClick={() => setShowCreateModal(true)}
                        className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-md shadow-[#2563eb]/20 rounded-[12px] px-6 py-3 h-auto font-medium"
                      >
                        <Plus className="h-5 w-5 mr-2 stroke-[2]" />
                        Nuevo Turno
                      </Button>
                    )}
                  </>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#F9FAFB] border-b-2 border-[#E5E7EB] hover:bg-[#F9FAFB]">
                    <TableHead className="font-['Inter'] font-medium text-[14px] text-[#374151] py-3 w-[125px] whitespace-nowrap">
                      Hora
                    </TableHead>
                    <TableHead className="font-['Inter'] font-medium text-[14px] text-[#374151] py-3 w-[22%] max-w-[200px]">
                      Paciente
                    </TableHead>
                    <TableHead className="font-['Inter'] font-medium text-[14px] text-[#374151] py-3 w-[155px]">
                      Estado
                    </TableHead>
                    <TableHead className="font-['Inter'] font-medium text-[14px] text-[#374151] py-3 w-[18%] min-w-[90px] max-w-[150px]">
                      Motivo
                    </TableHead>
                    <TableHead className="font-['Inter'] font-medium text-[14px] text-[#374151] py-3 text-right w-[120px]">
                      Acciones
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bloquesDelDiaListado.map((bloque) => (
                    <TableRow key={bloque.id} className="border-b border-gray-200 bg-gray-50 hover:bg-gray-100/80">
                      <TableCell className="py-3 font-['Inter'] text-[15px] text-gray-700 whitespace-nowrap w-[125px]">
                        <span className="font-medium flex items-center gap-1.5">
                          <Lock className="h-4 w-4 text-gray-600 stroke-[2]" />
                          {format(new Date(bloque.fecha_hora_inicio), 'HH:mm', { locale: es })} - {format(new Date(bloque.fecha_hora_fin), 'HH:mm', { locale: es })}
                        </span>
                      </TableCell>
                      <TableCell colSpan={4} className="py-3 font-['Inter'] text-[14px] text-gray-600 italic">
                        Bloqueado{bloque.motivo ? ` — ${bloque.motivo}` : ''}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredTurnos.map((turno) => (
                    <TableRow
                      key={turno.id}
                      className="border-b border-[#E5E7EB] hover:bg-[#F9FAFB] transition-colors duration-150"
                    >
                      <TableCell className="py-3 font-['Inter'] text-[15px] text-[#374151] whitespace-nowrap w-[125px]">
                        <span className="font-medium">
                          {format(new Date(turno.fecha_hora_inicio), 'HH:mm', { locale: es })} - {format(new Date(turno.fecha_hora_fin), 'HH:mm', { locale: es })}
                        </span>
                      </TableCell>
                      <TableCell className="py-3 max-w-0">
                        <span className="font-medium text-[#374151] font-['Inter'] text-[15px] truncate block">
                          {turno.paciente_nombre} {turno.paciente_apellido}
                          {turno.paciente_dni ? ` (${formatDni(turno.paciente_dni)})` : ''}
                        </span>
                      </TableCell>
                      <TableCell className="py-3">
                        {canUpdate ? (
                          <Select
                            value={turno.estado}
                            onValueChange={(value) => handleUpdateEstado(turno.id, value)}
                            disabled={updateMutation.isPending}
                          >
                            <SelectTrigger className={getEstadoSelectTriggerClass(turno.estado)}>
                              <SelectValue>
                                <span className="font-medium truncate block">{getEstadoLabel(turno.estado)}</span>
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent className="rounded-[12px] border-[#E5E7EB]" align="start">
                              {estadoOpcionesGrilla.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value} className="font-['Inter'] text-[14px] rounded-[8px]">
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          getEstadoBadge(turno.estado)
                        )}
                      </TableCell>
                      <TableCell className="py-3 font-['Inter'] text-[14px] text-[#374151] max-w-0">
                        {turno.motivo ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="line-clamp-2 cursor-default">{turno.motivo}</span>
                              </TooltipTrigger>
                              <TooltipContent className="bg-[#111827] text-white text-xs font-['Inter'] rounded-[8px] px-3 py-2 max-w-[280px]">
                                {turno.motivo}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <span className="text-[#9CA3AF]">—</span>
                        )}
                      </TableCell>
                      <TableCell className="py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setSelectedTurno(turno);
                                    setShowDetailModal(true);
                                  }}
                                  className="h-8 w-8 rounded-[8px] hover:bg-[#F3F4F6] text-[#6B7280] hover:text-[#374151]"
                                >
                                  <Eye className="h-4 w-4 stroke-[2]" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent className="bg-[#111827] text-white text-xs rounded-[8px]">
                                Ver detalle
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          {canDelete && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDelete(turno)}
                                    disabled={deleteMutation.isPending}
                                    className="h-8 w-8 rounded-[8px] text-[#EF4444] hover:bg-[#FEE2E2] hover:text-[#DC2626]"
                                  >
                                    <Trash2 className="h-4 w-4 stroke-[2]" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent className="bg-[#111827] text-white text-xs rounded-[8px]">
                                  Eliminar turno
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal Bloquear agenda / horario */}
      <Dialog open={showBloqueModal} onOpenChange={setShowBloqueModal}>
        <DialogContent
          className="max-w-[900px] max-h-[90vh] rounded-[20px] border border-[#E5E7EB] shadow-2xl p-0 flex flex-col overflow-hidden"
          onInteractOutside={(e) => {
            const target = e.target as Node;
            const calendar = document.querySelector('[data-bloque-calendar-portal]');
            if (calendar?.contains(target)) e.preventDefault();
          }}
        >
          <DialogHeader className="px-8 pt-8 pb-6 border-b border-[#E5E7EB] bg-gradient-to-b from-white to-[#F9FAFB] flex-shrink-0 mb-0">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] flex items-center justify-center shadow-lg shadow-[#2563eb]/20">
                <Lock className="h-6 w-6 text-white stroke-[2]" />
              </div>
              <div>
                <DialogTitle className="text-[28px] font-bold text-[#111827] font-['Poppins'] leading-tight mb-0">
                  Bloquear agenda / horario
                </DialogTitle>
                <DialogDescription className="text-base text-[#6B7280] font-['Inter'] mt-1 mb-0">
                  Marca períodos en los que no se podrán asignar turnos (vacaciones, ausencias, etc.)
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="px-8 py-6 space-y-5 overflow-y-auto">
            <div className="space-y-3">
              <Label className="text-[15px] font-medium text-[#374151] font-['Inter'] flex items-center gap-2">
                <Stethoscope className="h-4 w-4 text-[#6B7280] stroke-[2]" />
                Profesional
              </Label>
              <div className="h-[52px] border-[1.5px] border-[#E5E7EB] rounded-[10px] bg-[#F9FAFB] px-4 flex items-center font-['Inter'] text-[16px] text-[#374151]">
                {(() => {
                  const p = profesionales.find((pr) => pr.id === profesionalFilter);
                  return p ? `${p.nombre} ${p.apellido}${p.especialidad ? ` - ${p.especialidad}` : ''}` : '—';
                })()}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <Label className="text-[15px] font-medium text-[#374151] font-['Inter'] flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-[#6B7280] stroke-[2]" />
                  Desde
                </Label>
                <div className="relative">
                  <button
                    ref={bloqueDesdeButtonRef}
                    type="button"
                    onClick={() => {
                      const willOpen = !bloqueDatePickerDesdeOpen;
                      if (willOpen) {
                        setBloqueDatePickerHastaOpen(false);
                        setBloqueHastaAnchor(null);
                        const rect = bloqueDesdeButtonRef.current?.getBoundingClientRect();
                        if (rect) setBloqueDesdeAnchor({ bottom: rect.bottom, left: rect.left, width: rect.width });
                        setBloqueDatePickerDesdeMonth(bloqueForm.fecha_inicio ? startOfMonth(new Date(bloqueForm.fecha_inicio + 'T12:00:00')) : startOfMonth(new Date()));
                      } else {
                        setBloqueDesdeAnchor(null);
                      }
                      setBloqueDatePickerDesdeOpen(willOpen);
                    }}
                    className="h-[52px] w-full flex items-center gap-2 px-4 border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[16px] font-['Inter'] text-left bg-white focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200 hover:border-[#9CA3AF]"
                  >
                    <Calendar className="h-4 w-4 text-[#6B7280] stroke-[2] flex-shrink-0" />
                    <span className="text-[#374151]">
                      {bloqueForm.fecha_inicio ? format(new Date(bloqueForm.fecha_inicio + 'T12:00:00'), "d 'de' MMMM, yyyy", { locale: es }) : 'Seleccionar fecha'}
                    </span>
                    <ChevronRight className={`h-4 w-4 text-[#6B7280] ml-auto transition-transform ${bloqueDatePickerDesdeOpen ? 'rotate-90' : ''}`} />
                  </button>
                </div>
              </div>
              <div className="space-y-3">
                <Label className="text-[15px] font-medium text-[#374151] font-['Inter'] flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-[#6B7280] stroke-[2]" />
                  Hasta
                </Label>
                <div className="relative">
                  <button
                    ref={bloqueHastaButtonRef}
                    type="button"
                    onClick={() => {
                      const willOpen = !bloqueDatePickerHastaOpen;
                      if (willOpen) {
                        setBloqueDatePickerDesdeOpen(false);
                        setBloqueDesdeAnchor(null);
                        const rect = bloqueHastaButtonRef.current?.getBoundingClientRect();
                        if (rect) setBloqueHastaAnchor({ bottom: rect.bottom, left: rect.left, width: rect.width });
                        setBloqueDatePickerHastaMonth(bloqueForm.fecha_fin ? startOfMonth(new Date(bloqueForm.fecha_fin + 'T12:00:00')) : startOfMonth(new Date()));
                      } else {
                        setBloqueHastaAnchor(null);
                      }
                      setBloqueDatePickerHastaOpen(willOpen);
                    }}
                    className="h-[52px] w-full flex items-center gap-2 px-4 border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[16px] font-['Inter'] text-left bg-white focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200 hover:border-[#9CA3AF]"
                  >
                    <Calendar className="h-4 w-4 text-[#6B7280] stroke-[2] flex-shrink-0" />
                    <span className="text-[#374151]">
                      {bloqueForm.fecha_fin ? format(new Date(bloqueForm.fecha_fin + 'T12:00:00'), "d 'de' MMMM, yyyy", { locale: es }) : 'Seleccionar fecha'}
                    </span>
                    <ChevronRight className={`h-4 w-4 text-[#6B7280] ml-auto transition-transform ${bloqueDatePickerHastaOpen ? 'rotate-90' : ''}`} />
                  </button>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 mb-0">
              <Checkbox
                id="todo_el_dia_bloque"
                checked={bloqueForm.todo_el_dia}
                onCheckedChange={(checked) => setBloqueForm((f) => ({ ...f, todo_el_dia: !!checked }))}
                className="border-[#2563eb] data-[state=checked]:bg-[#2563eb]"
              />
              <Label htmlFor="todo_el_dia_bloque" className="text-[15px] font-['Inter'] text-[#374151] cursor-pointer mb-0">
                Todo el día (o todos los días completos)
              </Label>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <Label className="text-[15px] font-medium text-[#374151] font-['Inter']">Hora inicio</Label>
                <Input
                  type="time"
                  value={bloqueForm.hora_inicio}
                  onChange={(e) => setBloqueForm((f) => ({ ...f, hora_inicio: e.target.value }))}
                  disabled={bloqueForm.todo_el_dia}
                  className="h-[52px] border-[1.5px] border-[#D1D5DB] rounded-[10px] font-['Inter'] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
              <div className="space-y-3">
                <Label className="text-[15px] font-medium text-[#374151] font-['Inter']">Hora fin</Label>
                <Input
                  type="time"
                  value={bloqueForm.hora_fin}
                  onChange={(e) => setBloqueForm((f) => ({ ...f, hora_fin: e.target.value }))}
                  disabled={bloqueForm.todo_el_dia}
                  className="h-[52px] border-[1.5px] border-[#D1D5DB] rounded-[10px] font-['Inter'] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
            </div>
            <div className="space-y-3">
              <Label className="text-[15px] font-medium text-[#374151] font-['Inter']">Motivo (opcional)</Label>
              <Input
                type="text"
                placeholder="Ej: Vacaciones, licencia, capacitación"
                value={bloqueForm.motivo}
                onChange={(e) => setBloqueForm((f) => ({ ...f, motivo: e.target.value }))}
                className="h-[52px] border-[1.5px] border-[#D1D5DB] rounded-[10px] font-['Inter'] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20"
              />
            </div>
          </div>
          <DialogFooter className="px-8 py-6 border-t border-[#E5E7EB] bg-[#F9FAFB] gap-3 flex-shrink-0">
            <Button variant="outline" onClick={() => setShowBloqueModal(false)} className="rounded-[12px] font-['Inter'] px-5 py-2.5 h-auto">
              Cancelar
            </Button>
            <Button
              onClick={handleSubmitBloque}
              disabled={isSubmittingBloque}
              className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-[12px] font-['Inter'] px-5 py-2.5 h-auto shadow-md shadow-[#2563eb]/20"
            >
              {isSubmittingBloque ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Bloquear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Habilitar día puntual */}
      <Dialog open={showDiaPuntualModal} onOpenChange={setShowDiaPuntualModal}>
        <DialogContent className="max-w-[900px] max-h-[90vh] rounded-[20px] border border-[#E5E7EB] shadow-2xl p-0 flex flex-col overflow-hidden">
          <DialogHeader className="px-8 pt-8 pb-6 border-b border-[#E5E7EB] bg-gradient-to-b from-white to-[#F9FAFB] flex-shrink-0 mb-0">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] flex items-center justify-center shadow-lg shadow-[#2563eb]/20">
                <CalendarPlus className="h-6 w-6 text-white stroke-[2]" />
              </div>
              <div>
                <DialogTitle className="text-[28px] font-bold text-[#111827] font-['Poppins'] leading-tight mb-0">
                  Habilitar día puntual
                </DialogTitle>
                <DialogDescription className="text-base text-[#6B7280] font-['Inter'] mt-1 mb-0">
                  Agregá una fecha en que el profesional atiende (ej. un día que no suele trabajar)
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="px-8 py-6 space-y-5 overflow-y-auto">
            <div className="space-y-3">
              <Label className="text-[15px] font-medium text-[#374151] font-['Inter'] flex items-center gap-2">
                <Stethoscope className="h-4 w-4 text-[#6B7280] stroke-[2]" />
                Profesional
              </Label>
              <div className="h-[52px] border-[1.5px] border-[#E5E7EB] rounded-[10px] bg-[#F9FAFB] px-4 flex items-center font-['Inter'] text-[16px] text-[#374151]">
                {(() => {
                  const p = profesionales.find((pr) => pr.id === profesionalFilter);
                  return p ? `${p.nombre} ${p.apellido}${p.especialidad ? ` - ${p.especialidad}` : ''}` : '—';
                })()}
              </div>
            </div>
            <div className="space-y-3">
              <Label className="text-[15px] font-medium text-[#374151] font-['Inter'] flex items-center gap-2">
                <Calendar className="h-4 w-4 text-[#6B7280] stroke-[2]" />
                Fecha
              </Label>
              <DatePicker
                value={diaPuntualForm.fecha}
                onChange={(fecha) => setDiaPuntualForm((f) => ({ ...f, fecha }))}
                placeholder="Seleccionar fecha"
                className="h-[52px] text-[#374151] border-[1.5px] border-[#D1D5DB] rounded-[10px] font-['Inter'] text-[16px] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <Label className="text-[15px] font-medium text-[#374151] font-['Inter']">Hora inicio</Label>
                <Input
                  type="time"
                  value={diaPuntualForm.hora_inicio}
                  onChange={(e) => setDiaPuntualForm((f) => ({ ...f, hora_inicio: e.target.value }))}
                  className="h-[52px] border-[1.5px] border-[#D1D5DB] rounded-[10px] font-['Inter'] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20"
                />
              </div>
              <div className="space-y-3">
                <Label className="text-[15px] font-medium text-[#374151] font-['Inter']">Hora fin</Label>
                <Input
                  type="time"
                  value={diaPuntualForm.hora_fin}
                  onChange={(e) => setDiaPuntualForm((f) => ({ ...f, hora_fin: e.target.value }))}
                  className="h-[52px] border-[1.5px] border-[#D1D5DB] rounded-[10px] font-['Inter'] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20"
                />
              </div>
            </div>
            <div className="space-y-3">
              <Label className="text-[15px] font-medium text-[#374151] font-['Inter']">Duración del turno (min)</Label>
              <Input
                type="number"
                min={5}
                max={480}
                value={diaPuntualForm.duracion_turno_minutos ?? 30}
                onChange={(e) => setDiaPuntualForm((f) => ({ ...f, duracion_turno_minutos: parseInt(e.target.value) || 30 }))}
                className="h-[52px] border-[1.5px] border-[#D1D5DB] rounded-[10px] font-['Inter'] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20"
              />
            </div>
          </div>
          <DialogFooter className="px-8 py-6 border-t border-[#E5E7EB] bg-[#F9FAFB] gap-3 flex-shrink-0">
            <Button variant="outline" onClick={() => setShowDiaPuntualModal(false)} className="rounded-[12px] font-['Inter'] px-5 py-2.5 h-auto">
              Cancelar
            </Button>
            <Button
              className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-[12px] font-['Inter'] px-5 py-2.5 h-auto shadow-md shadow-[#2563eb]/20"
              disabled={createExcepcionMutation.isPending || !diaPuntualForm.profesional_id || !diaPuntualForm.fecha}
              onClick={() => {
                const { profesional_id, fecha, hora_inicio, hora_fin, duracion_turno_minutos } = diaPuntualForm;
                createExcepcionMutation.mutate({
                  profesional_id,
                  fecha,
                  hora_inicio: hora_inicio.length >= 5 ? hora_inicio : hora_inicio + ':00',
                  hora_fin: hora_fin.length >= 5 ? hora_fin : hora_fin + ':00',
                  duracion_turno_minutos: duracion_turno_minutos ?? 30,
                });
              }}
            >
              {createExcepcionMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Habilitar día
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Gestionar bloqueo del día (cuando el día seleccionado tiene bloques) */}
      <Dialog open={showGestionarBloqueModal} onOpenChange={(open) => { setShowGestionarBloqueModal(open); if (!open) { setBloqueEditando(null); setBloqueToDelete(null); } }}>
        <DialogContent className="max-w-[900px] max-h-[90vh] rounded-[20px] border border-[#E5E7EB] shadow-2xl p-0 flex flex-col overflow-hidden">
          <DialogHeader className="px-8 pt-8 pb-6 border-b border-[#E5E7EB] bg-gradient-to-b from-white to-[#F9FAFB] flex-shrink-0 mb-0">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] flex items-center justify-center shadow-lg shadow-[#2563eb]/20">
                <Lock className="h-6 w-6 text-white stroke-[2]" />
              </div>
              <div>
                <DialogTitle className="text-[28px] font-bold text-[#111827] font-['Poppins'] leading-tight mb-0">
                  Gestionar bloqueo del día
                </DialogTitle>
                <DialogDescription className="text-base text-[#6B7280] font-['Inter'] mt-1 mb-0">
                  Eliminar o modificar los horarios bloqueados para este día
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="px-8 py-6 space-y-5 overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <Label className="text-[15px] font-medium text-[#374151] font-['Inter'] flex items-center gap-2">
                  <Stethoscope className="h-4 w-4 text-[#6B7280] stroke-[2]" />
                  Profesional
                </Label>
                <div className="h-[52px] border-[1.5px] border-[#E5E7EB] rounded-[10px] bg-[#F9FAFB] px-4 flex items-center font-['Inter'] text-[16px] text-[#374151]">
                  {(() => {
                    const p = profesionales.find((pr) => pr.id === profesionalFilter);
                    return p ? `${p.nombre} ${p.apellido}${p.especialidad ? ` - ${p.especialidad}` : ''}` : '—';
                  })()}
                </div>
              </div>
              <div className="space-y-3">
                <Label className="text-[15px] font-medium text-[#374151] font-['Inter'] flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-[#6B7280] stroke-[2]" />
                  Fecha
                </Label>
                <div className="h-[52px] border-[1.5px] border-[#E5E7EB] rounded-[10px] bg-[#F9FAFB] px-4 flex items-center font-['Inter'] text-[16px] text-[#374151]">
                  {fechaFilter ? format(new Date(fechaFilter + 'T12:00:00'), "d 'de' MMMM, yyyy", { locale: es }) : '—'}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-[15px] font-medium text-[#374151] font-['Inter']">Bloques del día</Label>
              <div className="space-y-2">
                {bloquesDelDiaListado.map((bloque) => (
                  <div key={bloque.id} className="border border-[#E5E7EB] rounded-[12px] p-4 bg-red-50/50">
                    {bloqueEditando?.id === bloque.id ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-[14px] font-['Inter']">Hora inicio</Label>
                            <Input
                              type="time"
                              value={bloqueEditForm.hora_inicio}
                              onChange={(e) => setBloqueEditForm((f) => ({ ...f, hora_inicio: e.target.value }))}
                              className="h-[44px] border-[1.5px] border-[#D1D5DB] rounded-[10px] font-['Inter']"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[14px] font-['Inter']">Hora fin</Label>
                            <Input
                              type="time"
                              value={bloqueEditForm.hora_fin}
                              onChange={(e) => setBloqueEditForm((f) => ({ ...f, hora_fin: e.target.value }))}
                              className="h-[44px] border-[1.5px] border-[#D1D5DB] rounded-[10px] font-['Inter']"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[14px] font-['Inter']">Motivo (opcional)</Label>
                          <Input
                            type="text"
                            placeholder="Ej: Vacaciones, licencia"
                            value={bloqueEditForm.motivo}
                            onChange={(e) => setBloqueEditForm((f) => ({ ...f, motivo: e.target.value }))}
                            className="h-[44px] border-[1.5px] border-[#D1D5DB] rounded-[10px] font-['Inter']"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            onClick={() => {
                              if (!fechaFilter || !bloqueEditando) return;
                              if (bloqueEditForm.hora_inicio >= bloqueEditForm.hora_fin) {
                                reactToastify.error('La hora fin debe ser posterior a la hora inicio', { position: 'top-right', autoClose: 3000 });
                                return;
                              }
                              updateBloqueMutation.mutate({
                                id: bloqueEditando.id,
                                data: {
                                  fecha_hora_inicio: new Date(fechaFilter + 'T' + bloqueEditForm.hora_inicio + ':00').toISOString(),
                                  fecha_hora_fin: new Date(fechaFilter + 'T' + bloqueEditForm.hora_fin + ':00').toISOString(),
                                  motivo: bloqueEditForm.motivo.trim() || undefined,
                                },
                              });
                            }}
                            disabled={updateBloqueMutation.isPending}
                            className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-[10px] font-['Inter']"
                          >
                            {updateBloqueMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Guardar
                          </Button>
                          <Button type="button" variant="outline" onClick={() => { setBloqueEditando(null); }} className="rounded-[10px] font-['Inter']">
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-3">
                          <Lock className="h-5 w-5 text-red-600 stroke-[2]" />
                          <span className="font-['Inter'] text-[15px] text-red-700 font-medium">
                            {format(new Date(bloque.fecha_hora_inicio), 'HH:mm', { locale: es })} - {format(new Date(bloque.fecha_hora_fin), 'HH:mm', { locale: es })}
                            {bloque.motivo ? ` — ${bloque.motivo}` : ''}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setBloqueEditando(bloque);
                              setBloqueEditForm({
                                hora_inicio: format(new Date(bloque.fecha_hora_inicio), 'HH:mm'),
                                hora_fin: format(new Date(bloque.fecha_hora_fin), 'HH:mm'),
                                motivo: bloque.motivo || '',
                              });
                            }}
                            className="rounded-[10px] font-['Inter'] border-[#2563eb] text-[#2563eb] hover:bg-[#dbeafe]"
                          >
                            <Pencil className="h-4 w-4 mr-1" />
                            Editar
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setBloqueToDelete(bloque)}
                            className="rounded-[10px] font-['Inter'] border-red-300 text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Eliminar
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {bloqueToDelete && (
              <div className="border border-red-200 rounded-[12px] p-4 bg-red-50">
                <p className="text-[14px] font-['Inter'] text-red-800 mb-3">
                  ¿Eliminar el bloque {format(new Date(bloqueToDelete.fecha_hora_inicio), 'HH:mm')} - {format(new Date(bloqueToDelete.fecha_hora_fin), 'HH:mm')}?
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    onClick={() => {
                      deleteBloqueMutation.mutate(bloqueToDelete.id);
                    }}
                    disabled={deleteBloqueMutation.isPending}
                    className="bg-red-600 hover:bg-red-700 text-white rounded-[10px] font-['Inter']"
                  >
                    {deleteBloqueMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Eliminar bloqueo
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setBloqueToDelete(null)} className="rounded-[10px] font-['Inter']">
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="px-8 py-6 border-t border-[#E5E7EB] bg-[#F9FAFB] gap-3 flex-shrink-0">
            <Button
              variant="outline"
              onClick={() => { setShowGestionarBloqueModal(false); setBloqueEditando(null); setBloqueToDelete(null); }}
              className="rounded-[12px] font-['Inter'] px-5 py-2.5 h-auto"
            >
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Calendarios del modal Bloquear: renderizados en portal para que no se corten */}
      {bloqueDatePickerDesdeOpen && bloqueDesdeAnchor && createPortal(
        <div
          data-bloque-calendar-portal
          className="bg-white border border-[#E5E7EB] rounded-[16px] shadow-xl p-4 z-[9999] pointer-events-auto"
          style={{ position: 'fixed', top: bloqueDesdeAnchor.bottom + 8, left: bloqueDesdeAnchor.left, width: bloqueDesdeAnchor.width }}
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-[16px] font-semibold text-[#111827] font-['Poppins']">
              {format(bloqueDatePickerDesdeMonth, 'MMMM yyyy', { locale: es }).charAt(0).toUpperCase() + format(bloqueDatePickerDesdeMonth, 'MMMM yyyy', { locale: es }).slice(1)}
            </span>
            <div className="flex gap-1">
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-[8px] hover:bg-[#dbeafe] text-[#2563eb]" onClick={() => setBloqueDatePickerDesdeMonth((m) => subMonths(m, 1))}>
                <ChevronLeft className="h-4 w-4 stroke-[2]" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-[8px] hover:bg-[#dbeafe] text-[#2563eb]" onClick={() => setBloqueDatePickerDesdeMonth((m) => addMonths(m, 1))}>
                <ChevronRight className="h-4 w-4 stroke-[2]" />
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'].map((d) => (
              <span key={d} className="text-[11px] font-medium text-[#6B7280] font-['Inter'] py-1">{d}</span>
            ))}
            {(() => {
              const monthStart = bloqueDatePickerDesdeMonth;
              const monthEnd = endOfMonth(monthStart);
              const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
              const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
              const days = eachDayOfInterval({ start: calStart, end: calEnd });
              const today = startOfDay(new Date());
              const selectedDate = bloqueForm.fecha_inicio ? new Date(bloqueForm.fecha_inicio + 'T12:00:00') : null;
              const horaActualCal = format(new Date(), 'HH:mm');
              const hoyYaPasóHorario = horaFinHoyAgenda != null && horaActualCal >= horaFinHoyAgenda;
              return days.map((day) => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const isCurrentMonth = isSameMonth(day, bloqueDatePickerDesdeMonth);
                const isPast = isBefore(day, today);
                const isLaborable = getAgendaForDate(dateStr).length > 0;
                const isHoyYaLegó = isToday(day) && hoyYaPasóHorario;
                const isDisabled = isPast || !isLaborable || isHoyYaLegó;
                const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => {
                      if (isDisabled) return;
                      const newInicio = dateStr;
                      setBloqueForm((f) => {
                        const finActual = f.fecha_fin;
                        const newFin = !finActual || new Date(newInicio) > new Date(finActual) ? newInicio : finActual;
                        return { ...f, fecha_inicio: newInicio, fecha_fin: newFin };
                      });
                      setBloqueDatePickerDesdeMonth(startOfMonth(day));
                      setBloqueDatePickerDesdeOpen(false);
                      setBloqueDesdeAnchor(null);
                    }}
                    className={`h-9 rounded-[10px] text-[13px] font-medium font-['Inter'] transition-all
                      ${isSelected ? 'bg-[#2563eb] text-white hover:bg-[#1d4ed8]' : ''}
                      ${!isSelected && isDisabled ? 'text-[#9CA3AF] cursor-not-allowed opacity-50' : ''}
                      ${!isSelected && !isDisabled && !isCurrentMonth ? 'text-[#9CA3AF] hover:bg-[#F3F4F6] cursor-pointer' : ''}
                      ${!isSelected && !isDisabled && isCurrentMonth ? 'text-[#374151] hover:bg-[#dbeafe] cursor-pointer' : ''}`}
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
      {bloqueDatePickerHastaOpen && bloqueHastaAnchor && createPortal(
        <div
          data-bloque-calendar-portal
          className="bg-white border border-[#E5E7EB] rounded-[16px] shadow-xl p-4 z-[9999] pointer-events-auto"
          style={{ position: 'fixed', top: bloqueHastaAnchor.bottom + 8, left: bloqueHastaAnchor.left, width: bloqueHastaAnchor.width }}
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-[16px] font-semibold text-[#111827] font-['Poppins']">
              {format(bloqueDatePickerHastaMonth, 'MMMM yyyy', { locale: es }).charAt(0).toUpperCase() + format(bloqueDatePickerHastaMonth, 'MMMM yyyy', { locale: es }).slice(1)}
            </span>
            <div className="flex gap-1">
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-[8px] hover:bg-[#dbeafe] text-[#2563eb]" onClick={() => setBloqueDatePickerHastaMonth((m) => subMonths(m, 1))}>
                <ChevronLeft className="h-4 w-4 stroke-[2]" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-[8px] hover:bg-[#dbeafe] text-[#2563eb]" onClick={() => setBloqueDatePickerHastaMonth((m) => addMonths(m, 1))}>
                <ChevronRight className="h-4 w-4 stroke-[2]" />
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'].map((d) => (
              <span key={d} className="text-[11px] font-medium text-[#6B7280] font-['Inter'] py-1">{d}</span>
            ))}
            {(() => {
              const monthStart = bloqueDatePickerHastaMonth;
              const monthEnd = endOfMonth(monthStart);
              const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
              const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
              const days = eachDayOfInterval({ start: calStart, end: calEnd });
              const today = startOfDay(new Date());
              const selectedDate = bloqueForm.fecha_fin ? new Date(bloqueForm.fecha_fin + 'T12:00:00') : null;
              const fechaDesde = bloqueForm.fecha_inicio ? startOfDay(new Date(bloqueForm.fecha_inicio + 'T12:00:00')) : null;
              const horaActualCal = format(new Date(), 'HH:mm');
              const hoyYaPasóHorario = horaFinHoyAgenda != null && horaActualCal >= horaFinHoyAgenda;
              return days.map((day) => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const isCurrentMonth = isSameMonth(day, bloqueDatePickerHastaMonth);
                const isPast = isBefore(day, today);
                const isLaborable = getAgendaForDate(dateStr).length > 0;
                const isHoyYaLegó = isToday(day) && hoyYaPasóHorario;
                const beforeDesde = fechaDesde ? isBefore(day, fechaDesde) : false;
                const isDisabled = isPast || !isLaborable || isHoyYaLegó || beforeDesde;
                const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => {
                      if (isDisabled) return;
                      setBloqueForm((f) => ({ ...f, fecha_fin: dateStr }));
                      setBloqueDatePickerHastaMonth(startOfMonth(day));
                      setBloqueDatePickerHastaOpen(false);
                      setBloqueHastaAnchor(null);
                    }}
                    className={`h-9 rounded-[10px] text-[13px] font-medium font-['Inter'] transition-all
                      ${isSelected ? 'bg-[#2563eb] text-white hover:bg-[#1d4ed8]' : ''}
                      ${!isSelected && isDisabled ? 'text-[#9CA3AF] cursor-not-allowed opacity-50' : ''}
                      ${!isSelected && !isDisabled && !isCurrentMonth ? 'text-[#9CA3AF] hover:bg-[#F3F4F6] cursor-pointer' : ''}
                      ${!isSelected && !isDisabled && isCurrentMonth ? 'text-[#374151] hover:bg-[#dbeafe] cursor-pointer' : ''}`}
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

      {/* Modal Crear Turno */}
      <Dialog
        open={showCreateModal}
        onOpenChange={(open) => {
          setShowCreateModal(open);
          if (!open) {
            setCreateFormData({
              profesional_id: '',
              paciente_id: '',
              fecha_hora_inicio: '',
              fecha_hora_fin: '',
              estado: 'pendiente',
              motivo: '',
            });
            setCreateFecha(format(new Date(), 'yyyy-MM-dd'));
            setCreateHoraInicio('09:00');
            setCreateHoraFin('09:30');
            setCreateDatePickerOpen(false);
            setPacienteDniInput('');
            setPacienteFound(null);
            setShowQuickCreatePaciente(false);
            setQuickCreatePaciente({ dni: '', nombre: '', apellido: '', telefono: '' });
          }
        }}
      >
        <DialogContent className="max-w-[900px] max-h-[90vh] rounded-[20px] p-0 border border-[#E5E7EB] shadow-2xl flex flex-col overflow-hidden">
          <DialogHeader className="px-8 pt-8 pb-6 border-b border-[#E5E7EB] bg-gradient-to-b from-white to-[#F9FAFB] flex-shrink-0 mb-0">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] flex items-center justify-center shadow-lg shadow-[#2563eb]/20">
                <Plus className="h-6 w-6 text-white stroke-[2]" />
              </div>
              <div>
                <DialogTitle className="text-[28px] font-bold text-[#111827] font-['Poppins'] leading-tight mb-0">
                  Nuevo Turno
                </DialogTitle>
                <DialogDescription className="text-base text-[#6B7280] font-['Inter'] mt-1 mb-0">
                  Crear un nuevo turno médico
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto px-8 py-6 space-y-5">
            {!profesionalFilter ? (
              <p className="text-[#6B7280] font-['Inter'] text-[15px] bg-[#F9FAFB] border border-[#E5E7EB] rounded-[10px] px-4 py-3">
                Seleccione un profesional en el filtro de la página para crear turnos en su agenda.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <Label className="text-[15px] font-medium text-[#374151] font-['Inter'] flex items-center gap-2">
                      <Stethoscope className="h-4 w-4 text-[#6B7280] stroke-[2]" />
                      Profesional
                    </Label>
                    <div className="h-[52px] border-[1.5px] border-[#E5E7EB] rounded-[10px] bg-[#F9FAFB] px-4 flex items-center font-['Inter'] text-[16px] text-[#374151]">
                      {(() => {
                        const p = profesionales.find((pr) => pr.id === profesionalFilter);
                        return p ? `${p.nombre} ${p.apellido}${p.especialidad ? ` - ${p.especialidad}` : ''}` : '—';
                      })()}
                    </div>
                  </div>

                  <div className="space-y-3" ref={createDatePickerRef}>
                    <Label htmlFor="create-fecha" className="text-[15px] font-medium text-[#374151] font-['Inter'] flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-[#6B7280] stroke-[2]" />
                      Fecha
                    </Label>
                    <div className="relative">
                      <button
                        id="create-fecha"
                        type="button"
                        onClick={() => {
                          setCreateDatePickerOpen((o) => !o);
                          if (!createDatePickerOpen) setCreateDatePickerMonth(createFecha ? startOfMonth(new Date(createFecha + 'T12:00:00')) : startOfMonth(new Date()));
                        }}
                        className="h-[52px] w-full flex items-center gap-2 px-4 border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[16px] font-['Inter'] text-left bg-white focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200 hover:border-[#9CA3AF]"
                      >
                        <Calendar className="h-4 w-4 text-[#6B7280] stroke-[2] flex-shrink-0" />
                        <span className="text-[#374151]">
                          {createFecha ? format(new Date(createFecha + 'T12:00:00'), "d 'de' MMMM, yyyy", { locale: es }) : 'Seleccionar fecha'}
                        </span>
                        <ChevronRight className={`h-4 w-4 text-[#6B7280] ml-auto transition-transform ${createDatePickerOpen ? 'rotate-90' : ''}`} />
                      </button>
                      {createDatePickerOpen && (
                        <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-white border border-[#E5E7EB] rounded-[16px] shadow-lg p-4 w-full">
                          <div className="flex items-center justify-between mb-4">
                            <span className="text-[16px] font-semibold text-[#111827] font-['Poppins']">
                              {format(createDatePickerMonth, 'MMMM yyyy', { locale: es }).charAt(0).toUpperCase() + format(createDatePickerMonth, 'MMMM yyyy', { locale: es }).slice(1)}
                            </span>
                            <div className="flex gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-[8px] hover:bg-[#dbeafe] text-[#2563eb]"
                                onClick={() => setCreateDatePickerMonth((m) => subMonths(m, 1))}
                              >
                                <ChevronLeft className="h-4 w-4 stroke-[2]" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-[8px] hover:bg-[#dbeafe] text-[#2563eb]"
                                onClick={() => setCreateDatePickerMonth((m) => addMonths(m, 1))}
                              >
                                <ChevronRight className="h-4 w-4 stroke-[2]" />
                              </Button>
                            </div>
                          </div>
                          <div className="grid grid-cols-7 gap-1 text-center">
                            {['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'].map((d) => (
                              <span key={d} className="text-[11px] font-medium text-[#6B7280] font-['Inter'] py-1">
                                {d}
                              </span>
                            ))}
                            {(() => {
                              const monthStart = createDatePickerMonth;
                              const monthEnd = endOfMonth(createDatePickerMonth);
                              const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
                              const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
                              const days = eachDayOfInterval({ start: calStart, end: calEnd });
                              const today = startOfDay(new Date());
                              const selectedCreateDate = createFecha ? new Date(createFecha + 'T12:00:00') : null;
                              const horaActualCal = format(new Date(), 'HH:mm');
                              const hoyYaPasóHorario = horaFinHoyAgenda != null && horaActualCal >= horaFinHoyAgenda;
                              return days.map((day) => {
                                const isCurrentMonth = isSameMonth(day, createDatePickerMonth);
                                const isPast = isBefore(day, today);
                                const dateStrCreate = format(day, 'yyyy-MM-dd');
                                const isLaborable = getAgendaForDate(dateStrCreate).length > 0;
                                const isHoyYaLegó = isToday(day) && hoyYaPasóHorario;
                                const isDisabled = isPast || !isLaborable || isHoyYaLegó;
                                const isSelected = selectedCreateDate ? isSameDay(day, selectedCreateDate) : false;
                                return (
                                  <button
                                    key={day.toISOString()}
                                    type="button"
                                    disabled={isDisabled}
                                    onClick={() => {
                                      if (isDisabled) return;
                                      setCreateFecha(format(day, 'yyyy-MM-dd'));
                                      setCreateDatePickerMonth(startOfMonth(day));
                                      setCreateDatePickerOpen(false);
                                    }}
                                    className={`
                                      h-9 rounded-[10px] text-[13px] font-medium font-['Inter'] transition-all
                                      ${isSelected ? 'bg-[#2563eb] text-white hover:bg-[#1d4ed8]' : ''}
                                      ${!isSelected && isDisabled ? 'text-[#9CA3AF] cursor-not-allowed opacity-50' : ''}
                                      ${!isSelected && !isDisabled && !isCurrentMonth ? 'text-[#9CA3AF] hover:bg-[#F3F4F6] cursor-pointer' : ''}
                                      ${!isSelected && !isDisabled && isCurrentMonth ? 'text-[#374151] hover:bg-[#dbeafe] cursor-pointer' : ''}
                                    `}
                                  >
                                    {format(day, 'd')}
                                  </button>
                                );
                              });
                            })()}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <Label htmlFor="create-hora-inicio" className="text-[15px] font-medium text-[#374151] font-['Inter'] flex items-center gap-2">
                      <Clock className="h-4 w-4 text-[#6B7280] stroke-[2]" />
                      Hora inicio
                    </Label>
                    <Select
                      value={opcionesHoraInicioFiltradas.includes(createHoraInicio) ? createHoraInicio : (opcionesHoraInicioFiltradas[0] ?? createHoraInicio)}
                      onValueChange={(v) => setCreateHoraInicio(v)}
                    >
                      <SelectTrigger id="create-hora-inicio" className="h-[52px] border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[16px] font-['Inter'] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20">
                        <SelectValue placeholder="Hora inicio" />
                      </SelectTrigger>
                      <SelectContent>
                        {opcionesHoraInicioFiltradas.map((h) => (
                          <SelectItem
                            key={h}
                            value={h}
                            className={rangoHorarioCreate.min !== undefined ? 'bg-[#dbeafe]/40 data-[highlighted]:bg-[#bfdbfe]' : undefined}
                          >
                            {h}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {rangoHorarioCreate.min !== undefined ? (
                      <>
                        <p className="text-[13px] text-[#6B7280] font-['Inter']">
                          Duración: {minutosEntre(createHoraInicio, createHoraFin)} min
                        </p>
                        {diaCompletamenteBloqueadoCreate && (
                          <p className="text-[13px] text-red-600 font-['Inter'] font-medium flex items-center gap-1.5">
                            <Lock className="h-4 w-4 stroke-[2]" />
                            Este día está completamente bloqueado. Elija otra fecha.
                          </p>
                        )}
                        {!diaCompletamenteBloqueadoCreate && bloquesDelDiaCreate.length > 0 && (
                          <p className="text-[13px] text-red-600 font-['Inter'] font-medium flex items-center gap-1.5">
                            <Lock className="h-4 w-4 stroke-[2] flex-shrink-0" />
                            Este día tiene bloqueado de {bloquesDelDiaCreate.map((b) => `${format(new Date(b.fecha_hora_inicio), 'HH:mm')} a ${format(new Date(b.fecha_hora_fin), 'HH:mm')}`).join(' y ')}.
                          </p>
                        )}
                        {!diaCompletamenteBloqueadoCreate && esHoyCreate && opcionesHoraInicioFiltradas.length === 0 && (
                          <p className="text-[13px] text-[#92400E] font-['Inter']">
                            No hay más horarios disponibles hoy. Seleccione otra fecha.
                          </p>
                        )}
                      </>
                    ) : profesionalFilter && agendasDelProfesional.length > 0 ? (
                      <p className="text-[13px] text-[#92400E] font-['Inter']">
                        No hay horario configurado para este día.
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="create-hora-fin" className="text-[15px] font-medium text-[#374151] font-['Inter'] flex items-center gap-2">
                      <Clock className="h-4 w-4 text-[#6B7280] stroke-[2]" />
                      Hora fin
                    </Label>
                    <Select
                      value={opcionesHoraFinFiltradas.includes(createHoraFin) ? createHoraFin : (opcionesHoraFinFiltradas[0] ?? createHoraFin)}
                      onValueChange={(v) => setCreateHoraFin(v)}
                    >
                      <SelectTrigger id="create-hora-fin" className="h-[52px] border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[16px] font-['Inter'] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20">
                        <SelectValue placeholder="Hora fin" />
                      </SelectTrigger>
                      <SelectContent>
                        {opcionesHoraFinFiltradas.map((h) => (
                          <SelectItem
                            key={h}
                            value={h}
                            className={rangoHorarioCreate.min !== undefined ? 'bg-[#dbeafe]/40 data-[highlighted]:bg-[#bfdbfe]' : undefined}
                          >
                            {h}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="create-paciente-dni" className="text-[15px] font-medium text-[#374151] font-['Inter'] flex items-center gap-2">
                    <User className="h-4 w-4 text-[#6B7280] stroke-[2]" />
                    Paciente
                  </Label>
                  {createFormData.paciente_id && pacienteFound ? (
                    <div className="flex items-center gap-3 h-[52px] px-4 border-[1.5px] border-[#E5E7EB] rounded-[10px] bg-[#F9FAFB] font-['Inter'] text-[16px] text-[#374151]">
                      <span className="flex-1">
                        {pacienteFound.nombre} {pacienteFound.apellido} - DNI: {formatDni(pacienteFound.dni)}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setCreateFormData((prev) => ({ ...prev, paciente_id: '' }));
                          setPacienteFound(null);
                          setPacienteDniInput('');
                        }}
                        className="text-[#6B7280] hover:text-[#374151] p-0.5 rounded"
                        aria-label="Buscar otro paciente"
                      >
                        <X className="h-4 w-4 stroke-[2]" />
                      </button>
                    </div>
                  ) : (
                    <>
                      {showQuickCreatePaciente ? (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between gap-2 h-[52px] px-4 border-[1.5px] border-[#E5E7EB] rounded-[10px] bg-[#F9FAFB]">
                            <span className="font-['Inter'] text-[15px] text-[#374151]">
                              DNI <strong>{formatDni(quickCreatePaciente.dni)}</strong> — no registrado. Completá los datos para crear el paciente:
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setShowQuickCreatePaciente(false);
                                setQuickCreatePaciente((p) => ({ ...p, nombre: '', apellido: '', telefono: '' }));
                              }}
                              className="text-[#6B7280] hover:text-[#374151] shrink-0 font-['Inter']"
                            >
                              Buscar otro DNI
                            </Button>
                          </div>
                          <div className="p-4 border border-[#E5E7EB] rounded-[10px] bg-[#F9FAFB] space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1.5">
                                <Label className="text-[13px] font-['Inter']">Nombre</Label>
                                <Input
                                  value={quickCreatePaciente.nombre}
                                  onChange={(e) => setQuickCreatePaciente((p) => ({ ...p, nombre: e.target.value }))}
                                  placeholder="Nombre"
                                  className="h-10 font-['Inter'] text-[14px]"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-[13px] font-['Inter']">Apellido</Label>
                                <Input
                                  value={quickCreatePaciente.apellido}
                                  onChange={(e) => setQuickCreatePaciente((p) => ({ ...p, apellido: e.target.value }))}
                                  placeholder="Apellido"
                                  className="h-10 font-['Inter'] text-[14px]"
                                />
                              </div>
                              <div className="space-y-1.5 col-span-2">
                                <Label className="text-[13px] font-['Inter'] flex items-center gap-1">
                                  <Phone className="h-3.5 w-3.5" /> Teléfono
                                </Label>
                                <Input
                                  value={quickCreatePaciente.telefono}
                                  onChange={(e) => setQuickCreatePaciente((p) => ({ ...p, telefono: e.target.value }))}
                                  placeholder="Teléfono"
                                  className="h-10 font-['Inter'] text-[14px]"
                                />
                              </div>
                            </div>
                            <Button
                              type="button"
                              onClick={handleQuickCreatePaciente}
                              disabled={isCreatingPaciente || !quickCreatePaciente.nombre.trim() || !quickCreatePaciente.apellido.trim() || !quickCreatePaciente.telefono.trim()}
                              className="h-10 px-4 rounded-[10px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-['Inter'] text-[14px]"
                            >
                              {isCreatingPaciente ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                              Crear y usar este paciente
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6B7280] stroke-[2] pointer-events-none" />
                            <Input
                              id="create-paciente-dni"
                              type="text"
                              inputMode="numeric"
                              value={pacienteDniInput}
                              onChange={(e) => setPacienteDniInput(e.target.value.replace(/\D/g, '').slice(0, 8))}
                              onKeyDown={(e) => e.key === 'Enter' && handleBuscarPacientePorDni()}
                              placeholder="Ingrese DNI (7 u 8 dígitos)"
                              className="h-[52px] pl-10 border-[1.5px] border-[#D1D5DB] rounded-[10px] font-['Inter'] text-[16px] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20"
                            />
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleBuscarPacientePorDni}
                            disabled={!pacienteDniInput.trim() || pacienteDniInput.trim().length < 7 || isSearchingPaciente}
                            className="h-[52px] px-4 rounded-[10px] border-[#D1D5DB] font-['Inter'] shrink-0"
                          >
                            {isSearchingPaciente ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Buscar'}
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>

            <div className="space-y-3">
              <Label htmlFor="create-motivo" className="text-[15px] font-medium text-[#374151] font-['Inter'] flex items-center gap-2">
                <FileText className="h-4 w-4 text-[#6B7280] stroke-[2]" />
                Motivo
              </Label>
              <Input
                id="create-motivo"
                value={createFormData.motivo}
                onChange={(e) => setCreateFormData({ ...createFormData, motivo: e.target.value })}
                placeholder="Motivo de la consulta"
                className="h-[52px] border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[16px] font-['Inter'] placeholder:text-[#9CA3AF] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200"
              />
            </div>
              </>
            )}
          </div>

          <DialogFooter className="px-8 py-5 border-t border-[#E5E7EB] bg-[#F9FAFB] flex flex-row justify-end gap-3 flex-shrink-0 mt-0">
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowCreateModal(false)}
                className="h-[48px] px-6 rounded-[12px] border-[1.5px] border-[#D1D5DB] font-medium font-['Inter'] text-[15px] hover:bg-white hover:border-[#9CA3AF] transition-all duration-200"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleCreate}
                disabled={isSubmitting || !profesionalFilter || diaCompletamenteBloqueadoCreate}
                className="h-[48px] px-8 rounded-[12px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-lg shadow-[#2563eb]/30 hover:shadow-xl hover:shadow-[#2563eb]/40 hover:scale-[1.02] font-semibold font-['Inter'] text-[15px] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin stroke-[2.5]" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-5 w-5 stroke-[2]" />
                    Crear Turno
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Ver detalle (solo lectura, mismo layout que crear) */}
      <Dialog open={showDetailModal} onOpenChange={(open) => { setShowDetailModal(open); if (!open) setSelectedTurno(null); }}>
        <DialogContent className="max-w-[900px] max-h-[90vh] rounded-[20px] p-0 border border-[#E5E7EB] shadow-2xl flex flex-col overflow-hidden">
          <DialogHeader className="px-8 pt-8 pb-6 border-b border-[#E5E7EB] bg-gradient-to-b from-white to-[#F9FAFB] flex-shrink-0 mb-0">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] flex items-center justify-center shadow-lg shadow-[#2563eb]/20">
                <Eye className="h-6 w-6 text-white stroke-[2]" />
              </div>
              <div>
                <DialogTitle className="text-[28px] font-bold text-[#111827] font-['Poppins'] leading-tight mb-0">
                  Detalle del turno
                </DialogTitle>
                <DialogDescription className="text-base text-[#6B7280] font-['Inter'] mt-1 mb-0">
                  Información del turno (solo lectura)
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto px-8 py-6 space-y-5">
            {selectedTurno && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <Label className="text-[15px] font-medium text-[#374151] font-['Inter'] flex items-center gap-2">
                      <Stethoscope className="h-4 w-4 text-[#6B7280] stroke-[2]" />
                      Profesional
                    </Label>
                    <div className="h-[52px] border-[1.5px] border-[#E5E7EB] rounded-[10px] bg-[#F9FAFB] px-4 flex items-center font-['Inter'] text-[16px] text-[#374151]">
                      {(() => {
                        const p = profesionales.find((pr) => pr.id === selectedTurno.profesional_id);
                        return p ? `${p.nombre} ${p.apellido}${p.especialidad ? ` - ${p.especialidad}` : ''}` : (selectedTurno.profesional_nombre ? `${selectedTurno.profesional_nombre} ${selectedTurno.profesional_apellido || ''}` : '—');
                      })()}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Label className="text-[15px] font-medium text-[#374151] font-['Inter'] flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-[#6B7280] stroke-[2]" />
                      Fecha
                    </Label>
                    <div className="h-[52px] border-[1.5px] border-[#E5E7EB] rounded-[10px] bg-[#F9FAFB] px-4 flex items-center font-['Inter'] text-[16px] text-[#374151]">
                      {format(new Date(selectedTurno.fecha_hora_inicio), 'dd/MM/yyyy', { locale: es })}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <Label className="text-[15px] font-medium text-[#374151] font-['Inter'] flex items-center gap-2">
                      <Clock className="h-4 w-4 text-[#6B7280] stroke-[2]" />
                      Hora inicio
                    </Label>
                    <div className="h-[52px] border-[1.5px] border-[#E5E7EB] rounded-[10px] bg-[#F9FAFB] px-4 flex items-center font-['Inter'] text-[16px] text-[#374151]">
                      {format(new Date(selectedTurno.fecha_hora_inicio), 'HH:mm', { locale: es })}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Label className="text-[15px] font-medium text-[#374151] font-['Inter'] flex items-center gap-2">
                      <Clock className="h-4 w-4 text-[#6B7280] stroke-[2]" />
                      Hora fin
                    </Label>
                    <div className="h-[52px] border-[1.5px] border-[#E5E7EB] rounded-[10px] bg-[#F9FAFB] px-4 flex items-center font-['Inter'] text-[16px] text-[#374151]">
                      {format(new Date(selectedTurno.fecha_hora_fin), 'HH:mm', { locale: es })}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-[15px] font-medium text-[#374151] font-['Inter'] flex items-center gap-2">
                    <User className="h-4 w-4 text-[#6B7280] stroke-[2]" />
                    Paciente
                  </Label>
                  <div className="h-[52px] border-[1.5px] border-[#E5E7EB] rounded-[10px] bg-[#F9FAFB] px-4 flex items-center font-['Inter'] text-[16px] text-[#374151]">
                    {selectedTurno.paciente_nombre} {selectedTurno.paciente_apellido}
                    {selectedTurno.paciente_dni ? ` (${formatDni(selectedTurno.paciente_dni)})` : ''}
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-[15px] font-medium text-[#374151] font-['Inter'] flex items-center gap-2">
                    <FileText className="h-4 w-4 text-[#6B7280] stroke-[2]" />
                    Motivo
                  </Label>
                  <div className="min-h-[52px] border-[1.5px] border-[#E5E7EB] rounded-[10px] bg-[#F9FAFB] px-4 py-3 font-['Inter'] text-[16px] text-[#374151]">
                    {selectedTurno.motivo || '—'}
                  </div>
                </div>
              </>
            )}
          </div>

          <DialogFooter className="px-8 py-5 border-t border-[#E5E7EB] bg-[#F9FAFB] flex flex-row justify-end gap-3">
            {canCancel && selectedTurno && selectedTurno.estado !== 'cancelado' && selectedTurno.estado !== 'completado' && (
              <Button
                variant="outline"
                onClick={() => { setShowDetailModal(false); setCancelData({ razon_cancelacion: '' }); setShowCancelModal(true); }}
                className="h-[52px] px-6 rounded-[12px] border-[#EF4444] text-[#EF4444] hover:bg-[#FEE2E2] font-['Inter']"
              >
                <X className="h-4 w-4 mr-2 stroke-[2]" />
                Cancelar turno
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => { setShowDetailModal(false); setSelectedTurno(null); }}
              className="h-[52px] px-6 rounded-[12px] border-[#D1D5DB] font-['Inter']"
            >
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteModal
        open={showDeleteTurnoModal}
        onOpenChange={(open) => { setShowDeleteTurnoModal(open); if (!open) setTurnoToDelete(null); }}
        title="Eliminar Turno"
        description={<>¿Estás seguro de que deseas eliminar el turno de <span className="font-semibold text-[#374151]">{turnoToDelete?.paciente_nombre} {turnoToDelete?.paciente_apellido}</span>? Esta acción no se puede deshacer.</>}
        onConfirm={handleConfirmDeleteTurno}
        isLoading={deleteMutation.isPending}
      />

      {/* Modal Cancelar Turno */}
      <Dialog open={showCancelModal} onOpenChange={setShowCancelModal}>
        <DialogContent className="max-w-[600px] rounded-[20px] p-0 border border-[#E5E7EB] shadow-2xl">
          <DialogHeader className="px-8 pt-8 pb-6 border-b border-[#E5E7EB] bg-gradient-to-b from-white to-[#F9FAFB]">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-[#EF4444] to-[#DC2626] flex items-center justify-center shadow-lg shadow-[#EF4444]/20">
                <X className="h-6 w-6 text-white stroke-[2]" />
              </div>
              <div>
                <DialogTitle className="text-[28px] font-bold text-[#111827] font-['Poppins'] leading-tight mb-0">
                  Cancelar Turno
                </DialogTitle>
                <DialogDescription className="text-base text-[#6B7280] font-['Inter'] mt-1 mb-0">
                  ¿Está seguro de cancelar este turno? Esta acción no se puede deshacer.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="px-8 py-6 space-y-5">
            {selectedTurno && (
              <div className="p-4 bg-[#F9FAFB] rounded-[12px] border border-[#E5E7EB]">
                <p className="font-medium text-[#374151] font-['Inter'] text-[15px]">
                  {selectedTurno.paciente_nombre} {selectedTurno.paciente_apellido}
                </p>
                <p className="text-sm text-[#6B7280] font-['Inter'] mt-1">
                  {format(new Date(selectedTurno.fecha_hora_inicio), "dd 'de' MMMM 'de' yyyy 'a las' HH:mm", {
                    locale: es,
                  })}
                </p>
              </div>
            )}

            <div className="space-y-3">
              <Label htmlFor="razon-cancelacion" className="text-[15px] font-medium text-[#374151] font-['Inter']">
                Razón de Cancelación
                <span className="text-[#EF4444]">*</span>
              </Label>
              <Textarea
                id="razon-cancelacion"
                value={cancelData.razon_cancelacion}
                onChange={(e) => setCancelData({ razon_cancelacion: e.target.value })}
                placeholder="Ingrese la razón de la cancelación"
                rows={4}
                required
                className="border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[16px] font-['Inter'] placeholder:text-[#9CA3AF] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 resize-y transition-all duration-200"
              />
            </div>
          </div>

          <DialogFooter className="px-8 py-5 border-t border-[#E5E7EB] bg-[#F9FAFB] flex flex-row justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setShowCancelModal(false)}
              className="h-[48px] px-6 rounded-[12px] border-[1.5px] border-[#D1D5DB] font-medium font-['Inter'] text-[15px] hover:bg-white hover:border-[#9CA3AF] transition-all duration-200"
            >
              No Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelSubmit}
              disabled={isSubmitting}
              className="h-[48px] px-8 rounded-[12px] font-semibold font-['Inter'] text-[15px]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin stroke-[2.5]" />
                  Cancelando...
                </>
              ) : (
                <>
                  <X className="mr-2 h-5 w-5 stroke-[2]" />
                  Confirmar Cancelación
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}