import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  ChevronLeft, User, Phone, Mail, Calendar, MapPin, 
  FileText, Stethoscope, Paperclip, StickyNote, 
  Loader2, AlertCircle, Clock, Edit, UserPlus, Trash2
} from 'lucide-react';
import { pacientesService, type AsignacionPacienteProfesional } from '@/services/pacientes.service';
import { profesionalesService } from '@/services/profesionales.service';
import { useToast } from '@/hooks/use-toast';
import { toast as reactToastify } from 'react-toastify';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/utils/permissions';
import { formatDisplayText } from '@/lib/utils';
import { EditPacienteModal } from './modals';
import PacienteArchivos from './Archivos';
import PacienteNotas from './Notas';
import PacienteEvoluciones from './Evoluciones';
import PacienteTurnos from './Turnos';

// Función para formatear DNI con separadores de miles
const formatDNI = (dni: string): string => {
  if (!dni) return '';
  // Remover cualquier punto existente y luego agregar separadores cada 3 dígitos desde la derecha
  const cleanDNI = dni.replace(/\./g, '');
  return cleanDNI.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

const calcularEdad = (fechaNacimiento?: string): number | null => {
  if (!fechaNacimiento) return null;
  const hoy = new Date();
  const nacimiento = new Date(fechaNacimiento);
  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  const m = hoy.getMonth() - nacimiento.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nacimiento.getDate())) {
    edad--;
  }
  return edad;
};

export default function PacienteDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('datos');
  const tabsListRef = useRef<HTMLDivElement>(null);

  // En mobile, hacer scroll para que la pestaña seleccionada quede visible
  useEffect(() => {
    if (!tabsListRef.current) return;
    const activeTrigger = tabsListRef.current.querySelector<HTMLElement>('[data-state="active"]');
    activeTrigger?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [activeTab]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [showActivateModal, setShowActivateModal] = useState(false);
  const [showAddAsignacionModal, setShowAddAsignacionModal] = useState(false);
  const [searchAsignar, setSearchAsignar] = useState('');
  const [_selectedProfesionalId, setSelectedProfesionalId] = useState<string | null>(null);
  const [asignarDropdownOpen, setAsignarDropdownOpen] = useState(false);
  const asignandoRef = useRef(false);
  const asignarModalOpenPrevRef = useRef(false);
  const initialAsignacionesRef = useRef<AsignacionPacienteProfesional[]>([]);
  const [draftAsignaciones, setDraftAsignaciones] = useState<AsignacionPacienteProfesional[]>([]);
  const [isSavingAsignaciones, setIsSavingAsignaciones] = useState(false);

  const { data: paciente, isLoading, error } = useQuery({
    queryKey: ['paciente', id],
    queryFn: () => pacientesService.getById(id!),
    enabled: !!id,
  });

  // Activate mutation
  const activateMutation = useMutation({
    mutationFn: (id: string) => pacientesService.activate(id),
    onSuccess: async (updatedPaciente) => {
      queryClient.setQueryData(['paciente', id], updatedPaciente);
      await queryClient.invalidateQueries({ queryKey: ['pacientes'] });
      toast({
        title: 'Éxito',
        description: 'Paciente activado correctamente',
      });
      setShowActivateModal(false);
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.response?.data?.error?.message || 'Error al activar paciente',
      });
    },
  });

  // Deactivate mutation
  const deactivateMutation = useMutation({
    mutationFn: (id: string) => pacientesService.deactivate(id),
    onSuccess: async (updatedPaciente) => {
      queryClient.setQueryData(['paciente', id], updatedPaciente);
      await queryClient.invalidateQueries({ queryKey: ['pacientes'] });
      toast({
        title: 'Éxito',
        description: 'Paciente desactivado correctamente',
      });
      setShowDeactivateModal(false);
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.response?.data?.error?.message || 'Error al desactivar paciente',
      });
    },
  });

  // Update mutation (para EditPacienteModal)
  const updateMutation = useMutation({
    mutationFn: (data: Parameters<typeof pacientesService.update>[1]) =>
      pacientesService.update(id!, data),
    onSuccess: async (updatedPaciente) => {
      queryClient.setQueryData(['paciente', id], updatedPaciente);
      await queryClient.invalidateQueries({ queryKey: ['pacientes'] });
      toast({ title: 'Éxito', description: 'Paciente actualizado correctamente' });
      setShowEditModal(false);
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { error?: { message?: string } } } };
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err?.response?.data?.error?.message || 'Error al actualizar paciente',
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await pacientesService.delete(id);
      return id;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['pacientes'] });
      toast({
        title: 'Éxito',
        description: 'Paciente eliminado correctamente',
      });
      setShowDeleteModal(false);
      navigate('/pacientes');
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.response?.data?.error?.message || 'Error al eliminar paciente',
      });
    },
  });

  const canUpdate = hasPermission(user, 'pacientes.actualizar');
  void hasPermission(user, 'pacientes.eliminar');
  // Pestaña Profesionales solo para administrador y secretaria (no profesionales)
  const canSeeTabProfesionales = user?.rol === 'administrador' || user?.rol === 'secretaria';
  // Pestaña Evoluciones no para secretaria (solo administrador y profesional)
  const canSeeTabEvoluciones = user?.rol !== 'secretaria';

  // Si la secretaria no puede ver Evoluciones y estaba en esa pestaña, volver a datos
  useEffect(() => {
    if (!canSeeTabEvoluciones && activeTab === 'evoluciones') setActiveTab('datos');
  }, [canSeeTabEvoluciones, activeTab]);

  const { data: asignaciones = [], refetch: refetchAsignaciones, isFetched: asignacionesFetched } = useQuery({
    queryKey: ['paciente-asignaciones', id],
    queryFn: () => pacientesService.getAsignaciones(id!),
    enabled: !!id && canSeeTabProfesionales,
  });

  const { data: profesionales = [] } = useQuery({
    queryKey: ['profesionales'],
    queryFn: () => profesionalesService.getAll({ activo: true }),
    enabled: showAddAsignacionModal,
  });

  const removeAsignacionMutation = useMutation({
    mutationFn: (profesionalId: string) => pacientesService.removeAsignacion(id!, profesionalId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['paciente-asignaciones', id] });
      await refetchAsignaciones();
      reactToastify.success('Asignación eliminada correctamente', { position: 'top-right', autoClose: 3000 });
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { error?: { message?: string } } } };
      reactToastify.error(err?.response?.data?.error?.message || 'Error al quitar asignación', { position: 'top-right', autoClose: 3000 });
    },
  });

  // Al abrir el modal (transición a open), sincronizar draft con la lista actual de asignaciones
  useEffect(() => {
    const justOpened = showAddAsignacionModal && !asignarModalOpenPrevRef.current;
    asignarModalOpenPrevRef.current = showAddAsignacionModal;
    if (justOpened && id && asignacionesFetched) {
      setDraftAsignaciones([...asignaciones]);
      initialAsignacionesRef.current = [...asignaciones];
    }
  }, [showAddAsignacionModal, id, asignaciones, asignacionesFetched]);

  const handleGuardarAsignaciones = async () => {
    if (!id) return;
    const profesionalIds = draftAsignaciones.map((a) => a.profesional_id);
    setIsSavingAsignaciones(true);
    try {
      const nuevaLista = await pacientesService.setAsignaciones(id, profesionalIds);
      queryClient.setQueryData(['paciente-asignaciones', id], nuevaLista);
      reactToastify.success('Cambios guardados correctamente', { position: 'top-right', autoClose: 3000 });
      setShowAddAsignacionModal(false);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error al guardar asignaciones';
      reactToastify.error(msg, { position: 'top-right', autoClose: 3000 });
    } finally {
      setIsSavingAsignaciones(false);
    }
  };

  const draftAsignacionesHasChanges =
    draftAsignaciones.length !== initialAsignacionesRef.current.length ||
    initialAsignacionesRef.current.some((a) => !draftAsignaciones.some((d) => d.profesional_id === a.profesional_id)) ||
    draftAsignaciones.some((d) => !initialAsignacionesRef.current.some((i) => i.profesional_id === d.profesional_id));

  useEffect(() => {
    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo cargar la información del paciente',
      });
    }
  }, [error, toast]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-16">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-[#2563eb]" />
          <p className="text-[#6B7280] font-['Inter']">Cargando información del paciente...</p>
        </div>
      </div>
    );
  }

  if (!paciente) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-[32px] font-bold text-[#111827] font-['Poppins'] leading-tight tracking-[-0.02em]">
            Paciente no encontrado
          </h1>
          <p className="text-base text-[#6B7280] mt-2 font-['Inter']">
            El paciente que buscas no existe o fue eliminado
          </p>
        </div>
        <Card className="border border-[#E5E7EB] rounded-[16px] shadow-sm">
          <CardContent className="p-16 text-center">
            <div className="h-20 w-20 rounded-full bg-[#FEE2E2] flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="h-10 w-10 text-[#EF4444] stroke-[2]" />
            </div>
            <h3 className="text-lg font-semibold mb-2 text-[#374151] font-['Inter']">
              Paciente no encontrado
            </h3>
            <p className="text-[#6B7280] mb-6 font-['Inter']">
              El paciente que buscas no existe o fue eliminado.
            </p>
            <Button 
              onClick={() => navigate('/pacientes')}
              className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-md shadow-[#2563eb]/20 hover:shadow-lg hover:shadow-[#2563eb]/30 transition-all duration-200 rounded-[12px] px-6 py-3 h-auto font-medium"
            >
              <ChevronLeft className="h-5 w-5 mr-2 stroke-[2]" />
              Volver a Pacientes
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const edad = calcularEdad(paciente.fecha_nacimiento);

  const handleDelete = () => {
    if (id) {
      deleteMutation.mutate(id);
    }
  };

  const handleActivate = () => {
    if (id) {
      activateMutation.mutate(id);
    }
  };

  const handleDeactivate = () => {
    if (id) {
      deactivateMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-6 max-lg:pb-12 max-lg:px-3">
      {/* Volver arriba (pequeño) + Tabs abajo */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6 w-full">
        <div className="space-y-3 w-full min-w-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/pacientes')}
            className="h-auto py-1.5 px-0 text-[13px] font-['Inter'] text-[#6B7280] hover:text-[#374151] hover:bg-transparent font-medium"
          >
            <ChevronLeft className="h-4 w-4 mr-1 stroke-[2] shrink-0" />
            Volver a todos los pacientes
          </Button>
          <TabsList
            ref={tabsListRef}
            className={`flex h-14 w-full min-w-0 items-center rounded-[12px] bg-[#F9FAFB] p-2 border border-[#E5E7EB] gap-1.5 mb-5 max-md:overflow-x-auto max-md:overflow-y-hidden max-md:flex-nowrap max-md:justify-start ${4 + (canSeeTabProfesionales ? 1 : 0) + (canSeeTabEvoluciones ? 1 : 0) === 6 ? 'md:grid md:grid-cols-6' : 'md:grid md:grid-cols-5'}`}
          >
            <TabsTrigger 
              value="datos" 
              className="inline-flex items-center justify-center whitespace-nowrap rounded-[10px] px-3 py-2.5 text-[13px] font-medium font-['Inter'] ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-[#2563eb] data-[state=active]:text-white data-[state=active]:shadow-sm text-[#6B7280] hover:text-[#374151] [&[data-state=active]_svg]:text-white flex-1 min-w-0 max-md:flex-none max-md:shrink-0"
            >
              <User className="h-4 w-4 mr-1.5 max-md:hidden stroke-[2] flex-shrink-0" />
              <span className="truncate">Datos Personales</span>
            </TabsTrigger>
            {canSeeTabProfesionales && (
              <TabsTrigger 
                value="profesionales"
                className="inline-flex items-center justify-center whitespace-nowrap rounded-[10px] px-3 py-2.5 text-[13px] font-medium font-['Inter'] ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-[#2563eb] data-[state=active]:text-white data-[state=active]:shadow-sm text-[#6B7280] hover:text-[#374151] [&[data-state=active]_svg]:text-white flex-1 min-w-0 max-md:flex-none max-md:shrink-0"
              >
                <UserPlus className="h-4 w-4 mr-1.5 max-md:hidden stroke-[2] flex-shrink-0" />
                <span className="truncate">Profesionales</span>
              </TabsTrigger>
            )}
            <TabsTrigger 
              value="turnos"
              className="inline-flex items-center justify-center whitespace-nowrap rounded-[10px] px-3 py-2.5 text-[13px] font-medium font-['Inter'] ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-[#2563eb] data-[state=active]:text-white data-[state=active]:shadow-sm text-[#6B7280] hover:text-[#374151] [&[data-state=active]_svg]:text-white flex-1 min-w-0 max-md:flex-none max-md:shrink-0"
            >
              <Clock className="h-4 w-4 mr-1.5 max-md:hidden stroke-[2] flex-shrink-0" />
              <span className="truncate">Turnos</span>
            </TabsTrigger>
            {canSeeTabEvoluciones && (
            <TabsTrigger 
              value="evoluciones"
              className="inline-flex items-center justify-center whitespace-nowrap rounded-[10px] px-3 py-2.5 text-[13px] font-medium font-['Inter'] ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-[#2563eb] data-[state=active]:text-white data-[state=active]:shadow-sm text-[#6B7280] hover:text-[#374151] [&[data-state=active]_svg]:text-white flex-1 min-w-0 max-md:flex-none max-md:shrink-0"
            >
              <Stethoscope className="h-4 w-4 mr-1.5 max-md:hidden stroke-[2] flex-shrink-0" />
              <span className="truncate">Evoluciones</span>
            </TabsTrigger>
            )}
            <TabsTrigger 
              value="notas"
              className="inline-flex items-center justify-center whitespace-nowrap rounded-[10px] px-3 py-2.5 text-[13px] font-medium font-['Inter'] ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-[#2563eb] data-[state=active]:text-white data-[state=active]:shadow-sm text-[#6B7280] hover:text-[#374151] [&[data-state=active]_svg]:text-white flex-1 min-w-0 max-md:flex-none max-md:shrink-0"
            >
              <StickyNote className="h-4 w-4 mr-1.5 max-md:hidden stroke-[2] flex-shrink-0" />
              <span className="truncate">Notas</span>
            </TabsTrigger>
            <TabsTrigger 
              value="archivos"
              className="inline-flex items-center justify-center whitespace-nowrap rounded-[10px] px-3 py-2.5 text-[13px] font-medium font-['Inter'] ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-[#2563eb] data-[state=active]:text-white data-[state=active]:shadow-sm text-[#6B7280] hover:text-[#374151] [&[data-state=active]_svg]:text-white flex-1 min-w-0 max-md:flex-none max-md:shrink-0"
            >
              <Paperclip className="h-4 w-4 mr-1.5 max-md:hidden stroke-[2] flex-shrink-0" />
              <span className="truncate">Archivos</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab: Datos Personales - 4 recuadros con mismo estilo de título */}
        <TabsContent value="datos" className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-[24px] font-bold text-[#111827] font-['Poppins'] mb-0">
                Datos Personales
              </h2>
              <p className="text-base text-[#6B7280] mt-1 font-['Inter']">
                Información personal y de contacto del paciente
              </p>
            </div>
            {canUpdate && (
              <Button
                onClick={() => setShowEditModal(true)}
                className="max-lg:hidden bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-md shadow-[#2563eb]/20 hover:shadow-lg hover:shadow-[#2563eb]/30 transition-all duration-200 rounded-[12px] px-6 h-12 font-medium shrink-0"
              >
                <Edit className="h-5 w-5 mr-2 stroke-[2]" />
                Editar Datos Personales
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 min-[1540px]:grid-cols-2 gap-6">
            {/* 1. Información Personal */}
            <Card className="border border-[#E5E7EB] rounded-[16px] shadow-sm">
              <CardHeader className="border-b border-[#E5E7EB] pb-4">
                <CardTitle className="text-[20px] font-semibold text-[#111827] font-['Inter'] mb-0">
                  Información Personal
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 max-lg:grid-cols-1 gap-4">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-[#dbeafe] flex items-center justify-center flex-shrink-0">
                      <User className="h-4 w-4 text-[#2563eb] stroke-[2]" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-[#6B7280] font-['Inter'] mb-0">Nombre</p>
                      <p className="text-[15px] font-medium text-[#374151] font-['Inter'] mb-0">
                        {formatDisplayText(paciente.nombre) || <span className="text-[#9CA3AF] italic">No especificado</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-[#dbeafe] flex items-center justify-center flex-shrink-0">
                      <User className="h-4 w-4 text-[#2563eb] stroke-[2]" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-[#6B7280] font-['Inter'] mb-0">Apellido</p>
                      <p className="text-[15px] font-medium text-[#374151] font-['Inter'] mb-0">
                        {formatDisplayText(paciente.apellido) || <span className="text-[#9CA3AF] italic">No especificado</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-[#dbeafe] flex items-center justify-center flex-shrink-0">
                      <FileText className="h-4 w-4 text-[#2563eb] stroke-[2]" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-[#6B7280] font-['Inter'] mb-0">DNI</p>
                      <p className="text-[15px] font-medium text-[#374151] font-['Inter'] mb-0">
                        {formatDNI(paciente.dni) || <span className="text-[#9CA3AF] italic">No especificado</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-[#dbeafe] flex items-center justify-center flex-shrink-0">
                      <Calendar className="h-4 w-4 text-[#2563eb] stroke-[2]" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-[#6B7280] font-['Inter'] mb-0">Fecha de Nacimiento</p>
                      <p className="text-[15px] font-medium text-[#374151] font-['Inter'] mb-0">
                        {paciente.fecha_nacimiento 
                          ? `${format(new Date(paciente.fecha_nacimiento), 'dd/MM/yyyy', { locale: es })}${edad ? ` (${edad} años)` : ''}`
                          : <span className="text-[#9CA3AF] italic">No especificada</span>
                        }
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 2. Información de Contactos */}
            <Card className="border border-[#E5E7EB] rounded-[16px] shadow-sm">
              <CardHeader className="border-b border-[#E5E7EB] pb-4">
                <CardTitle className="text-[20px] font-semibold text-[#111827] font-['Inter'] mb-0">
                  Información de Contactos
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 max-lg:grid-cols-1 gap-4">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-[#DBEAFE] flex items-center justify-center flex-shrink-0">
                        <Phone className="h-4 w-4 text-[#3B82F6] stroke-[2]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[#6B7280] font-['Inter'] mb-0">Teléfono</p>
                        <p className="text-[15px] font-medium text-[#374151] font-['Inter'] mb-0">
                          {paciente.telefono || <span className="text-[#9CA3AF] italic">No especificado</span>}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-[#FEF3C7] flex items-center justify-center flex-shrink-0">
                        <Mail className="h-4 w-4 text-[#F59E0B] stroke-[2]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[#6B7280] font-['Inter'] mb-0">Email</p>
                        <p className="text-[15px] font-medium text-[#374151] font-['Inter'] mb-0">
                          {paciente.email || <span className="text-[#9CA3AF] italic">No especificado</span>}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-[#D1FAE5] flex items-center justify-center flex-shrink-0">
                      <MapPin className="h-4 w-4 text-[#10B981] stroke-[2]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#6B7280] font-['Inter'] mb-0">Dirección</p>
                      <p className="text-[15px] font-medium text-[#374151] font-['Inter'] mb-0">
                        {paciente.direccion || <span className="text-[#9CA3AF] italic">No especificada</span>}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 3. Cobertura Médica */}
            <Card className="border border-[#E5E7EB] rounded-[16px] shadow-sm">
              <CardHeader className="border-b border-[#E5E7EB] pb-4">
                <CardTitle className="text-[20px] font-semibold text-[#111827] font-['Inter'] mb-0">
                  Cobertura Médica
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-[#dbeafe] flex items-center justify-center flex-shrink-0">
                      <FileText className="h-4 w-4 text-[#2563eb] stroke-[2]" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-[#6B7280] font-['Inter'] mb-0">Obra Social</p>
                      <p className="text-[15px] font-medium text-[#374151] font-['Inter'] mb-0">
                        {paciente.obra_social || <span className="text-[#9CA3AF] italic">No especificada</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-[#DBEAFE] flex items-center justify-center flex-shrink-0">
                      <FileText className="h-4 w-4 text-[#3B82F6] stroke-[2]" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-[#6B7280] font-['Inter'] mb-0">N° de Afiliado</p>
                      <p className="text-[15px] font-medium text-[#374151] font-['Inter'] mb-0">
                        {paciente.numero_afiliado || <span className="text-[#9CA3AF] italic">No especificado</span>}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 4. Contacto de Emergencia */}
            <Card className="border border-[#E5E7EB] rounded-[16px] shadow-sm">
              <CardHeader className="border-b border-[#E5E7EB] pb-4">
                <CardTitle className="text-[20px] font-semibold text-[#111827] font-['Inter'] mb-0">
                  Contacto de Emergencia
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-[#dbeafe] flex items-center justify-center flex-shrink-0">
                      <User className="h-4 w-4 text-[#2563eb] stroke-[2]" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-[#6B7280] font-['Inter'] mb-0">Nombre</p>
                      <p className="text-[15px] font-medium text-[#374151] font-['Inter'] mb-0">
                        {paciente.contacto_emergencia_nombre || <span className="text-[#9CA3AF] italic">No especificado</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-[#DBEAFE] flex items-center justify-center flex-shrink-0">
                      <Phone className="h-4 w-4 text-[#3B82F6] stroke-[2]" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-[#6B7280] font-['Inter'] mb-0">Teléfono</p>
                      <p className="text-[15px] font-medium text-[#374151] font-['Inter'] mb-0">
                        {paciente.contacto_emergencia_telefono || <span className="text-[#9CA3AF] italic">No especificado</span>}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab: Profesionales (solo administrador y secretaria, no profesionales) */}
        {canSeeTabProfesionales && (
          <TabsContent value="profesionales" className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-[24px] font-bold text-[#111827] font-['Poppins'] mb-0">
                  Profesionales
                </h2>
                <p className="text-base text-[#6B7280] mt-1 font-['Inter']">
                  Profesionales asignados a este paciente. Solo ellos podrán verlo y generar evoluciones, notas y subir archivos.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  refetchAsignaciones().then(() => setShowAddAsignacionModal(true));
                }}
                className="max-lg:hidden rounded-[10px] shrink-0"
              >
                <UserPlus className="h-4 w-4 mr-2 stroke-[2]" />
                Vincular profesional
              </Button>
            </div>
            <Card className="border border-[#E5E7EB] rounded-[16px] shadow-sm">
              <CardContent className="pt-6">
                {asignaciones.length === 0 ? (
                  <p className="text-[#6B7280] font-['Inter'] text-sm">
                    No hay profesionales asignados. Solo los profesionales asignados podrán ver este paciente en su lista.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {asignaciones.map((a: AsignacionPacienteProfesional) => (
                      <li
                        key={a.id}
                        className="flex items-center justify-between gap-3 py-2 px-3 rounded-[10px] bg-[#F9FAFB] border border-[#E5E7EB]"
                      >
                        <span className="text-[15px] font-medium text-[#374151] font-['Inter']">
                          {formatDisplayText(a.profesional_nombre)} {formatDisplayText(a.profesional_apellido)}{a.profesional_especialidad ? ` - ${formatDisplayText(a.profesional_especialidad)}` : ''}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-[#EF4444] hover:text-[#EF4444] hover:bg-[#FEE2E2] rounded-[8px] h-8 w-8 shrink-0"
                          onClick={() => removeAsignacionMutation.mutate(a.profesional_id)}
                          disabled={removeAsignacionMutation.isPending}
                          aria-label="Quitar"
                        >
                          <Trash2 className="h-4 w-4 stroke-[2]" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Otros Tabs */}
        <TabsContent value="turnos" className="space-y-4">
          <PacienteTurnos pacienteId={paciente.id} />
        </TabsContent>

        {canSeeTabEvoluciones && (
        <TabsContent value="evoluciones" className="space-y-4">
          <PacienteEvoluciones pacienteId={paciente.id} />
        </TabsContent>
        )}

        <TabsContent value="notas" className="space-y-4">
          <PacienteNotas pacienteId={paciente.id} />
        </TabsContent>

        <TabsContent value="archivos" className="space-y-4">
          <PacienteArchivos pacienteId={paciente.id} />
        </TabsContent>
      </Tabs>

      {/* FAB móvil: acción principal según pestaña */}
      {((activeTab === 'datos' && canUpdate) || (activeTab === 'profesionales' && canSeeTabProfesionales)) && (
        <div className="lg:hidden fixed bottom-6 right-6 z-40">
          <Button
            onClick={() => {
              if (activeTab === 'datos') setShowEditModal(true);
              if (activeTab === 'profesionales') {
                refetchAsignaciones().then(() => setShowAddAsignacionModal(true));
              }
            }}
            className="h-14 w-14 rounded-full shadow-lg shadow-[#2563eb]/30 bg-[#2563eb] hover:bg-[#1d4ed8] text-white p-0"
            title={activeTab === 'datos' ? 'Editar Datos Personales' : 'Vincular profesional'}
          >
            {activeTab === 'datos' ? (
              <Edit className="h-6 w-6 stroke-[2]" />
            ) : (
              <UserPlus className="h-6 w-6 stroke-[2]" />
            )}
          </Button>
        </div>
      )}

      {/* Modal Editar */}
      {showEditModal && paciente && (
        <EditPacienteModal
          paciente={paciente}
          open={showEditModal}
          onOpenChange={setShowEditModal}
          onSubmit={async (data) => {
            await updateMutation.mutateAsync(data);
          }}
          isSubmitting={updateMutation.isPending}
        />
      )}

      <ConfirmDeleteModal
        open={showDeleteModal}
        onOpenChange={setShowDeleteModal}
        title="Eliminar Paciente"
        description="¿Está seguro de que desea eliminar este paciente? Esta acción no se puede deshacer."
        onConfirm={handleDelete}
        isLoading={deleteMutation.isPending}
      />

      {/* Modal Desactivar */}
      <Dialog open={showDeactivateModal} onOpenChange={setShowDeactivateModal}>
        <DialogContent className="max-w-md min-h-[280px] rounded-[20px] border border-[#E5E7EB] shadow-2xl gap-0 p-6">
          <DialogHeader className="pb-4 mb-0 border-b border-[#E5E7EB]">
            <DialogTitle className="text-[24px] font-bold text-[#111827] font-['Poppins'] mb-0">
              Desactivar Paciente
            </DialogTitle>
          </DialogHeader>
          <div className="mt-5 mb-1">
            <p className="text-base text-[#6B7280] font-['Inter'] leading-relaxed">
              ¿Está seguro de que desea desactivar este paciente? No se podrán crear turnos, notas o evoluciones para pacientes inactivos.
            </p>
          </div>
          <DialogFooter className="flex flex-row justify-end gap-3 mt-0 pt-4 border-t border-[#E5E7EB]">
            <Button
              variant="outline"
              onClick={() => setShowDeactivateModal(false)}
              disabled={deactivateMutation.isPending}
              className="h-[48px] px-6 rounded-[12px] font-medium font-['Inter'] text-[15px]"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleDeactivate}
              disabled={deactivateMutation.isPending}
              className="h-[48px] px-8 rounded-[12px] font-semibold font-['Inter'] text-[15px] bg-[#F59E0B] hover:bg-[#D97706] text-white"
            >
              {deactivateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Desactivando...
                </>
              ) : (
                'Desactivar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Activar */}
      <Dialog open={showActivateModal} onOpenChange={setShowActivateModal}>
        <DialogContent className="rounded-[16px]">
          <DialogHeader>
            <DialogTitle className="text-[20px] font-semibold font-['Inter']">
              Activar Paciente
            </DialogTitle>
            <DialogDescription className="text-[15px] text-[#6B7280] font-['Inter']">
              ¿Está seguro de que desea activar este paciente? Una vez activado, se podrán crear turnos, notas y evoluciones.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-3">
            <Button
              variant="outline"
              onClick={() => setShowActivateModal(false)}
              className="rounded-[10px]"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleActivate}
              disabled={activateMutation.isPending}
              className="bg-[#10B981] hover:bg-[#059669] text-white rounded-[10px]"
            >
              {activateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Activando...
                </>
              ) : (
                'Activar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Vincular profesional */}
      <Dialog open={showAddAsignacionModal} onOpenChange={(open) => {
          setShowAddAsignacionModal(open);
          if (!open) {
            asignandoRef.current = false;
            setSearchAsignar('');
            setSelectedProfesionalId(null);
            setAsignarDropdownOpen(false);
          }
        }}>
        <DialogContent
          className="max-w-[1000px] min-h-[640px] max-h-[90vh] max-lg:max-h-[85vh] rounded-[20px] p-0 border border-[#E5E7EB] shadow-2xl flex flex-col overflow-hidden"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader className="px-8 max-lg:px-4 pt-8 max-lg:pt-4 pb-6 max-lg:pb-4 border-b border-[#E5E7EB] bg-gradient-to-b from-white to-[#F9FAFB] flex-shrink-0 mb-0">
            <div className="flex items-center gap-4">
              <div className="max-lg:hidden h-14 w-14 rounded-full bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] flex items-center justify-center shadow-lg shadow-[#2563eb]/30">
                <UserPlus className="h-7 w-7 text-white stroke-[2.5]" />
              </div>
              <div>
                <DialogTitle className="text-[32px] max-lg:text-[20px] font-bold text-[#111827] font-['Poppins'] leading-tight mb-0">
                  Vincular profesional
                </DialogTitle>
                <DialogDescription className="text-base max-lg:text-sm text-[#6B7280] font-['Inter'] mt-1.5 mb-0">
                  Seleccioná profesionales para que puedan atender a este paciente.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="px-8 max-lg:px-4 pt-4 pb-4 flex flex-col flex-1 min-h-0 overflow-y-auto">
              <div className="flex-shrink-0 space-y-2">
                <label className="text-[14px] max-lg:text-[13px] font-medium text-[#374151] font-['Inter']">
                  Seleccionar profesional
                </label>
                <div className="relative">
                  <Input
                    type="text"
                    placeholder="Buscar por nombre o especialidad..."
                    value={searchAsignar}
                    onChange={(e) => { setSearchAsignar(e.target.value); if (!e.target.value.trim()) setSelectedProfesionalId(null); }}
                    onFocus={() => setAsignarDropdownOpen(true)}
                    onBlur={() => setTimeout(() => setAsignarDropdownOpen(false), 200)}
                    className="h-11 max-lg:h-10 rounded-[10px] max-lg:rounded-[8px] border-[1.5px] border-[#D1D5DB] font-['Inter'] text-[14px] max-lg:text-[13px] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20"
                  />
                  {(asignarDropdownOpen || searchAsignar.trim().length > 0) && profesionales
                    .filter((p) => !draftAsignaciones.some((a) => a.profesional_id === p.id))
                    .filter((p) => {
                      const q = searchAsignar.trim().toLowerCase();
                      if (!q) return true;
                      const nombre = `${p.nombre ?? ''} ${p.apellido ?? ''}`.toLowerCase();
                      const esp = (p.especialidad ?? '').toLowerCase();
                      return nombre.includes(q) || esp.includes(q);
                    }).length > 0 && (
                    <div className="absolute z-20 top-full left-0 right-0 mt-1 max-h-[260px] overflow-y-auto rounded-[10px] border border-[#E5E7EB] bg-white shadow-lg py-1">
                      {profesionales
                        .filter((p) => !draftAsignaciones.some((a) => a.profesional_id === p.id))
                        .filter((p) => {
                          const q = searchAsignar.trim().toLowerCase();
                          const nombre = `${p.nombre ?? ''} ${p.apellido ?? ''}`.toLowerCase();
                          const esp = (p.especialidad ?? '').toLowerCase();
                          return nombre.includes(q) || esp.includes(q);
                        })
                        .map((p) => {
                          const label = `${formatDisplayText(p.nombre)} ${formatDisplayText(p.apellido)}${p.especialidad ? ` - ${formatDisplayText(p.especialidad)}` : ''}`;
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setDraftAsignaciones((prev) => [
                                  ...prev,
                                  {
                                    id: `temp-${p.id}`,
                                    paciente_id: id!,
                                    asignado_por_usuario_id: user?.id ?? null,
                                    fecha_asignacion: new Date().toISOString(),
                                    profesional_id: p.id,
                                    profesional_nombre: p.nombre ?? '',
                                    profesional_apellido: p.apellido ?? '',
                                    profesional_especialidad: p.especialidad ?? '',
                                  },
                                ]);
                                setSearchAsignar('');
                                setSelectedProfesionalId(null);
                                // No cerrar el dropdown: queda abierto para seguir eligiendo hasta que toque afuera
                              }}
                              className="w-full text-left px-4 py-2.5 text-[14px] font-['Inter'] hover:bg-[#F3F4F6] transition-colors text-[#374151]"
                            >
                              {label}
                            </button>
                          );
                        })}
                    </div>
                  )}
                </div>
                {profesionales.filter((p) => !draftAsignaciones.some((a) => a.profesional_id === p.id)).length === 0 && (
                  <p className="text-[13px] max-lg:text-[12px] text-[#6B7280] font-['Inter']">Todos los profesionales están asignados.</p>
                )}
              </div>

              <div className="flex flex-col flex-shrink-0 mt-6">
                <h4 className="text-[14px] max-lg:text-[13px] font-semibold text-[#374151] font-['Inter'] mb-0">
                  Profesionales asignados
                </h4>
                <div className="min-h-[120px] rounded-[12px] border border-[#E5E7EB] bg-[#F9FAFB] p-2 mt-2">
                  {draftAsignaciones.length === 0 ? (
                    <div className="flex items-center justify-center min-h-[100px]">
                      <p className="text-[13px] max-lg:text-[12px] text-[#6B7280] font-['Inter'] py-4 px-3 text-center mb-0">
                        Ningún profesional asignado
                      </p>
                    </div>
                  ) : (
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {draftAsignaciones.map((a) => (
                        <li key={a.id ?? a.profesional_id} className="flex items-center justify-between gap-2 py-2 px-3 rounded-[8px] bg-white border border-[#E5E7EB]">
<span className="text-[13px] max-lg:text-[12px] font-medium text-[#374151] font-['Inter'] truncate">
                          {formatDisplayText(a.profesional_nombre)} {formatDisplayText(a.profesional_apellido)}{a.profesional_especialidad ? ` - ${formatDisplayText(a.profesional_especialidad)}` : ''}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-[#EF4444] hover:text-[#EF4444] hover:bg-[#FEE2E2] rounded-[6px] h-8 w-8 shrink-0"
                            onClick={() => setDraftAsignaciones((prev) => prev.filter((x) => x.profesional_id !== a.profesional_id))}
                            aria-label="Quitar"
                          >
                            <Trash2 className="h-3.5 w-3.5 stroke-[2]" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="px-8 max-lg:px-4 py-5 max-lg:py-4 border-t border-[#E5E7EB] bg-[#F9FAFB] flex flex-row max-lg:flex-col justify-end items-center gap-3 max-lg:gap-2 flex-shrink-0 mt-0">
            <div className="flex gap-3 max-lg:w-full max-lg:flex-col max-lg:gap-2">
              <Button
                variant="outline"
                onClick={() => setShowAddAsignacionModal(false)}
                className="h-[48px] max-lg:h-11 px-6 rounded-[12px] border-[1.5px] border-[#2563eb] text-[#2563eb] font-medium font-['Inter'] text-[15px] hover:bg-[#dbeafe] hover:border-[#2563eb] transition-all duration-200 max-lg:w-full"
              >
                Cerrar
              </Button>
              <Button
                onClick={() => void handleGuardarAsignaciones()}
                disabled={!draftAsignacionesHasChanges || isSavingAsignaciones}
                className="h-[48px] max-lg:h-11 px-6 rounded-[12px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-semibold font-['Inter'] text-[15px] disabled:opacity-50 max-lg:w-full"
              >
                {isSavingAsignaciones ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin stroke-[2.5]" />
                    Guardando...
                  </>
                ) : (
                  'Guardar cambios'
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}