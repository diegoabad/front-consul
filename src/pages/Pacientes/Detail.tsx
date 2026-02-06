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
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [showActivateModal, setShowActivateModal] = useState(false);
  const [showAddAsignacionModal, setShowAddAsignacionModal] = useState(false);
  const [searchAsignar, setSearchAsignar] = useState('');
  const [selectedProfesionalId, setSelectedProfesionalId] = useState<string | null>(null);
  const [asignarDropdownOpen, setAsignarDropdownOpen] = useState(false);
  const asignandoRef = useRef(false);
  const asignarModalJustOpenedRef = useRef(false);

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

  const { data: asignaciones = [], refetch: refetchAsignaciones } = useQuery({
    queryKey: ['paciente-asignaciones', id],
    queryFn: () => pacientesService.getAsignaciones(id!),
    enabled: !!id && canSeeTabProfesionales,
  });

  const { data: profesionales = [] } = useQuery({
    queryKey: ['profesionales'],
    queryFn: () => profesionalesService.getAll({ activo: true }),
    enabled: showAddAsignacionModal,
  });

  const addAsignacionMutation = useMutation({
    mutationFn: (profesional_id: string) => pacientesService.addAsignacion(id!, profesional_id),
    onSuccess: (nuevaListaAsignaciones) => {
      // Actualizar caché con la lista que devuelve el servidor para que la UI se sincronice al instante
      queryClient.setQueryData(['paciente-asignaciones', id], nuevaListaAsignaciones ?? []);
      toast({ title: 'Éxito', description: 'Profesional asignado correctamente' });
    },
    onError: async (error: unknown) => {
      const err = error as { response?: { status?: number; data?: { message?: string; error?: { message?: string } } } };
      const msg = err?.response?.data?.message ?? err?.response?.data?.error?.message ?? 'Error al asignar profesional';
      toast({
        variant: 'destructive',
        title: 'Error',
        description: msg,
      });
      // Si el backend dice "ya asignado", refrescar la lista para que el profesional pase a la columna asignados
      if (err?.response?.status === 400) {
        await queryClient.invalidateQueries({ queryKey: ['paciente-asignaciones', id] });
        refetchAsignaciones();
      }
    },
  });

  const removeAsignacionMutation = useMutation({
    mutationFn: (profesionalId: string) => pacientesService.removeAsignacion(id!, profesionalId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['paciente-asignaciones', id] });
      await refetchAsignaciones();
      toast({ title: 'Éxito', description: 'Asignación eliminada correctamente' });
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { error?: { message?: string } } } };
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err?.response?.data?.error?.message || 'Error al quitar asignación',
      });
    },
  });

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
    <div className="space-y-6">
      {/* Volver arriba (pequeño) + Tabs abajo */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6 w-full">
        <div className="space-y-3 w-full">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/pacientes')}
            className="h-auto py-1.5 px-0 text-[13px] font-['Inter'] text-[#6B7280] hover:text-[#374151] hover:bg-transparent font-medium"
          >
            <ChevronLeft className="h-4 w-4 mr-1 stroke-[2] shrink-0" />
            Volver a todos los pacientes
          </Button>
          <TabsList className="flex h-14 w-full min-w-0 items-center justify-start rounded-[12px] bg-[#F9FAFB] p-2 border border-[#E5E7EB] gap-1.5 mb-5">
            <TabsTrigger 
              value="datos" 
              className="inline-flex items-center justify-center whitespace-nowrap rounded-[10px] px-3 py-2.5 text-[13px] font-medium font-['Inter'] ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-[#2563eb] data-[state=active]:text-white data-[state=active]:shadow-sm text-[#6B7280] hover:text-[#374151] [&[data-state=active]_svg]:text-white flex-1"
            >
              <User className="h-4 w-4 mr-1.5 stroke-[2] flex-shrink-0" />
              <span className="truncate">Datos Personales</span>
            </TabsTrigger>
            {canSeeTabProfesionales && (
              <TabsTrigger 
                value="profesionales"
                className="inline-flex items-center justify-center whitespace-nowrap rounded-[10px] px-3 py-2.5 text-[13px] font-medium font-['Inter'] ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-[#2563eb] data-[state=active]:text-white data-[state=active]:shadow-sm text-[#6B7280] hover:text-[#374151] [&[data-state=active]_svg]:text-white flex-1"
              >
                <UserPlus className="h-4 w-4 mr-1.5 stroke-[2] flex-shrink-0" />
                <span className="truncate">Profesionales</span>
              </TabsTrigger>
            )}
            <TabsTrigger 
              value="turnos"
              className="inline-flex items-center justify-center whitespace-nowrap rounded-[10px] px-3 py-2.5 text-[13px] font-medium font-['Inter'] ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-[#2563eb] data-[state=active]:text-white data-[state=active]:shadow-sm text-[#6B7280] hover:text-[#374151] [&[data-state=active]_svg]:text-white flex-1"
            >
              <Clock className="h-4 w-4 mr-1.5 stroke-[2] flex-shrink-0" />
              <span className="truncate">Turnos</span>
            </TabsTrigger>
            <TabsTrigger 
              value="evoluciones"
              className="inline-flex items-center justify-center whitespace-nowrap rounded-[10px] px-3 py-2.5 text-[13px] font-medium font-['Inter'] ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-[#2563eb] data-[state=active]:text-white data-[state=active]:shadow-sm text-[#6B7280] hover:text-[#374151] [&[data-state=active]_svg]:text-white flex-1"
            >
              <Stethoscope className="h-4 w-4 mr-1.5 stroke-[2] flex-shrink-0" />
              <span className="truncate">Evoluciones</span>
            </TabsTrigger>
            <TabsTrigger 
              value="notas"
              className="inline-flex items-center justify-center whitespace-nowrap rounded-[10px] px-3 py-2.5 text-[13px] font-medium font-['Inter'] ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-[#2563eb] data-[state=active]:text-white data-[state=active]:shadow-sm text-[#6B7280] hover:text-[#374151] [&[data-state=active]_svg]:text-white flex-1"
            >
              <StickyNote className="h-4 w-4 mr-1.5 stroke-[2] flex-shrink-0" />
              <span className="truncate">Notas</span>
            </TabsTrigger>
            <TabsTrigger 
              value="archivos"
              className="inline-flex items-center justify-center whitespace-nowrap rounded-[10px] px-3 py-2.5 text-[13px] font-medium font-['Inter'] ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-[#2563eb] data-[state=active]:text-white data-[state=active]:shadow-sm text-[#6B7280] hover:text-[#374151] [&[data-state=active]_svg]:text-white flex-1"
            >
              <Paperclip className="h-4 w-4 mr-1.5 stroke-[2] flex-shrink-0" />
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
                className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-md shadow-[#2563eb]/20 hover:shadow-lg hover:shadow-[#2563eb]/30 transition-all duration-200 rounded-[12px] px-6 h-12 font-medium shrink-0"
              >
                <Edit className="h-5 w-5 mr-2 stroke-[2]" />
                Editar Datos Personales
              </Button>
            )}
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {/* 1. Información Personal */}
            <Card className="border border-[#E5E7EB] rounded-[16px] shadow-sm">
              <CardHeader className="border-b border-[#E5E7EB] pb-4">
                <CardTitle className="text-[20px] font-semibold text-[#111827] font-['Inter'] mb-0">
                  Información Personal
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 gap-4">
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
                  <div className="grid grid-cols-2 gap-4">
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
                onClick={() => setShowAddAsignacionModal(true)}
                className="rounded-[10px] shrink-0"
              >
                <UserPlus className="h-4 w-4 mr-2 stroke-[2]" />
                Asignar profesionales
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
                          {a.profesional_nombre} {a.profesional_apellido}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-[#EF4444] hover:text-[#EF4444] hover:bg-[#FEE2E2] rounded-[8px]"
                          onClick={() => removeAsignacionMutation.mutate(a.profesional_id)}
                          disabled={removeAsignacionMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4 mr-1 stroke-[2]" />
                          Quitar
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

        <TabsContent value="evoluciones" className="space-y-4">
          <PacienteEvoluciones pacienteId={paciente.id} />
        </TabsContent>

        <TabsContent value="notas" className="space-y-4">
          <PacienteNotas pacienteId={paciente.id} />
        </TabsContent>

        <TabsContent value="archivos" className="space-y-4">
          <PacienteArchivos pacienteId={paciente.id} />
        </TabsContent>
      </Tabs>

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
        <DialogContent className="rounded-[16px]">
          <DialogHeader>
            <DialogTitle className="text-[20px] font-semibold font-['Inter']">
              Desactivar Paciente
            </DialogTitle>
            <DialogDescription className="text-[15px] text-[#6B7280] font-['Inter']">
              ¿Está seguro de que desea desactivar este paciente? No se podrán crear turnos, notas o evoluciones para pacientes inactivos.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-3">
            <Button
              variant="outline"
              onClick={() => setShowDeactivateModal(false)}
              className="rounded-[10px]"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleDeactivate}
              disabled={deactivateMutation.isPending}
              className="bg-[#F59E0B] hover:bg-[#D97706] text-white rounded-[10px]"
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

      {/* Modal Asignar profesionales */}
      <Dialog open={showAddAsignacionModal} onOpenChange={(open) => {
          setShowAddAsignacionModal(open);
          if (open) {
            asignarModalJustOpenedRef.current = true;
          } else {
            asignandoRef.current = false;
            setSearchAsignar('');
            setSelectedProfesionalId(null);
            setAsignarDropdownOpen(false);
          }
        }}>
        <DialogContent
          className="max-w-[1000px] min-h-[640px] max-h-[90vh] rounded-[20px] p-0 border border-[#E5E7EB] shadow-2xl flex flex-col overflow-hidden"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader className="px-8 pt-8 pb-6 border-b border-[#E5E7EB] bg-gradient-to-b from-white to-[#F9FAFB] flex-shrink-0 mb-0">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-full bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] flex items-center justify-center shadow-lg shadow-[#2563eb]/30">
                <UserPlus className="h-7 w-7 text-white stroke-[2.5]" />
              </div>
              <div>
                <DialogTitle className="text-[32px] font-bold text-[#111827] font-['Poppins'] leading-tight mb-0">
                  Asignar profesionales al paciente
                </DialogTitle>
                <DialogDescription className="text-base text-[#6B7280] font-['Inter'] mt-1.5 mb-0">
                  Solo los profesionales asignados al paciente podrán verlo y generar evoluciones, notas y subir archivos.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="px-8 pt-4 pb-4 flex flex-col flex-1 min-h-0 overflow-hidden">
            {/* Arriba: Agregar profesional (input + botón) */}
            <div className="flex-shrink-0 space-y-2">
              <label className="text-[14px] font-medium text-[#374151] font-['Inter']">
                Agregar profesional
              </label>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Input
                    type="text"
                    placeholder="Buscar por nombre o especialidad..."
                    value={searchAsignar}
                    onChange={(e) => { setSearchAsignar(e.target.value); if (!e.target.value.trim()) setSelectedProfesionalId(null); }}
                    onFocus={() => {
                      if (asignarModalJustOpenedRef.current) {
                        asignarModalJustOpenedRef.current = false;
                        return;
                      }
                      setAsignarDropdownOpen(true);
                    }}
                    onBlur={() => setTimeout(() => setAsignarDropdownOpen(false), 200)}
                    className="h-11 rounded-[10px] border-[1.5px] border-[#D1D5DB] font-['Inter'] text-[14px] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20"
                  />
                  {(asignarDropdownOpen || searchAsignar.trim().length > 0) && profesionales
                    .filter((p) => !asignaciones.some((a) => a.profesional_id === p.id))
                    .filter((p) => {
                      const q = searchAsignar.trim().toLowerCase();
                      if (!q) return true;
                      const nombre = `${p.nombre ?? ''} ${p.apellido ?? ''}`.toLowerCase();
                      const esp = (p.especialidad ?? '').toLowerCase();
                      return nombre.includes(q) || esp.includes(q);
                    }).length > 0 && (
                    <div className="absolute z-20 top-full left-0 right-0 mt-1 max-h-[260px] overflow-y-auto rounded-[10px] border border-[#E5E7EB] bg-white shadow-lg py-1">
                      {profesionales
                        .filter((p) => !asignaciones.some((a) => a.profesional_id === p.id))
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
                                setSelectedProfesionalId(p.id);
                                setSearchAsignar(label);
                              }}
                              className={`w-full text-left px-4 py-2.5 text-[14px] font-['Inter'] hover:bg-[#F3F4F6] transition-colors ${selectedProfesionalId === p.id ? 'bg-[#dbeafe] text-[#2563eb]' : 'text-[#374151]'}`}
                            >
                              {label}
                            </button>
                          );
                        })}
                    </div>
                  )}
                </div>
                <Button
                  type="button"
                  onClick={() => {
                    if (!selectedProfesionalId || addAsignacionMutation.isPending) return;
                    asignandoRef.current = true;
                    addAsignacionMutation.mutate(selectedProfesionalId, {
                      onSettled: () => {
                        asignandoRef.current = false;
                        setSelectedProfesionalId(null);
                        setSearchAsignar('');
                      },
                    });
                  }}
                  disabled={!selectedProfesionalId || addAsignacionMutation.isPending}
                  className="h-11 px-5 rounded-[10px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-medium font-['Inter'] text-[14px] shrink-0"
                >
                  Asignar
                </Button>
              </div>
              {profesionales.filter((p) => !asignaciones.some((a) => a.profesional_id === p.id)).length === 0 && (
                <p className="text-[13px] text-[#6B7280] font-['Inter']">Todos los profesionales están asignados.</p>
              )}
            </div>

            {/* Abajo: Profesionales asignados (la lista puede ir en 2 columnas cuando hay espacio) */}
            <div className="flex flex-col flex-1 min-h-0 mt-6">
              <h4 className="text-[14px] font-semibold text-[#374151] font-['Inter'] mb-0 flex-shrink-0">
                Profesionales asignados
              </h4>
              <div className="flex-1 min-h-0 overflow-y-auto rounded-[12px] border border-[#E5E7EB] bg-[#F9FAFB] p-2 mt-2 flex flex-col">
                {asignaciones.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center min-h-[120px]">
                    <p className="text-[13px] text-[#6B7280] font-['Inter'] py-4 px-3 text-center mb-0">
                      Ningún profesional asignado
                    </p>
                  </div>
                ) : (
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {asignaciones.map((a: AsignacionPacienteProfesional) => (
                      <li
                        key={a.id}
                        className="flex items-center justify-between gap-2 py-2 px-3 rounded-[8px] bg-white border border-[#E5E7EB]"
                      >
                        <span className="text-[13px] font-medium text-[#374151] font-['Inter'] truncate">
                          {a.profesional_nombre} {a.profesional_apellido}{a.profesional_especialidad ? ` - ${a.profesional_especialidad}` : ''}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-[#EF4444] hover:text-[#EF4444] hover:bg-[#FEE2E2] rounded-[6px] h-8 px-2 text-[12px] shrink-0"
                          onClick={() => removeAsignacionMutation.mutate(a.profesional_id)}
                          disabled={removeAsignacionMutation.isPending}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1 stroke-[2]" />
                          Quitar
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
          <DialogFooter className="px-8 py-5 border-t border-[#E5E7EB] bg-[#F9FAFB] flex flex-row justify-end items-center gap-3 flex-shrink-0 mt-0">
            <Button
              variant="outline"
              onClick={() => setShowAddAsignacionModal(false)}
              className="h-[48px] px-6 rounded-[12px] border-[1.5px] border-[#2563eb] text-[#2563eb] font-medium font-['Inter'] text-[15px] hover:bg-[#dbeafe] hover:border-[#2563eb] transition-all duration-200"
            >
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}