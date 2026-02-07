import { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
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
import { Plus, Edit, Trash2, Loader2, Stethoscope, Eye, Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { evolucionesService, type CreateEvolucionData, type UpdateEvolucionData } from '@/services/evoluciones.service';
import { pacientesService } from '@/services/pacientes.service';
import { profesionalesService } from '@/services/profesionales.service';
import type { Evolucion } from '@/services/evoluciones.service';
import { toast as reactToastify } from 'react-toastify';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/utils/permissions';
import { formatDisplayText, formatEvolucionDateTime } from '@/lib/utils';
import { AlertCircle } from 'lucide-react';
import { CreateEvolucionModal, EditEvolucionModal, ViewEvolucionModal } from './modals';
import { PAGE_SIZE } from '@/lib/constants';

interface PacienteEvolucionesProps {
  pacienteId: string;
}

export default function PacienteEvoluciones({ pacienteId }: PacienteEvolucionesProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedEvolucion, setSelectedEvolucion] = useState<Evolucion | null>(null);
  const [evolucionToDelete, setEvolucionToDelete] = useState<Evolucion | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filterProfesionalId, setFilterProfesionalId] = useState<string>('todos');
  const [filterFechaDesde, setFilterFechaDesde] = useState<string>('');
  const [filterFechaHasta, setFilterFechaHasta] = useState<string>('');
  const [pageEvoluciones, setPageEvoluciones] = useState(1);

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

  const { data: paciente } = useQuery({
    queryKey: ['paciente', pacienteId],
    queryFn: () => pacientesService.getById(pacienteId),
  });

  // Obtener el profesional asociado al usuario logueado si es profesional
  const { data: profesionalesData = [] } = useQuery({
    queryKey: ['profesionales', 'for-filter'],
    queryFn: () => profesionalesService.getAll({ bloqueado: false }),
  });
  const profesionales = Array.isArray(profesionalesData) ? profesionalesData : [];

  const profesionalLogueado = profesionales.find(p => p.usuario_id === user?.id);
  const isProfesional = user?.rol === 'profesional';

  const { data: evolucionesData = [], isLoading } = useQuery({
    queryKey: ['evoluciones', 'paciente', pacienteId, profesionalLogueado?.id],
    queryFn: () => {
      // Si es profesional, filtrar por profesional_id
      if (isProfesional && profesionalLogueado) {
        return evolucionesService.getAll({
          paciente_id: pacienteId,
          profesional_id: profesionalLogueado.id,
        });
      }
      // Si no es profesional, obtener todas las evoluciones del paciente
      return evolucionesService.getByPaciente(pacienteId);
    },
    enabled: !isProfesional || !!profesionalLogueado,
  });
  const evoluciones = Array.isArray(evolucionesData) ? evolucionesData : [];

  const sortedEvoluciones = useMemo(() => {
    return [...evoluciones].sort((a, b) => new Date(b.fecha_consulta).getTime() - new Date(a.fecha_consulta).getTime());
  }, [evoluciones]);

  const filteredEvoluciones = useMemo(() => {
    let list = sortedEvoluciones;
    if (filterProfesionalId && filterProfesionalId !== 'todos') {
      list = list.filter(e => e.profesional_id === filterProfesionalId);
    }
    if (filterFechaDesde) {
      const desde = new Date(filterFechaDesde + 'T00:00:00').getTime();
      list = list.filter(e => new Date(e.fecha_consulta).getTime() >= desde);
    }
    if (filterFechaHasta) {
      const hasta = new Date(filterFechaHasta + 'T23:59:59').getTime();
      list = list.filter(e => new Date(e.fecha_consulta).getTime() <= hasta);
    }
    return list;
  }, [sortedEvoluciones, filterProfesionalId, filterFechaDesde, filterFechaHasta]);

  const totalEvoluciones = filteredEvoluciones.length;
  const totalPagesEvoluciones = Math.ceil(totalEvoluciones / PAGE_SIZE) || 0;
  const evolucionesPaginadas = useMemo(() => {
    const start = (pageEvoluciones - 1) * PAGE_SIZE;
    return filteredEvoluciones.slice(start, start + PAGE_SIZE);
  }, [filteredEvoluciones, pageEvoluciones]);

  useEffect(() => {
    setPageEvoluciones(1);
  }, [filterProfesionalId, filterFechaDesde, filterFechaHasta]);

  const profesionalesEnEvoluciones = useMemo(() => {
    const ids = new Set(evoluciones.map(e => e.profesional_id));
    return profesionales.filter(p => ids.has(p.id));
  }, [evoluciones, profesionales]);

  // Para el Select: si es profesional, incluir siempre al profesional logueado para que se muestre su nombre
  const opcionesProfesionalSelect = useMemo(() => {
    if (isProfesional && profesionalLogueado) {
      const yaIncluido = profesionalesEnEvoluciones.some(p => p.id === profesionalLogueado.id);
      if (yaIncluido) return profesionalesEnEvoluciones;
      return [profesionalLogueado, ...profesionalesEnEvoluciones];
    }
    return profesionalesEnEvoluciones;
  }, [isProfesional, profesionalLogueado, profesionalesEnEvoluciones]);

  useEffect(() => {
    if (isProfesional && profesionalLogueado) {
      setFilterProfesionalId(profesionalLogueado.id);
    }
  }, [isProfesional, profesionalLogueado?.id]);

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

  const createMutation = useMutation({
    mutationFn: (data: CreateEvolucionData) => evolucionesService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evoluciones', 'paciente', pacienteId] });
      setShowCreateModal(false);
      reactToastify.success('Evolución creada correctamente', {
        position: 'top-right',
        autoClose: 3000,
      });
    },
    onError: (error: any) => {
      const errorData = error.response?.data?.error || {};
      let errorMessage = 'Error al crear evolución';
      
      if (errorData.details && Array.isArray(errorData.details) && errorData.details.length > 0) {
        const detailsMessages = errorData.details.map((d: any) => d.message).join('. ');
        errorMessage = detailsMessages;
      } else if (errorData.message) {
        errorMessage = errorData.message;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      
      reactToastify.error(errorMessage, {
        position: 'top-right',
        autoClose: 3000,
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateEvolucionData }) =>
      evolucionesService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evoluciones', 'paciente', pacienteId] });
      setShowEditModal(false);
      setSelectedEvolucion(null);
      reactToastify.success('Evolución actualizada correctamente', {
        position: 'top-right',
        autoClose: 3000,
      });
    },
    onError: (error: any) => {
      const errorData = error.response?.data?.error || {};
      let errorMessage = 'Error al actualizar evolución';
      
      if (errorData.details && Array.isArray(errorData.details) && errorData.details.length > 0) {
        const detailsMessages = errorData.details.map((d: any) => d.message).join('. ');
        errorMessage = detailsMessages;
      } else if (errorData.message) {
        errorMessage = errorData.message;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      
      reactToastify.error(errorMessage, {
        position: 'top-right',
        autoClose: 3000,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => evolucionesService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evoluciones', 'paciente', pacienteId] });
      reactToastify.success('Evolución eliminada correctamente', {
        position: 'top-right',
        autoClose: 3000,
      });
    },
    onError: (error: any) => {
      const errorData = error.response?.data?.error || {};
      let errorMessage = 'Error al eliminar evolución';
      
      if (errorData.details && Array.isArray(errorData.details) && errorData.details.length > 0) {
        const detailsMessages = errorData.details.map((d: any) => d.message).join('. ');
        errorMessage = detailsMessages;
      } else if (errorData.message) {
        errorMessage = errorData.message;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      
      reactToastify.error(errorMessage, {
        position: 'top-right',
        autoClose: 3000,
      });
    },
  });

  const handleCreate = async (data: CreateEvolucionData) => {
    setIsSubmitting(true);
    try {
      await createMutation.mutateAsync(data);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (evolucion: Evolucion) => {
    setSelectedEvolucion(evolucion);
    setShowEditModal(true);
  };

  const handleUpdate = async (id: string, data: UpdateEvolucionData) => {
    setIsSubmitting(true);
    try {
      await updateMutation.mutateAsync({ id, data });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (evolucion: Evolucion) => {
    setEvolucionToDelete(evolucion);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!evolucionToDelete) return;
    setIsSubmitting(true);
    try {
      await deleteMutation.mutateAsync(evolucionToDelete.id);
      setShowDeleteModal(false);
      setEvolucionToDelete(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const canCreate = hasPermission(user, 'evoluciones.crear');
  const canUpdate = hasPermission(user, 'evoluciones.actualizar');
  const canDelete = hasPermission(user, 'evoluciones.eliminar');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-16">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-[#2563eb]" />
          <p className="text-[#6B7280] font-['Inter']">Cargando evoluciones...</p>
        </div>
      </div>
    );
  }

  const pacienteInactivo = !!(paciente && !paciente.activo);

  return (
    <div className="space-y-6 max-lg:pb-12 relative">
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
                  No se pueden crear nuevas evoluciones clínicas para pacientes inactivos.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-[24px] font-bold text-[#111827] font-['Poppins'] mb-0">
            Evoluciones Clínicas
          </h2>
          <p className="text-base text-[#6B7280] mt-1 font-['Inter']">
            {filteredEvoluciones.length === sortedEvoluciones.length
              ? `${sortedEvoluciones.length} ${sortedEvoluciones.length === 1 ? 'evolución registrada' : 'evoluciones registradas'}`
              : `${filteredEvoluciones.length} de ${sortedEvoluciones.length} evoluciones`}
          </p>
        </div>
        <div className="flex gap-3 max-lg:hidden">
          {canCreate && (
            <Button 
              onClick={() => setShowCreateModal(true)}
              disabled={pacienteInactivo}
              title={pacienteInactivo ? 'No se pueden crear evoluciones para pacientes inactivos' : ''}
              className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-md shadow-[#2563eb]/20 hover:shadow-lg hover:shadow-[#2563eb]/30 transition-all duration-200 rounded-[12px] px-6 h-12 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="h-5 w-5 mr-2 stroke-[2]" />
              Nueva Evolución
            </Button>
          )}
        </div>
      </div>

      {/* Filtros: profesional y fecha */}
      <Card className="border border-[#E5E7EB] rounded-[16px] shadow-sm">
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-4">
              <div className="flex-1 min-w-[200px]">
                <Label className="text-[13px] font-medium text-[#374151] font-['Inter'] mb-1.5 block">Profesional</Label>
                <Select
                  value={isProfesional && profesionalLogueado ? profesionalLogueado.id : filterProfesionalId}
                  onValueChange={setFilterProfesionalId}
                  disabled={!!(isProfesional && profesionalLogueado)}
                >
                  <SelectTrigger className="h-11 w-full rounded-[10px] border-[#E5E7EB] font-['Inter'] text-[14px]">
                    <SelectValue placeholder="Todos los profesionales" />
                  </SelectTrigger>
                  <SelectContent className="rounded-[12px]">
                    <SelectItem value="todos">Todos los profesionales</SelectItem>
                    {opcionesProfesionalSelect.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {formatDisplayText(p.nombre)} {formatDisplayText(p.apellido)}
                        {p.especialidad ? ` — ${formatDisplayText(p.especialidad)}` : ''}
                      </SelectItem>
                    ))}
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

      {/* Empty State o Lista */}
      {sortedEvoluciones.length === 0 ? (
        <Card className="border border-[#E5E7EB] rounded-[16px] shadow-sm">
          <CardContent className="p-8 max-lg:p-6 text-center">
            <h3 className="text-base font-semibold text-[#374151] font-['Inter'] mb-0">
              No hay evoluciones clínicas
            </h3>
          </CardContent>
        </Card>
      ) : filteredEvoluciones.length === 0 ? (
        <Card className="border border-[#E5E7EB] rounded-[16px] shadow-sm">
          <CardContent className="p-8 max-lg:p-6 text-center">
            <h3 className="text-lg font-semibold mb-1 text-[#374151] font-['Inter']">
              No hay resultados
            </h3>
            <p className="text-[#6B7280] font-['Inter'] mb-0">
              No se encontraron evoluciones con los filtros aplicados. Probá cambiando profesional o rango de fechas.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {evolucionesPaginadas.map((evolucion) => (
            <Card key={evolucion.id} className="border border-[#E5E7EB] rounded-[12px] shadow-sm hover:shadow-md transition-all duration-200">
              <CardContent className="p-4 flex items-center min-h-[72px]">
                <div className="flex flex-col lg:flex-row items-center justify-center lg:justify-between gap-3 lg:gap-4 lg:flex-nowrap w-full">
                  {/* Renglón 1 mobile / Col 1 desktop: Profesional - Especialidad */}
                  <div className="flex flex-col items-center text-center lg:flex-row lg:items-center lg:text-left lg:min-w-0 lg:max-w-[240px] w-full lg:w-auto">
                    <div className="max-lg:hidden h-10 w-10 rounded-full bg-gradient-to-br from-[#DBEAFE] to-[#BFDBFE] flex items-center justify-center shadow-sm flex-shrink-0 mr-3">
                      <Stethoscope className="h-5 w-5 text-[#3B82F6] stroke-[2]" />
                    </div>
                    <div className="min-w-0 overflow-hidden flex flex-col items-center lg:items-start">
                      <p className="text-[16px] font-semibold text-[#111827] font-['Inter'] mb-0 lg:truncate text-center lg:text-left">
                        {formatDisplayText(evolucion.profesional_nombre)} {formatDisplayText(evolucion.profesional_apellido)}
                        {evolucion.profesional_especialidad && (
                          <span className="font-normal text-[#6B7280] lg:hidden"> — {formatDisplayText(evolucion.profesional_especialidad)}</span>
                        )}
                      </p>
                      {evolucion.profesional_especialidad && (
                        <p className="hidden lg:block text-[14px] text-[#6B7280] font-['Inter'] mb-0 truncate">
                          {formatDisplayText(evolucion.profesional_especialidad)}
                        </p>
                      )}
                    </div>
                  </div>
                  {/* Renglón 2 mobile / Col 2 desktop: Fecha */}
                  <div className="w-full lg:flex-1 flex justify-center min-w-0">
                    <p className="text-[14px] text-[#6B7280] font-['Inter'] whitespace-nowrap mb-0 text-center">
                      {formatEvolucionDateTime(evolucion.fecha_consulta)}
                    </p>
                  </div>
                  {/* Renglón 3 mobile / Col 3 desktop: Acciones */}
                  <div className="flex items-center justify-center lg:justify-end gap-2 flex-shrink-0">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            onClick={() => {
                              setSelectedEvolucion(evolucion);
                              setShowViewModal(true);
                            }}
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 rounded-[8px] hover:bg-[#F3F4F6]"
                          >
                            <Eye className="h-5 w-5 text-[#6B7280] stroke-[2]" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent className="bg-[#111827] text-white text-xs font-['Inter'] rounded-[8px] px-3 py-2 [&>p]:text-white">
                          <p className="text-white">Ver Evolución</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    {canUpdate && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              onClick={() => handleEdit(evolucion)}
                              variant="ghost"
                              size="icon"
                              className="h-10 w-10 rounded-[8px] hover:bg-[#F3F4F6]"
                            >
                              <Edit className="h-5 w-5 text-[#6B7280] stroke-[2]" />
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
                              onClick={() => handleDelete(evolucion)}
                              variant="ghost"
                              size="icon"
                              className="h-10 w-10 rounded-[8px] hover:bg-[#FEE2E2] hover:text-[#DC2626]"
                            >
                              <Trash2 className="h-5 w-5 text-[#EF4444] stroke-[2]" />
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
              </CardContent>
            </Card>
          ))}
          {(totalPagesEvoluciones >= 1) && !isLoading && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-4 border-t border-[#E5E7EB] bg-[#F9FAFB] rounded-b-[16px]">
              <p className="text-sm text-[#6B7280] font-['Inter'] m-0">
                Página {pageEvoluciones} de {totalPagesEvoluciones || 1}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPageEvoluciones((p) => Math.max(1, p - 1))}
                  disabled={pageEvoluciones <= 1}
                  className="h-9 rounded-[8px] border-[#D1D5DB] font-['Inter'] m-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPageEvoluciones((p) => Math.min(totalPagesEvoluciones, p + 1))}
                  disabled={pageEvoluciones >= totalPagesEvoluciones}
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

      {/* FAB móvil: Nueva evolución */}
      {canCreate && !pacienteInactivo && (
        <div className="lg:hidden fixed bottom-6 right-6 z-40">
          <Button
            onClick={() => setShowCreateModal(true)}
            className="h-14 w-14 rounded-full shadow-lg shadow-[#2563eb]/30 bg-[#2563eb] hover:bg-[#1d4ed8] text-white p-0"
            title="Nueva Evolución"
          >
            <Plus className="h-6 w-6 stroke-[2]" />
          </Button>
        </div>
      )}

      {/* Modales */}
      <CreateEvolucionModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        pacienteId={pacienteId}
        onSubmit={handleCreate}
        isSubmitting={isSubmitting}
      />

      {selectedEvolucion && (
        <>
          <ViewEvolucionModal
            open={showViewModal}
            onOpenChange={setShowViewModal}
            evolucion={selectedEvolucion}
          />
          <EditEvolucionModal
            open={showEditModal}
            onOpenChange={setShowEditModal}
            evolucion={selectedEvolucion}
            onSubmit={handleUpdate}
            isSubmitting={isSubmitting}
          />
        </>
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

      <ConfirmDeleteModal
        open={showDeleteModal}
        onOpenChange={(open) => { setShowDeleteModal(open); if (!open) setEvolucionToDelete(null); }}
        title="Eliminar Evolución Clínica"
        description="¿Estás seguro de que deseas eliminar esta evolución clínica? Esta acción no se puede deshacer y se eliminará permanentemente."
        onConfirm={handleConfirmDelete}
        isLoading={isSubmitting}
      />
    </div>
  );
}