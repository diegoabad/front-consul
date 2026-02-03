import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Calendar, Clock, User, Loader2, CalendarX 
} from 'lucide-react';
import { agendaService } from '@/services/agenda.service';
import { profesionalesService } from '@/services/profesionales.service';
import { useToast } from '@/hooks/use-toast';
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

export default function SecretariaAgendas() {
  useToast();
  const [selectedProfesionalId, setSelectedProfesionalId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'agendas' | 'bloques'>('agendas');

  // Obtener profesionales (en producción, esto debería filtrar solo los asignados a esta secretaria)
  const { data: profesionales = [], isLoading: loadingProfesionales } = useQuery({
    queryKey: ['profesionales'],
    queryFn: () => profesionalesService.getAll(),
  });

  // Establecer el primer profesional como seleccionado por defecto
  useEffect(() => {
    if (profesionales.length > 0 && !selectedProfesionalId) {
      setSelectedProfesionalId(profesionales[0].id);
    }
  }, [profesionales, selectedProfesionalId]);

  // Obtener configuraciones de agenda del profesional seleccionado
  const { data: agendas = [], isLoading: loadingAgendas } = useQuery({
    queryKey: ['agendas', selectedProfesionalId],
    queryFn: () => agendaService.getAgendaByProfesional(selectedProfesionalId, false),
    enabled: !!selectedProfesionalId,
  });

  // Obtener bloques no disponibles del profesional seleccionado
  const { data: bloques = [], isLoading: loadingBloques } = useQuery({
    queryKey: ['bloques', selectedProfesionalId],
    queryFn: () => agendaService.getBloquesByProfesional(selectedProfesionalId),
    enabled: !!selectedProfesionalId,
  });

  const isLoading = loadingProfesionales || loadingAgendas || loadingBloques;
  const selectedProfesional = profesionales.find(p => p.id === selectedProfesionalId);

  // Agrupar agendas por día de la semana
  const agendasPorDia = agendas.reduce((acc, agenda) => {
    if (!acc[agenda.dia_semana]) {
      acc[agenda.dia_semana] = [];
    }
    acc[agenda.dia_semana].push(agenda);
    return acc;
  }, {} as Record<number, typeof agendas>);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agendas de Profesionales"
        subtitle="Visualiza las configuraciones de agenda y bloques no disponibles"
        breadcrumbs={[
          { label: 'Turnos', href: '/secretaria/turnos' },
          { label: 'Agendas' },
        ]}
      />

      {/* Selector de Profesional */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Ver agenda de:</span>
            </div>
            <Select value={selectedProfesionalId} onValueChange={setSelectedProfesionalId}>
              <SelectTrigger className="w-[300px]">
                <SelectValue placeholder="Seleccionar profesional" />
              </SelectTrigger>
              <SelectContent>
                {profesionales.map((prof) => (
                  <SelectItem key={prof.id} value={prof.id}>
                    {prof.nombre} {prof.apellido} - {prof.especialidad}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedProfesional && (
              <div className="text-sm text-muted-foreground">
                {selectedProfesional.matricula && `Matrícula: ${selectedProfesional.matricula}`}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {!selectedProfesionalId ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">Selecciona un profesional para ver su agenda</p>
          </CardContent>
        </Card>
      ) : (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'agendas' | 'bloques')}>
          <TabsList>
            <TabsTrigger value="agendas">
              <Calendar className="h-4 w-4 mr-2" />
              Configuraciones ({agendas.length})
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
                description="Este profesional aún no tiene configuraciones de horario"
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {DIAS_SEMANA.map((dia) => {
                  const agendasDelDia = agendasPorDia[dia.value] || [];
                  return (
                    <Card key={dia.value}>
                      <CardHeader>
                        <CardTitle className="text-lg">{dia.label}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {agendasDelDia.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            Sin horarios configurados
                          </p>
                        ) : (
                          agendasDelDia.map((agenda) => (
                            <div
                              key={agenda.id}
                              className="p-3 rounded-lg border bg-card space-y-1"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Clock className="h-4 w-4 text-muted-foreground" />
                                  <span className="font-medium text-sm">
                                    {formatTime(agenda.hora_inicio)} - {formatTime(agenda.hora_fin)}
                                  </span>
                                </div>
                                {getEstadoBadge(agenda.activo)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Duración: {agenda.duracion_turno_minutos} min
                              </div>
                            </div>
                          ))
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Tab: Bloques No Disponibles */}
          <TabsContent value="bloques" className="space-y-4">
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
                description="Este profesional no tiene períodos de no disponibilidad registrados"
              />
            ) : (
              <Card>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {bloques.map((bloque) => (
                      <div key={bloque.id} className="p-4 hover:bg-accent/50 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">
                                {format(new Date(bloque.fecha_hora_inicio), 'dd/MM/yyyy HH:mm', { locale: es })} -{' '}
                                {format(new Date(bloque.fecha_hora_fin), 'dd/MM/yyyy HH:mm', { locale: es })}
                              </span>
                            </div>
                            {bloque.motivo && (
                              <p className="text-sm text-muted-foreground ml-6">
                                {bloque.motivo}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
