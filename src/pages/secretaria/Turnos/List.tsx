import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
import { Textarea } from '@/components/ui/textarea';
import { 
  Calendar, Clock, User, Phone, Eye, X, 
  CheckCircle, Plus, Loader2 
} from 'lucide-react';
import { turnosService, type CreateTurnoData, type CancelTurnoData } from '@/services/turnos.service';
import { profesionalesService } from '@/services/profesionales.service';
import { pacientesService } from '@/services/pacientes.service';
import type { Turno } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/utils/permissions';

function getEstadoBadge(estado: string) {
  switch (estado) {
    case 'confirmado':
      return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300">Confirmado</Badge>;
    case 'pendiente':
      return <Badge className="bg-violet-100 text-violet-800 border-violet-300">Pendiente</Badge>;
    case 'cancelado':
      return <Badge className="bg-red-100 text-red-800 border-red-300">Cancelado</Badge>;
    case 'completado':
      return <Badge className="bg-sky-100 text-sky-800 border-sky-300">Completado</Badge>;
    default:
      return <Badge variant="outline">{estado}</Badge>;
  }
}

export default function SecretariaTurnos() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [activeProfesional, setActiveProfesional] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedTurno, setSelectedTurno] = useState<Turno | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state para crear turno
  const [createFormData, setCreateFormData] = useState<CreateTurnoData>({
    profesional_id: '',
    paciente_id: '',
    fecha_hora_inicio: '',
    fecha_hora_fin: '',
    estado: 'pendiente',
    motivo: '',
  });

  // Form state para cancelar turno
  const [cancelData, setCancelData] = useState<CancelTurnoData>({
    razon_cancelacion: '',
  });

  // Fetch profesionales (solo activos y no bloqueados)
  const { data: profesionales = [] } = useQuery({
    queryKey: ['profesionales', 'for-turnos-secretaria'],
    queryFn: () => profesionalesService.getAll({ activo: true }),
  });

  // Fetch pacientes activos
  const { data: pacientes = [] } = useQuery({
    queryKey: ['pacientes', 'for-turnos-secretaria'],
    queryFn: () => pacientesService.getAll({ activo: true }),
  });

  // Setear el primer profesional como activo por defecto
  useEffect(() => {
    if (profesionales.length > 0 && !activeProfesional) {
      setActiveProfesional(profesionales[0].id);
    }
  }, [profesionales, activeProfesional]);

  // Fetch turnos del día para el profesional activo
  const fechaInicio = useMemo(() => {
    const fecha = new Date(selectedDate);
    fecha.setHours(0, 0, 0, 0);
    return fecha.toISOString();
  }, [selectedDate]);

  const fechaFin = useMemo(() => {
    const fecha = new Date(selectedDate);
    fecha.setHours(23, 59, 59, 999);
    return fecha.toISOString();
  }, [selectedDate]);

  const { data: turnos = [], isLoading } = useQuery({
    queryKey: ['turnos', 'profesional', activeProfesional, selectedDate],
    queryFn: () =>
      activeProfesional
        ? turnosService.getByProfesional(activeProfesional, fechaInicio, fechaFin)
        : Promise.resolve([]),
    enabled: !!activeProfesional,
  });

  // Filtrar por estado
  const filteredTurnos = useMemo(() => {
    if (statusFilter === 'todos') return turnos;
    return turnos.filter((t) => t.estado === statusFilter);
  }, [turnos, statusFilter]);

  // Ordenar por hora
  const sortedTurnos = useMemo(() => {
    return [...filteredTurnos].sort((a, b) => {
      return new Date(a.fecha_hora_inicio).getTime() - new Date(b.fecha_hora_inicio).getTime();
    });
  }, [filteredTurnos]);

  // Estadísticas
  const stats = useMemo(() => {
    return {
      total: turnos.length,
      confirmados: turnos.filter((t) => t.estado === 'confirmado').length,
      pendientes: turnos.filter((t) => t.estado === 'pendiente').length,
      cancelados: turnos.filter((t) => t.estado === 'cancelado').length,
      completados: turnos.filter((t) => t.estado === 'completado').length,
    };
  }, [turnos]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: CreateTurnoData) => turnosService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['turnos'] });
      toast({
        title: 'Éxito',
        description: 'Turno creado correctamente',
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
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.response?.data?.message || 'Error al crear turno',
      });
    },
  });

  // Cancel mutation
  const cancelMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: CancelTurnoData }) =>
      turnosService.cancel(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['turnos'] });
      toast({
        title: 'Éxito',
        description: 'Turno cancelado correctamente',
      });
      setShowCancelModal(false);
      setSelectedTurno(null);
      setCancelData({ razon_cancelacion: '' });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.response?.data?.message || 'Error al cancelar turno',
      });
    },
  });

  // Confirm mutation
  const confirmMutation = useMutation({
    mutationFn: (id: string) => turnosService.confirm(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['turnos'] });
      toast({
        title: 'Éxito',
        description: 'Turno confirmado correctamente',
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.response?.data?.message || 'Error al confirmar turno',
      });
    },
  });

  const handleCreate = async () => {
    if (!createFormData.profesional_id || !createFormData.paciente_id || !createFormData.fecha_hora_inicio || !createFormData.fecha_hora_fin) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Complete todos los campos requeridos',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await createMutation.mutateAsync(createFormData);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = (turno: Turno) => {
    setSelectedTurno(turno);
    setCancelData({ razon_cancelacion: '' });
    setShowCancelModal(true);
  };

  const handleCancelSubmit = async () => {
    if (!selectedTurno || !cancelData.razon_cancelacion.trim()) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Ingrese la razón de cancelación',
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

  const handleConfirm = async (id: string) => {
    await confirmMutation.mutateAsync(id);
  };

  const handleViewDetail = (turno: Turno) => {
    setSelectedTurno(turno);
    setShowDetailModal(true);
  };

  const canCreate = hasPermission(user, 'turnos.crear');
  const canCancel = hasPermission(user, 'turnos.cancelar');
  const canConfirm = hasPermission(user, 'turnos.confirmar');

  void profesionales.find((p) => p.id === activeProfesional);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Turnos del Día"
        subtitle={format(new Date(selectedDate), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}
        breadcrumbs={[
          { label: 'Dashboard', href: '/secretaria/agendas' },
          { label: 'Turnos' },
        ]}
        actions={
          <>
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-[180px]"
            />
            {canCreate && (
              <Button onClick={() => setShowCreateModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Turno
              </Button>
            )}
          </>
        }
      />

      {/* Status Filters */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={statusFilter === 'todos' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setStatusFilter('todos')}
        >
          Todos ({stats.total})
        </Button>
        <Button
          variant={statusFilter === 'confirmado' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setStatusFilter('confirmado')}
        >
          <CheckCircle className="h-4 w-4 mr-1" />
          Confirmados ({stats.confirmados})
        </Button>
        <Button
          variant={statusFilter === 'pendiente' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setStatusFilter('pendiente')}
        >
          <Clock className="h-4 w-4 mr-1" />
          Pendientes ({stats.pendientes})
        </Button>
        <Button
          variant={statusFilter === 'cancelado' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setStatusFilter('cancelado')}
        >
          <X className="h-4 w-4 mr-1" />
          Cancelados ({stats.cancelados})
        </Button>
      </div>

      {/* Tabs por Profesional */}
      {profesionales.length > 0 && (
        <Tabs value={activeProfesional} onValueChange={setActiveProfesional}>
          <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${profesionales.length}, 1fr)` }}>
            {profesionales.map((prof) => {
              const turnosProf = turnos.filter((t) => t.profesional_id === prof.id).length;
              return (
                <TabsTrigger key={prof.id} value={prof.id} className="gap-2">
                  <span className="hidden sm:inline">
                    {prof.nombre} {prof.apellido}
                  </span>
                  <span className="sm:hidden">
                    {prof.nombre?.[0]}. {prof.apellido}
                  </span>
                  <Badge className="ml-1 bg-teal-50 text-teal-700 border-teal-200">
                    {turnosProf}
                  </Badge>
                </TabsTrigger>
              );
            })}
          </TabsList>

          {profesionales.map((prof) => (
            <TabsContent key={prof.id} value={prof.id} className="space-y-4 mt-4">
              {/* Info del Profesional */}
              <Card>
                <CardContent className="py-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback>
                        {prof.nombre?.[0] || ''}
                        {prof.apellido?.[0] || ''}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">
                        {prof.nombre} {prof.apellido}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {prof.especialidad || 'Sin especialidad'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Timeline de Turnos */}
              {isLoading ? (
                <div className="flex items-center justify-center p-12">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : sortedTurnos.filter((t) => t.profesional_id === prof.id).length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="font-semibold text-lg">Sin turnos</h3>
                    <p className="text-muted-foreground">No hay turnos programados para este día</p>
                    {canCreate && (
                      <Button className="mt-4" onClick={() => setShowCreateModal(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Agregar Turno
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {sortedTurnos
                    .filter((t) => t.profesional_id === prof.id)
                    .map((turno) => (
                      <Card key={turno.id} className="hover:bg-accent/50 transition-colors">
                        <CardContent className="p-4">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                            {/* Hora */}
                            <div className="flex items-center gap-2 min-w-[120px]">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">
                                {format(new Date(turno.fecha_hora_inicio), 'HH:mm', { locale: es })} -{' '}
                                {format(new Date(turno.fecha_hora_fin), 'HH:mm', { locale: es })}
                              </span>
                            </div>

                            {/* Info Paciente */}
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">
                                  {turno.paciente_nombre} {turno.paciente_apellido}
                                </span>
                                {getEstadoBadge(turno.estado)}
                              </div>
                              <div className="flex flex-wrap gap-4 mt-1 text-sm text-muted-foreground">
                                {turno.paciente_dni && <span>DNI: {turno.paciente_dni}</span>}
                                {turno.paciente_telefono && (
                                  <span className="flex items-center gap-1">
                                    <Phone className="h-3 w-3" />
                                    {turno.paciente_telefono}
                                  </span>
                                )}
                                {turno.motivo && <span>{turno.motivo}</span>}
                              </div>
                            </div>

                            {/* Acciones */}
                            <div className="flex flex-wrap gap-2">
                              <Button variant="outline" size="sm" onClick={() => handleViewDetail(turno)}>
                                <Eye className="h-4 w-4 mr-1" />
                                Ver
                              </Button>
                              {canConfirm && turno.estado === 'pendiente' && (
                                <Button size="sm" onClick={() => handleConfirm(turno.id)}>
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  Confirmar
                                </Button>
                              )}
                              {canCancel && turno.estado !== 'cancelado' && turno.estado !== 'completado' && (
                                <Button variant="outline" size="sm" onClick={() => handleCancel(turno)}>
                                  <X className="h-4 w-4 mr-1" />
                                  Cancelar
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                </div>
              )}

              {/* Resumen */}
              <Card>
                <CardContent className="py-3">
                  <div className="flex flex-wrap gap-4 text-sm">
                    <span>
                      Total: <strong>{turnos.filter((t) => t.profesional_id === prof.id).length}</strong> turnos
                    </span>
                    <span>
                      ✅ <strong>{stats.confirmados}</strong> Confirmados
                    </span>
                    <span>
                      ⏰ <strong>{stats.pendientes}</strong> Pendientes
                    </span>
                    <span>
                      ❌ <strong>{stats.cancelados}</strong> Cancelados
                    </span>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      )}

      {/* Modal Ver Detalle */}
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
                  {format(new Date(selectedTurno.fecha_hora_inicio), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}
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
                  <p className="text-sm text-muted-foreground">Profesional</p>
                  <p className="font-medium">
                    {selectedTurno.profesional_nombre} {selectedTurno.profesional_apellido}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Estado</p>
                  {getEstadoBadge(selectedTurno.estado)}
                </div>
                {selectedTurno.motivo && (
                  <div className="col-span-2">
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
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Crear Turno */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Nuevo Turno</DialogTitle>
            <DialogDescription>Completa los datos para agendar un nuevo turno</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="create-profesional">Profesional *</Label>
                <Select
                  value={createFormData.profesional_id}
                  onValueChange={(value) => setCreateFormData({ ...createFormData, profesional_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar profesional" />
                  </SelectTrigger>
                  <SelectContent>
                    {profesionales.map((prof) => (
                      <SelectItem key={prof.id} value={prof.id}>
                        {prof.nombre} {prof.apellido} {prof.especialidad ? `- ${prof.especialidad}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-paciente">Paciente *</Label>
                <Select
                  value={createFormData.paciente_id}
                  onValueChange={(value) => setCreateFormData({ ...createFormData, paciente_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar paciente" />
                  </SelectTrigger>
                  <SelectContent>
                    {pacientes.map((pac) => (
                      <SelectItem key={pac.id} value={pac.id}>
                        {pac.nombre} {pac.apellido} - DNI: {pac.dni}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="create-fecha-inicio">Fecha y Hora Inicio *</Label>
                <Input
                  id="create-fecha-inicio"
                  type="datetime-local"
                  value={createFormData.fecha_hora_inicio}
                  onChange={(e) => setCreateFormData({ ...createFormData, fecha_hora_inicio: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-fecha-fin">Fecha y Hora Fin *</Label>
                <Input
                  id="create-fecha-fin"
                  type="datetime-local"
                  value={createFormData.fecha_hora_fin}
                  onChange={(e) => setCreateFormData({ ...createFormData, fecha_hora_fin: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-estado">Estado</Label>
              <Select
                value={createFormData.estado}
                onValueChange={(value: any) => setCreateFormData({ ...createFormData, estado: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendiente">Pendiente</SelectItem>
                  <SelectItem value="confirmado">Confirmado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-motivo">Motivo</Label>
              <Input
                id="create-motivo"
                value={createFormData.motivo}
                onChange={(e) => setCreateFormData({ ...createFormData, motivo: e.target.value })}
                placeholder="Motivo de la consulta"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                'Crear Turno'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Cancelar Turno */}
      <Dialog open={showCancelModal} onOpenChange={setShowCancelModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar Turno</DialogTitle>
            <DialogDescription>
              ¿Está seguro de cancelar este turno? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedTurno && (
              <div className="p-4 bg-muted rounded-lg">
                <p className="font-medium">
                  {selectedTurno.paciente_nombre} {selectedTurno.paciente_apellido}
                </p>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(selectedTurno.fecha_hora_inicio), "dd 'de' MMMM 'de' yyyy 'a las' HH:mm", {
                    locale: es,
                  })}
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="razon-cancelacion">Razón de Cancelación *</Label>
              <Textarea
                id="razon-cancelacion"
                value={cancelData.razon_cancelacion}
                onChange={(e) => setCancelData({ razon_cancelacion: e.target.value })}
                placeholder="Ingrese la razón de la cancelación"
                rows={3}
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelModal(false)}>
              No Cancelar
            </Button>
            <Button variant="destructive" onClick={handleCancelSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cancelando...
                </>
              ) : (
                'Confirmar Cancelación'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
