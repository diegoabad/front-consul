import { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CreatePacienteModal, EditPacienteModal } from './modals';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ConfirmDeleteModal } from '@/components/shared/ConfirmDeleteModal';
import { formatDisplayText } from '@/lib/utils';
import {
  Search, Plus, Eye, Edit, Trash2, Phone,
  User, Loader2, UserCheck, UserX, UserPlus
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { pacientesService, type CreatePacienteData, type AsignacionPacienteProfesional } from '@/services/pacientes.service';
import { profesionalesService } from '@/services/profesionales.service';
import type { Paciente } from '@/types';
import { toast as reactToastify } from 'react-toastify';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/utils/permissions';

// Función para formatear DNI con separadores de miles
const formatDNI = (dni: string): string => {
  if (!dni) return '';
  // Remover cualquier punto existente y luego agregar separadores cada 3 dígitos desde la derecha
  const cleanDNI = dni.replace(/\./g, '');
  return cleanDNI.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

export default function AdminPacientes() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showActivateModal, setShowActivateModal] = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [selectedPaciente, setSelectedPaciente] = useState<Paciente | null>(null);
  const [pacienteToDelete, setPacienteToDelete] = useState<Paciente | null>(null);
  const [pacienteToActivate, setPacienteToActivate] = useState<Paciente | null>(null);
  const [pacienteToDeactivate, setPacienteToDeactivate] = useState<Paciente | null>(null);
  const [showAsignarModal, setShowAsignarModal] = useState(false);
  const [pacienteForAsignar, setPacienteForAsignar] = useState<Paciente | null>(null);
  const [searchAsignarLista, setSearchAsignarLista] = useState('');
  const [selectedProfesionalIdLista, setSelectedProfesionalIdLista] = useState<string | null>(null);
  const [asignarDropdownOpenLista, setAsignarDropdownOpenLista] = useState(false);
  const asignandoRef = useRef(false);
  const asignarModalJustOpenedRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Profesional logueado (para rol profesional: asignar al crear/vincular)
  const isProfesional = user?.rol === 'profesional';
  const { data: profesionalLogueado } = useQuery({
    queryKey: ['profesional-by-user', user?.id],
    queryFn: () => profesionalesService.getByUsuarioId(user!.id),
    enabled: isProfesional && Boolean(user?.id),
  });

  // Fetch pacientes
  const { data: pacientes = [], isLoading } = useQuery({
    queryKey: ['pacientes'],
    queryFn: async () => {
      return pacientesService.getAll();
    },
  });

  // Filter pacientes
  const filteredPacientes = useMemo(() => {
    let result = pacientes;

    if (searchTerm && searchTerm.length >= 2) {
      const term = searchTerm.toLowerCase();
      result = result.filter(p =>
        `${p.nombre} ${p.apellido}`.toLowerCase().includes(term) ||
        p.dni.includes(term) ||
        p.email?.toLowerCase().includes(term)
      );
    }

    return result;
  }, [pacientes, searchTerm]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: CreatePacienteData) => pacientesService.create(data),
    onSuccess: async (newPaciente) => {
      // Si es profesional, asignar el nuevo paciente a su lista
      if (profesionalLogueado?.id) {
        try {
          await pacientesService.addAsignacion(newPaciente.id, profesionalLogueado.id);
        } catch {
          reactToastify.error('Paciente creado pero no se pudo asignar a tu lista', {
            position: 'top-right',
            autoClose: 3000,
          });
        }
      }
      // Cerrar modal primero
      setShowCreateModal(false);
      // Actualizar el cache directamente agregando el nuevo paciente
      queryClient.setQueryData<Paciente[]>(['pacientes'], (oldData = []) => {
        return [...oldData, newPaciente];
      });
      // Invalidar para asegurar que los datos estén sincronizados
      await queryClient.invalidateQueries({ queryKey: ['pacientes'] });
      reactToastify.success('Paciente creado correctamente', {
        position: 'top-right',
        autoClose: 3000,
      });
    },
    onError: (error: any) => {
      const errorData = error.response?.data?.error || {};
      let errorMessage = 'Error al crear paciente';
      
      // Si hay detalles de validación, usar esos mensajes (son más específicos)
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

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreatePacienteData> }) =>
      pacientesService.update(id, data),
    onSuccess: async (updatedPaciente) => {
      setShowEditModal(false);
      setSelectedPaciente(null);
      // Actualizar el cache directamente
      queryClient.setQueryData<Paciente[]>(['pacientes'], (oldData = []) => {
        return oldData.map(p => p.id === updatedPaciente.id ? updatedPaciente : p);
      });
      // Invalidar para asegurar sincronización
      await queryClient.invalidateQueries({ queryKey: ['pacientes'] });
      reactToastify.success('Paciente actualizado correctamente', {
        position: 'top-right',
        autoClose: 3000,
      });
    },
    onError: (error: any) => {
      const errorData = error.response?.data?.error || {};
      let errorMessage = 'Error al actualizar paciente';
      
      // Si hay detalles de validación, usar esos mensajes (son más específicos)
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

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await pacientesService.delete(id);
      return id; // Retornar el id para usarlo en onSuccess
    },
    onSuccess: async (deletedId) => {
      // Actualizar el cache directamente removiendo el paciente
      queryClient.setQueryData<Paciente[]>(['pacientes'], (oldData = []) => {
        return oldData.filter(p => p.id !== deletedId);
      });
      // Invalidar y refetch para asegurar sincronización
      await queryClient.invalidateQueries({ queryKey: ['pacientes'] });
      await queryClient.refetchQueries({ queryKey: ['pacientes'] });
      reactToastify.success('Paciente eliminado correctamente', {
        position: 'top-right',
        autoClose: 3000,
      });
    },
    onError: (error: any) => {
      const errorData = error.response?.data?.error || {};
      const errorMessage = errorData.message || 'Error al eliminar paciente';
      reactToastify.error(errorMessage, {
        position: 'top-right',
        autoClose: 3000,
      });
    },
  });

  const activateMutation = useMutation({
    mutationFn: (id: string) => pacientesService.activate(id),
    onSuccess: async (updatedPaciente) => {
      queryClient.setQueryData<Paciente[]>(['pacientes'], (oldData = []) => {
        return oldData.map(p => p.id === updatedPaciente.id ? updatedPaciente : p);
      });
      await queryClient.invalidateQueries({ queryKey: ['pacientes'] });
      setShowActivateModal(false);
      setPacienteToActivate(null);
      reactToastify.success('Paciente activado correctamente', {
        position: 'top-right',
        autoClose: 3000,
      });
    },
    onError: (error: any) => {
      const errorData = error.response?.data?.error || {};
      const errorMessage = errorData.message || 'Error al activar paciente';
      reactToastify.error(errorMessage, {
        position: 'top-right',
        autoClose: 3000,
      });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => pacientesService.deactivate(id),
    onSuccess: async (updatedPaciente) => {
      queryClient.setQueryData<Paciente[]>(['pacientes'], (oldData = []) => {
        return oldData.map(p => p.id === updatedPaciente.id ? updatedPaciente : p);
      });
      await queryClient.invalidateQueries({ queryKey: ['pacientes'] });
      setShowDeactivateModal(false);
      setPacienteToDeactivate(null);
      reactToastify.success('Paciente desactivado correctamente', {
        position: 'top-right',
        autoClose: 3000,
      });
    },
    onError: (error: any) => {
      const errorData = error.response?.data?.error || {};
      const errorMessage = errorData.message || 'Error al desactivar paciente';
      reactToastify.error(errorMessage, {
        position: 'top-right',
        autoClose: 3000,
      });
    },
  });

  const handleCreate = async (data: CreatePacienteData) => {
    setIsSubmitting(true);
    try {
      await createMutation.mutateAsync(data);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (paciente: Paciente) => {
    setSelectedPaciente(paciente);
    setShowEditModal(true);
  };

  const handleUpdate = async (data: CreatePacienteData) => {
    if (!selectedPaciente) return;
    setIsSubmitting(true);
    try {
      await updateMutation.mutateAsync({
        id: selectedPaciente.id,
        data,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (paciente: Paciente) => {
    setPacienteToDelete(paciente);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!pacienteToDelete) return;
    setIsSubmitting(true);
    try {
      await deleteMutation.mutateAsync(pacienteToDelete.id);
      setShowDeleteModal(false);
      setPacienteToDelete(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const canCreate = hasPermission(user, 'pacientes.crear');
  const canUpdate = hasPermission(user, 'pacientes.actualizar');
  const canDelete = hasPermission(user, 'pacientes.eliminar');
  const canActivate = hasPermission(user, 'pacientes.activar');
  const canDeactivate = hasPermission(user, 'pacientes.desactivar');
  const canAsignarProfesionales = user?.rol === 'administrador' || user?.rol === 'secretaria';

  const { data: asignacionesLista = [], refetch: refetchAsignacionesLista } = useQuery({
    queryKey: ['paciente-asignaciones', pacienteForAsignar?.id],
    queryFn: () => pacientesService.getAsignaciones(pacienteForAsignar!.id),
    enabled: !!showAsignarModal && !!pacienteForAsignar?.id,
  });

  const { data: profesionalesLista = [] } = useQuery({
    queryKey: ['profesionales-list'],
    queryFn: () => profesionalesService.getAll({ activo: true }),
    enabled: showAsignarModal,
  });

  const addAsignacionListaMutation = useMutation({
    mutationFn: (profesional_id: string) =>
      pacientesService.addAsignacion(pacienteForAsignar!.id, profesional_id),
    onSuccess: (nuevaListaAsignaciones) => {
      if (pacienteForAsignar?.id) {
        queryClient.setQueryData(['paciente-asignaciones', pacienteForAsignar.id], nuevaListaAsignaciones ?? []);
      }
      reactToastify.success('Profesional asignado correctamente', { position: 'top-right', autoClose: 3000 });
    },
    onError: async (error: unknown) => {
      const err = error as { response?: { data?: { message?: string }; status?: number } };
      reactToastify.error(err?.response?.data?.message ?? 'Error al asignar profesional', {
        position: 'top-right',
        autoClose: 3000,
      });
      if (err?.response?.status === 400 && pacienteForAsignar?.id) {
        await queryClient.invalidateQueries({ queryKey: ['paciente-asignaciones', pacienteForAsignar.id] });
        refetchAsignacionesLista();
      }
    },
  });

  const removeAsignacionListaMutation = useMutation({
    mutationFn: (profesionalId: string) =>
      pacientesService.removeAsignacion(pacienteForAsignar!.id, profesionalId),
    onSuccess: async () => {
      if (pacienteForAsignar?.id) {
        await queryClient.invalidateQueries({ queryKey: ['paciente-asignaciones', pacienteForAsignar.id] });
        refetchAsignacionesLista();
      }
      reactToastify.success('Asignación eliminada correctamente', { position: 'top-right', autoClose: 3000 });
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      reactToastify.error(err?.response?.data?.message ?? 'Error al quitar asignación', {
        position: 'top-right',
        autoClose: 3000,
      });
    },
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[32px] font-bold text-[#111827] font-['Poppins'] leading-tight tracking-[-0.02em] mb-0">
            Pacientes
          </h1>
          <p className="text-base text-[#6B7280] mt-2 font-['Inter']">
            {isLoading ? 'Cargando...' : `${filteredPacientes.length} ${filteredPacientes.length === 1 ? 'paciente registrado' : 'pacientes registrados'}`}
          </p>
        </div>
        {canCreate && (
          <Button
            onClick={() => setShowCreateModal(true)}
            className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-md shadow-[#2563eb]/20 hover:shadow-lg hover:shadow-[#2563eb]/30 transition-all duration-200 rounded-[12px] px-6 py-3 h-auto font-medium"
          >
            <Plus className="h-5 w-5 mr-2 stroke-[2]" />
            Nuevo Paciente
          </Button>
        )}
      </div>

      {/* Filtros */}
      <Card className="border border-[#E5E7EB] rounded-[16px] shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Buscador */}
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#9CA3AF] stroke-[2]" />
              <Input
                placeholder="Buscar por nombre, DNI o email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-12 h-12 border-[#D1D5DB] rounded-[10px] text-[16px] font-['Inter'] focus:border-[#2563eb] focus:ring-[#2563eb]/20 transition-all duration-200"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabla / Empty States */}
      {isLoading ? (
        <Card className="border border-[#E5E7EB] rounded-[16px] shadow-sm">
          <CardContent className="p-16 text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-[#2563eb]" />
            <p className="text-[#6B7280] font-['Inter'] text-base">Cargando pacientes...</p>
          </CardContent>
        </Card>
      ) : filteredPacientes.length === 0 ? (
        <Card className="border border-[#E5E7EB] rounded-[16px] shadow-sm">
          <CardContent className="p-16 text-center">
            <div className="h-20 w-20 rounded-full bg-[#dbeafe] flex items-center justify-center mx-auto mb-4">
              <User className="h-10 w-10 text-[#2563eb] stroke-[2]" />
            </div>
            <h3 className="text-lg font-semibold mb-2 text-[#374151] font-['Inter']">
              No hay pacientes
            </h3>
            <p className="text-[#6B7280] mb-6 font-['Inter']">
              {searchTerm ? 'No se encontraron pacientes con los filtros aplicados' : 'Comienza agregando tu primer paciente'}
            </p>
            {canCreate && !searchTerm && (
              <Button
                onClick={() => setShowCreateModal(true)}
                className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-md shadow-[#2563eb]/20 hover:shadow-lg hover:shadow-[#2563eb]/30 transition-all duration-200 rounded-[12px] px-6 py-3 h-auto font-medium"
              >
                <Plus className="h-5 w-5 mr-2 stroke-[2]" />
                Agregar Paciente
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="border border-[#E5E7EB] rounded-[16px] shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#F9FAFB] border-b-2 border-[#E5E7EB] hover:bg-[#F9FAFB]">
                <TableHead className="font-['Inter'] font-medium text-[14px] text-[#374151] py-4">
                  Paciente
                </TableHead>
                <TableHead className={isProfesional ? "font-['Inter'] font-medium text-[14px] text-[#374151]" : "hidden md:table-cell font-['Inter'] font-medium text-[14px] text-[#374151]"}>
                  DNI
                </TableHead>
                <TableHead className={isProfesional ? "font-['Inter'] font-medium text-[14px] text-[#374151]" : "hidden lg:table-cell font-['Inter'] font-medium text-[14px] text-[#374151]"}>
                  Teléfono
                </TableHead>
                {isProfesional && (
                  <TableHead className="font-['Inter'] font-medium text-[14px] text-[#374151]">
                    Email
                  </TableHead>
                )}
                <TableHead className={isProfesional ? "font-['Inter'] font-medium text-[14px] text-[#374151]" : "hidden lg:table-cell font-['Inter'] font-medium text-[14px] text-[#374151]"}>
                  Obra Social
                </TableHead>
                {!isProfesional && (
                  <TableHead className="hidden md:table-cell font-['Inter'] font-medium text-[14px] text-[#374151]">
                    Estado
                  </TableHead>
                )}
                <TableHead className={isProfesional ? "font-['Inter'] font-medium text-[14px] text-[#374151]" : "font-['Inter'] font-medium text-[14px] text-[#374151] w-[100px] text-center"}>
                  {isProfesional ? '' : 'Acciones'}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPacientes.map((paciente) => (
                <TableRow
                  key={paciente.id}
                  className="border-b border-[#E5E7EB] hover:bg-[#F9FAFB] transition-colors duration-150"
                >
                  <TableCell className="py-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10 rounded-full bg-gradient-to-br from-[#dbeafe] to-[#bfdbfe] shadow-sm">
                        <AvatarFallback className="bg-transparent text-[#2563eb] font-semibold text-sm">
                          {(paciente.nombre?.[0] ?? '').toUpperCase()}{(paciente.apellido?.[0] ?? '').toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-[#374151] font-['Inter'] text-[15px] mb-0">
                          {formatDisplayText(paciente.apellido)}, {formatDisplayText(paciente.nombre)}
                        </p>
                        {!isProfesional && (
                          <>
                            <p className="text-sm text-[#6B7280] md:hidden font-['Inter']">
                              DNI: {formatDNI(paciente.dni)}
                            </p>
                            {paciente.email && (
                              <p className="text-xs text-[#9CA3AF] hidden sm:block font-['Inter'] mb-0">
                                {paciente.email}
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className={isProfesional ? "text-[#6B7280] font-['Inter'] text-[14px]" : "hidden md:table-cell text-[#6B7280] font-['Inter'] text-[14px]"}>
                    {formatDNI(paciente.dni)}
                  </TableCell>
                  <TableCell className={isProfesional ? '' : 'hidden lg:table-cell'}>
                    {paciente.telefono ? (
                      <div className="flex items-center gap-2 text-[#6B7280] font-['Inter'] text-[14px]">
                        <Phone className="h-4 w-4 stroke-[2]" />
                        {paciente.telefono}
                      </div>
                    ) : (
                      <span className="text-[#9CA3AF]">-</span>
                    )}
                  </TableCell>
                  {isProfesional && (
                    <TableCell className="text-[#6B7280] font-['Inter'] text-[14px]">
                      {paciente.email || '-'}
                    </TableCell>
                  )}
                  <TableCell className={isProfesional ? '' : 'hidden lg:table-cell'}>
                    <Badge className="bg-[#dbeafe] text-[#2563eb] border-[#bfdbfe] hover:bg-[#bfdbfe] rounded-full px-3 py-1 text-xs font-medium">
                      {paciente.obra_social || 'Sin cobertura'}
                    </Badge>
                  </TableCell>
                  {!isProfesional && (
                    <TableCell className="hidden md:table-cell">
                      <Badge className={
                        paciente.activo
                          ? 'bg-[#D1FAE5] text-[#065F46] border-[#6EE7B7] hover:bg-[#A7F3D0] rounded-full px-3 py-1 text-xs font-medium'
                          : 'bg-[#F3F4F6] text-[#4B5563] border-[#D1D5DB] hover:bg-[#E5E7EB] rounded-full px-3 py-1 text-xs font-medium'
                      }>
                        {paciente.activo ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </TableCell>
                  )}
                  <TableCell className={isProfesional ? '' : 'text-right'}>
                    {isProfesional ? (
                      <Button
                        onClick={() => navigate(`/pacientes/${paciente.id}`)}
                        className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-[10px] px-4 py-2 font-['Inter'] text-[14px] font-medium"
                      >
                        Ver ficha
                      </Button>
                    ) : (
                    <TooltipProvider>
                      <div className="flex items-center justify-end gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => navigate(`/pacientes/${paciente.id}`)}
                              className="h-8 w-8 rounded-[8px] hover:bg-[#F3F4F6] transition-all duration-200 text-[#6B7280] hover:text-[#374151]"
                            >
                              <Eye className="h-4 w-4 stroke-[2]" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent className="bg-[#111827] text-white text-xs font-['Inter'] rounded-[8px] px-3 py-2 [&>p]:text-white">
                            <p className="text-white">Ver Detalles</p>
                          </TooltipContent>
                        </Tooltip>
                        {canAsignarProfesionales && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setPacienteForAsignar(paciente);
                                  setShowAsignarModal(true);
                                }}
                                className="h-8 w-8 rounded-[8px] hover:bg-[#ede9fe] transition-all duration-200 text-[#7c3aed] hover:text-[#6d28d9]"
                              >
                                <UserPlus className="h-4 w-4 stroke-[2]" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent className="bg-[#111827] text-white text-xs font-['Inter'] rounded-[8px] px-3 py-2 [&>p]:text-white">
                              <p className="text-white">Asignar profesionales</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {canUpdate && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEdit(paciente)}
                                className="h-8 w-8 rounded-[8px] hover:bg-[#dbeafe] transition-all duration-200 text-[#2563eb] hover:text-[#1d4ed8]"
                              >
                                <Edit className="h-4 w-4 stroke-[2]" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent className="bg-[#111827] text-white text-xs font-['Inter'] rounded-[8px] px-3 py-2 [&>p]:text-white">
                              <p className="text-white">Editar</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {paciente.activo && canDeactivate && user?.rol !== 'profesional' && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setPacienteToDeactivate(paciente);
                                  setShowDeactivateModal(true);
                                }}
                                className="h-8 w-8 rounded-[8px] hover:bg-[#FEF3C7] transition-all duration-200 text-[#F59E0B] hover:text-[#D97706]"
                              >
                                <UserX className="h-4 w-4 stroke-[2]" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent className="bg-[#111827] text-white text-xs font-['Inter'] rounded-[8px] px-3 py-2 [&>p]:text-white">
                              <p className="text-white">Desactivar</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {!paciente.activo && canActivate && user?.rol !== 'profesional' && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setPacienteToActivate(paciente);
                                  setShowActivateModal(true);
                                }}
                                className="h-8 w-8 rounded-[8px] hover:bg-[#D1FAE5] transition-all duration-200 text-[#10B981] hover:text-[#059669]"
                              >
                                <UserCheck className="h-4 w-4 stroke-[2]" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent className="bg-[#111827] text-white text-xs font-['Inter'] rounded-[8px] px-3 py-2 [&>p]:text-white">
                              <p className="text-white">Activar</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {canDelete && user?.rol !== 'profesional' && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(paciente)}
                                className="h-8 w-8 rounded-[8px] hover:bg-[#FEE2E2] transition-all duration-200 text-[#EF4444] hover:text-[#DC2626]"
                              >
                                <Trash2 className="h-4 w-4 stroke-[2]" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent className="bg-[#111827] text-white text-xs font-['Inter'] rounded-[8px] px-3 py-2 [&>p]:text-white">
                              <p className="text-white">Eliminar</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TooltipProvider>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Modales */}
      <CreatePacienteModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        onSubmit={handleCreate}
        isSubmitting={isSubmitting}
        profesionalIdToAssign={isProfesional ? (profesionalLogueado?.id ?? null) : null}
        onVincularExistente={
          isProfesional && profesionalLogueado?.id
            ? async (pacienteId) => {
                await pacientesService.addAsignacion(pacienteId, profesionalLogueado.id);
                await queryClient.invalidateQueries({ queryKey: ['pacientes'] });
              }
            : undefined
        }
      />

      <EditPacienteModal
        open={showEditModal}
        onOpenChange={setShowEditModal}
        paciente={selectedPaciente}
        onSubmit={handleUpdate}
        isSubmitting={isSubmitting}
      />

      {/* Modal Desactivar Paciente */}
      <Dialog open={showDeactivateModal} onOpenChange={(open) => {
        if (!open) {
          setShowDeactivateModal(false);
          setPacienteToDeactivate(null);
        }
      }}>
        <DialogContent className="max-w-md rounded-[20px] border border-[#E5E7EB] shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-[24px] font-bold text-[#111827] font-['Poppins'] mb-0">
              Desactivar Paciente
            </DialogTitle>
            <DialogDescription className="text-base text-[#6B7280] font-['Inter'] mt-2 mb-0">
              ¿Está seguro de que desea desactivar a <span className="font-semibold text-[#374151]">{formatDisplayText(pacienteToDeactivate?.nombre)} {formatDisplayText(pacienteToDeactivate?.apellido)}</span>? No se podrán crear turnos, notas o evoluciones para pacientes inactivos.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-row justify-end gap-3 mt-6">
            <Button
              variant="outline"
              onClick={() => {
                setShowDeactivateModal(false);
                setPacienteToDeactivate(null);
              }}
              disabled={deactivateMutation.isPending}
              className="h-[48px] px-6 rounded-[12px] font-medium font-['Inter'] text-[15px]"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => pacienteToDeactivate && deactivateMutation.mutate(pacienteToDeactivate.id)}
              disabled={deactivateMutation.isPending}
              className="h-[48px] px-8 rounded-[12px] font-semibold font-['Inter'] text-[15px] bg-[#F59E0B] hover:bg-[#D97706] text-white"
            >
              {deactivateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin stroke-[2.5]" />
                  Desactivando...
                </>
              ) : (
                <>
                  <UserX className="mr-2 h-5 w-5 stroke-[2]" />
                  Desactivar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Activar Paciente */}
      <Dialog open={showActivateModal} onOpenChange={(open) => {
        if (!open) {
          setShowActivateModal(false);
          setPacienteToActivate(null);
        }
      }}>
        <DialogContent className="max-w-md rounded-[20px] border border-[#E5E7EB] shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-[24px] font-bold text-[#111827] font-['Poppins'] mb-0">
              Activar Paciente
            </DialogTitle>
            <DialogDescription className="text-base text-[#6B7280] font-['Inter'] mt-2 mb-0">
              ¿Está seguro de que desea activar a <span className="font-semibold text-[#374151]">{formatDisplayText(pacienteToActivate?.nombre)} {formatDisplayText(pacienteToActivate?.apellido)}</span>? Una vez activado, se podrán crear turnos, notas y evoluciones.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-row justify-end gap-3 mt-6">
            <Button
              variant="outline"
              onClick={() => {
                setShowActivateModal(false);
                setPacienteToActivate(null);
              }}
              disabled={activateMutation.isPending}
              className="h-[48px] px-6 rounded-[12px] font-medium font-['Inter'] text-[15px]"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => pacienteToActivate && activateMutation.mutate(pacienteToActivate.id)}
              disabled={activateMutation.isPending}
              className="h-[48px] px-8 rounded-[12px] font-semibold font-['Inter'] text-[15px] bg-[#10B981] hover:bg-[#059669] text-white"
            >
              {activateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin stroke-[2.5]" />
                  Activando...
                </>
              ) : (
                <>
                  <UserCheck className="mr-2 h-5 w-5 stroke-[2]" />
                  Activar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteModal
        open={showDeleteModal}
        onOpenChange={(open) => { setShowDeleteModal(open); if (!open) setPacienteToDelete(null); }}
        title="Eliminar Paciente"
        description={<>¿Estás seguro de que deseas eliminar a <span className="font-semibold text-[#374151]">{formatDisplayText(pacienteToDelete?.nombre)} {formatDisplayText(pacienteToDelete?.apellido)}</span>? Esta acción no se puede deshacer y se eliminará permanentemente.</>}
        onConfirm={handleConfirmDelete}
        isLoading={isSubmitting}
      />

      {/* Modal Asignar profesionales (desde listado) */}
      <Dialog
        open={showAsignarModal}
        onOpenChange={(open) => {
          setShowAsignarModal(open);
          if (open) {
            asignarModalJustOpenedRef.current = true;
          } else {
            setPacienteForAsignar(null);
            setSearchAsignarLista('');
            setSelectedProfesionalIdLista(null);
            setAsignarDropdownOpenLista(false);
            asignandoRef.current = false;
          }
        }}
      >
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
                  Asignar profesionales a {pacienteForAsignar ? `${formatDisplayText(pacienteForAsignar.nombre)} ${formatDisplayText(pacienteForAsignar.apellido)}` : 'paciente'}
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
                    value={searchAsignarLista}
                    onChange={(e) => { setSearchAsignarLista(e.target.value); if (!e.target.value.trim()) setSelectedProfesionalIdLista(null); }}
                    onFocus={() => {
                      if (asignarModalJustOpenedRef.current) {
                        asignarModalJustOpenedRef.current = false;
                        return;
                      }
                      setAsignarDropdownOpenLista(true);
                    }}
                    onBlur={() => setTimeout(() => setAsignarDropdownOpenLista(false), 200)}
                    className="h-11 rounded-[10px] border-[1.5px] border-[#D1D5DB] font-['Inter'] text-[14px] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20"
                  />
                  {(asignarDropdownOpenLista || searchAsignarLista.trim().length > 0) && profesionalesLista
                    .filter((p) => !asignacionesLista.some((a) => a.profesional_id === p.id))
                    .filter((p) => {
                      const q = searchAsignarLista.trim().toLowerCase();
                      if (!q) return true;
                      const nombre = `${p.nombre ?? ''} ${p.apellido ?? ''}`.toLowerCase();
                      const esp = (p.especialidad ?? '').toLowerCase();
                      return nombre.includes(q) || esp.includes(q);
                    }).length > 0 && (
                    <div className="absolute z-20 top-full left-0 right-0 mt-1 max-h-[260px] overflow-y-auto rounded-[10px] border border-[#E5E7EB] bg-white shadow-lg py-1">
                      {profesionalesLista
                        .filter((p) => !asignacionesLista.some((a) => a.profesional_id === p.id))
                        .filter((p) => {
                          const q = searchAsignarLista.trim().toLowerCase();
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
                                setSelectedProfesionalIdLista(p.id);
                                setSearchAsignarLista(label);
                              }}
                              className={`w-full text-left px-4 py-2.5 text-[14px] font-['Inter'] hover:bg-[#F3F4F6] transition-colors ${selectedProfesionalIdLista === p.id ? 'bg-[#dbeafe] text-[#2563eb]' : 'text-[#374151]'}`}
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
                    if (!selectedProfesionalIdLista || addAsignacionListaMutation.isPending || !pacienteForAsignar) return;
                    asignandoRef.current = true;
                    addAsignacionListaMutation.mutate(selectedProfesionalIdLista, {
                      onSettled: () => {
                        asignandoRef.current = false;
                        setSelectedProfesionalIdLista(null);
                        setSearchAsignarLista('');
                      },
                    });
                  }}
                  disabled={!selectedProfesionalIdLista || addAsignacionListaMutation.isPending || !pacienteForAsignar}
                  className="h-11 px-5 rounded-[10px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-medium font-['Inter'] text-[14px] shrink-0"
                >
                  Asignar
                </Button>
              </div>
              {profesionalesLista.filter((p) => !asignacionesLista.some((a) => a.profesional_id === p.id)).length === 0 && (
                <p className="text-[13px] text-[#6B7280] font-['Inter']">Todos los profesionales están asignados.</p>
              )}
            </div>

            {/* Abajo: Profesionales asignados (la lista puede ir en 2 columnas cuando hay espacio) */}
            <div className="flex flex-col flex-1 min-h-0 mt-6">
              <h4 className="text-[14px] font-semibold text-[#374151] font-['Inter'] mb-0 flex-shrink-0">
                Profesionales asignados
              </h4>
              <div className="flex-1 min-h-0 overflow-y-auto rounded-[12px] border border-[#E5E7EB] bg-[#F9FAFB] p-2 mt-2 flex flex-col">
                {asignacionesLista.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center min-h-[120px]">
                    <p className="text-[13px] text-[#6B7280] font-['Inter'] py-4 px-3 text-center mb-0">
                      Ningún profesional asignado
                    </p>
                  </div>
                ) : (
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {asignacionesLista.map((a: AsignacionPacienteProfesional) => (
                      <li key={a.id} className="flex items-center justify-between gap-2 py-2 px-3 rounded-[8px] bg-white border border-[#E5E7EB]">
                        <span className="text-[13px] font-medium text-[#374151] font-['Inter'] truncate">
                          {a.profesional_nombre} {a.profesional_apellido}{a.profesional_especialidad ? ` - ${a.profesional_especialidad}` : ''}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-[#EF4444] hover:text-[#EF4444] hover:bg-[#FEE2E2] rounded-[6px] h-8 px-2 text-[12px] shrink-0"
                          onClick={() => removeAsignacionListaMutation.mutate(a.profesional_id)}
                          disabled={removeAsignacionListaMutation.isPending}
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
              onClick={() => { setShowAsignarModal(false); setPacienteForAsignar(null); }}
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