import { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth, addMonths, subMonths, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addWeeks, getDate, setDate, parseISO, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  CreditCard, DollarSign, CheckCircle2, Calendar, 
  Eye, Loader2, Plus, User, Pencil, Trash2, FileText, AlertCircle, ChevronLeft, ChevronRight
} from 'lucide-react';
import { toast as reactToastify } from 'react-toastify';
import { pagosService, type CreatePagoData, type MarkAsPaidData } from '@/services/pagos.service';
import { profesionalesService, type UpdateProfesionalData } from '@/services/profesionales.service';
import type { Pago, Profesional } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/utils/permissions';

function getEstadoPagoBadge(estado: string) {
  switch (estado) {
    case 'pagado':
      return (
        <Badge className="bg-[#D1FAE5] text-[#065F46] border-[#6EE7B7] hover:bg-[#A7F3D0] rounded-full px-3 py-1 text-xs font-medium">
          Pagado
        </Badge>
      );
    case 'pendiente':
      return (
        <Badge className="bg-[#FEF3C7] text-[#92400E] border-[#FDE047] hover:bg-[#FDE68A] rounded-full px-3 py-1 text-xs font-medium">
          Pendiente
        </Badge>
      );
    case 'vencido':
      return (
        <Badge className="bg-[#FEE2E2] text-[#991B1B] border-[#FECACA] hover:bg-[#FCA5A5] rounded-full px-3 py-1 text-xs font-medium">
          Vencido
        </Badge>
      );
    default:
      return (
        <Badge className="bg-[#F3F4F6] text-[#4B5563] border-[#D1D5DB] rounded-full px-3 py-1 text-xs font-medium">
          -
        </Badge>
      );
  }
}

const METODOS_PAGO = [
  'Efectivo',
  'Transferencia',
  'Depósito',
  'Tarjeta',
  'Cheque',
];

export type PeriodOption = { label: string; value: string };

/** Primera letra en mayúscula (meses y textos de período) */
function capitalizeFirst(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** Parsea string de monto (ej. "$ 500.000") a número; sin decimales en display */
function parseValorToNumber(valorStr: string): number | undefined {
  const trimmed = valorStr.trim().replace(/^\$\s*/, '');
  if (!trimmed) return undefined;
  const cleaned = trimmed.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

/** Formatea número a display con $ y miles, sin decimales */
function formatValorDisplay(valorStr: string): string {
  const n = parseValorToNumber(valorStr);
  if (n === undefined) return '';
  const formatted = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
  return `$ ${formatted}`;
}

/**
 * Genera opciones de período desde la fecha de inicio del contrato hasta 12 períodos hacia adelante.
 * - Mensual: 12 meses a futuro (desde inicio contrato hasta hoy + 12 meses).
 * - Quincenal: 12 quincenas a futuro = 6 meses (hoy + 6 meses).
 * - Semanal: 12 semanas a futuro ≈ 3 meses (hoy + 12 semanas).
 * Los que ya tienen orden se filtran después.
 */
function getPeriodOptions(prof: Profesional | undefined): PeriodOption[] {
  if (!prof?.fecha_inicio_contrato?.trim() || !prof?.monto_mensual || prof.monto_mensual <= 0) return [];
  const raw = prof.fecha_inicio_contrato.trim();
  const dateStr = raw.length >= 10 ? raw.slice(0, 10) : raw;
  const start = parseISO(dateStr + 'T12:00:00');
  if (!isValid(start)) return [];
  const tipo = prof.tipo_periodo_pago || 'mensual';
  const today = new Date();
  const options: PeriodOption[] = [];

  if (tipo === 'mensual') {
    const startMonth = startOfMonth(start);
    const endMonth = addMonths(startOfMonth(today), 12);
    for (let d = startMonth; d <= endMonth; d = addMonths(d, 1)) {
      options.push({
        label: capitalizeFirst(format(d, 'MMMM yyyy', { locale: es })),
        value: format(d, 'yyyy-MM-dd'),
      });
    }
  } else if (tipo === 'quincenal') {
    const startMonth = startOfMonth(start);
    const endMonth = addMonths(startOfMonth(today), 6);
    for (let m = startMonth; m <= endMonth; m = addMonths(m, 1)) {
      for (const day of [1, 16] as const) {
        const d = setDate(m, day);
        const quincena = day === 1 ? '1ª quincena' : '2ª quincena';
        options.push({
          label: capitalizeFirst(`${format(m, 'MMMM yyyy', { locale: es })} ${quincena}`),
          value: format(d, 'yyyy-MM-dd'),
        });
      }
    }
  } else {
    const startWeek = startOfWeek(start, { weekStartsOn: 1 });
    const endWeek = addWeeks(startOfWeek(today, { weekStartsOn: 1 }), 12);
    for (let d = startWeek; d <= endWeek; d = addWeeks(d, 1)) {
      options.push({
        label: `Semana del ${capitalizeFirst(format(d, 'd MMM yyyy', { locale: es }))}`,
        value: format(d, 'yyyy-MM-dd'),
      });
    }
  }
  return options;
}

/** Formatea el período para mostrar en tabla según tipo (mensual/quincenal/semanal), mes con mayúscula */
function formatPeriodoDisplay(pago: Pago): string {
  const raw = pago.periodo?.trim();
  if (!raw) return '—';
  const dateStr = raw.length >= 10 ? raw.slice(0, 10) : raw;
  const d = parseISO(dateStr + 'T12:00:00');
  if (!isValid(d)) return '—';
  const tipo = pago.profesional_tipo_periodo_pago || 'mensual';
  if (tipo === 'mensual') return capitalizeFirst(format(d, 'MMMM yyyy', { locale: es }));
  if (tipo === 'quincenal') {
    const day = getDate(d);
    const quincena = day <= 15 ? '1ª quincena' : '2ª quincena';
    return capitalizeFirst(`${format(d, 'MMMM yyyy', { locale: es })} ${quincena}`);
  }
  return `Semana del ${capitalizeFirst(format(d, 'd MMM yyyy', { locale: es }))}`;
}

export default function AdminPagos() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [activeMainTab, setActiveMainTab] = useState<'contrato' | 'pagos'>('pagos');
  const [activeTab, setActiveTab] = useState('todos');
  const [filterProfesionalId, setFilterProfesionalId] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedPago, setSelectedPago] = useState<Pago | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Contrato por profesional
  const [showEditContratoModal, setShowEditContratoModal] = useState(false);
  const [contratoEditando, setContratoEditando] = useState<Profesional | null>(null);
  const [editContratoForm, setEditContratoForm] = useState<{ fecha_inicio_contrato: string; monto_mensual: string; tipo_periodo_pago: 'mensual' | 'quincenal' | 'semanal' }>({ fecha_inicio_contrato: '', monto_mensual: '', tipo_periodo_pago: 'mensual' });
  const [showEliminarContratoConfirm, setShowEliminarContratoConfirm] = useState(false);
  const [contratoToEliminar, setContratoToEliminar] = useState<Profesional | null>(null);

  // Form state para generar orden de pago (pendiente; método de pago al marcar como pagada)
  const [createFormData, setCreateFormData] = useState<CreatePagoData>({
    profesional_id: '',
    periodo: '',
    monto: 0,
    observaciones: '',
  });

  // Form state para marcar como pagado
  const [payFormData, setPayFormData] = useState<MarkAsPaidData>({
    fecha_pago: format(new Date(), 'yyyy-MM-dd'),
    metodo_pago: '',
    observaciones: '',
  });
  // Date picker para Fecha de Pago (calendario como en Usuarios/Turnos)
  const [payDatePickerOpen, setPayDatePickerOpen] = useState(false);
  const [payDatePickerMonth, setPayDatePickerMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [payDatePickerAnchor, setPayDatePickerAnchor] = useState<DOMRect | null>(null);
  const payDatePickerButtonRef = useRef<HTMLButtonElement>(null);
  const payDatePickerRef = useRef<HTMLDivElement>(null);

  // Cerrar date picker Fecha de Pago al hacer clic fuera
  useEffect(() => {
    if (!payDatePickerOpen) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (payDatePickerButtonRef.current?.contains(target)) return;
      if (payDatePickerRef.current?.contains(target)) return;
      if ((e.target as Element).closest?.('[data-pay-calendar-portal]')) return;
      setPayDatePickerOpen(false);
      setPayDatePickerAnchor(null);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [payDatePickerOpen]);

  // Fetch profesionales para contrato y para crear pago (y para saber profesional logueado si es rol profesional)
  const { data: profesionales = [], isLoading: isLoadingProfesionales } = useQuery({
    queryKey: ['profesionales', 'all'],
    queryFn: () => profesionalesService.getAll(),
  });

  const isProfesional = user?.rol === 'profesional';
  const profesionalLogueado = useMemo(
    () => profesionales.find((p: Profesional) => p.usuario_id === user?.id),
    [profesionales, user?.id]
  );
  const profesionalIdForFilter = isProfesional ? profesionalLogueado?.id : null;

  // Fetch todos los pagos (si es profesional, solo los suyos)
  const { data: allPagos = [], isLoading: isLoadingAll } = useQuery({
    queryKey: ['pagos', 'all', profesionalIdForFilter ?? 'all'],
    queryFn: () =>
      profesionalIdForFilter
        ? pagosService.getAll({ profesional_id: profesionalIdForFilter })
        : pagosService.getAll(),
    enabled: !isProfesional || !!profesionalLogueado,
  });

  // Fetch pagos pendientes (admin: endpoint; profesional: derivado de allPagos)
  const { data: pendingPagosFromApi = [], isLoading: isLoadingPending } = useQuery({
    queryKey: ['pagos', 'pending'],
    queryFn: () => pagosService.getPending(),
    enabled: !isProfesional,
  });
  const pendingPagos = isProfesional ? allPagos.filter((p) => p.estado === 'pendiente') : pendingPagosFromApi;

  // Fetch pagos vencidos (admin: endpoint; profesional: derivado de allPagos)
  const { data: overduePagosFromApi = [], isLoading: isLoadingOverdue } = useQuery({
    queryKey: ['pagos', 'overdue'],
    queryFn: () => pagosService.getOverdue(),
    enabled: !isProfesional,
  });
  const overduePagos = isProfesional ? allPagos.filter((p) => p.estado === 'vencido') : overduePagosFromApi;

  // Filtrar pagos por estado para las tabs
  const pagosByEstado = useMemo(() => {
    return {
      vencidos: overduePagos,
      pendientes: pendingPagos,
      pagados: allPagos.filter(p => p.estado === 'pagado'),
      todos: allPagos,
    };
  }, [allPagos, pendingPagos, overduePagos]);

  // Profesional: fijar filtro a su propio id y no permitir cambiar
  useEffect(() => {
    if (isProfesional && profesionalLogueado?.id) setFilterProfesionalId(profesionalLogueado.id);
  }, [isProfesional, profesionalLogueado?.id]);

  // Lista de profesionales para contratos: si es profesional solo ve el suyo
  const profesionalesParaContrato = useMemo(
    () => (isProfesional && profesionalLogueado ? [profesionalLogueado] : profesionales),
    [isProfesional, profesionalLogueado, profesionales]
  );

  // Filtrar por profesional y estado
  const filteredPagos = useMemo(() => {
    const pagosActuales = pagosByEstado[activeTab as keyof typeof pagosByEstado] || [];
    if (filterProfesionalId === 'all' || !filterProfesionalId) return pagosActuales;
    return pagosActuales.filter(p => p.profesional_id === filterProfesionalId);
  }, [pagosByEstado, activeTab, filterProfesionalId]);

  // Períodos que ya tienen orden de pago para el profesional seleccionado (modal crear)
  const existingPeriodsForSelectedProf = useMemo(() => {
    if (!createFormData.profesional_id) return new Set<string>();
    return new Set(
      allPagos
        .filter(p => p.profesional_id === createFormData.profesional_id)
        .map(p => (p.periodo || '').trim().slice(0, 10))
    );
  }, [allPagos, createFormData.profesional_id]);

  // Opciones de período disponibles (excluyendo los que ya tienen orden)
  const availablePeriodOptions = useMemo(() => {
    const prof = profesionales.find(p => p.id === createFormData.profesional_id);
    const all = getPeriodOptions(prof);
    return all.filter(opt => !existingPeriodsForSelectedProf.has(opt.value));
  }, [profesionales, createFormData.profesional_id, existingPeriodsForSelectedProf]);

  // Si el período seleccionado ya tiene orden (ej. creada en otra pestaña), limpiar selección
  useEffect(() => {
    if (!createFormData.profesional_id || !createFormData.periodo) return;
    const stillAvailable = availablePeriodOptions.some(o => o.value === createFormData.periodo);
    if (!stillAvailable) setCreateFormData(prev => ({ ...prev, periodo: '' }));
  }, [createFormData.profesional_id, createFormData.periodo, availablePeriodOptions]);

  const formatCurrency = (amount: number | string) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num);
  };

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: CreatePagoData) => pagosService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pagos'] });
      queryClient.invalidateQueries({ queryKey: ['profesionales'] });
      reactToastify.success('Orden de pago generada correctamente', {
        position: 'top-right',
        autoClose: 3000,
      });
      setShowCreateModal(false);
      setCreateFormData({
        profesional_id: '',
        periodo: '',
        monto: 0,
        observaciones: '',
      });
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message || 'Error al registrar pago';
      reactToastify.error(errorMessage, {
        position: 'top-right',
        autoClose: 3000,
      });
    },
  });

  // Mark as paid mutation
  const markAsPaidMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: MarkAsPaidData }) =>
      pagosService.markAsPaid(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pagos'] });
      queryClient.invalidateQueries({ queryKey: ['profesionales'] });
      reactToastify.success('Pago marcado como pagado correctamente', {
        position: 'top-right',
        autoClose: 3000,
      });
      setShowPayModal(false);
      setSelectedPago(null);
      setPayFormData({
        fecha_pago: format(new Date(), 'yyyy-MM-dd'),
        metodo_pago: '',
        observaciones: '',
      });
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message || 'Error al marcar pago como pagado';
      reactToastify.error(errorMessage, {
        position: 'top-right',
        autoClose: 3000,
      });
    },
  });

  // Actualizar contrato del profesional
  const updateContratoMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateProfesionalData }) =>
      profesionalesService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profesionales'] });
      reactToastify.success('Contrato actualizado correctamente', {
        position: 'top-right',
        autoClose: 3000,
      });
      setShowEditContratoModal(false);
      setContratoEditando(null);
    },
    onError: (error: any) => {
      reactToastify.error(error.response?.data?.message || 'Error al actualizar contrato', {
        position: 'top-right',
        autoClose: 3000,
      });
    },
  });

  // Quitar contrato (limpiar fecha y monto)
  const eliminarContratoMutation = useMutation({
    mutationFn: (id: string) =>
      profesionalesService.update(id, { fecha_inicio_contrato: undefined, monto_mensual: undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profesionales'] });
      reactToastify.success('Contrato eliminado', {
        position: 'top-right',
        autoClose: 3000,
      });
      setShowEliminarContratoConfirm(false);
      setContratoToEliminar(null);
    },
    onError: (error: any) => {
      reactToastify.error(error.response?.data?.message || 'Error al eliminar contrato', {
        position: 'top-right',
        autoClose: 3000,
      });
    },
  });

  const handleCreate = async () => {
    const monto = createFormData.profesional_id
      ? (profesionales.find((p) => p.id === createFormData.profesional_id)?.monto_mensual ?? 0)
      : 0;
    if (!createFormData.profesional_id || !createFormData.periodo?.trim() || monto <= 0) {
      reactToastify.error('Seleccione un profesional con contrato y un período', {
        position: 'top-right',
        autoClose: 3000,
      });
      return;
    }
    setIsSubmitting(true);
    try {
      await createMutation.mutateAsync({
        profesional_id: createFormData.profesional_id,
        periodo: createFormData.periodo,
        monto,
        // Sin metodo_pago: la orden se genera en pendiente; se indica al marcar como pagada
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePay = (pago: Pago) => {
    setSelectedPago(pago);
    setPayFormData({
      fecha_pago: format(new Date(), 'yyyy-MM-dd'),
      metodo_pago: '',
      observaciones: '',
    });
    setShowPayModal(true);
  };

  const handlePaySubmit = async () => {
    if (!selectedPago || !payFormData.fecha_pago?.trim() || !payFormData.metodo_pago?.trim()) {
      reactToastify.error('Indique la fecha del pago y el método de pago', {
        position: 'top-right',
        autoClose: 3000,
      });
      return;
    }
    setIsSubmitting(true);
    try {
      // Enviar fecha con noon UTC para evitar desfase de un día en la BD
      const data: MarkAsPaidData = {
        ...payFormData,
        fecha_pago: `${payFormData.fecha_pago}T12:00:00.000Z`,
      };
      await markAsPaidMutation.mutateAsync({
        id: selectedPago.id,
        data,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const normalizeFechaInicioForInput = (value: string | undefined | null): string => {
    if (value == null || value === '') return '';
    const trimmed = String(value).trim();
    return trimmed.length >= 10 ? trimmed.slice(0, 10) : trimmed;
  };

  const handleOpenEditContrato = (prof: Profesional) => {
    setContratoEditando(prof);
    // Formatear el número directamente (como en Usuarios) para evitar malinterpretar strings o decimales
    const num = prof.monto_mensual != null ? Number(prof.monto_mensual) : null;
    const montoDisplay = num != null && num > 0
      ? `$ ${new Intl.NumberFormat('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num)}`
      : '';
    setEditContratoForm({
      fecha_inicio_contrato: normalizeFechaInicioForInput(prof.fecha_inicio_contrato) || '',
      monto_mensual: montoDisplay,
      tipo_periodo_pago: prof.tipo_periodo_pago || 'mensual',
    });
    setShowEditContratoModal(true);
  };

  const handleSubmitEditContrato = async () => {
    if (!contratoEditando) return;
    const fechaInicio = editContratoForm.fecha_inicio_contrato?.trim();
    const monto = parseValorToNumber(editContratoForm.monto_mensual);
    const payload: UpdateProfesionalData = {
      fecha_inicio_contrato: fechaInicio ? `${fechaInicio}T12:00:00.000Z` : undefined,
      monto_mensual: monto !== undefined ? monto : undefined,
      tipo_periodo_pago: editContratoForm.tipo_periodo_pago,
    };
    await updateContratoMutation.mutateAsync({ id: contratoEditando.id, data: payload });
  };

  const handleConfirmEliminarContrato = async () => {
    if (!contratoToEliminar) return;
    await eliminarContratoMutation.mutateAsync(contratoToEliminar.id);
  };

  const isLoading = isProfesional ? isLoadingAll : (isLoadingAll || isLoadingPending || isLoadingOverdue);
  const canCreate = hasPermission(user, 'pagos.crear');
  const canMarkPaid = hasPermission(user, 'pagos.marcar_pagado');
  const canUpdatePago = hasPermission(user, 'pagos.actualizar');

  // Eliminar orden de pago
  const [pagoToDelete, setPagoToDelete] = useState<Pago | null>(null);
  const [showDeletePagoConfirm, setShowDeletePagoConfirm] = useState(false);
  const deletePagoMutation = useMutation({
    mutationFn: (id: string) => pagosService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pagos'] });
      reactToastify.success('Orden de pago eliminada', { position: 'top-right', autoClose: 3000 });
      setShowDeletePagoConfirm(false);
      setPagoToDelete(null);
    },
    onError: (error: unknown) => {
      const msg = (error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Error al eliminar';
      reactToastify.error(msg, { position: 'top-right', autoClose: 3000 });
    },
  });
  const updatePagoMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { estado: 'vencido' } }) => pagosService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pagos'] });
      reactToastify.success('Orden marcada en mora', { position: 'top-right', autoClose: 3000 });
    },
    onError: (error: unknown) => {
      const msg = (error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Error al actualizar';
      reactToastify.error(msg, { position: 'top-right', autoClose: 3000 });
    },
  });

  const handleMora = (pago: Pago) => {
    updatePagoMutation.mutate({ id: pago.id, data: { estado: 'vencido' } });
  };
  const handleDeletePago = (pago: Pago) => {
    setPagoToDelete(pago);
    setShowDeletePagoConfirm(true);
  };
  const handleConfirmDeletePago = async () => {
    if (!pagoToDelete) return;
    await deletePagoMutation.mutateAsync(pagoToDelete.id);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[32px] font-bold text-[#111827] font-['Poppins'] leading-tight tracking-[-0.02em] mb-0">
            Contratos y Pagos
          </h1>
          <p className="text-base text-[#6B7280] mt-2 font-['Inter']">
            Contratos por profesional y pagos
          </p>
        </div>
        {activeMainTab === 'pagos' && canCreate && (
          <Button
            onClick={() => setShowCreateModal(true)}
            className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-md shadow-[#2563eb]/20 hover:shadow-lg hover:shadow-[#2563eb]/30 transition-all duration-200 rounded-[12px] px-6 py-3 h-auto font-medium"
          >
            <Plus className="h-5 w-5 mr-2 stroke-[2]" />
            Generar orden de pago
          </Button>
        )}
      </div>

      {/* Pestañas principales: Contrato por profesional | Pagos */}
      <Tabs value={activeMainTab} onValueChange={(v) => setActiveMainTab(v as 'contrato' | 'pagos')} className="space-y-6">
        <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-[12px] p-1.5 inline-flex">
          <TabsList className="bg-transparent p-0 h-auto gap-1">
            <TabsTrigger value="pagos" className="rounded-[10px] px-5 py-2.5 text-[14px] font-medium font-['Inter'] text-[#6B7280] hover:text-[#374151] data-[state=active]:bg-[#2563eb] data-[state=active]:text-white data-[state=active]:[&_svg]:text-white data-[state=active]:shadow-sm transition-all duration-200">
              <CreditCard className="h-4 w-4 mr-2 stroke-[2]" />
              Órdenes de pago
            </TabsTrigger>
            <TabsTrigger value="contrato" className="rounded-[10px] px-5 py-2.5 text-[14px] font-medium font-['Inter'] text-[#6B7280] hover:text-[#374151] data-[state=active]:bg-[#2563eb] data-[state=active]:text-white data-[state=active]:[&_svg]:text-white data-[state=active]:shadow-sm transition-all duration-200">
              <FileText className="h-4 w-4 mr-2 stroke-[2]" />
              Contrato por profesional
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="contrato" className="mt-0">
          {isLoadingProfesionales ? (
            <Card className="border border-[#E5E7EB] rounded-[16px] shadow-sm">
              <CardContent className="p-16 text-center">
                <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-[#2563eb]" />
                <p className="text-[#6B7280] font-['Inter'] text-base">Cargando contratos...</p>
              </CardContent>
            </Card>
          ) : profesionalesParaContrato.length === 0 ? (
            <Card className="border border-[#E5E7EB] rounded-[16px] shadow-sm">
              <CardContent className="p-16 text-center">
                <div className="h-20 w-20 rounded-full bg-[#dbeafe] flex items-center justify-center mx-auto mb-4">
                  <FileText className="h-10 w-10 text-[#2563eb] stroke-[2]" />
                </div>
                <h3 className="text-lg font-semibold mb-2 text-[#374151] font-['Inter']">No hay profesionales</h3>
                <p className="text-[#6B7280] font-['Inter']">Los contratos se configuran desde Usuarios al editar un profesional (valor y fecha de inicio).</p>
              </CardContent>
            </Card>
          ) : (
            <ContratosTable
              profesionales={profesionalesParaContrato}
              formatCurrency={formatCurrency}
              onEdit={handleOpenEditContrato}
              onEliminar={(p) => { setContratoToEliminar(p); setShowEliminarContratoConfirm(true); }}
              canEditContrato={!isProfesional}
            />
          )}
        </TabsContent>

        <TabsContent value="pagos" className="mt-0 space-y-6">
          <Card className="border border-[#E5E7EB] rounded-[16px] shadow-sm">
            <CardContent className="p-6">
              <div className={`grid gap-6 max-w-2xl ${isProfesional ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
                {!isProfesional && (
                <div className="space-y-2">
                  <Label className="text-[14px] font-medium text-[#374151] font-['Inter']">Profesionales</Label>
                  <Select value={filterProfesionalId} onValueChange={setFilterProfesionalId}>
                    <SelectTrigger className="h-12 w-full border-[1.5px] border-[#D1D5DB] rounded-[10px] font-['Inter'] text-[16px] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200">
                      <SelectValue placeholder="Todos los profesionales" />
                    </SelectTrigger>
                    <SelectContent className="rounded-[12px] border-[#E5E7EB] shadow-xl max-h-[300px]">
                      <SelectItem value="all" className="rounded-[8px] font-['Inter'] text-[15px] py-3">
                        Todos los profesionales
                      </SelectItem>
                      {profesionales.map((prof) => (
                        <SelectItem key={prof.id} value={prof.id} className="rounded-[8px] font-['Inter'] text-[15px] py-3">
                          {prof.nombre} {prof.apellido}
                          {prof.especialidad ? ` — ${prof.especialidad}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                )}
                <div className="space-y-2">
                  <Label className="text-[14px] font-medium text-[#374151] font-['Inter']">Estado</Label>
                  <Select value={activeTab} onValueChange={setActiveTab}>
                    <SelectTrigger className="h-12 w-full border-[1.5px] border-[#D1D5DB] rounded-[10px] font-['Inter'] text-[16px] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200">
                      <SelectValue placeholder="Todos los estados" />
                    </SelectTrigger>
                    <SelectContent className="rounded-[12px] border-[#E5E7EB] shadow-xl">
                      <SelectItem value="todos" className="rounded-[8px] font-['Inter'] text-[15px] py-3">
                        Todos los estados
                      </SelectItem>
                      <SelectItem value="vencidos" className="rounded-[8px] font-['Inter'] text-[15px] py-3">
                        Vencidos
                        {pagosByEstado.vencidos.length > 0 && ` (${pagosByEstado.vencidos.length})`}
                      </SelectItem>
                      <SelectItem value="pendientes" className="rounded-[8px] font-['Inter'] text-[15px] py-3">
                        Pendientes
                        {pagosByEstado.pendientes.length > 0 && ` (${pagosByEstado.pendientes.length})`}
                      </SelectItem>
                      <SelectItem value="pagados" className="rounded-[8px] font-['Inter'] text-[15px] py-3">
                        Pagados
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
          {isLoading ? (
            <Card className="border border-[#E5E7EB] rounded-[16px] shadow-sm">
              <CardContent className="p-16 text-center">
                <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-[#2563eb]" />
                <p className="text-[#6B7280] font-['Inter'] text-base">Cargando pagos...</p>
              </CardContent>
            </Card>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-0">
              <TabsContent value="vencidos" className="mt-0">
                <PagosTable pagos={filteredPagos} formatCurrency={formatCurrency} showPayButton={canMarkPaid} onPay={handlePay} onMora={canUpdatePago ? handleMora : undefined} onDelete={canUpdatePago ? handleDeletePago : undefined} />
              </TabsContent>
              <TabsContent value="pendientes" className="mt-0">
                <PagosTable pagos={filteredPagos} formatCurrency={formatCurrency} showPayButton={canMarkPaid} onPay={handlePay} onMora={canUpdatePago ? handleMora : undefined} onDelete={canUpdatePago ? handleDeletePago : undefined} />
              </TabsContent>
              <TabsContent value="pagados" className="mt-0">
                <PagosTable pagos={filteredPagos} formatCurrency={formatCurrency} showPayButton={false} onDelete={canUpdatePago ? handleDeletePago : undefined} />
              </TabsContent>
              <TabsContent value="todos" className="mt-0">
                <PagosTable pagos={filteredPagos} formatCurrency={formatCurrency} showPayButton={canMarkPaid} onPay={handlePay} onMora={canUpdatePago ? handleMora : undefined} onDelete={canUpdatePago ? handleDeletePago : undefined} />
              </TabsContent>
            </Tabs>
          )}
        </TabsContent>
      </Tabs>

      {/* Modal Crear Pago */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-[700px] rounded-[20px] p-0 border border-[#E5E7EB] shadow-2xl flex flex-col max-h-[90vh]">
          <DialogHeader className="px-8 pt-8 pb-6 mb-0 border-b border-[#E5E7EB] bg-gradient-to-b from-white to-[#F9FAFB] flex-shrink-0 [&>div]:m-0">
            <div className="flex items-center gap-4 m-0">
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] flex items-center justify-center shadow-lg shadow-[#2563eb]/20 flex-shrink-0">
                <Plus className="h-6 w-6 text-white stroke-[2]" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-[28px] font-bold text-[#111827] font-['Poppins'] leading-tight mb-0">
                  Generar orden de pago
                </DialogTitle>
                <DialogDescription className="text-sm text-[#6B7280] font-['Inter'] mt-1 mb-0 line-clamp-2">
                  Orden en pendiente. Método y fecha al marcarla como pagada.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto px-8 py-6 flex flex-col gap-5">
            <div className="space-y-3">
              <Label htmlFor="profesional_id" className="text-[15px] font-medium text-[#374151] font-['Inter'] flex items-center gap-2">
                <User className="h-4 w-4 text-[#6B7280] stroke-[2]" />
                Profesional
                <span className="text-[#EF4444]">*</span>
              </Label>
              <Select
                value={createFormData.profesional_id}
                onValueChange={(value) => setCreateFormData({ ...createFormData, profesional_id: value, periodo: '' })}
              >
                <SelectTrigger className="h-[52px] border-[1.5px] border-[#D1D5DB] rounded-[10px] font-['Inter'] text-[16px] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200">
                  <SelectValue placeholder="Seleccionar profesional" />
                </SelectTrigger>
                <SelectContent className="rounded-[12px] border-[#E5E7EB] shadow-xl max-h-[300px]">
                  {profesionales.map((prof) => (
                    <SelectItem key={prof.id} value={prof.id} className="rounded-[8px] font-['Inter'] text-[15px] py-3">
                      {prof.nombre} {prof.apellido} {prof.especialidad ? `- ${prof.especialidad}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Monto y Período: se muestran siempre en el mismo lugar; al elegir profesional se rellenan */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-3">
                <Label className="text-[15px] font-medium text-[#374151] font-['Inter'] flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-[#6B7280] stroke-[2]" />
                  Monto
                </Label>
                <div className="h-[52px] flex items-center px-4 border-[1.5px] border-[#D1D5DB] rounded-[10px] bg-[#F9FAFB] font-['Inter'] text-[16px] text-[#374151]">
                  {createFormData.profesional_id ? (() => {
                    const prof = profesionales.find((p) => p.id === createFormData.profesional_id);
                    const monto = prof?.monto_mensual;
                    if (monto != null && monto > 0) return formatCurrency(monto);
                    return <span className="text-[#EF4444]">Sin monto en contrato</span>;
                  })() : (
                    <span className="text-[#9CA3AF]">Seleccione un profesional</span>
                  )}
                </div>
              </div>
              <div className="space-y-3">
                <Label htmlFor="periodo" className="text-[15px] font-medium text-[#374151] font-['Inter'] flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-[#6B7280] stroke-[2]" />
                  Período
                  <span className="text-[#EF4444]">*</span>
                </Label>
                <Select
                  value={createFormData.periodo}
                  onValueChange={(value) => setCreateFormData({ ...createFormData, periodo: value })}
                  disabled={!createFormData.profesional_id || availablePeriodOptions.length === 0}
                >
                  <SelectTrigger className="h-[52px] border-[1.5px] border-[#D1D5DB] rounded-[10px] font-['Inter'] text-[16px] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200">
                    <SelectValue placeholder={!createFormData.profesional_id ? 'Seleccione profesional' : availablePeriodOptions.length === 0 ? 'Sin períodos disponibles' : 'Seleccionar período'} />
                  </SelectTrigger>
                  <SelectContent className="rounded-[12px] border-[#E5E7EB] shadow-xl max-h-[300px]">
                    {availablePeriodOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className="rounded-[8px] font-['Inter'] text-[15px] py-3">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-xs text-[#6B7280] font-['Inter'] min-h-[1.25rem]">
              {createFormData.profesional_id && availablePeriodOptions.length === 0
                ? 'Todos los períodos ya tienen una orden de pago.'
                : 'Si querés que aparezca otro valor en la orden de pago, debés modificar el contrato del profesional.'}
            </p>
          </div>

          <DialogFooter className="px-8 py-5 mt-0 border-t border-[#E5E7EB] bg-[#F9FAFB] flex flex-row justify-end items-center gap-3 flex-shrink-0 [&>div]:m-0">
            <Button
              variant="outline"
              onClick={() => setShowCreateModal(false)}
              className="h-[48px] px-6 rounded-[12px] border-[1.5px] border-[#D1D5DB] font-medium font-['Inter'] text-[15px] hover:bg-white hover:border-[#9CA3AF] transition-all duration-200"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreate}
              disabled={isSubmitting}
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
                  Generar orden de pago
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Marcar como Pagado */}
      <Dialog open={showPayModal} onOpenChange={setShowPayModal}>
        <DialogContent className="max-w-[600px] rounded-[20px] p-0 border border-[#E5E7EB] shadow-2xl flex flex-col max-h-[90vh]">
          <DialogHeader className="px-8 pt-8 pb-6 mb-0 border-b border-[#E5E7EB] bg-gradient-to-b from-white to-[#F9FAFB] flex-shrink-0 [&>div]:m-0">
            <div className="flex items-center gap-4 m-0">
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] flex items-center justify-center shadow-lg shadow-[#2563eb]/20 flex-shrink-0">
                <CheckCircle2 className="h-6 w-6 text-white stroke-[2]" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-[28px] font-bold text-[#111827] font-['Poppins'] leading-tight mb-0">
                  Marcar como Pagado
                </DialogTitle>
                <DialogDescription className="text-sm text-[#6B7280] font-['Inter'] mt-1 mb-0 line-clamp-2">
                  {selectedPago && (
                    <>
                      {selectedPago.profesional_nombre} {selectedPago.profesional_apellido} — {formatPeriodoDisplay(selectedPago)} — {formatCurrency(selectedPago.monto)}. Indique método y fecha de pago.
                    </>
                  )}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto px-8 py-6 flex flex-col gap-5">
            <div className="space-y-3 relative" ref={payDatePickerRef}>
              <Label className="text-[15px] font-medium text-[#374151] font-['Inter'] flex items-center gap-2">
                <Calendar className="h-4 w-4 text-[#6B7280] stroke-[2]" />
                Fecha de Pago
                <span className="text-[#EF4444]">*</span>
              </Label>
              <button
                ref={payDatePickerButtonRef}
                type="button"
                onClick={() => {
                  const willOpen = !payDatePickerOpen;
                  setPayDatePickerOpen(willOpen);
                  if (willOpen) {
                    setPayDatePickerMonth(payFormData.fecha_pago ? startOfMonth(new Date(payFormData.fecha_pago + 'T12:00:00')) : startOfMonth(new Date()));
                    setPayDatePickerAnchor(payDatePickerButtonRef.current?.getBoundingClientRect() ?? null);
                  } else {
                    setPayDatePickerAnchor(null);
                  }
                }}
                className="h-[52px] w-full flex items-center gap-2 px-4 border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[16px] font-['Inter'] text-left bg-white focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200 hover:border-[#9CA3AF]"
              >
                <Calendar className="h-4 w-4 text-[#6B7280] stroke-[2] flex-shrink-0" />
                <span className="text-[#374151]">
                  {payFormData.fecha_pago
                    ? format(new Date(payFormData.fecha_pago + 'T12:00:00'), "d 'de' MMMM yyyy", { locale: es })
                    : 'Seleccionar fecha'}
                </span>
                <ChevronRight className={`h-4 w-4 text-[#6B7280] ml-auto transition-transform ${payDatePickerOpen ? 'rotate-90' : ''}`} />
              </button>
            </div>

            <div className="space-y-3">
              <Label htmlFor="pay-metodo_pago" className="text-[15px] font-medium text-[#374151] font-['Inter'] flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-[#6B7280] stroke-[2]" />
                Método de Pago
                <span className="text-[#EF4444]">*</span>
              </Label>
              <Select
                value={payFormData.metodo_pago}
                onValueChange={(value) => setPayFormData({ ...payFormData, metodo_pago: value })}
              >
                <SelectTrigger className="h-[52px] border-[1.5px] border-[#D1D5DB] rounded-[10px] font-['Inter'] text-[16px] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200">
                  <SelectValue placeholder="Seleccionar método (obligatorio)" />
                </SelectTrigger>
                <SelectContent className="rounded-[12px] border-[#E5E7EB] shadow-xl">
                  {METODOS_PAGO.map((metodo) => (
                    <SelectItem key={metodo} value={metodo} className="rounded-[8px] font-['Inter'] text-[15px] py-3">
                      {metodo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="px-8 py-5 mt-0 border-t border-[#E5E7EB] bg-[#F9FAFB] flex flex-row justify-end items-center gap-3 flex-shrink-0 [&>div]:m-0">
            <Button
              variant="outline"
              onClick={() => setShowPayModal(false)}
              className="h-[48px] px-6 rounded-[12px] border-[1.5px] border-[#D1D5DB] font-medium font-['Inter'] text-[15px] hover:bg-white hover:border-[#9CA3AF] transition-all duration-200"
            >
              Cancelar
            </Button>
            <Button
              onClick={handlePaySubmit}
              disabled={isSubmitting}
              className="h-[48px] px-8 rounded-[12px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-lg shadow-[#2563eb]/30 hover:shadow-xl hover:shadow-[#2563eb]/40 hover:scale-[1.02] font-semibold font-['Inter'] text-[15px] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin stroke-[2.5]" />
                  Guardando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-5 w-5 stroke-[2]" />
                  Confirmar Pago
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Editar Contrato */}
      <Dialog open={showEditContratoModal} onOpenChange={setShowEditContratoModal}>
        <DialogContent className="max-w-[640px] rounded-[20px] p-0 border border-[#E5E7EB] shadow-2xl">
          <DialogHeader className="px-8 pt-8 pb-6 mb-0 border-b border-[#E5E7EB] bg-gradient-to-b from-white to-[#F9FAFB] [&>div]:m-0">
            <div className="flex items-center gap-4 m-0">
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] flex items-center justify-center shadow-lg shadow-[#2563eb]/20 flex-shrink-0">
                <FileText className="h-6 w-6 text-white stroke-[2]" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-[28px] font-bold text-[#111827] font-['Poppins'] leading-tight mb-0">
                  Editar contrato
                </DialogTitle>
                <DialogDescription className="text-sm text-[#6B7280] font-['Inter'] mt-1 mb-0">
                  {contratoEditando ? `${contratoEditando.nombre} ${contratoEditando.apellido}` : ''}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="px-8 py-6 space-y-5">
            <div className="space-y-3">
              <Label htmlFor="edit-contrato-fecha" className="text-[15px] font-medium text-[#374151] font-['Inter']">
                Fecha de inicio
              </Label>
              <Input
                id="edit-contrato-fecha"
                type="date"
                value={editContratoForm.fecha_inicio_contrato}
                onChange={(e) => setEditContratoForm((f) => ({ ...f, fecha_inicio_contrato: e.target.value }))}
                className="h-[52px] border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[16px] font-['Inter'] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-3">
                <Label className="text-[15px] font-medium text-[#374151] font-['Inter']">
                  Monto
                </Label>
                <Input
                  id="edit-contrato-monto"
                  type="text"
                  inputMode="decimal"
                  value={editContratoForm.monto_mensual}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^\d,.]/g, '');
                    setEditContratoForm((f) => ({ ...f, monto_mensual: v }));
                  }}
                  onBlur={() => {
                    if (editContratoForm.monto_mensual.trim()) {
                      const formatted = formatValorDisplay(editContratoForm.monto_mensual);
                      if (formatted !== '') setEditContratoForm((f) => ({ ...f, monto_mensual: formatted }));
                    }
                  }}
                  onFocus={(e) => {
                    const current = (e.target as HTMLInputElement).value;
                    const n = parseValorToNumber(current);
                    if (n !== undefined) {
                      requestAnimationFrame(() => {
                        setEditContratoForm((f) => ({ ...f, monto_mensual: String(n) }));
                      });
                    }
                  }}
                  placeholder="$ 0"
                  className="h-[52px] border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[16px] font-['Inter'] placeholder:text-[#9CA3AF] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200"
                />
              </div>
              <div className="space-y-3">
                <Label className="text-[15px] font-medium text-[#374151] font-['Inter']">
                  Período
                </Label>
                <Select
                  value={editContratoForm.tipo_periodo_pago}
                  onValueChange={(v: 'mensual' | 'quincenal' | 'semanal') => setEditContratoForm((f) => ({ ...f, tipo_periodo_pago: v }))}
                >
                  <SelectTrigger className="h-[52px] border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[16px] font-['Inter'] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-[12px] border-[#E5E7EB] shadow-xl">
                    <SelectItem value="mensual" className="rounded-[8px] font-['Inter'] text-[15px] py-3">Mensual</SelectItem>
                    <SelectItem value="quincenal" className="rounded-[8px] font-['Inter'] text-[15px] py-3">Quincenal</SelectItem>
                    <SelectItem value="semanal" className="rounded-[8px] font-['Inter'] text-[15px] py-3">Semanal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter className="px-8 py-5 mt-0 border-t border-[#E5E7EB] bg-[#F9FAFB] flex flex-row justify-end items-center gap-3 [&>div]:m-0">
            <Button
              variant="outline"
              onClick={() => setShowEditContratoModal(false)}
              className="h-[48px] px-6 rounded-[12px] border-[1.5px] border-[#D1D5DB] font-medium font-['Inter'] text-[15px] hover:bg-white hover:border-[#9CA3AF] transition-all duration-200"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmitEditContrato}
              disabled={updateContratoMutation.isPending}
              className="h-[48px] px-8 rounded-[12px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-lg shadow-[#2563eb]/30 hover:shadow-xl hover:shadow-[#2563eb]/40 font-semibold font-['Inter'] text-[15px] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {updateContratoMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Calendario Fecha de Pago (portal) */}
      {payDatePickerOpen && payDatePickerAnchor && createPortal(
        <div
          data-pay-calendar-portal
          className="bg-white border border-[#E5E7EB] rounded-[16px] shadow-xl p-4 z-[9999] pointer-events-auto min-w-[280px] max-w-[450px]"
          style={{ position: 'fixed', top: payDatePickerAnchor.bottom + 8, left: payDatePickerAnchor.left, width: Math.min(Math.max(payDatePickerAnchor.width, 280), 450) }}
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-[16px] font-semibold text-[#111827] font-['Poppins']">
              {format(payDatePickerMonth, 'MMMM yyyy', { locale: es }).charAt(0).toUpperCase() + format(payDatePickerMonth, 'MMMM yyyy', { locale: es }).slice(1)}
            </span>
            <div className="flex gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-[8px] hover:bg-[#dbeafe] text-[#2563eb]"
                onClick={() => setPayDatePickerMonth((m) => subMonths(m, 1))}
              >
                <ChevronLeft className="h-4 w-4 stroke-[2]" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-[8px] hover:bg-[#dbeafe] text-[#2563eb]"
                onClick={() => setPayDatePickerMonth((m) => addMonths(m, 1))}
              >
                <ChevronRight className="h-4 w-4 stroke-[2]" />
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'].map((d) => (
              <span key={d} className="text-[11px] font-medium text-[#6B7280] font-['Inter'] py-1">{d}</span>
            ))}
            {(() => {
              const monthStart = payDatePickerMonth;
              const monthEnd = endOfMonth(payDatePickerMonth);
              const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
              const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
              const days = eachDayOfInterval({ start: calStart, end: calEnd });
              const selectedDate = payFormData.fecha_pago ? new Date(payFormData.fecha_pago + 'T12:00:00') : null;
              return days.map((day) => {
                const isCurrentMonth = isSameMonth(day, payDatePickerMonth);
                const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => {
                      setPayFormData((prev) => ({ ...prev, fecha_pago: format(day, 'yyyy-MM-dd') }));
                      setPayDatePickerMonth(startOfMonth(day));
                      setPayDatePickerOpen(false);
                      setPayDatePickerAnchor(null);
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

      <ConfirmDeleteModal
        open={showEliminarContratoConfirm}
        onOpenChange={(open) => { setShowEliminarContratoConfirm(open); if (!open) setContratoToEliminar(null); }}
        title="Eliminar contrato"
        description={<>¿Estás seguro de que deseas quitar el contrato de <span className="font-semibold text-[#374151]">{contratoToEliminar ? `${contratoToEliminar.nombre} ${contratoToEliminar.apellido}` : ''}</span>? Se borrarán la fecha de inicio y el monto mensual.</>}
        onConfirm={handleConfirmEliminarContrato}
        isLoading={eliminarContratoMutation.isPending}
      />

      <ConfirmDeleteModal
        open={showDeletePagoConfirm}
        onOpenChange={(open) => { setShowDeletePagoConfirm(open); if (!open) setPagoToDelete(null); }}
        title="Eliminar orden de pago"
        description={<>¿Estás seguro de que deseas eliminar la orden de <span className="font-semibold text-[#374151]">{pagoToDelete ? `${pagoToDelete.profesional_nombre} ${pagoToDelete.profesional_apellido} — ${formatPeriodoDisplay(pagoToDelete)}` : ''}</span>? Esta acción no se puede deshacer.</>}
        onConfirm={handleConfirmDeletePago}
        isLoading={deletePagoMutation.isPending}
      />
    </div>
  );
}

interface ContratosTableProps {
  profesionales: Profesional[];
  formatCurrency: (amount: number | string) => string;
  onEdit: (p: Profesional) => void;
  onEliminar: (p: Profesional) => void;
  canEditContrato?: boolean;
}

function ContratosTable({ profesionales, formatCurrency, onEdit, onEliminar, canEditContrato = true }: ContratosTableProps) {
  const tieneContrato = (p: Profesional) =>
    (p.fecha_inicio_contrato && p.fecha_inicio_contrato.trim() !== '') || (p.monto_mensual != null && p.monto_mensual > 0);

  return (
    <Card className="border border-[#E5E7EB] rounded-[16px] shadow-sm overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-[#F9FAFB] border-b-2 border-[#E5E7EB] hover:bg-[#F9FAFB]">
            <TableHead className="font-['Inter'] font-medium text-[14px] text-[#374151] py-4">Profesional</TableHead>
            <TableHead className="font-['Inter'] font-medium text-[14px] text-[#374151] py-4">Especialidad</TableHead>
            <TableHead className="font-['Inter'] font-medium text-[14px] text-[#374151] py-4">Fecha inicio</TableHead>
            <TableHead className="font-['Inter'] font-medium text-[14px] text-[#374151] py-4">Monto</TableHead>
            <TableHead className="font-['Inter'] font-medium text-[14px] text-[#374151] py-4">Período</TableHead>
            <TableHead className="font-['Inter'] font-medium text-[14px] text-[#374151] py-4 w-[120px]">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {profesionales.map((p) => {
            const periodoLabel = { mensual: 'Mensual', quincenal: 'Quincenal', semanal: 'Semanal' }[p.tipo_periodo_pago || 'mensual'];
            return (
            <TableRow key={p.id} className="border-b border-[#E5E7EB] hover:bg-[#F9FAFB]">
              <TableCell className="py-4 font-['Inter'] text-[15px] text-[#374151]">
                {p.nombre} {p.apellido}
              </TableCell>
              <TableCell className="py-4 font-['Inter'] text-[14px] text-[#6B7280]">
                {p.especialidad || '—'}
              </TableCell>
              <TableCell className="py-4 font-['Inter'] text-[14px] text-[#6B7280]">
                {(() => {
                  const raw = p.fecha_inicio_contrato?.trim();
                  if (!raw) return '—';
                  const dateOnly = raw.length >= 10 ? raw.slice(0, 10) : raw;
                  const [y, m, day] = dateOnly.split('-').map(Number);
                  if (!y || !m || !day) return '—';
                  const d = new Date(y, m - 1, day);
                  return Number.isNaN(d.getTime()) ? '—' : format(d, 'dd/MM/yyyy', { locale: es });
                })()}
              </TableCell>
              <TableCell className="py-4 font-['Inter'] text-[15px] font-medium text-[#374151]">
                {p.monto_mensual != null && p.monto_mensual > 0 ? formatCurrency(p.monto_mensual) : '—'}
              </TableCell>
              <TableCell className="py-4 font-['Inter'] text-[14px] text-[#6B7280]">
                {p.monto_mensual != null && p.monto_mensual > 0 ? periodoLabel : '—'}
              </TableCell>
              <TableCell className="py-4 text-right">
                {canEditContrato && (
                <TooltipProvider>
                  <div className="flex items-center justify-end gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onEdit(p)}
                          className="h-8 w-8 rounded-[8px] hover:bg-[#dbeafe] transition-all duration-200 text-[#2563eb] hover:text-[#1d4ed8]"
                        >
                          <Pencil className="h-4 w-4 stroke-[2]" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent className="bg-[#111827] text-white text-xs font-['Inter'] rounded-[8px] px-3 py-2 [&>p]:text-white">
                        <p className="text-white">Editar</p>
                      </TooltipContent>
                    </Tooltip>
                    {tieneContrato(p) && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onEliminar(p)}
                            className="h-8 w-8 rounded-[8px] hover:bg-[#FEE2E2] transition-all duration-200 text-[#EF4444] hover:text-[#DC2626]"
                          >
                            <Trash2 className="h-4 w-4 stroke-[2]" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent className="bg-[#111827] text-white text-xs font-['Inter'] rounded-[8px] px-3 py-2 [&>p]:text-white">
                          <p className="text-white">Eliminar</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </TooltipProvider>
                )}
              </TableCell>
            </TableRow>
          );})}
        </TableBody>
      </Table>
    </Card>
  );
}

interface PagosTableProps {
  pagos: Pago[];
  formatCurrency: (amount: number | string) => string;
  showPayButton?: boolean;
  onPay?: (pago: Pago) => void;
  onMora?: (pago: Pago) => void;
  onDelete?: (pago: Pago) => void;
}

function PagosTable({ pagos, formatCurrency, showPayButton = false, onPay, onMora, onDelete }: PagosTableProps) {
  if (pagos.length === 0) {
    return (
      <Card className="border border-[#E5E7EB] rounded-[16px] shadow-sm">
        <CardContent className="p-16 text-center">
          <div className="h-20 w-20 rounded-full bg-[#dbeafe] flex items-center justify-center mx-auto mb-4">
            <DollarSign className="h-10 w-10 text-[#2563eb] stroke-[2]" />
          </div>
          <h3 className="text-lg font-semibold mb-2 text-[#374151] font-['Inter']">
            No hay órdenes de pago
          </h3>
          <p className="text-[#6B7280] font-['Inter']">
            No hay órdenes en esta categoría
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-[#E5E7EB] rounded-[16px] shadow-sm overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-[#F9FAFB] border-b-2 border-[#E5E7EB] hover:bg-[#F9FAFB]">
            <TableHead className="font-['Inter'] font-medium text-[14px] text-[#374151] py-4">
              Período
            </TableHead>
            <TableHead className="font-['Inter'] font-medium text-[14px] text-[#374151]">
              Profesional
            </TableHead>
            <TableHead className="hidden md:table-cell font-['Inter'] font-medium text-[14px] text-[#374151]">
              Monto
            </TableHead>
            <TableHead className="hidden lg:table-cell font-['Inter'] font-medium text-[14px] text-[#374151]">
              Fecha Pago
            </TableHead>
            <TableHead className="font-['Inter'] font-medium text-[14px] text-[#374151]">
              Estado
            </TableHead>
            <TableHead className="hidden md:table-cell font-['Inter'] font-medium text-[14px] text-[#374151]">
              Método
            </TableHead>
            <TableHead className="font-['Inter'] font-medium text-[14px] text-[#374151] w-[160px]">
              Acciones
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pagos.map((pago) => (
            <TableRow
              key={pago.id}
              className="border-b border-[#E5E7EB] hover:bg-[#F9FAFB] transition-colors duration-150"
            >
              <TableCell className="py-4">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-[#6B7280] stroke-[2]" />
                  <span className="font-medium text-[#374151] font-['Inter'] text-[15px]">
                    {formatPeriodoDisplay(pago)}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 rounded-full bg-gradient-to-br from-[#dbeafe] to-[#bfdbfe] shadow-sm">
                    <AvatarFallback className="bg-transparent text-[#2563eb] font-semibold text-sm">
                      {pago.profesional_nombre?.[0] || ''}{pago.profesional_apellido?.[0] || ''}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-[#374151] font-['Inter'] text-[15px] mb-0">
                      {pago.profesional_nombre} {pago.profesional_apellido}
                    </p>
                    <p className="text-sm text-[#6B7280] md:hidden font-['Inter'] mt-0">
                      {formatCurrency(pago.monto)}
                    </p>
                  </div>
                </div>
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <span className="font-semibold text-[#374151] font-['Inter'] text-[15px]">
                  {formatCurrency(pago.monto)}
                </span>
              </TableCell>
              <TableCell className="hidden lg:table-cell text-[#6B7280] font-['Inter'] text-[14px]">
                {pago.fecha_pago
                  ? format(
                      new Date((pago.fecha_pago as string).slice(0, 10) + 'T12:00:00'),
                      'dd/MM/yyyy',
                      { locale: es }
                    )
                  : '-'}
              </TableCell>
              <TableCell>
                {getEstadoPagoBadge(pago.estado)}
              </TableCell>
              <TableCell className="hidden md:table-cell">
                {pago.metodo_pago ? (
                  <Badge className="bg-[#dbeafe] text-[#2563eb] border-[#bfdbfe] hover:bg-[#bfdbfe] rounded-full px-3 py-1 text-xs font-medium">
                    {pago.metodo_pago}
                  </Badge>
                ) : (
                  <span className="text-[#9CA3AF]">-</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                <TooltipProvider>
                  <div className="flex items-center justify-end gap-1">
                    {showPayButton && (pago.estado === 'pendiente' || pago.estado === 'vencido') && onPay && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" onClick={() => onPay(pago)} className="h-8 w-8 rounded-[8px] hover:bg-[#D1FAE5] transition-all duration-200 text-[#059669] hover:text-[#047857]">
                            <CheckCircle2 className="h-4 w-4 stroke-[2]" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent className="bg-[#111827] text-white text-xs font-['Inter'] rounded-[8px] px-3 py-2 [&>p]:text-white"><p className="text-white">Pagar</p></TooltipContent>
                      </Tooltip>
                    )}
                    {pago.estado === 'pendiente' && onMora && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" onClick={() => onMora(pago)} className="h-8 w-8 rounded-[8px] hover:bg-[#FEF3C7] transition-all duration-200 text-[#D97706] hover:text-[#B45309]">
                            <AlertCircle className="h-4 w-4 stroke-[2]" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent className="bg-[#111827] text-white text-xs font-['Inter'] rounded-[8px] px-3 py-2 [&>p]:text-white"><p className="text-white">Mora</p></TooltipContent>
                      </Tooltip>
                    )}
                    {onDelete && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" onClick={() => onDelete(pago)} className="h-8 w-8 rounded-[8px] hover:bg-[#FEE2E2] transition-all duration-200 text-[#EF4444] hover:text-[#DC2626]">
                            <Trash2 className="h-4 w-4 stroke-[2]" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent className="bg-[#111827] text-white text-xs font-['Inter'] rounded-[8px] px-3 py-2 [&>p]:text-white"><p className="text-white">Eliminar</p></TooltipContent>
                      </Tooltip>
                    )}
                    {pago.comprobante_url && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" asChild className="h-8 w-8 rounded-[8px] hover:bg-[#F3F4F6] transition-all duration-200 text-[#6B7280] hover:text-[#374151]">
                            <a href={pago.comprobante_url} target="_blank" rel="noopener noreferrer"><Eye className="h-4 w-4 stroke-[2]" /></a>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent className="bg-[#111827] text-white text-xs font-['Inter'] rounded-[8px] px-3 py-2 [&>p]:text-white"><p className="text-white">Ver comprobante</p></TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </TooltipProvider>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}