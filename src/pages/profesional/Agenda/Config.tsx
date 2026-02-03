import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
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
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Calendar, Plus, MoreHorizontal, Edit, Trash2, CheckCircle2, XCircle, 
  Loader2, Clock, CalendarX 
} from 'lucide-react';
import { agendaService, type CreateAgendaData, type CreateBloqueData } from '@/services/agenda.service';
import { profesionalesService } from '@/services/profesionales.service';
import type { ConfiguracionAgenda, BloqueNoDisponible } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const DIAS_SEMANA = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sábado' },
];

function getDiaSemanaLabel(dia: number): string {
  return DIAS_SEMANA.find(d => d.value === dia)?.label || '';
}

function formatTime(time: string): string {
  return time.substring(0, 5);
}

function getEstadoBadge(activo: boolean) {
  return activo ? (
    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300">Activo</Badge>
  ) : (
    <Badge className="bg-slate-100 text-slate-700 border-slate-300">Inactivo</Badge>
  );
}

export default function ProfesionalAgendaConfig() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [profesionalId, setProfesionalId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'agendas' | 'bloques'>('agendas');
  
  // Modales
  const [showAgendaModal, setShowAgendaModal] = useState(false);
  const [showBloqueModal, setShowBloqueModal] = useState(false);
  const [editingAgenda, setEditingAgenda] = useState<ConfiguracionAgenda | null>(null);
  const [editingBloque, setEditingBloque] = useState<BloqueNoDisponible | null>(null);

  // Formularios
  const [agendaForm, setAgendaForm] = useState<CreateAgendaData>({
    profesional_id: '',
    dia_semana: 1,
    hora_inicio: '09:00',
    hora_fin: '18:00',
    duracion_turno_minutos: 30,
    activo: true,
  });
  const [bloqueForm, setBloqueForm] = useState<CreateBloqueData>({
    profesional_id: '',
    fecha_hora_inicio: '',
    fecha_hora_fin: '',
    motivo: '',
  });

  // Obtener el ID del profesional del usuario actual
  useEffect(() => {
    if (user) {
      profesionalesService
        .getAll({ activo: true })
        .then((profesionales) => {
          const profesional = profesionales.find((p) => p.usuario_id === user.id);
          if (profesional) {
            setProfesionalId(profesional.id);
            setAgendaForm((prev) => ({ ...prev, profesional_id: profesional.id }));
            setBloqueForm((prev) => ({ ...prev, profesional_id: profesional.id }));
          } else {
            toast({
              variant: 'destructive',
              title: 'Error',
              description: 'No se encontró información del profesional',
            });
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

  // Queries
  const { data: agendas = [], isLoading: loadingAgendas } = useQuery({
    queryKey: ['agendas', profesionalId],
    queryFn: () => agendaService.getAgendaByProfesional(profesionalId, false),
    enabled: !!profesionalId,
  });

  const { data: bloques = [], isLoading: loadingBloques } = useQuery({
    queryKey: ['bloques', profesionalId],
    queryFn: () => agendaService.getBloquesByProfesional(profesionalId),
    enabled: !!profesionalId,
  });

  // Mutations
  const createAgendaMutation = useMutation({
    mutationFn: (data: CreateAgendaData) => {
      return agendaService.createAgenda(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agendas'] });
      setShowAgendaModal(false);
      resetAgendaForm();
      toast({
        title: 'Éxito',
        description: 'Configuración de agenda creada exitosamente',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error?.response?.data?.message || 'Error al crear configuración de agenda',
        variant: 'destructive',
      });
    },
  });

  const updateAgendaMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateAgendaData> }) => {
      return agendaService.updateAgenda(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agendas'] });
      setShowAgendaModal(false);
      setEditingAgenda(null);
      resetAgendaForm();
      toast({
        title: 'Éxito',
        description: 'Configuración de agenda actualizada exitosamente',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error?.response?.data?.message || 'Error al actualizar configuración de agenda',
        variant: 'destructive',
      });
    },
  });

  const deleteAgendaMutation = useMutation({
    mutationFn: (id: string) => agendaService.deleteAgenda(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agendas'] });
      toast({
        title: 'Éxito',
        description: 'Configuración de agenda eliminada exitosamente',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error?.response?.data?.message || 'Error al eliminar configuración de agenda',
        variant: 'destructive',
      });
    },
  });

  const toggleAgendaMutation = useMutation({
    mutationFn: ({ id, activo }: { id: string; activo: boolean }) => {
      return activo 
        ? agendaService.activateAgenda(id)
        : agendaService.deactivateAgenda(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agendas'] });
      toast({
        title: 'Éxito',
        description: 'Estado de configuración actualizado exitosamente',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error?.response?.data?.message || 'Error al actualizar estado',
        variant: 'destructive',
      });
    },
  });

  const createBloqueMutation = useMutation({
    mutationFn: (data: CreateBloqueData) => agendaService.createBloque(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bloques'] });
      setShowBloqueModal(false);
      resetBloqueForm();
      toast({
        title: 'Éxito',
        description: 'Bloque no disponible creado exitosamente',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error?.response?.data?.message || 'Error al crear bloque no disponible',
        variant: 'destructive',
      });
    },
  });

  const updateBloqueMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateBloqueData> }) => 
      agendaService.updateBloque(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bloques'] });
      setShowBloqueModal(false);
      setEditingBloque(null);
      resetBloqueForm();
      toast({
        title: 'Éxito',
        description: 'Bloque no disponible actualizado exitosamente',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error?.response?.data?.message || 'Error al actualizar bloque no disponible',
        variant: 'destructive',
      });
    },
  });

  const deleteBloqueMutation = useMutation({
    mutationFn: (id: string) => agendaService.deleteBloque(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bloques'] });
      toast({
        title: 'Éxito',
        description: 'Bloque no disponible eliminado exitosamente',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error?.response?.data?.message || 'Error al eliminar bloque no disponible',
        variant: 'destructive',
      });
    },
  });

  // Handlers
  const resetAgendaForm = () => {
    setAgendaForm({
      profesional_id: profesionalId,
      dia_semana: 1,
      hora_inicio: '09:00',
      hora_fin: '18:00',
      duracion_turno_minutos: 30,
      activo: true,
    });
    setEditingAgenda(null);
  };

  const resetBloqueForm = () => {
    setBloqueForm({
      profesional_id: profesionalId,
      fecha_hora_inicio: '',
      fecha_hora_fin: '',
      motivo: '',
    });
    setEditingBloque(null);
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

  const handleOpenBloqueModal = (bloque?: BloqueNoDisponible) => {
    if (bloque) {
      setEditingBloque(bloque);
      setBloqueForm({
        profesional_id: bloque.profesional_id,
        fecha_hora_inicio: bloque.fecha_hora_inicio,
        fecha_hora_fin: bloque.fecha_hora_fin,
        motivo: bloque.motivo || '',
      });
    } else {
      resetBloqueForm();
    }
    setShowBloqueModal(true);
  };

  const handleSubmitAgenda = () => {
    if (editingAgenda) {
      updateAgendaMutation.mutate({ id: editingAgenda.id, data: agendaForm });
    } else {
      createAgendaMutation.mutate(agendaForm);
    }
  };

  const handleSubmitBloque = () => {
    if (editingBloque) {
      updateBloqueMutation.mutate({ id: editingBloque.id, data: bloqueForm });
    } else {
      createBloqueMutation.mutate(bloqueForm);
    }
  };

  const isLoading = loadingAgendas || loadingBloques;

  if (!profesionalId) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Configurar Mi Agenda"
          subtitle="Gestiona tus horarios de trabajo y períodos de no disponibilidad"
          breadcrumbs={[
            { label: 'Pacientes', href: '/pacientes' },
            { label: 'Configurar Agenda' },
          ]}
        />
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configurar Mi Agenda"
        subtitle="Gestiona tus horarios de trabajo y períodos de no disponibilidad"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Configurar Agenda' },
        ]}
        actions={
          <Button onClick={() => handleOpenAgendaModal()}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva Configuración
          </Button>
        }
      />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'agendas' | 'bloques')}>
        <TabsList>
          <TabsTrigger value="agendas">
            <Calendar className="h-4 w-4 mr-2" />
            Horarios ({agendas.length})
          </TabsTrigger>
          <TabsTrigger value="bloques">
            <CalendarX className="h-4 w-4 mr-2" />
            Bloques No Disponibles ({bloques.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab: Configuraciones de Agenda */}
        <TabsContent value="agendas" className="space-y-4">
          {isLoading ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </CardContent>
            </Card>
          ) : agendas.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="No hay configuraciones de agenda"
              description="Crea una nueva configuración para definir tus horarios de trabajo"
              action={
                <Button onClick={() => handleOpenAgendaModal()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nueva Configuración
                </Button>
              }
            />
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Día</TableHead>
                    <TableHead>Horario</TableHead>
                    <TableHead>Duración</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agendas.map((agenda) => (
                    <TableRow key={agenda.id}>
                      <TableCell className="font-medium">
                        {getDiaSemanaLabel(agenda.dia_semana)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          {formatTime(agenda.hora_inicio)} - {formatTime(agenda.hora_fin)}
                        </div>
                      </TableCell>
                      <TableCell>{agenda.duracion_turno_minutos} min</TableCell>
                      <TableCell>{getEstadoBadge(agenda.activo)}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleOpenAgendaModal(agenda)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => toggleAgendaMutation.mutate({ 
                                id: agenda.id, 
                                activo: !agenda.activo 
                              })}
                            >
                              {agenda.activo ? (
                                <>
                                  <XCircle className="h-4 w-4 mr-2" />
                                  Desactivar
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="h-4 w-4 mr-2" />
                                  Activar
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => deleteAgendaMutation.mutate(agenda.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        {/* Tab: Bloques No Disponibles */}
        <TabsContent value="bloques" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => handleOpenBloqueModal()}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Bloque
            </Button>
          </div>

          {isLoading ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </CardContent>
            </Card>
          ) : bloques.length === 0 ? (
            <EmptyState
              icon={CalendarX}
              title="No hay bloques no disponibles"
              description="Crea un nuevo bloque para marcar períodos de no disponibilidad (vacaciones, licencias, etc.)"
              action={
                <Button onClick={() => handleOpenBloqueModal()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nuevo Bloque
                </Button>
              }
            />
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha/Hora Inicio</TableHead>
                    <TableHead>Fecha/Hora Fin</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bloques.map((bloque) => (
                    <TableRow key={bloque.id}>
                      <TableCell>
                        {format(new Date(bloque.fecha_hora_inicio), 'dd/MM/yyyy HH:mm', { locale: es })}
                      </TableCell>
                      <TableCell>
                        {format(new Date(bloque.fecha_hora_fin), 'dd/MM/yyyy HH:mm', { locale: es })}
                      </TableCell>
                      <TableCell>{bloque.motivo || '-'}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleOpenBloqueModal(bloque)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => deleteBloqueMutation.mutate(bloque.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Modal: Crear/Editar Configuración de Agenda */}
      <Dialog open={showAgendaModal} onOpenChange={setShowAgendaModal}>
        <DialogContent className="max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {editingAgenda ? 'Editar Configuración' : 'Nueva Configuración de Agenda'}
            </DialogTitle>
            <DialogDescription>
              {editingAgenda 
                ? 'Modifica los datos de la configuración de agenda'
                : 'Define un nuevo horario de trabajo para un día de la semana'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="dia_semana">Día de la Semana *</Label>
              <Select
                value={agendaForm.dia_semana.toString()}
                onValueChange={(value) => setAgendaForm({ ...agendaForm, dia_semana: parseInt(value) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIAS_SEMANA.map((dia) => (
                    <SelectItem key={dia.value} value={dia.value.toString()}>
                      {dia.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="hora_inicio">Hora Inicio *</Label>
                <Input
                  id="hora_inicio"
                  type="time"
                  value={agendaForm.hora_inicio}
                  onChange={(e) => setAgendaForm({ ...agendaForm, hora_inicio: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hora_fin">Hora Fin *</Label>
                <Input
                  id="hora_fin"
                  type="time"
                  value={agendaForm.hora_fin}
                  onChange={(e) => setAgendaForm({ ...agendaForm, hora_fin: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="duracion_turno_minutos">Duración del Turno (minutos) *</Label>
              <Input
                id="duracion_turno_minutos"
                type="number"
                min="5"
                max="480"
                value={agendaForm.duracion_turno_minutos}
                onChange={(e) => setAgendaForm({ 
                  ...agendaForm, 
                  duracion_turno_minutos: parseInt(e.target.value) || 30 
                })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowAgendaModal(false);
              resetAgendaForm();
            }}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmitAgenda}
              disabled={createAgendaMutation.isPending || updateAgendaMutation.isPending}
            >
              {(createAgendaMutation.isPending || updateAgendaMutation.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingAgenda ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Crear/Editar Bloque No Disponible */}
      <Dialog open={showBloqueModal} onOpenChange={setShowBloqueModal}>
        <DialogContent className="max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {editingBloque ? 'Editar Bloque' : 'Nuevo Bloque No Disponible'}
            </DialogTitle>
            <DialogDescription>
              {editingBloque 
                ? 'Modifica los datos del bloque no disponible'
                : 'Marca un período de tiempo donde no estarás disponible'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="fecha_hora_inicio">Fecha/Hora Inicio *</Label>
              <Input
                id="fecha_hora_inicio"
                type="datetime-local"
                value={bloqueForm.fecha_hora_inicio ? format(new Date(bloqueForm.fecha_hora_inicio), "yyyy-MM-dd'T'HH:mm") : ''}
                onChange={(e) => {
                  const date = e.target.value ? new Date(e.target.value).toISOString() : '';
                  setBloqueForm({ ...bloqueForm, fecha_hora_inicio: date });
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fecha_hora_fin">Fecha/Hora Fin *</Label>
              <Input
                id="fecha_hora_fin"
                type="datetime-local"
                value={bloqueForm.fecha_hora_fin ? format(new Date(bloqueForm.fecha_hora_fin), "yyyy-MM-dd'T'HH:mm") : ''}
                onChange={(e) => {
                  const date = e.target.value ? new Date(e.target.value).toISOString() : '';
                  setBloqueForm({ ...bloqueForm, fecha_hora_fin: date });
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="motivo">Motivo</Label>
              <Input
                id="motivo"
                value={bloqueForm.motivo}
                onChange={(e) => setBloqueForm({ ...bloqueForm, motivo: e.target.value })}
                placeholder="Ej: Vacaciones, Licencia médica, etc."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowBloqueModal(false);
              resetBloqueForm();
            }}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmitBloque}
              disabled={createBloqueMutation.isPending || updateBloqueMutation.isPending}
            >
              {(createBloqueMutation.isPending || updateBloqueMutation.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingBloque ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
