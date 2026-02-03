import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, addDays, subDays, startOfWeek, endOfWeek, eachDayOfInterval, isToday, isBefore, startOfMonth, endOfMonth, eachWeekOfInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  Calendar, ChevronLeft, ChevronRight, Clock, User, 
  Phone, CheckCircle, Loader2 
} from 'lucide-react';
import { turnosService } from '@/services/turnos.service';
import { profesionalesService } from '@/services/profesionales.service';
import type { Turno } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/utils/permissions';
import { cn } from '@/lib/utils';

type ViewType = 'day' | 'week' | 'month';

const HORAS_AGENDA = Array.from({ length: 12 }, (_, i) => {
  const hora = i + 8;
  return `${hora.toString().padStart(2, '0')}:00`;
});

function getEstadoColor(estado: string) {
  switch (estado) {
    case 'completado':
      return 'bg-green-500/10 border-green-500/30 text-green-700';
    case 'confirmado':
      return 'bg-blue-500/10 border-blue-500/30 text-blue-700';
    case 'pendiente':
      return 'bg-gray-500/10 border-gray-500/30 text-gray-700';
    case 'cancelado':
      return 'bg-red-500/10 border-red-500/30 text-red-700';
    default:
      return 'bg-muted border-border';
  }
}

function getEstadoBadge(estado: string) {
  switch (estado) {
    case 'completado':
      return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300">Completado</Badge>;
    case 'confirmado':
      return <Badge className="bg-sky-100 text-sky-800 border-sky-300">Confirmado</Badge>;
    case 'pendiente':
      return <Badge className="bg-violet-100 text-violet-800 border-violet-300">Pendiente</Badge>;
    case 'cancelado':
      return <Badge className="bg-red-100 text-red-800 border-red-300">Cancelado</Badge>;
    default:
      return <Badge variant="outline">{estado}</Badge>;
  }
}

export default function ProfesionalAgenda() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [view, setView] = useState<ViewType>('day');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedTurno, setSelectedTurno] = useState<Turno | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [profesionalId, setProfesionalId] = useState<string>('');

  // Obtener el ID del profesional del usuario actual
  useEffect(() => {
    if (user) {
      profesionalesService
        .getAll({ activo: true })
        .then((profesionales) => {
          const profesional = profesionales.find((p) => p.usuario_id === user.id);
          if (profesional) {
            setProfesionalId(profesional.id);
          }
        })
        .catch(() => {
          toast({
            variant: 'destructive',
            title: 'Error',
            description: 'No se pudo cargar la información del profesional',
          });
        });
    }
  }, [user, toast]);

  // Calcular rango de fechas según la vista
  const fechaInicio = useMemo(() => {
    if (view === 'day') {
      const fecha = new Date(currentDate);
      fecha.setHours(0, 0, 0, 0);
      return fecha.toISOString();
    } else if (view === 'week') {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
      weekStart.setHours(0, 0, 0, 0);
      return weekStart.toISOString();
    } else {
      const monthStart = startOfMonth(currentDate);
      monthStart.setHours(0, 0, 0, 0);
      return monthStart.toISOString();
    }
  }, [currentDate, view]);

  const fechaFin = useMemo(() => {
    if (view === 'day') {
      const fecha = new Date(currentDate);
      fecha.setHours(23, 59, 59, 999);
      return fecha.toISOString();
    } else if (view === 'week') {
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
      weekEnd.setHours(23, 59, 59, 999);
      return weekEnd.toISOString();
    } else {
      const monthEnd = endOfMonth(currentDate);
      monthEnd.setHours(23, 59, 59, 999);
      return monthEnd.toISOString();
    }
  }, [currentDate, view]);

  // Fetch turnos del profesional
  const { data: turnos = [], isLoading } = useQuery({
    queryKey: ['turnos', 'profesional', profesionalId, fechaInicio, fechaFin],
    queryFn: () => (profesionalId ? turnosService.getByProfesional(profesionalId, fechaInicio, fechaFin) : Promise.resolve([])),
    enabled: !!profesionalId,
  });

  // Complete mutation
  const completeMutation = useMutation({
    mutationFn: (id: string) => turnosService.complete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['turnos'] });
      toast({
        title: 'Éxito',
        description: 'Turno marcado como completado',
      });
      setShowDetailModal(false);
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.response?.data?.message || 'Error al completar turno',
      });
    },
  });

  // Obtener turnos para una fecha específica
  const getTurnosForDate = (fecha: Date) => {
    const fechaStr = format(fecha, 'yyyy-MM-dd');
    return turnos
      .filter((t) => {
        const turnoFecha = format(new Date(t.fecha_hora_inicio), 'yyyy-MM-dd');
        return turnoFecha === fechaStr;
      })
      .sort((a, b) => new Date(a.fecha_hora_inicio).getTime() - new Date(b.fecha_hora_inicio).getTime());
  };

  // Navegación
  const navigatePrev = () => {
    if (view === 'day') setCurrentDate(subDays(currentDate, 1));
    else if (view === 'week') setCurrentDate(subDays(currentDate, 7));
    else setCurrentDate(subDays(currentDate, 30));
  };

  const navigateNext = () => {
    if (view === 'day') setCurrentDate(addDays(currentDate, 1));
    else if (view === 'week') setCurrentDate(addDays(currentDate, 7));
    else setCurrentDate(addDays(currentDate, 30));
  };

  const goToToday = () => setCurrentDate(new Date());

  const handleTurnoClick = (turno: Turno) => {
    setSelectedTurno(turno);
    setShowDetailModal(true);
  };

  const handleComplete = async (id: string) => {
    await completeMutation.mutateAsync(id);
  };

  const canComplete = hasPermission(user, 'turnos.completar');

  // Vista Día
  const DayView = () => {
    const turnosDelDia = getTurnosForDate(currentDate);
    const fechaStr = format(currentDate, 'yyyy-MM-dd');

    return (
      <div className="space-y-2">
        {HORAS_AGENDA.map((hora) => {
          const turno = turnosDelDia.find((t) => {
            const turnoHora = format(new Date(t.fecha_hora_inicio), 'HH:mm');
            return turnoHora === hora;
          });
          const isPast = isBefore(new Date(`${fechaStr}T${hora}`), new Date());

          return (
            <div key={hora} className="flex gap-4">
              {/* Hora */}
              <div
                className={cn(
                  'w-16 text-sm font-medium flex-shrink-0 py-3',
                  isPast ? 'text-muted-foreground' : 'text-foreground'
                )}
              >
                {hora}
              </div>

              {/* Slot */}
              <div className="flex-1 min-h-[70px] space-y-1">
                {turno ? (
                  <div
                    onClick={() => handleTurnoClick(turno)}
                    className={cn(
                      'p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md',
                      getEstadoColor(turno.estado)
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="font-semibold">
                          {turno.paciente_nombre} {turno.paciente_apellido}
                        </div>
                        <div className="text-sm opacity-80 flex items-center gap-2">
                          {turno.paciente_dni && <span>DNI: {turno.paciente_dni}</span>}
                          {turno.motivo && (
                            <>
                              <span>•</span>
                              <span>{turno.motivo}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {getEstadoBadge(turno.estado)}
                        <span className="text-xs opacity-70">
                          {Math.round(
                            (new Date(turno.fecha_hora_fin).getTime() -
                              new Date(turno.fecha_hora_inicio).getTime()) /
                              60000
                          )}{' '}
                          min
                        </span>
                      </div>
                    </div>
                    {turno.paciente_telefono && (
                      <div className="flex items-center gap-2 mt-2 text-xs opacity-70">
                        <Phone className="h-3 w-3" />
                        {turno.paciente_telefono}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="w-full h-[70px] border border-dashed border-border rounded-lg flex items-center justify-center text-muted-foreground">
                    <span className="text-xs">Disponible</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Vista Semana
  const WeekView = () => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: weekStart, end: weekEnd }).slice(0, 6); // Lunes a Sábado

    return (
      <div className="overflow-x-auto">
        <div className="min-w-[800px]">
          {/* Header con días */}
          <div className="grid grid-cols-7 gap-2 mb-4">
            <div className="w-16" /> {/* Espacio para horas */}
            {days.map((day) => (
              <div
                key={day.toISOString()}
                className={cn(
                  'text-center p-2 rounded-lg',
                  isToday(day) ? 'bg-primary text-primary-foreground' : 'bg-muted'
                )}
              >
                <div className="text-xs font-medium uppercase">{format(day, 'EEE', { locale: es })}</div>
                <div className="text-lg font-bold">{format(day, 'd')}</div>
              </div>
            ))}
          </div>

          {/* Grid de turnos */}
          <div className="space-y-1">
            {HORAS_AGENDA.map((hora) => (
              <div key={hora} className="grid grid-cols-7 gap-2">
                <div className="w-16 text-xs text-muted-foreground py-2">{hora}</div>
                {days.map((day) => {
                  const fechaStr = format(day, 'yyyy-MM-dd');
                  const turno = turnos.find((t) => {
                    const turnoFecha = format(new Date(t.fecha_hora_inicio), 'yyyy-MM-dd');
                    const turnoHora = format(new Date(t.fecha_hora_inicio), 'HH:mm');
                    return turnoFecha === fechaStr && turnoHora === hora;
                  });

                  return (
                    <div key={`${fechaStr}-${hora}`} className="min-h-[50px]">
                      {turno ? (
                        <div
                          onClick={() => handleTurnoClick(turno)}
                          className={cn(
                            'p-1.5 rounded text-xs cursor-pointer h-full',
                            getEstadoColor(turno.estado)
                          )}
                        >
                          <div className="font-medium truncate">
                            {turno.paciente_nombre} {turno.paciente_apellido}
                          </div>
                          <div className="opacity-70 truncate">{turno.motivo || '-'}</div>
                        </div>
                      ) : (
                        <div className="w-full h-full min-h-[50px] border border-dashed border-transparent rounded" />
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // Vista Mes
  const MonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const weeks = eachWeekOfInterval({ start: monthStart, end: monthEnd }, { weekStartsOn: 1 });

    return (
      <div className="space-y-2">
        {/* Header días */}
        <div className="grid grid-cols-7 gap-1">
          {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((dia) => (
            <div key={dia} className="text-center text-xs font-medium text-muted-foreground p-2">
              {dia}
            </div>
          ))}
        </div>

        {/* Semanas */}
        {weeks.map((weekStart) => {
          const days = eachDayOfInterval({
            start: weekStart,
            end: endOfWeek(weekStart, { weekStartsOn: 1 }),
          });

          return (
            <div key={weekStart.toISOString()} className="grid grid-cols-7 gap-1">
              {days.map((day) => {
                const fechaStr = format(day, 'yyyy-MM-dd');
                const turnosDelDia = turnos.filter((t) => {
                  const turnoFecha = format(new Date(t.fecha_hora_inicio), 'yyyy-MM-dd');
                  return turnoFecha === fechaStr;
                });
                const isCurrentMonth = day.getMonth() === currentDate.getMonth();

                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => {
                      setCurrentDate(day);
                      setView('day');
                    }}
                    className={cn(
                      'min-h-[80px] p-2 border rounded-lg text-left transition-all hover:bg-accent',
                      !isCurrentMonth && 'opacity-50',
                      isToday(day) && 'border-primary bg-primary/5'
                    )}
                  >
                    <div className="text-sm font-medium mb-1">{format(day, 'd')}</div>
                    <div className="space-y-1">
                      {turnosDelDia.slice(0, 3).map((turno) => (
                        <div
                          key={turno.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTurnoClick(turno);
                          }}
                          className={cn(
                            'text-xs p-1 rounded truncate cursor-pointer',
                            getEstadoColor(turno.estado)
                          )}
                        >
                          {format(new Date(turno.fecha_hora_inicio), 'HH:mm')} - {turno.paciente_nombre}
                        </div>
                      ))}
                      {turnosDelDia.length > 3 && (
                        <div className="text-xs text-muted-foreground">
                          +{turnosDelDia.length - 3} más
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  };

  if (isLoading && !profesionalId) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mi Agenda"
        subtitle="Gestiona tus turnos y disponibilidad"
        breadcrumbs={[
          { label: 'Dashboard', href: '/agenda' },
          { label: 'Agenda' },
        ]}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={navigatePrev}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={goToToday}>
              Hoy
            </Button>
            <Button variant="outline" size="sm" onClick={navigateNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      {/* Vista Selector */}
      <Tabs value={view} onValueChange={(v) => setView(v as ViewType)}>
        <TabsList>
          <TabsTrigger value="day">Día</TabsTrigger>
          <TabsTrigger value="week">Semana</TabsTrigger>
          <TabsTrigger value="month">Mes</TabsTrigger>
        </TabsList>

        <TabsContent value="day" className="mt-4">
          <Card>
            <CardContent className="p-6">
              <div className="mb-4">
                <h2 className="text-lg font-semibold">
                  {format(currentDate, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}
                </h2>
              </div>
              {isLoading ? (
                <div className="flex items-center justify-center p-12">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <DayView />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="week" className="mt-4">
          <Card>
            <CardContent className="p-6">
              {isLoading ? (
                <div className="flex items-center justify-center p-12">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <WeekView />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="month" className="mt-4">
          <Card>
            <CardContent className="p-6">
              <div className="mb-4 text-center">
                <h2 className="text-lg font-semibold">
                  {format(currentDate, "MMMM 'de' yyyy", { locale: es })}
                </h2>
              </div>
              {isLoading ? (
                <div className="flex items-center justify-center p-12">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <MonthView />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal Detalle Turno */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Detalle del Turno</DialogTitle>
          </DialogHeader>
          {selectedTurno && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-lg">
                <Calendar className="h-5 w-5" />
                <span>
                  {format(new Date(selectedTurno.fecha_hora_inicio), "EEEE, d 'de' MMMM 'de' yyyy", {
                    locale: es,
                  })}
                </span>
              </div>
              <div className="flex items-center gap-2 text-lg">
                <Clock className="h-5 w-5" />
                <span>
                  {format(new Date(selectedTurno.fecha_hora_inicio), 'HH:mm', { locale: es })} -{' '}
                  {format(new Date(selectedTurno.fecha_hora_fin), 'HH:mm', { locale: es })}
                </span>
              </div>

              <div className="p-4 border rounded-lg space-y-2">
                <h4 className="font-semibold flex items-center gap-2">
                  <User className="h-4 w-4" /> Paciente
                </h4>
                <p className="font-medium">
                  {selectedTurno.paciente_nombre} {selectedTurno.paciente_apellido}
                </p>
                {selectedTurno.paciente_dni && (
                  <p className="text-sm text-muted-foreground">DNI: {selectedTurno.paciente_dni}</p>
                )}
                {selectedTurno.paciente_telefono && (
                  <p className="text-sm text-muted-foreground">Tel: {selectedTurno.paciente_telefono}</p>
                )}
                {selectedTurno.paciente_email && (
                  <p className="text-sm text-muted-foreground">Email: {selectedTurno.paciente_email}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Estado</p>
                  {getEstadoBadge(selectedTurno.estado)}
                </div>
                {selectedTurno.motivo && (
                  <div>
                    <p className="text-sm text-muted-foreground">Motivo</p>
                    <p className="font-medium">{selectedTurno.motivo}</p>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailModal(false)}>
              Cerrar
            </Button>
            {canComplete && selectedTurno && selectedTurno.estado === 'confirmado' && (
              <Button onClick={() => handleComplete(selectedTurno.id)}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Completar Turno
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
