import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ConfirmDeleteModal } from '@/components/shared/ConfirmDeleteModal';
import { Plus, Edit, Trash2, Loader2, StickyNote, Calendar, ChevronLeft, ChevronRight, X, Eye } from 'lucide-react';
import { notasService, type CreateNotaData, type UpdateNotaData } from '@/services/notas.service';
import { pacientesService } from '@/services/pacientes.service';
import type { Nota } from '@/types';
import { toast as reactToastify } from 'react-toastify';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/utils/permissions';
import { formatDisplayText, formatEvolucionDateTime } from '@/lib/utils';
import { AlertCircle } from 'lucide-react';
import { CreateNotaModal, EditNotaModal, ViewNotaModal } from './modals';
import { PAGE_SIZE } from '@/lib/constants';

interface PacienteNotasProps {
  pacienteId: string;
}

export default function PacienteNotas({ pacienteId }: PacienteNotasProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedNota, setSelectedNota] = useState<Nota | null>(null);
  const [notaToDelete, setNotaToDelete] = useState<Nota | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [filterCreadorId, setFilterCreadorId] = useState<string>('todos');
  const [filterFechaDesde, setFilterFechaDesde] = useState<string>('');
  const [filterFechaHasta, setFilterFechaHasta] = useState<string>('');
  const [pageNotas, setPageNotas] = useState(1);

  const [datePickerDesdeOpen, setDatePickerDesdeOpen] = useState(false);
  const [datePickerHastaOpen, setDatePickerHastaOpen] = useState(false);
  const [datePickerDesdeMonth, setDatePickerDesdeMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [datePickerHastaMonth, setDatePickerHastaMonth] = useState<Date>(() => startOfMonth(new Date()));
  const datePickerDesdeButtonRef = useRef<HTMLButtonElement>(null);
  const datePickerHastaButtonRef = useRef<HTMLButtonElement>(null);
  const datePickerDesdeRef = useRef<HTMLDivElement>(null);
  const datePickerHastaRef = useRef<HTMLDivElement>(null);

  const { data: paciente } = useQuery({
    queryKey: ['paciente', pacienteId],
    queryFn: () => pacientesService.getById(pacienteId),
  });

  const isProfesional = user?.rol === 'profesional';
  const isSecretaria = user?.rol === 'secretaria';
  const filtroCreadorFijo = isProfesional || isSecretaria;

  const { data: notasData = [], isLoading } = useQuery({
    queryKey: ['notas', 'paciente', pacienteId, user?.id],
    queryFn: () => {
      if (isProfesional && user?.id) {
        return notasService.getAll({
          paciente_id: pacienteId,
          usuario_id: user.id,
        });
      }
      return notasService.getByPaciente(pacienteId);
    },
    enabled: !isProfesional || !!user?.id,
  });
  const notas = Array.isArray(notasData) ? notasData : [];

  const sortedNotas = useMemo(() => {
    return [...notas].sort((a, b) => {
      const da = a.fecha_creacion ? new Date(a.fecha_creacion).getTime() : 0;
      const db = b.fecha_creacion ? new Date(b.fecha_creacion).getTime() : 0;
      return db - da;
    });
  }, [notas]);

  const filteredNotas = useMemo(() => {
    let list = sortedNotas;
    if (filterCreadorId && filterCreadorId !== 'todos') {
      list = list.filter((n) => n.usuario_id === filterCreadorId);
    }
    if (filterFechaDesde) {
      const desde = new Date(filterFechaDesde + 'T00:00:00').getTime();
      list = list.filter((n) => (n.fecha_creacion ? new Date(n.fecha_creacion).getTime() : 0) >= desde);
    }
    if (filterFechaHasta) {
      const hasta = new Date(filterFechaHasta + 'T23:59:59').getTime();
      list = list.filter((n) => (n.fecha_creacion ? new Date(n.fecha_creacion).getTime() : 0) <= hasta);
    }
    return list;
  }, [sortedNotas, filterCreadorId, filterFechaDesde, filterFechaHasta]);

  const totalNotas = filteredNotas.length;
  const totalPagesNotas = Math.ceil(totalNotas / PAGE_SIZE) || 0;
  const notasPaginadas = useMemo(() => {
    const start = (pageNotas - 1) * PAGE_SIZE;
    return filteredNotas.slice(start, start + PAGE_SIZE);
  }, [filteredNotas, pageNotas]);

  useEffect(() => {
    setPageNotas(1);
  }, [filterCreadorId, filterFechaDesde, filterFechaHasta]);

  const creadoresEnNotas = useMemo(() => {
    const seen = new Set<string>();
    const result: { id: string; nombre: string; apellido: string; especialidad?: string }[] = [];
    for (const n of sortedNotas) {
      if (n.usuario_id && !seen.has(n.usuario_id)) {
        seen.add(n.usuario_id);
        result.push({
          id: n.usuario_id,
          nombre: n.usuario_nombre ?? '',
          apellido: n.usuario_apellido ?? '',
          especialidad: n.especialidad,
        });
      }
    }
    // Profesional y secretaria: el usuario actual siempre debe aparecer en el filtro (aunque no tenga notas aún)
    if (filtroCreadorFijo && user?.id && !seen.has(user.id)) {
      result.unshift({
        id: user.id,
        nombre: user.nombre ?? '',
        apellido: user.apellido ?? '',
      });
    }
    return result;
  }, [sortedNotas, filtroCreadorFijo, user?.id, user?.nombre, user?.apellido]);

  // Profesional y secretaria: fijar filtro al usuario actual y no permitir cambiarlo
  useEffect(() => {
    if (filtroCreadorFijo && user?.id) {
      setFilterCreadorId(user.id);
    }
  }, [filtroCreadorFijo, user?.id]);

  useEffect(() => {
    if (!datePickerDesdeOpen) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (datePickerDesdeButtonRef.current?.contains(target)) return;
      if (datePickerDesdeRef.current?.contains(target)) return;
      if ((e.target as Element).closest?.('[data-calendar-desde-portal]')) return;
      setDatePickerDesdeOpen(false);
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
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [datePickerHastaOpen]);

  const createMutation = useMutation({
    mutationFn: (data: CreateNotaData) => notasService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notas', 'paciente', pacienteId] });
      setShowCreateModal(false);
      reactToastify.success('Nota creada correctamente', {
        position: 'top-right',
        autoClose: 3000,
      });
    },
    onError: (error: any) => {
      const errorData = error.response?.data?.error || {};
      let errorMessage = 'Error al crear nota';
      if (errorData.details && Array.isArray(errorData.details) && errorData.details.length > 0) {
        errorMessage = errorData.details.map((d: any) => d.message).join('. ');
      } else if (errorData.message) {
        errorMessage = errorData.message;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      reactToastify.error(errorMessage, { position: 'top-right', autoClose: 3000 });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateNotaData }) =>
      notasService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notas', 'paciente', pacienteId] });
      setShowEditModal(false);
      setSelectedNota(null);
      reactToastify.success('Nota actualizada correctamente', {
        position: 'top-right',
        autoClose: 3000,
      });
    },
    onError: (error: any) => {
      const errorData = error.response?.data?.error || {};
      let errorMessage = 'Error al actualizar nota';
      if (errorData.details && Array.isArray(errorData.details) && errorData.details.length > 0) {
        errorMessage = errorData.details.map((d: any) => d.message).join('. ');
      } else if (errorData.message) {
        errorMessage = errorData.message;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      reactToastify.error(errorMessage, { position: 'top-right', autoClose: 3000 });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => notasService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notas', 'paciente', pacienteId] });
      reactToastify.success('Nota eliminada correctamente', {
        position: 'top-right',
        autoClose: 3000,
      });
    },
    onError: (error: any) => {
      const errorData = error.response?.data?.error || {};
      let errorMessage = 'Error al eliminar nota';
      if (errorData.details && Array.isArray(errorData.details) && errorData.details.length > 0) {
        errorMessage = errorData.details.map((d: any) => d.message).join('. ');
      } else if (errorData.message) {
        errorMessage = errorData.message;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      reactToastify.error(errorMessage, { position: 'top-right', autoClose: 3000 });
    },
  });

  const handleCreate = async (data: CreateNotaData) => {
    setIsSubmitting(true);
    try {
      await createMutation.mutateAsync(data);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleView = (nota: Nota) => {
    setSelectedNota(nota);
    setShowViewModal(true);
  };

  const handleEdit = (nota: Nota) => {
    setSelectedNota(nota);
    setShowEditModal(true);
  };

  const handleUpdate = async (id: string, data: UpdateNotaData) => {
    setIsSubmitting(true);
    try {
      await updateMutation.mutateAsync({ id, data });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (nota: Nota) => {
    setNotaToDelete(nota);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!notaToDelete) return;
    setIsSubmitting(true);
    try {
      await deleteMutation.mutateAsync(notaToDelete.id);
      setShowDeleteModal(false);
      setNotaToDelete(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const canCreate = hasPermission(user, 'notas.crear');
  const canUpdate = hasPermission(user, 'notas.actualizar');
  const canDelete = hasPermission(user, 'notas.eliminar');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-16">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-[#2563eb]" />
          <p className="text-[#6B7280] font-['Inter']">Cargando notas...</p>
        </div>
      </div>
    );
  }

  const pacienteInactivo = !!(paciente && !paciente.activo);

  return (
    <div className="space-y-6 max-lg:pb-20 max-lg:overflow-x-hidden relative">
      {/* Alerta paciente inactivo */}
      {pacienteInactivo && (
        <Card className="bg-[#FEF3C7] border-[1.5px] border-[#F59E0B] rounded-[16px]">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-[#FDE047] flex items-center justify-center flex-shrink-0">
                <AlertCircle className="h-5 w-5 text-[#92400E] stroke-[2]" />
              </div>
              <div>
                <p className="text-sm text-[#92400E] font-semibold font-['Inter']">
                  Paciente Inactivo
                </p>
                <p className="text-sm text-[#92400E] font-['Inter'] mt-0.5">
                  No se pueden crear nuevas notas para pacientes inactivos.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Header más compacto */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[20px] max-lg:text-[18px] font-bold text-[#111827] font-['Poppins'] mb-0">
            Notas del Paciente
          </h2>
          <p className="text-sm text-[#6B7280] mt-0.5 font-['Inter']">
            {filteredNotas.length === sortedNotas.length
              ? `${sortedNotas.length} ${sortedNotas.length === 1 ? 'nota registrada' : 'notas registradas'}`
              : `${filteredNotas.length} de ${sortedNotas.length} notas`}
          </p>
        </div>
        <div className="flex gap-3 max-lg:hidden">
          {canCreate && (
            <Button
              onClick={() => setShowCreateModal(true)}
              disabled={pacienteInactivo}
              title={pacienteInactivo ? 'No se pueden crear notas para pacientes inactivos' : ''}
              className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-md shadow-[#2563eb]/20 hover:shadow-lg hover:shadow-[#2563eb]/30 transition-all duration-200 rounded-[12px] px-6 h-12 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="h-5 w-5 mr-2 stroke-[2]" />
              Nueva Nota
            </Button>
          )}
        </div>
      </div>

      {/* Filtros: creador y fecha - relative z-10 para que el calendario desplegado quede por encima */}
      <Card className="relative z-10 border border-[#E5E7EB] rounded-[16px] shadow-sm">
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-4">
              <div className="flex-1 min-w-[200px]">
                <Label className="text-[13px] font-medium text-[#374151] font-['Inter'] mb-1.5 block">Creador</Label>
                <Select
                  value={filterCreadorId}
                  onValueChange={setFilterCreadorId}
                  disabled={filtroCreadorFijo}
                >
                  <SelectTrigger className="h-12 w-full rounded-[10px] border-[#E5E7EB] font-['Inter'] text-[14px] disabled:opacity-90 disabled:cursor-default">
                    <SelectValue placeholder="Todos los creadores" />
                  </SelectTrigger>
                  <SelectContent className="rounded-[12px]">
                    {!filtroCreadorFijo && <SelectItem value="todos">Todos los creadores</SelectItem>}
                    {creadoresEnNotas.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {formatDisplayText(c.nombre)} {formatDisplayText(c.apellido)}
                        {c.especialidad ? ` — ${formatDisplayText(c.especialidad)}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 min-w-[200px] relative" ref={datePickerDesdeRef}>
                <Label className="text-[13px] font-medium text-[#374151] font-['Inter'] mb-1.5 block">Fecha desde</Label>
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
                      }
                    }}
                    className="h-12 flex-1 min-w-0 flex items-center gap-2 px-4 border border-[#E5E7EB] rounded-[10px] text-[14px] font-['Inter'] text-left bg-white hover:border-[#9CA3AF] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all"
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
                      className="h-12 w-12 shrink-0 rounded-[10px] text-[#6B7280] hover:text-[#374151] hover:bg-[#FEE2E2]"
                      aria-label="Quitar fecha desde"
                    >
                      <X className="h-5 w-5 stroke-[2]" />
                    </Button>
                  )}
                </div>
                {datePickerDesdeOpen && (
                  <div
                    data-calendar-desde-portal
                    className="absolute top-full left-0 right-0 mt-2 z-[9999] bg-white border border-[#E5E7EB] rounded-[16px] shadow-xl p-4 min-w-[280px] max-w-[450px]"
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
                        const monthEnd = endOfMonth(datePickerDesdeMonth);
                        const calStart = startOfWeek(datePickerDesdeMonth, { weekStartsOn: 1 });
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
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-[200px] relative" ref={datePickerHastaRef}>
                <Label className="text-[13px] font-medium text-[#374151] font-['Inter'] mb-1.5 block">Fecha hasta</Label>
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
                      }
                    }}
                    className="h-12 flex-1 min-w-0 flex items-center gap-2 px-4 border border-[#E5E7EB] rounded-[10px] text-[14px] font-['Inter'] text-left bg-white hover:border-[#9CA3AF] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all"
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
                      className="h-12 w-12 shrink-0 rounded-[10px] text-[#6B7280] hover:text-[#374151] hover:bg-[#FEE2E2]"
                      aria-label="Quitar fecha hasta"
                    >
                      <X className="h-5 w-5 stroke-[2]" />
                    </Button>
                  )}
                </div>
                {datePickerHastaOpen && (
                  <div
                    data-calendar-hasta-portal
                    className="absolute top-full left-0 right-0 mt-2 z-[9999] bg-white border border-[#E5E7EB] rounded-[16px] shadow-xl p-4 min-w-[280px] max-w-[450px]"
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
                        const monthEnd = endOfMonth(datePickerHastaMonth);
                        const calStart = startOfWeek(datePickerHastaMonth, { weekStartsOn: 1 });
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
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

      {/* Empty State o Lista */}
      {sortedNotas.length === 0 ? (
        <Card className="border border-[#E5E7EB] rounded-[16px] shadow-sm">
          <CardContent className="p-8 max-lg:p-6 text-center">
            <h3 className="text-base font-semibold text-[#374151] font-['Inter'] mb-0">
              No hay notas
            </h3>
          </CardContent>
        </Card>
      ) : filteredNotas.length === 0 ? (
        <Card className="border border-[#E5E7EB] rounded-[16px] shadow-sm">
          <CardContent className="p-8 max-lg:p-6 text-center">
            <h3 className="text-lg font-semibold mb-1 text-[#374151] font-['Inter']">
              No hay resultados
            </h3>
            <p className="text-[#6B7280] font-['Inter'] mb-0">
              No se encontraron notas con los filtros aplicados. Probá cambiando creador o rango de fechas.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {notasPaginadas.map((nota) => (
            <Card key={nota.id} className="border border-[#E5E7EB] rounded-[12px] shadow-sm hover:shadow-md transition-all duration-200 flex flex-col w-full">
              <CardContent className="p-4 flex flex-col flex-1 min-h-0">
                {/* Ícono arriba a la izquierda + nombre/especialidad y acciones */}
                <div className="flex items-start gap-3 flex-shrink-0">
                  <div className="h-9 w-9 rounded-full bg-gradient-to-br from-[#dbeafe] to-[#bfdbfe] flex items-center justify-center flex-shrink-0">
                    <StickyNote className="h-4 w-4 text-[#2563eb] stroke-[2]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold text-[#111827] font-['Inter'] mb-0 truncate">
                      {formatDisplayText(nota.usuario_nombre)} {formatDisplayText(nota.usuario_apellido)}
                      {nota.especialidad && (
                        <span className="font-normal text-[#6B7280]"> — {formatDisplayText(nota.especialidad)}</span>
                      )}
                    </p>
                    <p className="text-[13px] text-[#6B7280] font-['Inter'] mt-0.5 mb-0">
                      {nota.fecha_creacion ? formatEvolucionDateTime(nota.fecha_creacion) : '—'}
                    </p>
                  </div>
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            onClick={() => handleView(nota)}
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-[8px] hover:bg-[#F3F4F6]"
                          >
                            <Eye className="h-4 w-4 text-[#6B7280] stroke-[2]" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent className="bg-[#111827] text-white text-xs font-['Inter'] rounded-[8px] px-3 py-2 [&>p]:text-white">
                          <p className="text-white">Ver</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    {canUpdate && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              onClick={() => handleEdit(nota)}
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-[8px] hover:bg-[#F3F4F6]"
                            >
                              <Edit className="h-4 w-4 text-[#6B7280] stroke-[2]" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent className="bg-[#111827] text-white text-xs font-['Inter'] rounded-[8px] px-3 py-2 [&>p]:text-white">
                            <p className="text-white">Editar</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    {canDelete && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              onClick={() => handleDelete(nota)}
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-[8px] hover:bg-[#FEE2E2] hover:text-[#DC2626]"
                            >
                              <Trash2 className="h-4 w-4 text-[#EF4444] stroke-[2]" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent className="bg-[#111827] text-white text-xs font-['Inter'] rounded-[8px] px-3 py-2 [&>p]:text-white">
                            <p className="text-white">Eliminar</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-[#E5E7EB] flex-1 min-h-[140px]">
                  <p className="text-[15px] text-[#374151] font-['Inter'] whitespace-pre-wrap leading-relaxed">
                    {nota.contenido}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
          </div>
          {(totalPagesNotas >= 1) && !isLoading && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-4 border border-[#E5E7EB] border-t-0 rounded-b-[16px] bg-[#F9FAFB]">
              <p className="text-sm text-[#6B7280] font-['Inter'] m-0">
                Página {pageNotas} de {totalPagesNotas || 1}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPageNotas((p) => Math.max(1, p - 1))}
                  disabled={pageNotas <= 1}
                  className="h-9 rounded-[8px] border-[#D1D5DB] font-['Inter'] m-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPageNotas((p) => Math.min(totalPagesNotas, p + 1))}
                  disabled={pageNotas >= totalPagesNotas}
                  className="h-9 rounded-[8px] border-[#D1D5DB] font-['Inter'] m-0"
                >
                  Siguiente
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* FAB móvil: Nueva nota */}
      {canCreate && !pacienteInactivo && (
        <div className="lg:hidden fixed bottom-6 right-6 z-40">
          <Button
            onClick={() => setShowCreateModal(true)}
            className="h-14 w-14 rounded-full shadow-lg shadow-[#2563eb]/30 bg-[#2563eb] hover:bg-[#1d4ed8] text-white p-0"
            title="Nueva Nota"
            aria-label="Nueva Nota"
          >
            <Plus className="h-6 w-6 stroke-[2]" />
          </Button>
        </div>
      )}

      {/* Modales */}
      <CreateNotaModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        pacienteId={pacienteId}
        onSubmit={handleCreate}
        isSubmitting={isSubmitting}
      />

      {selectedNota && (
        <ViewNotaModal
          open={showViewModal}
          onOpenChange={setShowViewModal}
          nota={selectedNota}
        />
      )}
      {selectedNota && (
        <EditNotaModal
          open={showEditModal}
          onOpenChange={setShowEditModal}
          nota={selectedNota}
          onSubmit={handleUpdate}
          isSubmitting={isSubmitting}
        />
      )}

      <ConfirmDeleteModal
        open={showDeleteModal}
        onOpenChange={(open) => {
          setShowDeleteModal(open);
          if (!open) setNotaToDelete(null);
        }}
        title="Eliminar Nota"
        description="¿Estás seguro de que deseas eliminar esta nota? Esta acción no se puede deshacer."
        onConfirm={handleConfirmDelete}
        isLoading={isSubmitting}
      />
    </div>
  );
}
