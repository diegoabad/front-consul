import { useState, useMemo } from 'react';
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
import {
  Search, Plus, Eye, Edit, Trash2, Phone,
  User, Loader2, UserCheck, UserX
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { pacientesService, type CreatePacienteData } from '@/services/pacientes.service';
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
  const [isSubmitting, setIsSubmitting] = useState(false);

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
            className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white shadow-md shadow-[#7C3AED]/20 hover:shadow-lg hover:shadow-[#7C3AED]/30 transition-all duration-200 rounded-[12px] px-6 py-3 h-auto font-medium"
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
                className="pl-12 h-12 border-[#D1D5DB] rounded-[10px] text-[16px] font-['Inter'] focus:border-[#7C3AED] focus:ring-[#7C3AED]/20 transition-all duration-200"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabla / Empty States */}
      {isLoading ? (
        <Card className="border border-[#E5E7EB] rounded-[16px] shadow-sm">
          <CardContent className="p-16 text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-[#7C3AED]" />
            <p className="text-[#6B7280] font-['Inter'] text-base">Cargando pacientes...</p>
          </CardContent>
        </Card>
      ) : filteredPacientes.length === 0 ? (
        <Card className="border border-[#E5E7EB] rounded-[16px] shadow-sm">
          <CardContent className="p-16 text-center">
            <div className="h-20 w-20 rounded-full bg-[#EDE9FE] flex items-center justify-center mx-auto mb-4">
              <User className="h-10 w-10 text-[#7C3AED] stroke-[2]" />
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
                className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white shadow-md shadow-[#7C3AED]/20 hover:shadow-lg hover:shadow-[#7C3AED]/30 transition-all duration-200 rounded-[12px] px-6 py-3 h-auto font-medium"
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
                <TableHead className="hidden md:table-cell font-['Inter'] font-medium text-[14px] text-[#374151]">
                  DNI
                </TableHead>
                <TableHead className="hidden lg:table-cell font-['Inter'] font-medium text-[14px] text-[#374151]">
                  Teléfono
                </TableHead>
                <TableHead className="hidden lg:table-cell font-['Inter'] font-medium text-[14px] text-[#374151]">
                  Obra Social
                </TableHead>
                <TableHead className="hidden md:table-cell font-['Inter'] font-medium text-[14px] text-[#374151]">
                  Estado
                </TableHead>
                <TableHead className="font-['Inter'] font-medium text-[14px] text-[#374151] text-right w-[100px]">
                  Acciones
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
                      <Avatar className="h-10 w-10 rounded-full bg-gradient-to-br from-[#EDE9FE] to-[#DDD6FE] shadow-sm">
                        <AvatarFallback className="bg-transparent text-[#7C3AED] font-semibold text-sm">
                          {paciente.nombre[0]}{paciente.apellido[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-[#374151] font-['Inter'] text-[15px] mb-0">
                          {paciente.apellido}, {paciente.nombre}
                        </p>
                        <p className="text-sm text-[#6B7280] md:hidden font-['Inter']">
                          DNI: {formatDNI(paciente.dni)}
                        </p>
                        {paciente.email && (
                          <p className="text-xs text-[#9CA3AF] hidden sm:block font-['Inter']">
                            {paciente.email}
                          </p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-[#6B7280] font-['Inter'] text-[14px]">
                    {formatDNI(paciente.dni)}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {paciente.telefono ? (
                      <div className="flex items-center gap-2 text-[#6B7280] font-['Inter'] text-[14px]">
                        <Phone className="h-4 w-4 stroke-[2]" />
                        {paciente.telefono}
                      </div>
                    ) : (
                      <span className="text-[#9CA3AF]">-</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <Badge className="bg-[#EDE9FE] text-[#7C3AED] border-[#DDD6FE] hover:bg-[#DDD6FE] rounded-full px-3 py-1 text-xs font-medium">
                      {paciente.obra_social || 'Sin cobertura'}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Badge className={
                      paciente.activo
                        ? 'bg-[#D1FAE5] text-[#065F46] border-[#6EE7B7] hover:bg-[#A7F3D0] rounded-full px-3 py-1 text-xs font-medium'
                        : 'bg-[#F3F4F6] text-[#4B5563] border-[#D1D5DB] hover:bg-[#E5E7EB] rounded-full px-3 py-1 text-xs font-medium'
                    }>
                      {paciente.activo ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
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
                        {canUpdate && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEdit(paciente)}
                                className="h-8 w-8 rounded-[8px] hover:bg-[#EDE9FE] transition-all duration-200 text-[#7C3AED] hover:text-[#6D28D9]"
                              >
                                <Edit className="h-4 w-4 stroke-[2]" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent className="bg-[#111827] text-white text-xs font-['Inter'] rounded-[8px] px-3 py-2 [&>p]:text-white">
                              <p className="text-white">Editar</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {paciente.activo && canDeactivate && (
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
                        {!paciente.activo && canActivate && (
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
                        {canDelete && (
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
              ¿Está seguro de que desea desactivar a <span className="font-semibold text-[#374151]">{pacienteToDeactivate?.nombre} {pacienteToDeactivate?.apellido}</span>? No se podrán crear turnos, notas o evoluciones para pacientes inactivos.
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
              ¿Está seguro de que desea activar a <span className="font-semibold text-[#374151]">{pacienteToActivate?.nombre} {pacienteToActivate?.apellido}</span>? Una vez activado, se podrán crear turnos, notas y evoluciones.
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

      {/* Modal Eliminar Paciente */}
      <Dialog open={showDeleteModal} onOpenChange={(open) => {
        if (!open) {
          setShowDeleteModal(false);
          setPacienteToDelete(null);
        }
      }}>
        <DialogContent className="max-w-md rounded-[20px] border border-[#E5E7EB] shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-[24px] font-bold text-[#111827] font-['Poppins'] mb-0">
              Eliminar Paciente
            </DialogTitle>
            <DialogDescription className="text-base text-[#6B7280] font-['Inter'] mt-2 mb-0">
              ¿Estás seguro de que deseas eliminar a <span className="font-semibold text-[#374151]">{pacienteToDelete?.nombre} {pacienteToDelete?.apellido}</span>? Esta acción no se puede deshacer y se eliminará permanentemente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-row justify-end gap-3 mt-6">
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteModal(false);
                setPacienteToDelete(null);
              }}
              disabled={isSubmitting}
              className="h-[48px] px-6 rounded-[12px] font-medium font-['Inter'] text-[15px]"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={isSubmitting}
              className="h-[48px] px-8 rounded-[12px] font-semibold font-['Inter'] text-[15px]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin stroke-[2.5]" />
                  Eliminando...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-5 w-5 stroke-[2]" />
                  Eliminar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}