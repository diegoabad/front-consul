import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
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
import { 
  ChevronLeft, User, Phone, Mail, Calendar, MapPin, 
  FileText, Stethoscope, Paperclip, StickyNote, 
  Loader2, AlertCircle, Clock, Edit
} from 'lucide-react';
import { pacientesService } from '@/services/pacientes.service';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/utils/permissions';
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
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-[#7C3AED]" />
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
              className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white shadow-md shadow-[#7C3AED]/20 hover:shadow-lg hover:shadow-[#7C3AED]/30 transition-all duration-200 rounded-[12px] px-6 py-3 h-auto font-medium"
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
      {/* Tabs - Arriba de todo */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="inline-flex h-12 items-center justify-center rounded-[12px] bg-[#F9FAFB] p-1.5 border border-[#E5E7EB] w-full gap-1.5">
          <TabsTrigger 
            value="datos" 
            className="inline-flex items-center justify-center whitespace-nowrap rounded-[10px] px-3 py-2.5 text-[13px] font-medium font-['Inter'] ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-[#7C3AED] data-[state=active]:text-white data-[state=active]:shadow-sm text-[#6B7280] hover:text-[#374151] [&[data-state=active]_svg]:text-white flex-1"
          >
            <User className="h-4 w-4 mr-1.5 stroke-[2] flex-shrink-0" />
            <span className="truncate">Datos Personales</span>
          </TabsTrigger>
          <TabsTrigger 
            value="turnos"
            className="inline-flex items-center justify-center whitespace-nowrap rounded-[10px] px-3 py-2.5 text-[13px] font-medium font-['Inter'] ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-[#7C3AED] data-[state=active]:text-white data-[state=active]:shadow-sm text-[#6B7280] hover:text-[#374151] [&[data-state=active]_svg]:text-white flex-1"
          >
            <Clock className="h-4 w-4 mr-1.5 stroke-[2] flex-shrink-0" />
            <span className="truncate">Turnos</span>
          </TabsTrigger>
          <TabsTrigger 
            value="evoluciones"
            className="inline-flex items-center justify-center whitespace-nowrap rounded-[10px] px-3 py-2.5 text-[13px] font-medium font-['Inter'] ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-[#7C3AED] data-[state=active]:text-white data-[state=active]:shadow-sm text-[#6B7280] hover:text-[#374151] [&[data-state=active]_svg]:text-white flex-1"
          >
            <Stethoscope className="h-4 w-4 mr-1.5 stroke-[2] flex-shrink-0" />
            <span className="truncate">Evoluciones</span>
          </TabsTrigger>
          <TabsTrigger 
            value="notas"
            className="inline-flex items-center justify-center whitespace-nowrap rounded-[10px] px-3 py-2.5 text-[13px] font-medium font-['Inter'] ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-[#7C3AED] data-[state=active]:text-white data-[state=active]:shadow-sm text-[#6B7280] hover:text-[#374151] [&[data-state=active]_svg]:text-white flex-1"
          >
            <StickyNote className="h-4 w-4 mr-1.5 stroke-[2] flex-shrink-0" />
            <span className="truncate">Notas</span>
          </TabsTrigger>
          <TabsTrigger 
            value="archivos"
            className="inline-flex items-center justify-center whitespace-nowrap rounded-[10px] px-3 py-2.5 text-[13px] font-medium font-['Inter'] ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-[#7C3AED] data-[state=active]:text-white data-[state=active]:shadow-sm text-[#6B7280] hover:text-[#374151] [&[data-state=active]_svg]:text-white flex-1"
          >
            <Paperclip className="h-4 w-4 mr-1.5 stroke-[2] flex-shrink-0" />
            <span className="truncate">Archivos</span>
          </TabsTrigger>
        </TabsList>

        {/* Botones de Acción */}
        <div className="flex items-center justify-between gap-3">
          <Button 
            variant="outline" 
            onClick={() => navigate('/pacientes')}
            className="h-11 px-5 rounded-[12px] border-[1.5px] border-[#D1D5DB] font-medium font-['Inter'] text-[15px] hover:bg-[#F3F4F6] transition-all duration-200"
          >
            <ChevronLeft className="h-4 w-4 mr-2 stroke-[2]" />
            Volver
          </Button>
          
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
                className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white shadow-md shadow-[#7C3AED]/20 hover:shadow-lg hover:shadow-[#7C3AED]/30 transition-all duration-200 rounded-[12px] px-6 h-12 font-medium shrink-0"
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
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 rounded-full bg-[#EDE9FE] flex items-center justify-center flex-shrink-0">
                      <User className="h-4 w-4 text-[#7C3AED] stroke-[2]" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-[#6B7280] font-['Inter'] mb-1">Nombre</p>
                      <p className="text-[15px] font-medium text-[#374151] font-['Inter']">
                        {paciente.nombre || <span className="text-[#9CA3AF] italic">No especificado</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 rounded-full bg-[#EDE9FE] flex items-center justify-center flex-shrink-0">
                      <User className="h-4 w-4 text-[#7C3AED] stroke-[2]" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-[#6B7280] font-['Inter'] mb-1">Apellido</p>
                      <p className="text-[15px] font-medium text-[#374151] font-['Inter']">
                        {paciente.apellido || <span className="text-[#9CA3AF] italic">No especificado</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 rounded-full bg-[#EDE9FE] flex items-center justify-center flex-shrink-0">
                      <FileText className="h-4 w-4 text-[#7C3AED] stroke-[2]" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-[#6B7280] font-['Inter'] mb-1">DNI</p>
                      <p className="text-[15px] font-medium text-[#374151] font-['Inter']">
                        {formatDNI(paciente.dni) || <span className="text-[#9CA3AF] italic">No especificado</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 rounded-full bg-[#EDE9FE] flex items-center justify-center flex-shrink-0">
                      <Calendar className="h-4 w-4 text-[#7C3AED] stroke-[2]" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-[#6B7280] font-['Inter'] mb-1">Fecha de Nacimiento</p>
                      <p className="text-[15px] font-medium text-[#374151] font-['Inter']">
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
                    <div className="flex items-start gap-3">
                      <div className="h-9 w-9 rounded-full bg-[#DBEAFE] flex items-center justify-center flex-shrink-0">
                        <Phone className="h-4 w-4 text-[#3B82F6] stroke-[2]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[#6B7280] font-['Inter'] mb-1">Teléfono</p>
                        <p className="text-[15px] font-medium text-[#374151] font-['Inter']">
                          {paciente.telefono || <span className="text-[#9CA3AF] italic">No especificado</span>}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="h-9 w-9 rounded-full bg-[#FEF3C7] flex items-center justify-center flex-shrink-0">
                        <Mail className="h-4 w-4 text-[#F59E0B] stroke-[2]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[#6B7280] font-['Inter'] mb-1">Email</p>
                        <p className="text-[15px] font-medium text-[#374151] font-['Inter']">
                          {paciente.email || <span className="text-[#9CA3AF] italic">No especificado</span>}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 rounded-full bg-[#D1FAE5] flex items-center justify-center flex-shrink-0">
                      <MapPin className="h-4 w-4 text-[#10B981] stroke-[2]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#6B7280] font-['Inter'] mb-1">Dirección</p>
                      <p className="text-[15px] font-medium text-[#374151] font-['Inter']">
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
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 rounded-full bg-[#EDE9FE] flex items-center justify-center flex-shrink-0">
                      <FileText className="h-4 w-4 text-[#7C3AED] stroke-[2]" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-[#6B7280] font-['Inter'] mb-1">Obra Social</p>
                      <p className="text-[15px] font-medium text-[#374151] font-['Inter']">
                        {paciente.obra_social || <span className="text-[#9CA3AF] italic">No especificada</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 rounded-full bg-[#DBEAFE] flex items-center justify-center flex-shrink-0">
                      <FileText className="h-4 w-4 text-[#3B82F6] stroke-[2]" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-[#6B7280] font-['Inter'] mb-1">N° de Afiliado</p>
                      <p className="text-[15px] font-medium text-[#374151] font-['Inter']">
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
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 rounded-full bg-[#EDE9FE] flex items-center justify-center flex-shrink-0">
                      <User className="h-4 w-4 text-[#7C3AED] stroke-[2]" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-[#6B7280] font-['Inter'] mb-1">Nombre</p>
                      <p className="text-[15px] font-medium text-[#374151] font-['Inter']">
                        {paciente.contacto_emergencia_nombre || <span className="text-[#9CA3AF] italic">No especificado</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 rounded-full bg-[#DBEAFE] flex items-center justify-center flex-shrink-0">
                      <Phone className="h-4 w-4 text-[#3B82F6] stroke-[2]" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-[#6B7280] font-['Inter'] mb-1">Teléfono</p>
                      <p className="text-[15px] font-medium text-[#374151] font-['Inter']">
                        {paciente.contacto_emergencia_telefono || <span className="text-[#9CA3AF] italic">No especificado</span>}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

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

      {/* Modal Eliminar */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="rounded-[16px]">
          <DialogHeader>
            <DialogTitle className="text-[20px] font-semibold font-['Inter']">
              Eliminar Paciente
            </DialogTitle>
            <DialogDescription className="text-[15px] text-[#6B7280] font-['Inter']">
              ¿Está seguro de que desea eliminar este paciente? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-3">
            <Button
              variant="outline"
              onClick={() => setShowDeleteModal(false)}
              className="rounded-[10px]"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="bg-[#EF4444] hover:bg-[#DC2626] text-white rounded-[10px]"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Eliminando...
                </>
              ) : (
                'Eliminar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
    </div>
  );
}