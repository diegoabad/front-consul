import { useState, useMemo } from 'react';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { 
  Calendar, Plus, Edit, Trash2, Loader2, Clock, User
} from 'lucide-react';
import { agendaService, type CreateAgendaData } from '@/services/agenda.service';
import { profesionalesService } from '@/services/profesionales.service';
import type { ConfiguracionAgenda } from '@/types';
import { toast as reactToastify } from 'react-toastify';

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
  const [profesionalGestionar, setProfesionalGestionar] = useState<{ id: string; nombre: string; apellido: string } | null>(null);
  const [editingAgenda, setEditingAgenda] = useState<ConfiguracionAgenda | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [agendaForm, setAgendaForm] = useState<CreateAgendaData>({
    profesional_id: '',
    dia_semana: 1,
    hora_inicio: '09:00',
    hora_fin: '18:00',
    duracion_turno_minutos: 30,
    activo: true,
  });
  const [diasHorarios, setDiasHorarios] = useState<Record<number, { hora_inicio: string; hora_fin: string }>>(
    () => Object.fromEntries(DIAS_SEMANA.map(d => [d.value, { hora_inicio: '09:00', hora_fin: '18:00' }]))
  );
  // Lunes(1)-Viernes(5) activos por defecto, Sábado(6) y Domingo(0) no
  const [diasActivos, setDiasActivos] = useState<Record<number, boolean>>(
    () => Object.fromEntries(DIAS_SEMANA.map(d => [d.value, d.value >= 1 && d.value <= 5]))
  );

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

  /** Agrupado por profesional para la tabla: una fila por profesional con "Días y horarios" resumido */
  const agendasPorProfesional = useMemo(() => {
    const byProf = new Map<string, { profesional_id: string; profesional_nombre: string; profesional_apellido: string; profesional_especialidad?: string; agendas: ConfiguracionAgenda[] }>();
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
    return Array.from(byProf.values());
  }, [filteredAgendas]);

  // Handlers
  const resetAgendaForm = () => {
    setAgendaForm({
      profesional_id: '',
      dia_semana: 1,
      hora_inicio: '09:00',
      hora_fin: '18:00',
      duracion_turno_minutos: 30,
      activo: true,
    });
    setDiasHorarios(Object.fromEntries(DIAS_SEMANA.map(d => [d.value, { hora_inicio: '09:00', hora_fin: '18:00' }])));
    setDiasActivos(Object.fromEntries(DIAS_SEMANA.map(d => [d.value, d.value >= 1 && d.value <= 5])));
    setEditingAgenda(null);
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
    }
    setShowAgendaModal(true);
  };

  const handleSubmitAgenda = async () => {
    if (!agendaForm.profesional_id) {
      reactToastify.error('Selecciona un profesional', { position: 'top-right', autoClose: 3000 });
      return;
    }
    setIsSubmitting(true);
    try {
      if (editingAgenda) {
        await updateAgendaMutation.mutateAsync({ id: editingAgenda.id, data: agendaForm });
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
          className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white shadow-md shadow-[#7C3AED]/20 hover:shadow-lg hover:shadow-[#7C3AED]/30 transition-all duration-200 rounded-[12px] px-6 py-3 h-auto font-medium"
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
              <SelectTrigger className="h-12 border-[#D1D5DB] rounded-[10px] font-['Inter'] text-[15px] focus:border-[#7C3AED] focus:ring-[#7C3AED]/20 sm:min-w-[280px]">
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
                <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-[#7C3AED]" />
                <p className="text-[#6B7280] font-['Inter'] text-base">Cargando configuraciones...</p>
              </CardContent>
            </Card>
          ) : agendasPorProfesional.length === 0 ? (
            <Card className="border border-[#E5E7EB] rounded-[16px] shadow-sm">
              <CardContent className="p-16 text-center">
                <div className="h-20 w-20 rounded-full bg-[#EDE9FE] flex items-center justify-center mx-auto mb-4">
                  <Calendar className="h-10 w-10 text-[#7C3AED] stroke-[2]" />
                </div>
                <h3 className="text-lg font-semibold mb-2 text-[#374151] font-['Inter']">
                  No hay configuraciones de agenda
                </h3>
                <p className="text-[#6B7280] mb-6 font-['Inter']">
                  {profesionalFilter !== 'todos' ? 'No hay configuraciones para el profesional seleccionado' : 'Crea una nueva agenda para comenzar'}
                </p>
                <Button
                  onClick={() => handleOpenAgendaModal()}
                  className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white shadow-md shadow-[#7C3AED]/20 hover:shadow-lg hover:shadow-[#7C3AED]/30 transition-all duration-200 rounded-[12px] px-6 py-3 h-auto font-medium"
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
                    <TableHead className="font-['Inter'] font-medium text-[14px] text-[#374151] text-right w-[120px]">
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
                          <p className="font-medium text-[#374151] font-['Inter'] text-[15px]">
                            {grupo.profesional_nombre} {grupo.profesional_apellido}
                          </p>
                          {grupo.profesional_especialidad && (
                            <p className="text-sm text-[#6B7280] font-['Inter']">
                              {grupo.profesional_especialidad}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-[#374151] font-['Inter'] text-[14px] flex-wrap">
                          <Clock className="h-4 w-4 text-[#6B7280] stroke-[2] flex-shrink-0" />
                          {formatDiasYHorarios(grupo.agendas)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-[#6B7280] font-['Inter'] text-[14px]">
                          {grupo.agendas.some((a) => a.duracion_turno_minutos !== grupo.agendas[0]?.duracion_turno_minutos)
                            ? 'Varia'
                            : `${grupo.agendas[0]?.duracion_turno_minutos ?? 30} min`}
                        </span>
                      </TableCell>
                      <TableCell>
                        {getEstadoBadge(grupo.agendas.every((a) => a.activo))}
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
                                  className="h-8 w-8 rounded-[8px] hover:bg-[#EDE9FE] transition-all duration-200 text-[#7C3AED] hover:text-[#6D28D9]"
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

      {/* Modal: Gestionar agenda de un profesional (lista de configuraciones) */}
      <Dialog open={showGestionarModal} onOpenChange={setShowGestionarModal}>
        <DialogContent className="max-w-[560px] rounded-[20px] p-0 border border-[#E5E7EB] shadow-2xl">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-[#E5E7EB] mb-0">
            <DialogTitle className="text-[22px] font-bold text-[#111827] font-['Poppins'] mb-0">
              Agenda de {profesionalGestionar?.nombre} {profesionalGestionar?.apellido}
            </DialogTitle>
            <DialogDescription className="text-sm text-[#6B7280] font-['Inter'] mt-1 mb-0">
              Edita o elimina configuraciones por día
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
            {profesionalGestionar && (
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#F9FAFB] border-[#E5E7EB]">
                    <TableHead className="font-['Inter'] text-[13px] text-[#374151] w-[100px]">Día</TableHead>
                    <TableHead className="font-['Inter'] text-[13px] text-[#374151]">Horario</TableHead>
                    <TableHead className="font-['Inter'] text-[13px] text-[#374151] text-right w-[90px]">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAgendas
                    .filter((a) => a.profesional_id === profesionalGestionar.id)
                    .sort((a, b) => [1, 2, 3, 4, 5, 6, 0].indexOf(a.dia_semana) - [1, 2, 3, 4, 5, 6, 0].indexOf(b.dia_semana))
                    .map((agenda) => (
                      <TableRow key={agenda.id} className="border-[#E5E7EB]">
                        <TableCell className="font-['Inter'] text-[14px] text-[#374151] py-2">
                          {getDiaSemanaLabel(agenda.dia_semana)}
                        </TableCell>
                        <TableCell className="font-['Inter'] text-[14px] text-[#6B7280] py-2">
                          {formatTime(agenda.hora_inicio)} - {formatTime(agenda.hora_fin)}
                        </TableCell>
                        <TableCell className="py-2 text-right">
                          <TooltipProvider>
                            <div className="flex items-center justify-end gap-1">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      setShowGestionarModal(false);
                                      handleOpenAgendaModal(agenda);
                                    }}
                                    className="h-8 w-8 rounded-[8px] hover:bg-[#EDE9FE] text-[#7C3AED]"
                                  >
                                    <Edit className="h-4 w-4 stroke-[2]" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent className="bg-[#111827] text-white text-xs rounded-[8px] [&>p]:text-white">
                                  <p className="text-white">Editar</p>
                                </TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => deleteAgendaMutation.mutate(agenda.id)}
                                    className="h-8 w-8 rounded-[8px] hover:bg-[#FEE2E2] text-[#EF4444]"
                                  >
                                    <Trash2 className="h-4 w-4 stroke-[2]" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent className="bg-[#111827] text-white text-xs rounded-[8px] [&>p]:text-white">
                                  <p className="text-white">Eliminar</p>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          </TooltipProvider>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Crear/Editar Configuración de Agenda */}
      <Dialog open={showAgendaModal} onOpenChange={setShowAgendaModal}>
        <DialogContent className="max-w-[900px] max-h-[90vh] rounded-[20px] p-0 border border-[#E5E7EB] shadow-2xl gap-0 flex flex-col overflow-hidden">
          <DialogHeader className="flex-shrink-0 px-8 pt-8 pb-4 border-b border-[#E5E7EB] bg-gradient-to-b from-white to-[#F9FAFB] mb-0">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#6D28D9] flex items-center justify-center shadow-lg shadow-[#7C3AED]/20">
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
                <div className="grid grid-cols-4 gap-4">
                  <div className="col-span-3 space-y-3">
                    <Label htmlFor="profesional_id" className="text-[15px] font-medium text-[#374151] font-['Inter'] flex items-center gap-2">
                      <User className="h-4 w-4 text-[#6B7280] stroke-[2]" />
                      Profesional
                      <span className="text-[#EF4444]">*</span>
                    </Label>
                    <Select
                      value={agendaForm.profesional_id}
                      onValueChange={(value) => setAgendaForm({ ...agendaForm, profesional_id: value })}
                    >
                      <SelectTrigger className="h-[52px] border-[1.5px] border-[#D1D5DB] rounded-[10px] font-['Inter'] text-[16px] focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20 transition-all duration-200">
                        <SelectValue placeholder="Seleccionar profesional" />
                      </SelectTrigger>
                      <SelectContent className="rounded-[12px] border-[#E5E7EB] shadow-xl max-h-[300px]">
                        {profesionales.map((prof) => (
                          <SelectItem key={prof.id} value={prof.id} className="rounded-[8px] font-['Inter'] text-[15px] py-3">
                            {prof.nombre} {prof.apellido} - {prof.especialidad}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
              disabled={isSubmitting}
              className="h-[48px] px-8 rounded-[12px] bg-[#7C3AED] hover:bg-[#6D28D9] text-white shadow-lg shadow-[#7C3AED]/30 font-semibold font-['Inter'] text-[15px] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
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
    </div>
  );
}