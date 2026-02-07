import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ConfirmDeleteModal } from '@/components/shared/ConfirmDeleteModal';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { formatDisplayText } from '@/lib/utils';
import { Calendar, Plus, Edit, Loader2, User, ChevronLeft, ChevronRight } from 'lucide-react';
import { agendaService } from '@/services/agenda.service';
import { profesionalesService } from '@/services/profesionales.service';
import type { ConfiguracionAgenda } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { toast as reactToastify } from 'react-toastify';
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { formatTime, formatDiasYHorarios, getDiaSemanaLabel } from './utils';
import { CreateAgendaModal, GestionarAgendaModal } from './modals';
import { PAGE_SIZE } from '@/lib/constants';

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

export default function AdminAgendas() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const isProfesional = user?.rol === 'profesional';
  const [profesionalFilter, setProfesionalFilter] = useState<string>('todos');
  
  const [showAgendaModal, setShowAgendaModal] = useState(false);
  const [showGestionarModal, setShowGestionarModal] = useState(false);
  const [showDeleteAgendaModal, setShowDeleteAgendaModal] = useState(false);
  const [agendaToDelete, setAgendaToDelete] = useState<ConfiguracionAgenda | null>(null);
  const [profesionalGestionar, setProfesionalGestionar] = useState<{ id: string; nombre: string; apellido: string } | null>(null);
  const [editingAgenda, setEditingAgenda] = useState<ConfiguracionAgenda | null>(null);
  const [pageAgendas, setPageAgendas] = useState(1);

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
  const { data: _todasLasAgendas = [] } = useQuery({
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
  // Mutations
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

  const filteredAgendas = useMemo(() => agendas, [agendas]);

  const profesionalLogueado = useMemo(
    () => profesionales.find((p: { usuario_id?: string }) => p.usuario_id === user?.id),
    [profesionales, user?.id]
  );

  /** Agrupado por profesional para la tabla: incluye configs, profesionales con solo excepciones y, si es profesional, siempre su propia fila */
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
    if (isProfesional && profesionalLogueado && !byProf.has(profesionalLogueado.id)) {
      byProf.set(profesionalLogueado.id, {
        profesional_id: profesionalLogueado.id,
        profesional_nombre: profesionalLogueado.nombre ?? '',
        profesional_apellido: profesionalLogueado.apellido ?? '',
        profesional_especialidad: profesionalLogueado.especialidad,
        agendas: [],
      });
    }
    return Array.from(byProf.values());
  }, [filteredAgendas, todasLasExcepciones, profesionales, isProfesional, profesionalLogueado]);

  const totalAgendas = agendasPorProfesional.length;
  const totalPagesAgendas = Math.ceil(totalAgendas / PAGE_SIZE) || 0;
  const agendasPorProfesionalPaginado = useMemo(() => {
    const start = (pageAgendas - 1) * PAGE_SIZE;
    return agendasPorProfesional.slice(start, start + PAGE_SIZE);
  }, [agendasPorProfesional, pageAgendas]);

  useEffect(() => {
    setPageAgendas(1);
  }, [profesionalFilter]);

  // Profesional: fijar filtro a su propio profesional (solo hay uno en la lista)
  useEffect(() => {
    if (isProfesional && profesionales.length > 0 && profesionalFilter === 'todos') {
      setProfesionalFilter(profesionales[0].id);
    }
  }, [isProfesional, profesionales, profesionalFilter]);

  // Profesional: abrir modal de creación si llega con ?crear=1
  useEffect(() => {
    if (!isProfesional || searchParams.get('crear') !== '1' || profesionales.length === 0) return;
    setEditingAgenda(null);
    setShowAgendaModal(true);
    setSearchParams({});
  }, [isProfesional, searchParams, profesionales]);

  // Profesional: abrir modal de gestionar si llega con ?gestionar=1
  useEffect(() => {
    if (!isProfesional || searchParams.get('gestionar') !== '1' || agendasPorProfesional.length === 0) return;
    const grupo = agendasPorProfesional[0];
    setProfesionalGestionar({
      id: grupo.profesional_id,
      nombre: grupo.profesional_nombre ?? '',
      apellido: grupo.profesional_apellido ?? '',
    });
    setShowGestionarModal(true);
    setSearchParams({});
  }, [isProfesional, searchParams, agendasPorProfesional]);

  const handleOpenAgendaModal = (agenda?: ConfiguracionAgenda) => {
    setEditingAgenda(agenda ?? null);
    setShowAgendaModal(true);
  };

  const isLoading = loadingAgendas || loadingProfesionales;

  return (
    <>
    <div className="space-y-8 max-lg:pb-20 relative">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[32px] font-bold text-[#111827] font-['Poppins'] leading-tight tracking-[-0.02em] mb-0">
            Agendas
          </h1>
          <p className="text-base text-[#6B7280] mt-2 font-['Inter']">
            {loadingAgendas || loadingProfesionales ? 'Cargando...' : totalPagesAgendas > 0 ? `Mostrando ${(pageAgendas - 1) * PAGE_SIZE + 1}-${Math.min(pageAgendas * PAGE_SIZE, totalAgendas)} de ${totalAgendas} profesionales` : 'Horarios de trabajo por profesional'}
          </p>
        </div>
        <Button
          onClick={() => handleOpenAgendaModal()}
          className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-md shadow-[#2563eb]/20 hover:shadow-lg hover:shadow-[#2563eb]/30 transition-all duration-200 rounded-[12px] px-6 py-3 h-auto font-medium max-lg:hidden"
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
                    {formatDisplayText(p.nombre)} {formatDisplayText(p.apellido)}
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
          ) : totalAgendas === 0 ? (
            <Card className="border border-[#E5E7EB] rounded-[16px] shadow-sm">
              <CardContent className="p-16 text-center">
                <div className="h-20 w-20 rounded-full bg-[#dbeafe] flex items-center justify-center mx-auto mb-4">
                  <Calendar className="h-10 w-10 text-[#2563eb] stroke-[2]" />
                </div>
                <h3 className="text-lg font-semibold mb-2 text-[#374151] font-['Inter']">
                  No hay configuraciones de agenda
                </h3>
                <p className="text-[#6B7280] mb-6 font-['Inter'] max-lg:mb-0">
                  {profesionalFilter !== 'todos' ? 'No hay configuraciones para el profesional seleccionado' : 'Crea una nueva agenda para comenzar'}
                </p>
                <Button
                  onClick={() => handleOpenAgendaModal()}
                  className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-md shadow-[#2563eb]/20 hover:shadow-lg hover:shadow-[#2563eb]/30 transition-all duration-200 rounded-[12px] px-6 py-3 h-auto font-medium max-lg:hidden"
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
                    <TableHead className="font-['Inter'] font-medium text-[14px] text-[#374151] py-4 min-w-[200px] w-[200px]">
                      Profesional
                    </TableHead>
                    <TableHead className="font-['Inter'] font-medium text-[14px] text-[#374151] py-4 min-w-[320px]">
                      Días y horarios
                    </TableHead>
                    <TableHead className="font-['Inter'] font-medium text-[14px] text-[#374151] py-4 min-w-[100px]">
                      Duración
                    </TableHead>
                    <TableHead className="font-['Inter'] font-medium text-[14px] text-[#374151] py-4 min-w-[100px]">
                      Estado
                    </TableHead>
                    <TableHead className="font-['Inter'] font-medium text-[14px] text-[#374151] py-4 w-[120px] min-w-[100px] text-center">
                      Acciones
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agendasPorProfesionalPaginado.map((grupo) => (
                    <TableRow
                      key={grupo.profesional_id}
                      className="border-b border-[#E5E7EB] hover:bg-[#F9FAFB] transition-colors duration-150"
                    >
                      <TableCell className="py-4 min-w-[200px]">
                        <div>
                          <p className="font-medium text-[#374151] font-['Inter'] text-[15px] mb-0">
                            {formatDisplayText(grupo.profesional_nombre)} {formatDisplayText(grupo.profesional_apellido)}
                          </p>
                          {grupo.profesional_especialidad && (
                            <p className="text-sm text-[#6B7280] font-['Inter'] mb-0">
                              {formatDisplayText(grupo.profesional_especialidad)}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="min-w-[320px]">
                        <div className="text-[#374151] font-['Inter'] text-[14px] flex-wrap">
                          {grupo.soloExcepciones ? (
                            <span className="text-[#6B7280] italic">Solo días puntuales</span>
                          ) : (
                            formatDiasYHorarios(grupo.agendas)
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="min-w-[100px]">
                        <span className="text-[#6B7280] font-['Inter'] text-[14px]">
                          {grupo.soloExcepciones
                            ? '—'
                            : grupo.agendas.some((a) => a.duracion_turno_minutos !== grupo.agendas[0]?.duracion_turno_minutos)
                              ? 'Varia'
                              : `${grupo.agendas[0]?.duracion_turno_minutos ?? 30} min`}
                        </span>
                      </TableCell>
                      <TableCell className="min-w-[100px]">
                        {getEstadoBadge(grupo.soloExcepciones ? true : grupo.agendas.every((a) => a.activo))}
                      </TableCell>
                      <TableCell className="text-right min-w-[100px]">
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
              {(totalPagesAgendas >= 1) && !isLoading && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-4 border-t border-[#E5E7EB] bg-[#F9FAFB]">
                  <p className="text-sm text-[#6B7280] font-['Inter'] m-0">
                    Página {pageAgendas} de {totalPagesAgendas || 1}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPageAgendas((p) => Math.max(1, p - 1))}
                      disabled={pageAgendas <= 1}
                      className="h-9 rounded-[8px] border-[#D1D5DB] font-['Inter'] m-0"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPageAgendas((p) => Math.min(totalPagesAgendas, p + 1))}
                      disabled={pageAgendas >= totalPagesAgendas}
                      className="h-9 rounded-[8px] border-[#D1D5DB] font-['Inter'] m-0"
                    >
                      Siguiente
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          )}

      {/* FAB móvil: Nueva Agenda */}
      <div className="lg:hidden fixed bottom-6 right-6 z-40">
        <Button
          onClick={() => handleOpenAgendaModal()}
          className="h-14 w-14 rounded-full shadow-lg shadow-[#2563eb]/30 bg-[#2563eb] hover:bg-[#1d4ed8] text-white p-0"
          title="Nueva Agenda"
          aria-label="Nueva Agenda"
        >
          <Plus className="h-6 w-6 stroke-[2]" />
        </Button>
      </div>

      {/* Modal: Gestionar agenda — solo montar cuando está abierto para evitar bucle Radix Presence */}
      {showGestionarModal && profesionalGestionar && (
        <GestionarAgendaModal
          open={true}
          onOpenChange={(open) => {
            if (!open) {
              setShowGestionarModal(false);
              setProfesionalGestionar(null);
            }
          }}
          profesionalId={profesionalGestionar.id}
          profesionalNombre={profesionalGestionar.nombre}
          profesionalApellido={profesionalGestionar.apellido}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['agendas'] })}
        />
      )}
                  </div>

      {/* Modal: Crear agenda (componente independiente) */}
      <CreateAgendaModal
        open={showAgendaModal}
        onOpenChange={(open) => {
          setShowAgendaModal(open);
          if (!open) setEditingAgenda(null);
        }}
        editingAgenda={editingAgenda}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['agendas'] })}
      />

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
    </>
  );
}
