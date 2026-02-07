import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  Calendar, CalendarPlus, User, Eye, X, Plus, 
  Loader2, Filter, Stethoscope, ChevronLeft, ChevronRight, Search, Phone, Mail, Trash2, Lock, LockOpen, AlertTriangle
} from 'lucide-react';
import { toast as reactToastify } from 'react-toastify';
import { turnosService, type CreateTurnoData, type CancelTurnoData, type UpdateTurnoData } from '@/services/turnos.service';
import { profesionalesService } from '@/services/profesionales.service';
import { pacientesService } from '@/services/pacientes.service';
import { agendaService, type CreateBloqueData, type CreateExcepcionAgendaData, type UpdateExcepcionAgendaData } from '@/services/agenda.service';
import { DatePicker } from '@/components/ui/date-picker';
import type { Turno, Paciente } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/utils/permissions';
import { formatDisplayText } from '@/lib/utils';
import { CreateAgendaModal, GestionarAgendaModal } from '@/pages/Agendas/modals';

const estadoOptions = [
  { value: 'activos', label: 'Todos (excepto cancelados)' },
  { value: 'todos', label: 'Todos los estados' },
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'confirmado', label: 'Confirmados' },
  { value: 'completado', label: 'Atendidos' },
  { value: 'cancelado', label: 'Cancelados' },
  { value: 'ausente', label: 'Ausentes' },
];

// Opciones para cambiar estado en la grilla (valor backend → etiqueta)
const estadoOpcionesGrilla = [
  { value: 'pendiente', label: 'Pendiente' },
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
  const base = "h-7 min-h-0 py-0 leading-tight w-auto max-w-[140px] min-w-0 rounded-full border shadow-none font-['Inter'] text-[12px] pl-2 pr-7 text-left focus:outline-none [&>svg]:!right-1.5 [&>svg]:!h-3 [&>svg]:!w-3";
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
  const base = 'rounded-full px-2.5 py-0.5 leading-tight text-[11px] font-medium inline-flex items-center ' + className;
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
          Pendiente
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
  const [estadoFilter, setEstadoFilter] = useState('activos');
  const [profesionalFilter, setProfesionalFilter] = useState('');
  const [fechaFilter, setFechaFilter] = useState<string>('');
  const [calendarViewMonth, setCalendarViewMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDeleteTurnoModal, setShowDeleteTurnoModal] = useState(false);
  const [turnoToDelete, setTurnoToDelete] = useState<Turno | null>(null);
  const [selectedTurno, setSelectedTurno] = useState<Turno | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showBloqueModal, setShowBloqueModal] = useState(false);
  const [abrioModalParaDesbloquear, setAbrioModalParaDesbloquear] = useState(false);
  const [showDesbloquearTodoConfirm, setShowDesbloquearTodoConfirm] = useState(false);
  const [isSubmittingBloque, setIsSubmittingBloque] = useState(false);
  const [bloqueForm, setBloqueForm] = useState<{
    profesional_id: string;
    fecha_inicio: string;
    fecha_fin: string;
    todo_el_dia: boolean;
    franjas: { hora_inicio: string; hora_fin: string }[];
    motivo: string;
  }>(() => {
    const hoy = new Date().toISOString().slice(0, 10);
    return {
      profesional_id: '',
      fecha_inicio: hoy,
      fecha_fin: hoy,
      todo_el_dia: false,
      franjas: [{ hora_inicio: '09:00', hora_fin: '12:00' }],
      motivo: '',
    };
  });
  const [bloqueDatePickerDesdeOpen, setBloqueDatePickerDesdeOpen] = useState(false);
  const [bloqueDatePickerHastaOpen, setBloqueDatePickerHastaOpen] = useState(false);
  const [bloqueDatePickerDesdeMonth, setBloqueDatePickerDesdeMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [bloqueDatePickerHastaMonth, setBloqueDatePickerHastaMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [_bloqueDesdeAnchor, setBloqueDesdeAnchor] = useState<{ bottom: number; left: number; width: number } | null>(null);
  const [_bloqueHastaAnchor, setBloqueHastaAnchor] = useState<{ bottom: number; left: number; width: number } | null>(null);
  const bloqueDesdeButtonRef = useRef<HTMLButtonElement>(null);
  const bloqueHastaButtonRef = useRef<HTMLButtonElement>(null);

  const [showDiaPuntualModal, setShowDiaPuntualModal] = useState(false);
  const [diaPuntualEditId, setDiaPuntualEditId] = useState<string | null>(null);
  const [showDeshabilitarDiaPuntualConfirm, setShowDeshabilitarDiaPuntualConfirm] = useState(false);
  const [diaPuntualDatePickerOpen, setDiaPuntualDatePickerOpen] = useState(false);
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
      setQuickCreatePaciente({ dni: '', nombre: '', apellido: '', telefono: '', email: '' });
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
  const [quickCreatePaciente, setQuickCreatePaciente] = useState({ dni: '', nombre: '', apellido: '', telefono: '', email: '' });
  const [isSearchingPaciente, setIsSearchingPaciente] = useState(false);
  const [isCreatingPaciente, setIsCreatingPaciente] = useState(false);

  // Form state para cancelar turno
  const [cancelData, setCancelData] = useState<CancelTurnoData>({
    razon_cancelacion: '',
  });
  const [showSinAgendaModal, setShowSinAgendaModal] = useState(false);
  const [showSobreturnoModal, setShowSobreturnoModal] = useState(false);
  const [pendingCreatePayload, setPendingCreatePayload] = useState<CreateTurnoData | null>(null);
  const [showCreateAgendaModalFromTurnos, setShowCreateAgendaModalFromTurnos] = useState(false);
  const [showGestionarAgendaModalFromTurnos, setShowGestionarAgendaModalFromTurnos] = useState(false);
  const handleGestionarAgendaClose = useCallback((open: boolean) => {
    if (!open) setShowGestionarAgendaModalFromTurnos(false);
  }, []);
  const navigate = useNavigate();

  // Fetch profesionales
  const { data: profesionales = [] } = useQuery({
    queryKey: ['profesionales', 'for-turnos'],
    queryFn: () => profesionalesService.getAll({ activo: true }),
  });

  const isProfesional = user?.rol === 'profesional';
  const profesionalLogueado = useMemo(
    () => profesionales.find((p: { usuario_id?: string }) => p.usuario_id === user?.id),
    [profesionales, user?.id]
  );

  const [searchParams] = useSearchParams();

  // Al entrar con ?profesional=id (ej. desde Agendas "Ir a la agenda"), preseleccionar ese profesional en Turnos
  useEffect(() => {
    const id = searchParams.get('profesional');
    if (id) setProfesionalFilter(id);
  }, [searchParams]);

  // Profesional: fijar filtro a su propio id y no permitir cambiar
  useEffect(() => {
    if (isProfesional && profesionalLogueado?.id) setProfesionalFilter(profesionalLogueado.id);
  }, [isProfesional, profesionalLogueado?.id]);

  // Al cambiar de profesional, quitar el día seleccionado para no mostrar turnos del día anterior
  useEffect(() => {
    setFechaFilter('');
  }, [profesionalFilter]);

  // Agenda del profesional (antes que cualquier hook que la use, para evitar "before initialization")
  const { data: agendasDelProfesional = [], isLoading: loadingAgendasDelProfesional } = useQuery({
    queryKey: ['agendas', profesionalFilter, 'conHistorico'],
    queryFn: () => agendaService.getAllAgenda({ profesional_id: profesionalFilter!, activo: true, vigente: false }),
    enabled: Boolean(profesionalFilter),
  });

  // Profesional sin agenda: mostrar modal "¿Querés crearla?"
  useEffect(() => {
    if (
      isProfesional &&
      profesionalFilter &&
      !loadingAgendasDelProfesional &&
      agendasDelProfesional.length === 0
    ) {
      setShowSinAgendaModal(true);
    }
  }, [isProfesional, profesionalFilter, loadingAgendasDelProfesional, agendasDelProfesional.length]);

  const sinAgendaDelProfesional = Boolean(profesionalFilter && !loadingAgendasDelProfesional && agendasDelProfesional.length === 0);

  // Fetch turnos con filtros
  const filters = useMemo(() => {
    const f: Record<string, string | undefined> = {};
    if (estadoFilter && estadoFilter !== 'todos' && estadoFilter !== 'activos') {
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
    enabled: Boolean(profesionalFilter) && Boolean(fechaFilter),
  });

  // Sin profesional seleccionado no se muestran turnos (aunque el backend pudiera devolverlos). Si estado = activos, excluir cancelados.
  const filteredTurnos = useMemo(() => {
    if (!profesionalFilter) return [];
    if (estadoFilter === 'activos') {
      return turnos.filter((t) => t.estado !== 'cancelado');
    }
    return turnos;
  }, [profesionalFilter, turnos, estadoFilter]);

  // Turnos del día seleccionado en el modal de crear (para mostrar Bloqueado/Ocupado y validar sobreturno)
  const filtersCreateDay = useMemo(() => {
    if (!createFecha || !createFormData.profesional_id) return null;
    const fechaInicio = new Date(createFecha + 'T00:00:00');
    const fechaFin = new Date(createFecha + 'T23:59:59.999');
    return {
      profesional_id: createFormData.profesional_id,
      fecha_inicio: fechaInicio.toISOString(),
      fecha_fin: fechaFin.toISOString(),
    };
  }, [createFecha, createFormData.profesional_id]);
  const { data: turnosDelDiaCreate = [] } = useQuery({
    queryKey: ['turnos', 'create-day', filtersCreateDay],
    queryFn: () => turnosService.getAll(filtersCreateDay!),
    enabled: Boolean(showCreateModal && filtersCreateDay),
  });

  // Todas las agendas (para saber qué profesionales tienen agenda y pueden ser elegidos en Turnos)
  const { data: todasLasAgendas = [] } = useQuery({
    queryKey: ['agendas', 'todos-profesionales'],
    queryFn: () => agendaService.getAllAgenda({ activo: true, vigente: false }),
  });
  const profesionalesConAgendaIds = useMemo(
    () => new Set(todasLasAgendas.map((a) => a.profesional_id)),
    [todasLasAgendas]
  );

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

  /** Bloques del día seleccionado en el modal de bloqueo (cuando es un solo día) para mostrar/eliminar */
  const bloquesDelDiaEnModal = useMemo(() => {
    if (!bloqueForm.fecha_inicio || bloqueForm.fecha_inicio !== bloqueForm.fecha_fin || !bloqueForm.profesional_id) return [];
    const dayStart = new Date(bloqueForm.fecha_inicio + 'T00:00:00').getTime();
    const dayEnd = new Date(bloqueForm.fecha_inicio + 'T23:59:59.999').getTime();
    return bloquesDelMes.filter((b) => {
      if (b.profesional_id !== bloqueForm.profesional_id) return false;
      const bStart = new Date(b.fecha_hora_inicio).getTime();
      const bEnd = new Date(b.fecha_hora_fin).getTime();
      return bStart < dayEnd && bEnd > dayStart;
    });
  }, [bloqueForm.fecha_inicio, bloqueForm.fecha_fin, bloqueForm.profesional_id, bloquesDelMes]);

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

  // Si el profesional tiene hoy habilitado y no hay día seleccionado, seleccionar hoy (solo cuando la agenda ya cargó)
  useEffect(() => {
    if (!profesionalFilter || loadingAgendasDelProfesional) return;
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    if (getAgendaForDate(todayStr).length > 0) {
      setFechaFilter((prev) => (prev === '' ? todayStr : prev));
    }
  }, [profesionalFilter, loadingAgendasDelProfesional, getAgendaForDate]);

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

  /** Motivo del bloqueo cuando el día listado está completamente bloqueado (para la pastilla) */
  const motivoBloqueoDiaListado = useMemo(() => {
    if (!diaCompletamenteBloqueadoListado || bloquesDelDiaListado.length === 0) return null;
    const b = bloquesDelDiaListado.find((block) => block.motivo?.trim());
    return b?.motivo?.trim() || null;
  }, [diaCompletamenteBloqueadoListado, bloquesDelDiaListado]);

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

  /** Si la fecha del turno es hoy (solo para mensajes; ya no filtramos horarios pasados para que se vea lo configurado). */
  const esHoyCreate = createFecha === format(new Date(), 'yyyy-MM-dd');
  const duracionCreate = rangoHorarioCreate.duracionMinutos ?? 30;
  /** Todas las opciones de hora inicio (siempre lo configurado en la agenda, sin ocultar horas pasadas). */
  const opcionesHoraInicioTodas = useMemo(() => {
    return opcionesHoraInicio;
  }, [opcionesHoraInicio]);
  /** Opciones de hora inicio con estado (Bloqueado/Ocupado) para mostrar en gris pero seleccionables */
  const opcionesHoraInicioConEstado = useMemo(() => {
    const activos = turnosDelDiaCreate.filter((t) => t.estado !== 'cancelado' && t.estado !== 'completado');
    return opcionesHoraInicioTodas.map((h) => {
      const slotStart = new Date(createFecha + 'T' + h + ':00');
      const slotEnd = new Date(createFecha + 'T' + sumarMinutos(h, duracionCreate) + ':00');
      const bloqueado = slotSolapaConBloque(slotStart, slotEnd, bloquesDelDiaCreate);
      const ocupado = activos.some((t) => {
        const tStart = new Date(t.fecha_hora_inicio).getTime();
        const tEnd = new Date(t.fecha_hora_fin).getTime();
        return slotStart.getTime() < tEnd && slotEnd.getTime() > tStart;
      });
      const label = bloqueado ? `${h} - Bloqueado` : ocupado ? `${h} - Ocupado` : h;
      return { value: h, label, bloqueado, ocupado };
    });
  }, [opcionesHoraInicioTodas, createFecha, duracionCreate, bloquesDelDiaCreate, turnosDelDiaCreate]);
  /** Todas las opciones de hora fin (siempre lo configurado en la agenda, sin ocultar horas pasadas). */
  const opcionesHoraFinTodas = useMemo(() => {
    return opcionesHoraFin;
  }, [opcionesHoraFin]);
  /** Opciones de hora fin con estado: Bloqueado = el intervalo [inicio, h] toca un bloque. Ocupado = la hora h cae dentro de un turno existente (solo esa hora, no todo el intervalo). */
  const opcionesHoraFinConEstado = useMemo(() => {
    const activos = turnosDelDiaCreate.filter((t) => t.estado !== 'cancelado' && t.estado !== 'completado');
    return opcionesHoraFinTodas
      .filter((h) => h > createHoraInicio)
      .map((h) => {
        const slotStart = new Date(createFecha + 'T' + createHoraInicio + ':00');
        const slotEnd = new Date(createFecha + 'T' + h + ':00');
        const bloqueado = slotSolapaConBloque(slotStart, slotEnd, bloquesDelDiaCreate);
        const hMs = new Date(createFecha + 'T' + h + ':00').getTime();
        const ocupado = activos.some((t) => {
          const tStart = new Date(t.fecha_hora_inicio).getTime();
          const tEnd = new Date(t.fecha_hora_fin).getTime();
          return hMs >= tStart && hMs <= tEnd;
        });
        const label = bloqueado ? `${h} - Bloqueado` : ocupado ? `${h} - Ocupado` : h;
        return { value: h, label, bloqueado, ocupado };
      });
  }, [opcionesHoraFinTodas, createHoraInicio, createFecha, bloquesDelDiaCreate, turnosDelDiaCreate]);

  /** Día sin horario configurado (no hay opciones) */
  const diaCompletamenteBloqueadoCreate = useMemo(() => {
    return opcionesHoraInicioTodas.length === 0;
  }, [opcionesHoraInicioTodas.length]);

  // Ajustar horas al cambiar fecha o rango: valor en la lista, no bloqueado, y fin > inicio
  useEffect(() => {
    const optInicio = opcionesHoraInicioConEstado.find((o) => o.value === createHoraInicio);
    const inicioValido = optInicio && !optInicio.bloqueado;
    const optFin = opcionesHoraFinConEstado.find((o) => o.value === createHoraFin);
    const finValido = optFin && !optFin.bloqueado && createHoraFin > createHoraInicio;
    if (!inicioValido && opcionesHoraInicioConEstado.length > 0) {
      const primerNoBloqueado = opcionesHoraInicioConEstado.find((o) => !o.bloqueado);
      if (primerNoBloqueado) setCreateHoraInicio(primerNoBloqueado.value);
    }
    if (!finValido && opcionesHoraFinConEstado.length > 0) {
      const primerNoBloqueado = opcionesHoraFinConEstado.find((o) => !o.bloqueado && o.value > createHoraInicio);
      if (primerNoBloqueado) setCreateHoraFin(primerNoBloqueado.value);
    }
  }, [createFecha, createHoraInicio, createHoraFin, opcionesHoraInicioConEstado, opcionesHoraFinConEstado]);


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
    if (showDiaPuntualModal && profesionalFilter && !diaPuntualEditId) {
      setDiaPuntualDatePickerOpen(false);
      setDiaPuntualForm((prev) => ({
        ...prev,
        profesional_id: profesionalFilter,
        fecha: fechaFilter || format(new Date(), 'yyyy-MM-dd'),
      }));
    }
  }, [showDiaPuntualModal, profesionalFilter, fechaFilter, diaPuntualEditId]);

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
      // No mostramos toast aquí: al desbloquear el día se eliminan varios bloques y se muestra un solo toast "Día desbloqueado correctamente"
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      reactToastify.error(err?.response?.data?.message || 'Error al eliminar bloque', {
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

  const deleteExcepcionMutation = useMutation({
    mutationFn: (id: string) => agendaService.deleteExcepcion(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['excepciones'] });
      queryClient.invalidateQueries({ queryKey: ['agendas'] });
      setShowDiaPuntualModal(false);
      setDiaPuntualEditId(null);
      reactToastify.success('Fecha especial eliminada correctamente', { position: 'top-right', autoClose: 3000 });
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      reactToastify.error(err?.response?.data?.message || 'Error al eliminar fecha especial', {
        position: 'top-right',
        autoClose: 3000,
      });
    },
  });

  const updateExcepcionMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateExcepcionAgendaData }) =>
      agendaService.updateExcepcion(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['excepciones'] });
      queryClient.invalidateQueries({ queryKey: ['agendas'] });
      setShowDiaPuntualModal(false);
      setDiaPuntualEditId(null);
      reactToastify.success('Día puntual actualizado correctamente', { position: 'top-right', autoClose: 3000 });
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      reactToastify.error(err?.response?.data?.message || 'Error al actualizar día puntual', {
        position: 'top-right',
        autoClose: 3000,
      });
    },
  });

  const excepcionDelDiaSeleccionado = useMemo(() => {
    if (!fechaFilter || !profesionalFilter) return null;
    return excepcionesDelRango.find((e) => e.fecha && e.fecha.slice(0, 10) === fechaFilter) ?? null;
  }, [excepcionesDelRango, fechaFilter, profesionalFilter]);

  const handleEliminarFechaEspecial = async () => {
    if (!excepcionDelDiaSeleccionado?.id) return;
    try {
      await deleteExcepcionMutation.mutateAsync(excepcionDelDiaSeleccionado.id);
    } catch {
      // toast ya en onError
    }
  };

  const handleOpenBloqueModal = () => {
    const diaInicial = fechaFilter || new Date().toISOString().slice(0, 10);
    const tieneBloques = bloquesDelDiaListado.length > 0;
    const esDiaCompletamenteBloqueado = diaCompletamenteBloqueadoListado && tieneBloques;
    const motivoPrellenado = tieneBloques
      ? (motivoBloqueoDiaListado || bloquesDelDiaListado.find((b) => b.motivo?.trim())?.motivo?.trim() || '')
      : '';
    const franjasPrellenadas =
      tieneBloques && !esDiaCompletamenteBloqueado
        ? bloquesDelDiaListado.map((b) => ({
            hora_inicio: format(new Date(b.fecha_hora_inicio), 'HH:mm'),
            hora_fin: format(new Date(b.fecha_hora_fin), 'HH:mm'),
          }))
        : [{ hora_inicio: '09:00', hora_fin: '12:00' }];
    setAbrioModalParaDesbloquear(tieneBloques);
    setBloqueForm({
      profesional_id: profesionalFilter || '',
      fecha_inicio: diaInicial,
      fecha_fin: diaInicial,
      todo_el_dia: esDiaCompletamenteBloqueado,
      franjas: franjasPrellenadas,
      motivo: motivoPrellenado,
    });
    setBloqueDatePickerDesdeMonth(startOfMonth(new Date(diaInicial + 'T12:00:00')));
    setBloqueDatePickerHastaMonth(startOfMonth(new Date(diaInicial + 'T12:00:00')));
    setShowBloqueModal(true);
  };

  const handleDesbloquearDia = async () => {
    if (bloquesDelDiaListado.length === 0) return;
    try {
      await Promise.all(bloquesDelDiaListado.map((b) => deleteBloqueMutation.mutateAsync(b.id)));
      reactToastify.success('Día desbloqueado correctamente', { position: 'top-right', autoClose: 3000 });
    } catch {
      reactToastify.error('Error al desbloquear el día', { position: 'top-right', autoClose: 3000 });
    }
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
    if (!bloqueForm.todo_el_dia) {
      const franjaInvalida = bloqueForm.franjas.find((f) => f.hora_inicio >= f.hora_fin);
      if (franjaInvalida) {
        reactToastify.error('En cada franja la hora fin debe ser posterior a la hora inicio', { position: 'top-right', autoClose: 3000 });
        return;
      }
      if (bloqueForm.franjas.length === 0 && !abrioModalParaDesbloquear) {
        reactToastify.error('Agregá al menos una franja horaria', { position: 'top-right', autoClose: 3000 });
        return;
      }
    }
    setIsSubmittingBloque(true);
    try {
      const { profesional_id, fecha_inicio, fecha_fin, todo_el_dia, franjas, motivo } = bloqueForm;
      const isUnDia = fecha_inicio === fecha_fin;

      if (abrioModalParaDesbloquear && bloquesDelDiaEnModal.length > 0) {
        const idsToDelete = bloquesDelDiaEnModal.map((b) => b.id);
        await Promise.all(idsToDelete.map((id) => deleteBloqueMutation.mutateAsync(id)));
        if (!todo_el_dia && franjas.length === 0) {
          reactToastify.success('Día desbloqueado correctamente', { position: 'top-right', autoClose: 3000 });
          setShowBloqueModal(false);
          setAbrioModalParaDesbloquear(false);
          return;
        }
      }

      if (isUnDia) {
        if (todo_el_dia) {
          const payload = buildBloquePayload(profesional_id, fecha_inicio, true, '00:00', '23:59');
          if (motivo.trim()) payload.motivo = motivo.trim();
          await createBloqueMutation.mutateAsync(payload);
          reactToastify.success(abrioModalParaDesbloquear ? 'Bloque actualizado correctamente' : 'Bloque creado correctamente', { position: 'top-right', autoClose: 3000 });
        } else {
          let creados = 0;
          for (const fr of franjas) {
            try {
              const payload = buildBloquePayload(profesional_id, fecha_inicio, false, fr.hora_inicio, fr.hora_fin);
              if (motivo.trim()) payload.motivo = motivo.trim();
              await createBloqueMutation.mutateAsync(payload);
              creados++;
            } catch {
              // puede fallar por solapamiento
            }
          }
          if (creados > 0) {
            reactToastify.success(creados === 1 ? (abrioModalParaDesbloquear ? '1 bloque actualizado' : '1 bloque creado') : (abrioModalParaDesbloquear ? `${creados} bloques actualizados` : `${creados} bloques creados`), { position: 'top-right', autoClose: 3000 });
          }
        }
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
            for (const fr of franjas) {
              try {
                const payload = buildBloquePayload(profesional_id, dateStr, false, fr.hora_inicio, fr.hora_fin);
                if (motivo.trim()) payload.motivo = motivo.trim();
                await createBloqueMutation.mutateAsync(payload);
                creados++;
              } catch {
                // puede fallar por solapamiento
              }
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
        // Si es profesional, vincular el paciente a su lista para no duplicar y que lo vea después
        if (isProfesional && profesionalFilter) {
          try {
            await pacientesService.addAsignacion(pac.id, profesionalFilter);
            queryClient.invalidateQueries({ queryKey: ['pacientes'] });
            reactToastify.success('Paciente vinculado a tu lista', { position: 'top-right', autoClose: 3000 });
          } catch {
            // Ya estaba asignado u otro error; no bloquear el flujo
          }
        }
      } else {
        setShowQuickCreatePaciente(true);
        setQuickCreatePaciente({ dni, nombre: '', apellido: '', telefono: '', email: '' });
      }
    } catch {
      reactToastify.error('Error al buscar paciente', { position: 'top-right', autoClose: 3000 });
    } finally {
      setIsSearchingPaciente(false);
    }
  };

  const handleQuickCreatePaciente = async () => {
    const { dni, nombre, apellido, telefono, email } = quickCreatePaciente;
    if (!dni.trim() || !nombre.trim() || !apellido.trim() || !telefono.trim() || !email.trim()) {
      reactToastify.error('Completá DNI, nombre, apellido, email y teléfono', { position: 'top-right', autoClose: 3000 });
      return;
    }
    setIsCreatingPaciente(true);
    try {
      const nuevo = await pacientesService.create({
        dni: dni.trim(),
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        telefono: telefono.trim(),
        email: email.trim(),
      });
      queryClient.invalidateQueries({ queryKey: ['pacientes'] });
      setCreateFormData((prev) => ({ ...prev, paciente_id: nuevo.id }));
      setPacienteFound(nuevo);
      setShowQuickCreatePaciente(false);
      setQuickCreatePaciente({ dni: '', nombre: '', apellido: '', telefono: '', email: '' });
      // Si es profesional, asignar el nuevo paciente a su lista para que lo vea
      if (isProfesional && profesionalFilter) {
        try {
          await pacientesService.addAsignacion(nuevo.id, profesionalFilter);
          queryClient.invalidateQueries({ queryKey: ['pacientes'] });
        } catch {
          // No bloquear; el paciente ya se creó
        }
      }
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

    const slotStart = inicioLocal.getTime();
    const slotEnd = finLocal.getTime();
    const turnosActivos = turnosDelDiaCreate.filter((t) => t.estado !== 'cancelado' && t.estado !== 'completado');
    const mismoPacienteEnSlot = turnosActivos.some((t) => {
      if (t.paciente_id !== createFormData.paciente_id) return false;
      const tStart = new Date(t.fecha_hora_inicio).getTime();
      const tEnd = new Date(t.fecha_hora_fin).getTime();
      return slotStart < tEnd && slotEnd > tStart;
    });
    if (mismoPacienteEnSlot) {
      reactToastify.error('Esta persona ya tiene un turno en ese horario. No puede tener dos turnos a la misma hora.', {
        position: 'top-right',
        autoClose: 4000,
      });
      return;
    }
    const otroPacienteEnSlot = turnosActivos.some((t) => {
      if (t.paciente_id === createFormData.paciente_id) return false;
      const tStart = new Date(t.fecha_hora_inicio).getTime();
      const tEnd = new Date(t.fecha_hora_fin).getTime();
      return slotStart < tEnd && slotEnd > tStart;
    });

    const payload = { ...createFormData, fecha_hora_inicio, fecha_hora_fin };
    if (otroPacienteEnSlot) {
      setPendingCreatePayload(payload);
      setShowSobreturnoModal(true);
      return;
    }

    setIsSubmitting(true);
    try {
      await createMutation.mutateAsync(payload);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmSobreturno = async () => {
    if (!pendingCreatePayload) return;
    setShowSobreturnoModal(false);
    setIsSubmitting(true);
    try {
      await createMutation.mutateAsync({ ...pendingCreatePayload, sobreturno: true });
      setPendingCreatePayload(null);
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
    label: `${formatDisplayText(prof.nombre)} ${formatDisplayText(prof.apellido)} ${prof.especialidad ? `- ${formatDisplayText(prof.especialidad)}` : ''}`,
    tieneAgenda: profesionalesConAgendaIds.has(prof.id),
  }));

  void Boolean(estadoFilter !== 'todos' || profesionalFilter);

  // Fecha seleccionada (para listado de turnos); null si no hay día seleccionado
  const selectedDate = useMemo<Date | null>(
    () => (fechaFilter ? new Date(fechaFilter + 'T12:00:00') : null),
    [fechaFilter]
  );
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
    <div className="flex flex-col gap-6 min-h-[calc(100vh-12rem)] justify-start">
      {/* Modal: profesional sin agenda — ¿Querés crearla? */}
      <Dialog open={showSinAgendaModal} onOpenChange={setShowSinAgendaModal}>
        <DialogContent
          className="max-w-[480px] rounded-[20px] border border-[#E5E7EB] shadow-2xl gap-2 max-lg:max-w-[92vw] max-lg:px-5"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader className="mb-0">
            <DialogTitle className="pr-14 mb-0 text-[22px] max-lg:text-[20px]">¿Querés crear tu agenda?</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1.5 mt-3 mb-0">
            <DialogDescription className="text-base max-lg:text-[14px] mb-0">
              Para poder ver y gestionar turnos necesitás definir tus horarios de atención. ¿Querés crearla ahora?
            </DialogDescription>
          </div>
          <DialogFooter className="mt-0 flex-row justify-end max-lg:flex-col max-lg:gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowSinAgendaModal(false)}
              className="rounded-[10px] border-[#D1D5DB] text-[#374151] hover:bg-[#F9FAFB] focus:outline-none focus:ring-0 max-lg:order-1 max-lg:w-full"
            >
              No
            </Button>
            <Button
              type="button"
              onClick={() => {
                setShowSinAgendaModal(false);
                setShowCreateAgendaModalFromTurnos(true);
              }}
              className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-[10px] px-5 max-lg:order-2 max-lg:w-full"
            >
              Sí, crear agenda
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: sobreturno — este horario ya tiene un turno */}
      <Dialog open={showSobreturnoModal} onOpenChange={(open) => { if (!open) { setShowSobreturnoModal(false); setPendingCreatePayload(null); } }}>
        <DialogContent
          className="max-w-[480px] rounded-[20px] border border-[#E5E7EB] shadow-2xl gap-2"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader className="mb-0">
            <DialogTitle className="pr-14 mb-0">Sobreturno</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1.5 mb-0">
            <DialogDescription>
              Este horario ya tiene un turno asignado a otro paciente. ¿Está seguro de querer sacar un sobreturno?
            </DialogDescription>
          </div>
          <DialogFooter className="mt-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => { setShowSobreturnoModal(false); setPendingCreatePayload(null); }}
              className="rounded-[10px] border-[#D1D5DB] text-[#374151] hover:bg-[#F9FAFB] focus:outline-none focus:ring-0"
            >
              No, cancelar
            </Button>
            <Button
              type="button"
              onClick={handleConfirmSobreturno}
              disabled={isSubmitting}
              className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-[10px] px-5"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2 inline" /> : null}
              Sí, crear sobreturno
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Header + Filtros: agrupados arriba con poco espacio entre sí */}
      <div className="flex flex-col gap-3 max-lg:gap-2">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[32px] font-bold text-[#111827] font-['Poppins'] leading-tight tracking-[-0.02em] mb-0">
              Gestión de Turnos
            </h1>
            {isProfesional && profesionalLogueado && (
              <span className="inline-flex items-center gap-1.5 mt-1">
                {agendasDelProfesional.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => setShowCreateAgendaModalFromTurnos(true)}
                    className="text-[15px] font-medium text-[#2563eb] hover:text-[#1d4ed8] hover:underline font-['Inter']"
                  >
                    Crear agenda
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowGestionarAgendaModalFromTurnos(true)}
                    className="text-[15px] font-medium text-[#2563eb] hover:text-[#1d4ed8] hover:underline font-['Inter']"
                  >
                    Gestionar agenda
                  </button>
                )}
              </span>
            )}
          </div>
          <p className="text-base text-[#6B7280] mt-2 font-['Inter']">
            {isLoading ? 'Cargando...' : `${filteredTurnos.length} ${filteredTurnos.length === 1 ? 'turno' : 'turnos'} del día seleccionado`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 max-lg:hidden">
          {profesionalFilter && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={bloquesDelDiaListado.length > 0 ? handleDesbloquearDia : handleOpenBloqueModal}
                disabled={sinAgendaDelProfesional || (bloquesDelDiaListado.length > 0 && deleteBloqueMutation.isPending)}
                className="border-[#6B7280] text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#374151] hover:border-[#6B7280] focus-visible:border-[#6B7280] rounded-[12px] px-4 py-2.5 h-11 font-medium font-['Inter'] disabled:opacity-50"
              >
                {bloquesDelDiaListado.length > 0 ? (
                  <>
                    {deleteBloqueMutation.isPending ? <Loader2 className="h-5 w-5 mr-2 animate-spin stroke-[2]" /> : <LockOpen className="h-5 w-5 mr-2 stroke-[2]" />}
                    Desbloquear
                  </>
                ) : (
                  <>
                    <Lock className="h-5 w-5 mr-2 stroke-[2]" />
                    Bloquear
                  </>
                )}
              </Button>
              {excepcionDelDiaSeleccionado ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const e = excepcionDelDiaSeleccionado;
                    setDiaPuntualEditId(e.id);
                    setDiaPuntualForm({
                      profesional_id: e.profesional_id,
                      fecha: e.fecha?.slice(0, 10) ?? format(new Date(), 'yyyy-MM-dd'),
                      hora_inicio: e.hora_inicio?.slice(0, 5) ?? '09:00',
                      hora_fin: e.hora_fin?.slice(0, 5) ?? '13:00',
                      duracion_turno_minutos: e.duracion_turno_minutos ?? 30,
                      observaciones: e.observaciones ?? '',
                    });
                    setShowDiaPuntualModal(true);
                  }}
                  disabled={sinAgendaDelProfesional}
                  className="border-emerald-600 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-700 rounded-[12px] px-4 py-2.5 h-11 font-medium font-['Inter'] disabled:opacity-50"
                >
                  <Calendar className="h-5 w-5 mr-2 stroke-[2]" />
                  Gestionar día
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setDiaPuntualEditId(null);
                    setDiaPuntualForm({
                      profesional_id: profesionalFilter || '',
                      fecha: fechaFilter || format(new Date(), 'yyyy-MM-dd'),
                      hora_inicio: '09:00',
                      hora_fin: '13:00',
                      duracion_turno_minutos: 30,
                      observaciones: '',
                    });
                    setShowDiaPuntualModal(true);
                  }}
                  disabled={sinAgendaDelProfesional}
                  className="border-emerald-600 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-700 rounded-[12px] px-4 py-2.5 h-11 font-medium font-['Inter'] disabled:opacity-50"
                >
                  <CalendarPlus className="h-5 w-5 mr-2 stroke-[2]" />
                  Habilitar
                </Button>
              )}
            </>
          )}
          {canCreate && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-block max-lg:hidden">
                    <Button
                      onClick={() => setShowCreateModal(true)}
                      disabled={!profesionalFilter || !fechaFilter || diaCompletamenteBloqueadoListado}
                      className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-md shadow-[#2563eb]/20 hover:shadow-lg hover:shadow-[#2563eb]/30 transition-all duration-200 rounded-[12px] px-5 py-2.5 h-11 font-medium font-['Inter'] disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed"
                    >
                      <Plus className="h-5 w-5 mr-2 stroke-[2]" />
                      Nuevo Turno
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent className="bg-[#111827] text-white text-xs font-['Inter'] rounded-[8px] px-3 py-2">
                  {!profesionalFilter
                    ? 'Seleccione un profesional para crear turnos'
                    : diaCompletamenteBloqueadoListado
                      ? 'El día está completamente bloqueado'
                      : 'Crear un nuevo turno'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>

      {/* Filtros: profesional y estado */}
      <Card className="border border-[#E5E7EB] rounded-[16px] shadow-sm max-lg:rounded-[12px]">
        <CardContent className="p-6 max-lg:p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-lg:gap-3">
            <div className="space-y-2 max-lg:space-y-1">
              <label className="text-[14px] max-lg:text-[12px] font-medium text-[#374151] font-['Inter'] flex items-center gap-2">
                <Stethoscope className="h-4 w-4 text-[#6B7280] stroke-[2] max-lg:hidden" />
                Profesional
              </label>
              {isProfesional ? (
                <div className="h-12 min-h-12 max-lg:h-10 max-lg:min-h-10 flex items-center px-3 border border-[#E5E7EB] rounded-[10px] max-lg:rounded-[6px] bg-[#F9FAFB] font-['Inter'] text-[15px] max-lg:text-[13px] text-[#374151]">
                  {profesionalLogueado ? `${formatDisplayText(profesionalLogueado.nombre)} ${formatDisplayText(profesionalLogueado.apellido)}` : 'Cargando...'}
                </div>
              ) : (
              <Select value={profesionalFilter || undefined} onValueChange={setProfesionalFilter}>
                <SelectTrigger className="h-12 min-h-12 max-lg:h-10 max-lg:min-h-10 border-[#D1D5DB] rounded-[10px] max-lg:rounded-[6px] font-['Inter'] text-[15px] max-lg:text-[13px] w-full focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 pl-3 max-lg:py-1.5 flex items-center">
                  <SelectValue placeholder="Seleccionar profesional" />
                </SelectTrigger>
                <SelectContent className="rounded-[12px]">
                  {profesionalOptions.map((opt) => (
                    <SelectItem
                      key={opt.value}
                      value={opt.value}
                      disabled={!opt.tieneAgenda}
                      className="font-['Inter'] text-[13px]"
                    >
                      <span className="truncate">{opt.label}</span>
                      {!opt.tieneAgenda && (
                        <span className="ml-1.5 text-[11px] text-[#6B7280] whitespace-nowrap">— Sin agenda</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              )}
            </div>
            <div className="space-y-2 max-lg:space-y-1">
              <label className="text-[14px] max-lg:text-[12px] font-medium text-[#374151] font-['Inter'] flex items-center gap-2">
                <Filter className="h-4 w-4 text-[#6B7280] stroke-[2] max-lg:hidden" />
                Estado
              </label>
              <Select value={estadoFilter} onValueChange={setEstadoFilter}>
                <SelectTrigger className="h-12 min-h-12 max-lg:h-10 max-lg:min-h-10 border-[#D1D5DB] rounded-[10px] max-lg:rounded-[6px] font-['Inter'] text-[15px] max-lg:text-[13px] w-full focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 pl-3 max-lg:py-1.5 flex items-center">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent className="rounded-[12px]">
                  {estadoOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="font-['Inter'] text-[13px]">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>
      </div>

      {/* Layout: Calendario izquierda | Turnos derecha */}
      <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
        {/* Calendario - lado izquierdo: solo alto del contenido (números) */}
        <Card className="border border-[#E5E7EB] rounded-[16px] shadow-sm w-full lg:w-[320px] flex-shrink-0 self-start mb-0">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[18px] font-semibold text-[#111827] font-['Poppins'] mb-0">
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
                const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
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
                      ${!isSelected && isDisabled && !isTodayDate ? 'text-[#9CA3AF] cursor-not-allowed opacity-50' : ''}
                      ${!isSelected && !isDisabled && !isCurrentMonth ? 'text-[#9CA3AF] hover:bg-[#F3F4F6]' : ''}
                      ${!isSelected && !isDisabled && isCurrentMonth && !isCompletamenteBloqueado && !isTodayDate ? 'text-[#374151] hover:bg-[#dbeafe]' : ''}
                      ${!isSelected && isTodayDate && !isDisabled ? 'bg-[#dbeafe] text-[#2563eb] font-semibold border-2 border-[#2563eb]' : ''}
                      ${!isSelected && isTodayDate && isDisabled ? 'bg-[#EFF6FF] text-[#2563eb]/80 font-semibold border-2 border-[#2563eb] cursor-not-allowed opacity-70' : ''}
                      ${!isSelected && !isDisabled && isCompletamenteBloqueado && !isTodayDate ? 'bg-gray-100 text-gray-600 font-medium ring-1 ring-gray-300' : ''}
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
          <CardContent className="p-0 flex-1 flex flex-col min-h-0 overflow-auto max-lg:pb-12">
            <div className="px-6 py-4 border-b border-[#E5E7EB] mb-4 max-lg:px-4 max-lg:py-3">
              {(() => {
                const excepcionDiaListado = profesionalFilter && fechaFilter ? excepcionesDelRango.find((e) => e.fecha && e.fecha.slice(0, 10) === fechaFilter) : null;
                const showBloqueadoIcon = profesionalFilter && (diaCompletamenteBloqueadoListado || bloquesDelDiaListado.length > 0);
                const showDiaPuntualIcon = profesionalFilter && excepcionDiaListado && !diaCompletamenteBloqueadoListado;
                return (
              <div className="flex flex-wrap items-center gap-2">
                {/* Parent: título + horario y chips en la misma línea */}
                <div className="flex items-center flex-nowrap gap-2 min-w-0 flex-1">
                  <h2 className="text-[18px] max-lg:text-[14px] font-semibold text-[#111827] font-['Poppins'] mb-0 leading-tight min-w-0">
                    {selectedDate
                      ? `Turnos del ${format(selectedDate, "d 'de' MMMM", { locale: es }).replace(/\s+(\w+)$/, (_, month) => ' ' + month.charAt(0).toUpperCase() + month.slice(1))}`
                      : 'Turnos'}
                    {selectedDate && profesionalFilter ? (
                      horarioDelDiaListado ? (
                        <span className="font-normal text-[#6B7280] text-[13px] max-lg:text-[12px]"> ({horarioDelDiaListado.min} - {horarioDelDiaListado.max})</span>
                      ) : (
                        <span className="font-normal text-[#9CA3AF] text-[13px] max-lg:text-[12px]"> (Sin horario para este día)</span>
                      )
                    ) : null}
                  </h2>
                  {/* Mobile/tablet: icono redondo o espaciador invisible para mantener el mismo espacio */}
                  {showBloqueadoIcon || showDiaPuntualIcon ? (
                    <span className={`lg:hidden shrink-0 w-8 h-8 rounded-full flex items-center justify-center border ${showBloqueadoIcon ? 'bg-[#E5E7EB] text-[#4B5563] border-[#D1D5DB]' : 'bg-[#D1FAE5] text-[#065F46] border-[#6EE7B7]'}`}>
                      {showBloqueadoIcon ? <Lock className="h-4 w-4 stroke-[2]" /> : <CalendarPlus className="h-4 w-4 stroke-[2]" />}
                    </span>
                  ) : profesionalFilter ? (
                    <span className="lg:hidden shrink-0 w-8 h-8 rounded-full invisible" aria-hidden="true" />
                  ) : null}
                </div>
                {/* Desktop: badges o espaciador invisible para mantener el mismo espacio */}
                {profesionalFilter && diaCompletamenteBloqueadoListado && (
                  <Badge
                    variant="secondary"
                    className="max-lg:hidden shrink-0 rounded-full px-3 py-1.5 text-[13px] font-medium bg-[#E5E7EB] text-[#4B5563] border border-[#D1D5DB] hover:bg-[#E5E7EB] ml-1"
                  >
                    <Lock className="h-3.5 w-3.5 mr-1.5 stroke-[2] inline-block" />
                    {motivoBloqueoDiaListado ? `Bloqueado - ${motivoBloqueoDiaListado}` : 'Bloqueado'}
                  </Badge>
                )}
                {profesionalFilter && bloquesDelDiaListado.length > 0 && !diaCompletamenteBloqueadoListado && (
                  <Badge
                    variant="secondary"
                    className="max-lg:hidden shrink-0 rounded-full px-3 py-1.5 text-[13px] font-medium bg-[#E5E7EB] text-[#4B5563] border border-[#D1D5DB] hover:bg-[#E5E7EB] ml-1"
                  >
                    <Lock className="h-3.5 w-3.5 mr-1.5 stroke-[2] inline-block" />
                    {(() => {
                      const horariosStr = bloquesDelDiaListado.map((b) => `${format(new Date(b.fecha_hora_inicio), 'HH:mm')} - ${format(new Date(b.fecha_hora_fin), 'HH:mm')}`).join(', ');
                      const motivoPrimero = bloquesDelDiaListado.find((b) => b.motivo?.trim())?.motivo?.trim();
                      return motivoPrimero ? `Bloqueado - ${motivoPrimero} (${horariosStr})` : `Bloqueado (${horariosStr})`;
                    })()}
                  </Badge>
                )}
                {profesionalFilter && fechaFilter && excepcionDiaListado ? (
                  <Badge
                    variant="secondary"
                    className="max-lg:hidden shrink-0 rounded-full px-3 py-1.5 text-[13px] font-medium bg-[#D1FAE5] text-[#065F46] border border-[#6EE7B7] hover:bg-[#D1FAE5] ml-1"
                  >
                    {excepcionDiaListado.observaciones?.trim() ? `Día puntual - ${excepcionDiaListado.observaciones.trim()}` : 'Día puntual'}
                  </Badge>
                ) : null}
                {/* Espaciador invisible en desktop cuando no hay ningún badge */}
                {profesionalFilter && !diaCompletamenteBloqueadoListado && bloquesDelDiaListado.length === 0 && !(fechaFilter && excepcionDiaListado) && (
                  <span className="max-lg:hidden shrink-0 w-20 h-8 invisible" aria-hidden="true" />
                )}
              </div>
                );
              })()}
              {/* En mobile: Habilitar y Bloquear siempre cuando hay agenda; Deshabilitar día solo con día seleccionado */}
              {profesionalFilter && !sinAgendaDelProfesional && (
                <div className="max-lg:flex max-lg:flex-wrap max-lg:gap-x-4 max-lg:gap-y-1 lg:hidden">
                  <button
                    type="button"
                    onClick={bloquesDelDiaListado.length > 0 ? handleDesbloquearDia : handleOpenBloqueModal}
                    disabled={bloquesDelDiaListado.length > 0 && deleteBloqueMutation.isPending}
                    className="text-[13px] font-medium font-['Inter'] text-[#6B7280] hover:text-[#374151] hover:underline disabled:opacity-50 disabled:no-underline"
                  >
                    {bloquesDelDiaListado.length > 0 ? (deleteBloqueMutation.isPending ? 'Desbloqueando...' : 'Desbloquear') : 'Bloquear'}
                  </button>
                  {fechaFilter && excepcionDelDiaSeleccionado ? (
                    <button
                      type="button"
                      onClick={() => {
                        const e = excepcionDelDiaSeleccionado;
                        setDiaPuntualEditId(e.id);
                        setDiaPuntualForm({
                          profesional_id: e.profesional_id,
                          fecha: e.fecha?.slice(0, 10) ?? format(new Date(), 'yyyy-MM-dd'),
                          hora_inicio: e.hora_inicio?.slice(0, 5) ?? '09:00',
                          hora_fin: e.hora_fin?.slice(0, 5) ?? '13:00',
                          duracion_turno_minutos: e.duracion_turno_minutos ?? 30,
                          observaciones: e.observaciones ?? '',
                        });
                        setShowDiaPuntualModal(true);
                      }}
                      className="text-[13px] font-medium font-['Inter'] text-emerald-600 hover:text-emerald-700 hover:underline"
                    >
                      Gestionar día
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setDiaPuntualEditId(null);
                        setDiaPuntualForm({
                          profesional_id: profesionalFilter || '',
                          fecha: fechaFilter || format(new Date(), 'yyyy-MM-dd'),
                          hora_inicio: '09:00',
                          hora_fin: '13:00',
                          duracion_turno_minutos: 30,
                          observaciones: '',
                        });
                        setShowDiaPuntualModal(true);
                      }}
                      className="text-[13px] font-medium font-['Inter'] text-emerald-600 hover:text-emerald-700 hover:underline"
                    >
                      Habilitar
                    </button>
                  )}
                </div>
              )}
            </div>
            {isLoading ? (
              <div className="p-16 text-center">
                <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-[#2563eb]" />
                <p className="text-[#6B7280] font-['Inter'] text-base">Cargando turnos...</p>
              </div>
            ) : !profesionalFilter ? (
              <div className="p-16 text-center max-lg:p-8">
                <h3 className="text-lg max-lg:text-[15px] font-semibold mb-0 text-[#374151] font-['Inter']">
                  Seleccione un profesional
                </h3>
              </div>
            ) : sinAgendaDelProfesional ? (
              <div className="p-16 text-center max-lg:p-8">
                <h3 className="text-lg max-lg:text-[15px] font-semibold mb-4 text-[#374151] font-['Inter']">
                  Tiene que crear su agenda
                </h3>
                <Button
                  type="button"
                  onClick={() => setShowCreateAgendaModalFromTurnos(true)}
                  className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-[10px] px-5 py-2.5 font-medium font-['Inter']"
                >
                  Crear agenda
                </Button>
              </div>
            ) : !fechaFilter ? (
              <div className="p-16 text-center">
                <div className="h-20 w-20 rounded-full bg-[#dbeafe] flex items-center justify-center mx-auto mb-4">
                  <Calendar className="h-10 w-10 text-[#2563eb] stroke-[2]" />
                </div>
                <h3 className="text-lg font-semibold mb-2 text-[#374151] font-['Inter']">
                  Seleccione un día
                </h3>
                <p className="text-[#6B7280] font-['Inter'] text-[15px] max-w-[320px] mx-auto">
                  Elija un día en el calendario para ver los turnos de ese día.
                </p>
              </div>
            ) : filteredTurnos.length === 0 ? (
              <div className="p-16 text-center">
                <h3 className="text-lg max-lg:text-[15px] font-semibold mb-0 text-[#374151] font-['Inter']">
                  No hay turnos este día
                </h3>
              </div>
            ) : (
              <div className="max-lg:overflow-x-auto">
              <Table className="table-fixed w-full min-w-[640px]">
                <TableHeader>
                  <TableRow className="bg-[#F9FAFB] border-b-2 border-[#E5E7EB] hover:bg-[#F9FAFB]">
                    <TableHead className="font-['Inter'] font-medium text-[13px] max-lg:text-[12px] text-[#374151] py-3 max-lg:py-2 w-[20%] min-w-[130px] whitespace-nowrap">
                      Horario
                    </TableHead>
                    <TableHead className="font-['Inter'] font-medium text-[13px] max-lg:text-[12px] text-[#374151] py-3 max-lg:py-2 w-[38%] min-w-[200px]">
                      Paciente
                    </TableHead>
                    <TableHead className="font-['Inter'] font-medium text-[13px] max-lg:text-[12px] text-[#374151] py-3 max-lg:py-2 w-[22%] min-w-[135px]">
                      Estado
                    </TableHead>
                    <TableHead className="font-['Inter'] font-medium text-[13px] max-lg:text-[12px] text-[#374151] py-3 max-lg:py-2 w-[20%] min-w-[130px] text-center">
                      Acciones
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTurnos.map((turno) => (
                    <TableRow
                      key={turno.id}
                      className="border-b border-[#E5E7EB] hover:bg-[#F9FAFB] transition-colors duration-150"
                    >
                      <TableCell className="py-3 font-['Inter'] text-[14px] text-[#374151] whitespace-nowrap w-[20%] min-w-[130px]">
                        <span className="font-medium">
                          {format(new Date(turno.fecha_hora_inicio), 'HH:mm', { locale: es })} - {format(new Date(turno.fecha_hora_fin), 'HH:mm', { locale: es })}
                        </span>
                      </TableCell>
                      <TableCell className="py-3 w-[38%] min-w-[200px]">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-[#374151] font-['Inter'] text-[14px] truncate block">
                            {formatDisplayText(turno.paciente_nombre)} {formatDisplayText(turno.paciente_apellido)}
                            {turno.paciente_dni ? ` (${formatDni(turno.paciente_dni)})` : ''}
                          </span>
                          {turno.sobreturno && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="shrink-0 inline-flex text-[#DC2626] cursor-help" aria-label="Sobreturno">
                                    <AlertTriangle className="h-4 w-4 stroke-[2]" />
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent className="bg-[#111827] text-white text-xs font-['Inter'] rounded-[8px] px-3 py-2">
                                  Sobreturno
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-3 w-[22%] min-w-[135px]">
                        {canUpdate ? (
                          <Select
                            value={turno.estado}
                            onValueChange={(value) => handleUpdateEstado(turno.id, value)}
                            disabled={updateMutation.isPending && (updateMutation.variables as { id: string } | undefined)?.id === turno.id}
                          >
                            <SelectTrigger className={getEstadoSelectTriggerClass(turno.estado)}>
                              <SelectValue>
                                <span className="font-medium truncate block">{getEstadoLabel(turno.estado)}</span>
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent className="rounded-[12px] border-[#E5E7EB]" align="start">
                              {estadoOpcionesGrilla.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value} hideIndicator className="font-['Inter'] text-[14px] rounded-[8px]">
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          getEstadoBadge(turno.estado)
                        )}
                      </TableCell>
                      <TableCell className="py-3 w-[20%] min-w-[130px] text-center">
                        <div className="flex items-center justify-center gap-2">
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
                                  className="h-9 w-9 rounded-[8px] hover:bg-[#F3F4F6] text-[#6B7280] hover:text-[#374151]"
                                >
                                  <Eye className="h-5 w-5 stroke-[2]" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent className="bg-[#111827] text-white text-xs rounded-[8px]">
                                Ver detalle
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => navigate(`/pacientes/${turno.paciente_id}`)}
                                  className="h-9 w-9 rounded-[8px] hover:bg-[#F3F4F6] text-[#6B7280] hover:text-[#374151]"
                                >
                                  <User className="h-5 w-5 stroke-[2]" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent className="bg-[#111827] text-white text-xs rounded-[8px]">
                                Ver ficha
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
                                    className="h-9 w-9 rounded-[8px] text-[#EF4444] hover:bg-[#FEE2E2] hover:text-[#DC2626]"
                                  >
                                    <Trash2 className="h-5 w-5 stroke-[2]" />
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
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Botón flotante Nuevo turno (solo mobile/tablet; en desktop se usa el botón del header) */}
      {canCreate && (
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={() => setShowCreateModal(true)}
                disabled={!profesionalFilter || !fechaFilter || diaCompletamenteBloqueadoListado}
                aria-label="Nuevo turno"
                className="lg:hidden fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-lg shadow-[#2563eb]/40 hover:shadow-xl hover:scale-105 transition-all duration-200 p-0 disabled:opacity-50 disabled:pointer-events-none disabled:hover:scale-100"
              >
                <Plus className="h-6 w-6 stroke-[2]" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left" className="font-['Inter']">
              <p>
                {!profesionalFilter
                  ? 'Seleccione un profesional para crear turnos'
                  : diaCompletamenteBloqueadoListado
                    ? 'El día está bloqueado'
                    : 'Nuevo turno'}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {/* Modal Bloquear agenda / horario */}
      <Dialog open={showBloqueModal} onOpenChange={(open) => { setShowBloqueModal(open); if (!open) setAbrioModalParaDesbloquear(false); }}>
        <DialogContent
          className="max-w-[900px] w-[95vw] max-lg:max-h-[85vh] max-lg:h-[85vh] max-h-[90vh] rounded-[20px] border border-[#E5E7EB] shadow-2xl p-0 flex flex-col overflow-hidden"
        >
          <DialogHeader className="relative z-[60] px-8 max-lg:px-4 pt-8 max-lg:pt-4 pb-6 max-lg:pb-4 border-b border-[#E5E7EB] bg-white flex-shrink-0 mb-0">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] flex items-center justify-center shadow-lg shadow-[#2563eb]/20 max-lg:hidden">
                <Lock className="h-6 w-6 text-white stroke-[2]" />
              </div>
              <div>
                <DialogTitle className="text-[28px] max-lg:text-[22px] font-bold text-[#111827] font-['Poppins'] leading-tight mb-0">
                  Bloquear agenda
                </DialogTitle>
                <DialogDescription className="text-base text-[#6B7280] font-['Inter'] mt-1 mb-0">
                  Marca períodos en los que no se podrán asignar turnos.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div
            className="px-8 max-lg:px-4 py-6 max-lg:py-4 space-y-5 overflow-y-auto flex-1 min-h-0"
          >
            <div className="space-y-3">
              <Label className="text-[15px] font-medium text-[#374151] font-['Inter']">
                Profesional
              </Label>
              <div className="h-[52px] max-lg:h-10 border-[1.5px] border-[#E5E7EB] rounded-[10px] bg-[#F9FAFB] px-4 flex items-center font-['Inter'] text-[16px] max-lg:text-[14px] text-[#374151]">
                {(() => {
                  const p = profesionales.find((pr) => pr.id === profesionalFilter);
                  return p ? `${formatDisplayText(p.nombre)} ${formatDisplayText(p.apellido)}${p.especialidad ? ` - ${formatDisplayText(p.especialidad)}` : ''}` : '—';
                })()}
              </div>
            </div>
            <div className="grid grid-cols-2 max-lg:grid-cols-1 gap-4 max-lg:gap-3">
              <div className="space-y-3">
                <Label className="text-[15px] font-medium text-[#374151] font-['Inter']">
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
                        setBloqueDatePickerDesdeMonth(bloqueForm.fecha_inicio ? startOfMonth(new Date(bloqueForm.fecha_inicio + 'T12:00:00')) : startOfMonth(new Date()));
                      }
                      setBloqueDatePickerDesdeOpen(willOpen);
                    }}
                    className="h-[52px] max-lg:h-10 w-full flex items-center gap-2 px-4 border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[16px] max-lg:text-[14px] font-['Inter'] text-left bg-white focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200 hover:border-[#9CA3AF]"
                  >
                    <Calendar className="h-4 w-4 text-[#6B7280] stroke-[2] flex-shrink-0" />
                    <span className="text-[#374151]">
                      {bloqueForm.fecha_inicio ? format(new Date(bloqueForm.fecha_inicio + 'T12:00:00'), "d 'de' MMMM, yyyy", { locale: es }) : 'Seleccionar fecha'}
                    </span>
                    <ChevronRight className={`h-4 w-4 text-[#6B7280] ml-auto transition-transform ${bloqueDatePickerDesdeOpen ? 'rotate-90' : ''}`} />
                  </button>
                  {bloqueDatePickerDesdeOpen && (
                    <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-white border border-[#E5E7EB] rounded-[16px] shadow-lg p-4 w-full">
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
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-3">
                <Label className="text-[15px] font-medium text-[#374151] font-['Inter']">
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
                        setBloqueDatePickerHastaMonth(bloqueForm.fecha_fin ? startOfMonth(new Date(bloqueForm.fecha_fin + 'T12:00:00')) : startOfMonth(new Date()));
                      }
                      setBloqueDatePickerHastaOpen(willOpen);
                    }}
                    className="h-[52px] max-lg:h-10 w-full flex items-center gap-2 px-4 border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[16px] max-lg:text-[14px] font-['Inter'] text-left bg-white focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200 hover:border-[#9CA3AF]"
                  >
                    <Calendar className="h-4 w-4 text-[#6B7280] stroke-[2] flex-shrink-0" />
                    <span className="text-[#374151]">
                      {bloqueForm.fecha_fin ? format(new Date(bloqueForm.fecha_fin + 'T12:00:00'), "d 'de' MMMM, yyyy", { locale: es }) : 'Seleccionar fecha'}
                    </span>
                    <ChevronRight className={`h-4 w-4 text-[#6B7280] ml-auto transition-transform ${bloqueDatePickerHastaOpen ? 'rotate-90' : ''}`} />
                  </button>
                  {bloqueDatePickerHastaOpen && (
                    <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-white border border-[#E5E7EB] rounded-[16px] shadow-lg p-4 w-full">
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
                    </div>
                  )}
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
              <Label htmlFor="todo_el_dia_bloque" className="text-[15px] max-lg:text-[14px] font-['Inter'] text-[#374151] cursor-pointer mb-0">
                Todo el día (o todos los días completos)
              </Label>
            </div>
            {!bloqueForm.todo_el_dia && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-[15px] max-lg:text-[14px] font-medium text-[#374151] font-['Inter']">Franjas horarias</Label>
                <button
                  type="button"
                  onClick={() => setBloqueForm((f) => ({ ...f, franjas: [...f.franjas, { hora_inicio: '14:00', hora_fin: '17:00' }] }))}
                  className="rounded-[10px] font-['Inter'] text-[14px] max-lg:text-[13px] border border-[#2563eb] text-[#2563eb] hover:bg-[#dbeafe] px-3 py-1.5 lg:px-3 lg:py-1.5 max-lg:border-0 max-lg:bg-transparent max-lg:px-0 max-lg:py-0 max-lg:text-[#2563eb] max-lg:hover:underline max-lg:hover:bg-transparent"
                >
                  <Plus className="h-4 w-4 mr-1 inline-block max-lg:hidden" />
                  Agregar franja
                </button>
              </div>
              <div className="space-y-2">
                {bloqueForm.franjas.map((fr, idx) => (
                  <div key={idx} className="flex items-center gap-2 flex-wrap">
                    <Input
                      type="time"
                      value={fr.hora_inicio}
                      onChange={(e) => setBloqueForm((f) => ({
                        ...f,
                        franjas: f.franjas.map((x, i) => i === idx ? { ...x, hora_inicio: e.target.value } : x),
                      }))}
                      className="h-[44px] max-lg:h-10 flex-1 min-w-[100px] max-w-[160px] max-lg:min-w-0 max-lg:max-w-none max-lg:flex-[1] border-[1.5px] border-[#D1D5DB] rounded-[10px] font-['Inter'] text-[16px] max-lg:text-[14px]"
                    />
                    <span className="text-[#6B7280] font-['Inter'] text-[14px] max-lg:text-[13px] shrink-0">a</span>
                    <Input
                      type="time"
                      value={fr.hora_fin}
                      onChange={(e) => setBloqueForm((f) => ({
                        ...f,
                        franjas: f.franjas.map((x, i) => i === idx ? { ...x, hora_fin: e.target.value } : x),
                      }))}
                      className="h-[44px] max-lg:h-10 flex-1 min-w-[100px] max-w-[160px] max-lg:min-w-0 max-lg:max-w-none max-lg:flex-[1] border-[1.5px] border-[#D1D5DB] rounded-[10px] font-['Inter'] text-[16px] max-lg:text-[14px]"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setBloqueForm((f) => ({ ...f, franjas: f.franjas.filter((_, i) => i !== idx) }))}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 rounded-[8px] h-9 shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
            )}
            <div className="space-y-3">
              <Label className="text-[15px] font-medium text-[#374151] font-['Inter']">Motivo (opcional)</Label>
              <Input
                type="text"
                placeholder="Ej: Vacaciones, licencia, capacitación"
                value={bloqueForm.motivo}
                onChange={(e) => setBloqueForm((f) => ({ ...f, motivo: e.target.value }))}
                className="h-[52px] max-lg:h-10 border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[16px] max-lg:text-[14px] font-['Inter'] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20"
              />
            </div>

          </div>
          <DialogFooter className="px-8 max-lg:px-4 py-6 max-lg:py-4 border-t border-[#E5E7EB] bg-[#F9FAFB] gap-3 max-lg:gap-2 flex-shrink-0 flex-wrap max-lg:flex-col mt-0">
            <Button
              variant="outline"
              onClick={() => { setShowBloqueModal(false); setAbrioModalParaDesbloquear(false); setShowDesbloquearTodoConfirm(false); }}
              className="h-[48px] max-lg:h-10 rounded-[12px] font-['Inter'] text-[15px] max-lg:text-[14px] px-5 py-2.5 max-lg:w-full"
            >
              Cancelar
            </Button>
            {abrioModalParaDesbloquear && bloquesDelDiaEnModal.length > 0 ? (
              <>
                <Button
                  type="button"
                  onClick={() => setShowDesbloquearTodoConfirm(true)}
                  disabled={deleteBloqueMutation.isPending}
                  variant="outline"
                  className="h-[48px] max-lg:h-10 rounded-[12px] font-['Inter'] text-[15px] max-lg:text-[14px] px-5 py-2.5 max-lg:w-full border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400 focus-visible:border-red-400 focus-visible:ring-red-200 focus-visible:ring-offset-0"
                >
                  Desbloquear todo
                </Button>
                <Button
                  onClick={handleSubmitBloque}
                  disabled={isSubmittingBloque}
                  className="h-[48px] max-lg:h-10 rounded-[12px] font-['Inter'] text-[15px] max-lg:text-[14px] px-5 py-2.5 bg-[#2563eb] hover:bg-[#1d4ed8] text-white max-lg:w-full shadow-md shadow-[#2563eb]/20"
                >
                  {isSubmittingBloque ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Editar
                </Button>
              </>
            ) : (
              <Button
                onClick={handleSubmitBloque}
                disabled={isSubmittingBloque}
                className="h-[48px] max-lg:h-10 rounded-[12px] font-['Inter'] text-[15px] max-lg:text-[14px] px-5 py-2.5 bg-[#2563eb] hover:bg-[#1d4ed8] text-white max-lg:w-full shadow-md shadow-[#2563eb]/20"
              >
                {isSubmittingBloque ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Bloquear
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteModal
        open={showDesbloquearTodoConfirm}
        onOpenChange={(open) => { setShowDesbloquearTodoConfirm(open); }}
        title="Desbloquear todo el día"
        description={
          <>
            ¿Estás seguro de que deseas desbloquear todo el día{' '}
            {bloqueForm.fecha_inicio
              ? format(new Date(bloqueForm.fecha_inicio + 'T12:00:00'), "d 'de' MMMM", { locale: es })
              : ''}
            ? Se eliminarán todos los bloqueos de este día.
          </>
        }
        confirmLabel="Desbloquear todo"
        loadingLabel="Desbloqueando..."
        onConfirm={async () => {
          if (bloquesDelDiaEnModal.length === 0) return;
          await Promise.all(bloquesDelDiaEnModal.map((b) => deleteBloqueMutation.mutateAsync(b.id)));
          setShowDesbloquearTodoConfirm(false);
          setShowBloqueModal(false);
          setAbrioModalParaDesbloquear(false);
          reactToastify.success('Día desbloqueado correctamente', { position: 'top-right', autoClose: 3000 });
        }}
        isLoading={deleteBloqueMutation.isPending}
      />

      {/* Modal Habilitar / Gestionar día puntual */}
      <Dialog
        open={showDiaPuntualModal}
        onOpenChange={(open) => {
          setShowDiaPuntualModal(open);
          if (!open) {
            setDiaPuntualEditId(null);
            setShowDeshabilitarDiaPuntualConfirm(false);
          }
        }}
      >
        <DialogContent className="max-w-[900px] w-[95vw] max-lg:max-h-[85vh] max-lg:h-[85vh] max-h-[90vh] rounded-[20px] border border-[#E5E7EB] shadow-2xl p-0 flex flex-col overflow-hidden">
          <DialogHeader className="relative z-[60] px-8 max-lg:px-4 pt-8 max-lg:pt-4 pb-6 max-lg:pb-4 border-b border-[#E5E7EB] bg-white flex-shrink-0 mb-0">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] flex items-center justify-center shadow-lg shadow-[#2563eb]/20 max-lg:hidden">
                <CalendarPlus className="h-6 w-6 text-white stroke-[2]" />
              </div>
              <div>
                <DialogTitle className="text-[28px] max-lg:text-[22px] font-bold text-[#111827] font-['Poppins'] leading-tight mb-0">
                  {diaPuntualEditId ? 'Gestionar día puntual' : 'Habilitar día puntual'}
                </DialogTitle>
                <DialogDescription className="text-base text-[#6B7280] font-['Inter'] mt-1 mb-0">
                  {diaPuntualEditId ? 'Modificá el horario del día puntual. La fecha no se puede cambiar.' : 'Agregá una fecha en que el profesional atiende.'}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="px-8 max-lg:px-4 py-6 max-lg:py-4 space-y-5 overflow-y-auto flex-1 min-h-0">
            <div className="grid grid-cols-1 gap-4 max-lg:gap-3">
              <div className="space-y-3">
                <Label className="text-[15px] font-medium text-[#374151] font-['Inter']">
                  Profesional
                </Label>
                <div className="h-[52px] max-lg:h-10 border-[1.5px] border-[#E5E7EB] rounded-[10px] bg-[#F9FAFB] px-4 flex items-center font-['Inter'] text-[16px] max-lg:text-[14px] text-[#374151]">
                  {(() => {
                    const p = profesionales.find((pr) => pr.id === profesionalFilter);
                    return p ? `${formatDisplayText(p.nombre)} ${formatDisplayText(p.apellido)}${p.especialidad ? ` - ${formatDisplayText(p.especialidad)}` : ''}` : '—';
                  })()}
                </div>
              </div>
              <div className="space-y-3 w-full">
                <Label className="text-[15px] font-medium text-[#374151] font-['Inter']">
                  Fecha
                </Label>
                {diaPuntualEditId ? (
                  <div className="h-[52px] max-lg:h-10 border-[1.5px] border-[#E5E7EB] rounded-[10px] bg-[#F3F4F6] px-4 flex items-center font-['Inter'] text-[16px] max-lg:text-[14px] text-[#6B7280] cursor-not-allowed">
                    {diaPuntualForm.fecha ? format(new Date(diaPuntualForm.fecha + 'T12:00:00'), "EEEE d 'de' MMMM yyyy", { locale: es }) : '—'}
                  </div>
                ) : (
                  <div className="h-[52px] max-lg:h-10 w-full [&_button]:h-full [&_button]:min-h-0 [&>div]:w-full flex">
                    <DatePicker
                      value={diaPuntualForm.fecha}
                      onChange={(fecha) => setDiaPuntualForm((f) => ({ ...f, fecha }))}
                      placeholder="Seleccionar fecha"
                      min={format(new Date(), 'yyyy-MM-dd')}
                      className="h-[52px] max-lg:h-10 w-full text-[#374151] border-[1.5px] border-[#D1D5DB] rounded-[10px] font-['Inter'] text-[16px] max-lg:text-[14px] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20"
                      open={diaPuntualDatePickerOpen}
                      onOpenChange={setDiaPuntualDatePickerOpen}
                      inline
                    />
                  </div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <Label className="text-[15px] font-medium text-[#374151] font-['Inter']">Hora inicio</Label>
                <Input
                  type="time"
                  value={diaPuntualForm.hora_inicio}
                  onChange={(e) => setDiaPuntualForm((f) => ({ ...f, hora_inicio: e.target.value }))}
                  className="h-[52px] max-lg:h-10 border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[16px] max-lg:text-[14px] font-['Inter'] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20"
                />
              </div>
              <div className="space-y-3">
                <Label className="text-[15px] font-medium text-[#374151] font-['Inter']">Hora fin</Label>
                <Input
                  type="time"
                  value={diaPuntualForm.hora_fin}
                  onChange={(e) => setDiaPuntualForm((f) => ({ ...f, hora_fin: e.target.value }))}
                  className="h-[52px] max-lg:h-10 border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[16px] max-lg:text-[14px] font-['Inter'] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20"
                />
              </div>
            </div>
            <div className="space-y-3">
              <Label className="text-[15px] font-medium text-[#374151] font-['Inter']">Duración (min)</Label>
              <Input
                type="number"
                min={5}
                max={480}
                placeholder="30"
                value={diaPuntualForm.duracion_turno_minutos != null ? diaPuntualForm.duracion_turno_minutos : ''}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === '') {
                    setDiaPuntualForm((f) => ({ ...f, duracion_turno_minutos: undefined }));
                    return;
                  }
                  const n = parseInt(raw, 10);
                  if (!Number.isNaN(n)) setDiaPuntualForm((f) => ({ ...f, duracion_turno_minutos: n }));
                }}
                className="h-[52px] max-lg:h-10 border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[16px] max-lg:text-[14px] font-['Inter'] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20"
              />
            </div>
          </div>
          <DialogFooter className="mt-0 px-8 max-lg:px-4 py-6 max-lg:py-4 border-t border-[#E5E7EB] bg-[#F9FAFB] gap-3 max-lg:gap-2 flex-shrink-0 max-lg:flex-col flex-row flex-wrap">
            {diaPuntualEditId ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowDeshabilitarDiaPuntualConfirm(true)}
                  disabled={deleteExcepcionMutation.isPending || updateExcepcionMutation.isPending}
                  className="h-[48px] max-lg:h-10 rounded-[12px] font-['Inter'] text-[15px] max-lg:text-[14px] px-5 py-2.5 border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400 focus-visible:border-red-400 focus-visible:ring-red-200 mr-auto max-lg:mr-0 max-lg:order-1 max-lg:w-full"
                >
                  Deshabilitar día
                </Button>
                <Button variant="outline" onClick={() => setShowDiaPuntualModal(false)} className="h-[48px] max-lg:h-10 rounded-[12px] font-['Inter'] text-[15px] max-lg:text-[14px] px-5 py-2.5 max-lg:w-full max-lg:order-2">
                  Cancelar
                </Button>
                <Button
                  className="h-[48px] max-lg:h-10 rounded-[12px] font-['Inter'] text-[15px] max-lg:text-[14px] px-5 py-2.5 bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-md shadow-[#2563eb]/20 max-lg:w-full max-lg:order-3"
                  disabled={
                    updateExcepcionMutation.isPending ||
                    !diaPuntualForm.hora_inicio ||
                    !diaPuntualForm.hora_fin ||
                    diaPuntualForm.duracion_turno_minutos == null ||
                    diaPuntualForm.duracion_turno_minutos < 5 ||
                    diaPuntualForm.duracion_turno_minutos > 480
                  }
                  onClick={() => {
                    if (!diaPuntualEditId) return;
                    const { hora_inicio, hora_fin, duracion_turno_minutos } = diaPuntualForm;
                    updateExcepcionMutation.mutate({
                      id: diaPuntualEditId,
                      data: {
                        hora_inicio: hora_inicio.length >= 5 ? hora_inicio : hora_inicio + ':00',
                        hora_fin: hora_fin.length >= 5 ? hora_fin : hora_fin + ':00',
                        duracion_turno_minutos: duracion_turno_minutos ?? 30,
                      },
                    });
                  }}
                >
                  {updateExcepcionMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Guardar
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setShowDiaPuntualModal(false)} className="h-[48px] max-lg:h-10 rounded-[12px] font-['Inter'] text-[15px] max-lg:text-[14px] px-5 py-2.5 max-lg:w-full">
                  Cancelar
                </Button>
                <Button
                  className="h-[48px] max-lg:h-10 rounded-[12px] font-['Inter'] text-[15px] max-lg:text-[14px] px-5 py-2.5 bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-md shadow-[#2563eb]/20 max-lg:w-full"
                  disabled={
                    createExcepcionMutation.isPending ||
                    !diaPuntualForm.profesional_id ||
                    !diaPuntualForm.fecha ||
                    (diaPuntualForm.fecha ? isBefore(startOfDay(new Date(diaPuntualForm.fecha + 'T12:00:00')), startOfDay(new Date())) : false) ||
                    diaPuntualForm.duracion_turno_minutos == null ||
                    diaPuntualForm.duracion_turno_minutos < 5 ||
                    diaPuntualForm.duracion_turno_minutos > 480
                  }
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
                  Habilitar
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteModal
        open={showDeshabilitarDiaPuntualConfirm}
        onOpenChange={setShowDeshabilitarDiaPuntualConfirm}
        title="Deshabilitar día puntual"
        description={
          <>
            ¿Está seguro de que desea deshabilitar este día? Se eliminará la configuración del día puntual y ya no se podrán crear turnos para esta fecha.
          </>
        }
        confirmLabel="Deshabilitar"
        loadingLabel="Deshabilitando..."
        confirmDisabled={!diaPuntualEditId}
        onConfirm={async () => {
          if (!diaPuntualEditId) return;
          await deleteExcepcionMutation.mutateAsync(diaPuntualEditId);
          setShowDeshabilitarDiaPuntualConfirm(false);
          setShowDiaPuntualModal(false);
          setDiaPuntualEditId(null);
        }}
        isLoading={deleteExcepcionMutation.isPending}
      />

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
            setQuickCreatePaciente({ dni: '', nombre: '', apellido: '', telefono: '', email: '' });
          }
        }}
      >
        <DialogContent className="max-w-[900px] w-[95vw] max-lg:max-h-[85vh] max-lg:h-[85vh] max-h-[90vh] rounded-[20px] p-0 border border-[#E5E7EB] shadow-2xl flex flex-col overflow-hidden">
          <DialogHeader className="px-8 max-lg:px-4 pt-8 max-lg:pt-4 pb-6 max-lg:pb-4 border-b border-[#E5E7EB] bg-gradient-to-b from-white to-[#F9FAFB] flex-shrink-0 mb-0">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] flex items-center justify-center shadow-lg shadow-[#2563eb]/20 max-lg:hidden">
                <Plus className="h-6 w-6 text-white stroke-[2]" />
              </div>
              <div>
                <DialogTitle className="text-[28px] max-lg:text-[22px] font-bold text-[#111827] font-['Poppins'] leading-tight mb-0">
                  Nuevo Turno
                </DialogTitle>
                <DialogDescription className="text-base text-[#6B7280] font-['Inter'] mt-1 mb-0">
                  Crear un nuevo turno médico
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto px-8 max-lg:px-4 py-6 max-lg:py-4 space-y-5">
            {!profesionalFilter ? (
              <p className="text-[#6B7280] font-['Inter'] text-[15px] bg-[#F9FAFB] border border-[#E5E7EB] rounded-[10px] px-4 py-3">
                Seleccione un profesional en el filtro de la página para crear turnos en su agenda.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-3">
                    <Label className="text-[15px] font-medium text-[#374151] font-['Inter']">
                      Profesional
                    </Label>
                    <div className="h-[52px] max-lg:h-10 border-[1.5px] border-[#E5E7EB] rounded-[10px] bg-[#F9FAFB] px-4 flex items-center font-['Inter'] text-[16px] max-lg:text-[14px] text-[#374151] w-full">
                      {(() => {
                        const p = profesionales.find((pr) => pr.id === profesionalFilter);
                        return p ? `${formatDisplayText(p.nombre)} ${formatDisplayText(p.apellido)}${p.especialidad ? ` - ${formatDisplayText(p.especialidad)}` : ''}` : '—';
                      })()}
                    </div>
                  </div>

                  <div className="space-y-3 w-full" ref={createDatePickerRef}>
                    <Label htmlFor="create-fecha" className="text-[15px] font-medium text-[#374151] font-['Inter']">
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
                        className="h-[52px] max-lg:h-10 w-full flex items-center gap-2 px-4 border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[16px] max-lg:text-[14px] font-['Inter'] text-left bg-white focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200 hover:border-[#9CA3AF]"
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
                              const selectedCreateDate = createFecha ? new Date(createFecha + 'T12:00:00') : null;
                              return days.map((day) => {
                                const isCurrentMonth = isSameMonth(day, createDatePickerMonth);
                                const dateStrCreate = format(day, 'yyyy-MM-dd');
                                const isLaborable = getAgendaForDate(dateStrCreate).length > 0;
                                const isDisabled = !isLaborable;
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

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <Label htmlFor="create-hora-inicio" className="text-[15px] font-medium text-[#374151] font-['Inter']">
                      Hora inicio
                    </Label>
                    <Select
                      value={
                        (() => {
                          const opt = opcionesHoraInicioConEstado.find((o) => o.value === createHoraInicio);
                          if (opt && !opt.bloqueado) return createHoraInicio;
                          const first = opcionesHoraInicioConEstado.find((o) => !o.bloqueado);
                          return first?.value ?? createHoraInicio;
                        })()
                      }
                      onValueChange={(v) => setCreateHoraInicio(v)}
                    >
                      <SelectTrigger id="create-hora-inicio" className="h-[52px] max-lg:h-10 border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[16px] max-lg:text-[14px] font-['Inter'] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 justify-start text-left">
                        <SelectValue placeholder="Hora inicio" />
                      </SelectTrigger>
                      <SelectContent className="text-left [&_button]:text-left max-h-[min(14rem,65vh)] [&_[data-radix-select-viewport]]:max-h-[min(14rem,65vh)]">
                        {opcionesHoraInicioConEstado.map((opt) => (
                          <SelectItem
                            key={opt.value}
                            value={opt.value}
                            disabled={opt.bloqueado}
                            className={
                              opt.bloqueado
                                ? 'text-[13px] font-[\'Inter\'] text-left pl-2 text-[#9CA3AF] bg-[#F3F4F6] cursor-not-allowed opacity-70'
                                : opt.ocupado
                                  ? 'text-[13px] font-[\'Inter\'] text-left pl-2 text-[#6B7280] bg-[#F3F4F6] data-[highlighted]:bg-[#E5E7EB]'
                                  : 'text-[13px] font-[\'Inter\'] text-left pl-2 data-[highlighted]:bg-[#F3F4F6]'
                            }
                          >
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {rangoHorarioCreate.min !== undefined ? (
                      <>
                        {!diaCompletamenteBloqueadoCreate && esHoyCreate && opcionesHoraInicioTodas.length === 0 && (
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
                    <Label htmlFor="create-hora-fin" className="text-[15px] font-medium text-[#374151] font-['Inter']">
                      Hora fin
                    </Label>
                    <Select
                      value={
                        (() => {
                          const opt = opcionesHoraFinConEstado.find((o) => o.value === createHoraFin);
                          if (opt && !opt.bloqueado && createHoraFin > createHoraInicio) return createHoraFin;
                          const first = opcionesHoraFinConEstado.find((o) => !o.bloqueado && o.value > createHoraInicio);
                          return first?.value ?? createHoraFin;
                        })()
                      }
                      onValueChange={(v) => setCreateHoraFin(v)}
                    >
                      <SelectTrigger id="create-hora-fin" className="h-[52px] max-lg:h-10 border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[16px] max-lg:text-[14px] font-['Inter'] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 justify-start text-left">
                        <SelectValue placeholder="Hora fin" />
                      </SelectTrigger>
                      <SelectContent className="text-left [&_button]:text-left max-h-[min(14rem,65vh)] [&_[data-radix-select-viewport]]:max-h-[min(14rem,65vh)]">
                        {opcionesHoraFinConEstado.map((opt) => (
                          <SelectItem
                            key={opt.value}
                            value={opt.value}
                            disabled={opt.bloqueado}
                            className={
                              opt.bloqueado
                                ? 'text-[13px] font-[\'Inter\'] text-left pl-2 text-[#9CA3AF] bg-[#F3F4F6] cursor-not-allowed opacity-70'
                                : opt.ocupado
                                  ? 'text-[13px] font-[\'Inter\'] text-left pl-2 text-[#6B7280] bg-[#F3F4F6] data-[highlighted]:bg-[#E5E7EB]'
                                  : 'text-[13px] font-[\'Inter\'] text-left pl-2 data-[highlighted]:bg-[#F3F4F6]'
                            }
                          >
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="create-paciente-dni" className="text-[15px] font-medium text-[#374151] font-['Inter']">
                    Paciente
                  </Label>
                  {createFormData.paciente_id && pacienteFound ? (
                    <div className="flex items-center gap-3 h-[52px] max-lg:h-10 px-4 border-[1.5px] border-[#E5E7EB] rounded-[10px] bg-[#F9FAFB] font-['Inter'] text-[16px] max-lg:text-[14px] text-[#374151]">
                      <span className="flex-1">
                        {formatDisplayText(pacienteFound.nombre)} {formatDisplayText(pacienteFound.apellido)} - DNI: {formatDni(pacienteFound.dni)}
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
                                setQuickCreatePaciente((p) => ({ ...p, nombre: '', apellido: '', telefono: '', email: '' }));
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
                              <div className="space-y-1.5">
                                <Label className="text-[13px] font-['Inter'] flex items-center gap-1">
                                  <Mail className="h-3.5 w-3.5" /> Email
                                </Label>
                                <Input
                                  type="email"
                                  value={quickCreatePaciente.email}
                                  onChange={(e) => setQuickCreatePaciente((p) => ({ ...p, email: e.target.value }))}
                                  placeholder="Email"
                                  className="h-10 font-['Inter'] text-[14px]"
                                />
                              </div>
                              <div className="space-y-1.5">
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
                              disabled={isCreatingPaciente || !quickCreatePaciente.nombre.trim() || !quickCreatePaciente.apellido.trim() || !quickCreatePaciente.email.trim() || !quickCreatePaciente.telefono.trim()}
                              className="h-10 px-4 rounded-[10px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-['Inter'] text-[14px]"
                            >
                              {isCreatingPaciente ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                              Crear y usar este paciente
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="relative flex-1">
                          <Input
                            id="create-paciente-dni"
                            type="text"
                            inputMode="numeric"
                            value={pacienteDniInput}
                            onChange={(e) => setPacienteDniInput(e.target.value.replace(/\D/g, '').slice(0, 8))}
                            onKeyDown={(e) => e.key === 'Enter' && handleBuscarPacientePorDni()}
                            placeholder="DNI (6 a 8 dígitos)"
                            className="h-10 pl-4 pr-10 border-[1.5px] border-[#D1D5DB] rounded-[10px] font-['Inter'] text-[14px] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (pacienteFound) {
                                setCreateFormData((prev) => ({ ...prev, paciente_id: '' }));
                                setPacienteFound(null);
                                setPacienteDniInput('');
                              } else {
                                handleBuscarPacientePorDni();
                              }
                            }}
                            disabled={pacienteFound ? false : (!pacienteDniInput.trim() || pacienteDniInput.trim().length < 6 || isSearchingPaciente)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 flex items-center justify-center rounded-[6px] text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#374151] disabled:opacity-50 disabled:pointer-events-none"
                            aria-label={pacienteFound ? 'Limpiar y buscar otro' : 'Buscar paciente por DNI'}
                          >
                            {isSearchingPaciente ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : pacienteFound ? (
                              <X className="h-4 w-4 stroke-[2]" />
                            ) : (
                              <Search className="h-4 w-4 stroke-[2]" />
                            )}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>

            <div className="space-y-3">
              <Label htmlFor="create-motivo" className="text-[15px] font-medium text-[#374151] font-['Inter']">
                Motivo
              </Label>
              <Input
                id="create-motivo"
                value={createFormData.motivo}
                onChange={(e) => setCreateFormData({ ...createFormData, motivo: e.target.value })}
                placeholder="Motivo de la consulta"
                className="h-[52px] max-lg:h-10 border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[16px] max-lg:text-[14px] font-['Inter'] placeholder:text-[#9CA3AF] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200"
              />
            </div>
              </>
            )}
          </div>

          <DialogFooter className="px-8 max-lg:px-4 py-5 max-lg:py-4 border-t border-[#E5E7EB] bg-[#F9FAFB] flex flex-row max-lg:flex-col justify-end gap-3 max-lg:gap-2 flex-shrink-0 mt-0">
            <div className="flex gap-3 max-lg:flex-col max-lg:w-full">
              <Button
                variant="outline"
                onClick={() => setShowCreateModal(false)}
                className="h-[48px] max-lg:h-10 px-6 rounded-[12px] border-[1.5px] border-[#D1D5DB] font-medium font-['Inter'] text-[15px] max-lg:text-[14px] hover:bg-white hover:border-[#9CA3AF] transition-all duration-200"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleCreate}
                disabled={isSubmitting || !profesionalFilter || diaCompletamenteBloqueadoCreate || !createFormData.paciente_id}
                className="h-[48px] max-lg:h-10 px-8 rounded-[12px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-lg shadow-[#2563eb]/30 hover:shadow-xl hover:shadow-[#2563eb]/40 hover:scale-[1.02] font-semibold font-['Inter'] text-[15px] max-lg:text-[14px] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
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

      {/* Modal Ver detalle del turno */}
      <Dialog open={showDetailModal} onOpenChange={(open) => { setShowDetailModal(open); if (!open) setSelectedTurno(null); }}>
        <DialogContent className="max-w-[500px] w-[95vw] max-h-[90vh] rounded-[20px] p-0 border border-[#E5E7EB] shadow-2xl flex flex-col overflow-hidden">
          <DialogHeader className="flex-shrink-0 px-8 max-lg:px-4 pt-6 pb-2 border-b border-[#E5E7EB] mb-0">
            <DialogTitle className="text-[22px] font-bold text-[#111827] font-['Poppins'] mb-0">
              Detalle del turno
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto px-8 max-lg:px-4 pt-3 pb-3 space-y-4">
            {selectedTurno && (
              <>
                <div className="space-y-2">
                  <Label className="text-[14px] font-medium text-[#374151] font-['Inter']">Paciente</Label>
                  <div className="h-10 border-[1.5px] border-[#E5E7EB] rounded-[10px] bg-[#F9FAFB] px-4 flex items-center font-['Inter'] text-[15px] text-[#374151]">
                    {formatDisplayText(selectedTurno.paciente_nombre)} {formatDisplayText(selectedTurno.paciente_apellido)}
                    {selectedTurno.paciente_dni ? ` (${formatDni(selectedTurno.paciente_dni)})` : ''}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-[14px] font-medium text-[#374151] font-['Inter']">Fecha</Label>
                  <div className="h-10 border-[1.5px] border-[#E5E7EB] rounded-[10px] bg-[#F9FAFB] px-4 flex items-center font-['Inter'] text-[15px] text-[#374151]">
                    {format(new Date(selectedTurno.fecha_hora_inicio), 'dd/MM/yyyy', { locale: es })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[14px] font-medium text-[#374151] font-['Inter']">Hora inicio</Label>
                    <div className="h-10 border-[1.5px] border-[#E5E7EB] rounded-[10px] bg-[#F9FAFB] px-4 flex items-center font-['Inter'] text-[15px] text-[#374151]">
                      {format(new Date(selectedTurno.fecha_hora_inicio), 'HH:mm', { locale: es })}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[14px] font-medium text-[#374151] font-['Inter']">Hora fin</Label>
                    <div className="h-10 border-[1.5px] border-[#E5E7EB] rounded-[10px] bg-[#F9FAFB] px-4 flex items-center font-['Inter'] text-[15px] text-[#374151]">
                      {format(new Date(selectedTurno.fecha_hora_fin), 'HH:mm', { locale: es })}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-[14px] font-medium text-[#374151] font-['Inter']">Profesional</Label>
                  <div className="h-10 border-[1.5px] border-[#E5E7EB] rounded-[10px] bg-[#F9FAFB] px-4 flex items-center font-['Inter'] text-[15px] text-[#374151]">
                    {(() => {
                      const p = profesionales.find((pr) => pr.id === selectedTurno.profesional_id);
                      return p ? `${formatDisplayText(p.nombre)} ${formatDisplayText(p.apellido)}${p.especialidad ? ` - ${formatDisplayText(p.especialidad)}` : ''}` : (selectedTurno.profesional_nombre ? `${formatDisplayText(selectedTurno.profesional_nombre)} ${formatDisplayText(selectedTurno.profesional_apellido || '')}` : '—');
                    })()}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-[14px] font-medium text-[#374151] font-['Inter']">Motivo</Label>
                  <div className="min-h-10 border-[1.5px] border-[#E5E7EB] rounded-[10px] bg-[#F9FAFB] px-4 py-2.5 font-['Inter'] text-[15px] text-[#374151]">
                    {selectedTurno.motivo || '—'}
                  </div>
                </div>
              </>
            )}
          </div>

          <DialogFooter className="flex-shrink-0 flex-row justify-end gap-0 px-8 max-lg:px-4 py-3 border-t border-[#E5E7EB] mt-0">
            <Button
              variant="outline"
              onClick={() => { setShowDetailModal(false); setSelectedTurno(null); }}
              className="rounded-[10px] border border-[#D1D5DB] font-['Inter'] text-[15px] px-6 h-10"
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
        description={<>¿Estás seguro de que deseas eliminar el turno de <span className="font-semibold text-[#374151]">{formatDisplayText(turnoToDelete?.paciente_nombre)} {formatDisplayText(turnoToDelete?.paciente_apellido)}</span>? Esta acción no se puede deshacer.</>}
        onConfirm={handleConfirmDeleteTurno}
        isLoading={deleteMutation.isPending}
      />

      {/* Modal Cancelar Turno */}
      <Dialog open={showCancelModal} onOpenChange={setShowCancelModal}>
        <DialogContent className="max-w-[600px] w-[95vw] rounded-[20px] p-0 border border-[#E5E7EB] shadow-2xl max-lg:p-4">
          <DialogHeader className="px-8 max-lg:px-4 pt-8 max-lg:pt-4 pb-6 max-lg:pb-4 border-b border-[#E5E7EB] bg-gradient-to-b from-white to-[#F9FAFB]">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-[#EF4444] to-[#DC2626] flex items-center justify-center shadow-lg shadow-[#EF4444]/20 max-lg:hidden">
                <X className="h-6 w-6 text-white stroke-[2]" />
              </div>
              <div>
                <DialogTitle className="text-[28px] max-lg:text-[22px] font-bold text-[#111827] font-['Poppins'] leading-tight mb-0">
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
                  {formatDisplayText(selectedTurno.paciente_nombre)} {formatDisplayText(selectedTurno.paciente_apellido)}
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

          <DialogFooter className="px-8 max-lg:px-4 py-5 max-lg:py-4 border-t border-[#E5E7EB] bg-[#F9FAFB] flex flex-row max-lg:flex-col justify-end gap-3 max-lg:gap-2">
            <Button
              variant="outline"
              onClick={() => setShowCancelModal(false)}
              className="h-[48px] max-lg:h-10 max-lg:w-full px-6 rounded-[12px] border-[1.5px] border-[#D1D5DB] font-medium font-['Inter'] text-[15px] max-lg:text-[14px] hover:bg-white hover:border-[#9CA3AF] transition-all duration-200"
            >
              No Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelSubmit}
              disabled={isSubmitting}
              className="h-[48px] max-lg:h-10 max-lg:w-full px-8 rounded-[12px] font-semibold font-['Inter'] text-[15px] max-lg:text-[14px]"
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

      {/* Modal Gestionar agenda: solo montar cuando está abierto para evitar bucle Radix Presence */}
      {showGestionarAgendaModalFromTurnos && profesionalLogueado && (
        <GestionarAgendaModal
          open={true}
          onOpenChange={handleGestionarAgendaClose}
          profesionalId={profesionalLogueado.id}
          profesionalNombre={profesionalLogueado.nombre ?? ''}
          profesionalApellido={profesionalLogueado.apellido ?? ''}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['agendas'] })}
        />
      )}
      <CreateAgendaModal
        open={showCreateAgendaModalFromTurnos}
        onOpenChange={(open) => {
          setShowCreateAgendaModalFromTurnos(open);
          if (!open) queryClient.invalidateQueries({ queryKey: ['agendas'] });
        }}
        presetProfesionalId={profesionalLogueado?.id ?? profesionalFilter ?? ''}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['agendas'] })}
      />
    </div>
  );
}