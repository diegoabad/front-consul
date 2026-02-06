import { useState, useMemo, useRef, useEffect } from 'react';
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
  Search, Plus, Eye, Edit, Trash2,
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
  const [_selectedProfesionalIdLista, setSelectedProfesionalIdLista] = useState<string | null>(null);
  const [asignarDropdownOpenLista, setAsignarDropdownOpenLista] = useState(false);
  const asignandoRef = useRef(false);
  const asignarModalOpenPrevRef = useRef(false);
  const asignarModalSyncedDraftRef = useRef(false);
  const initialAsignacionesListaRef = useRef<AsignacionPacienteProfesional[]>([]);
  const [draftAsignacionesLista, setDraftAsignacionesLista] = useState<AsignacionPacienteProfesional[]>([]);
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

  const { data: asignacionesLista = [], isFetched: asignacionesListaFetched } = useQuery({
    queryKey: ['paciente-asignaciones', pacienteForAsignar?.id],
    queryFn: () => pacientesService.getAsignaciones(pacienteForAsignar!.id),
    enabled: !!showAsignarModal && !!pacienteForAsignar?.id,
  });

  const { data: profesionalesLista = [] } = useQuery({
    queryKey: ['profesionales-list'],
    queryFn: () => profesionalesService.getAll({ activo: true }),
    enabled: showAsignarModal,
  });

  // Al abrir el modal (desde icono de acciones o de otro lado), sincronizar draft cuando lleguen las asignaciones
  useEffect(() => {
    const justOpened = showAsignarModal && !asignarModalOpenPrevRef.current;
    asignarModalOpenPrevRef.current = showAsignarModal;
    if (justOpened) {
      asignarModalSyncedDraftRef.current = false;
    }
    if (showAsignarModal && pacienteForAsignar?.id && asignacionesListaFetched && !asignarModalSyncedDraftRef.current) {
      asignarModalSyncedDraftRef.current = true;
      setDraftAsignacionesLista([...asignacionesLista]);
      initialAsignacionesListaRef.current = [...asignacionesLista];
    }
  }, [showAsignarModal, pacienteForAsignar?.id, asignacionesLista, asignacionesListaFetched]);

  const handleGuardarAsignacionesLista = async () => {
    if (!pacienteForAsignar?.id) return;
    const profesionalIds = draftAsignacionesLista.map((a) => a.profesional_id);
    setIsSubmitting(true);
    try {
      const nuevaLista = await pacientesService.setAsignaciones(pacienteForAsignar.id, profesionalIds);
      queryClient.setQueryData(['paciente-asignaciones', pacienteForAsignar.id], nuevaLista);
      reactToastify.success('Cambios guardados correctamente', { position: 'top-right', autoClose: 3000 });
      setShowAsignarModal(false);
      setPacienteForAsignar(null);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error al guardar asignaciones';
      reactToastify.error(msg, { position: 'top-right', autoClose: 3000 });
    } finally {
      setIsSubmitting(false);
    }
  };

  const draftListaHasChanges =
    draftAsignacionesLista.length !== initialAsignacionesListaRef.current.length ||
    initialAsignacionesListaRef.current.some(
      (a) => !draftAsignacionesLista.some((d) => d.profesional_id === a.profesional_id)
    ) ||
    draftAsignacionesLista.some(
      (d) => !initialAsignacionesListaRef.current.some((i) => i.profesional_id === d.profesional_id)
    );

  return (
    <div className="space-y-8 max-lg:pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[32px] max-lg:text-[24px] font-bold text-[#111827] font-['Poppins'] leading-tight tracking-[-0.02em] mb-0">
            Pacientes
          </h1>
          <p className="text-base max-lg:text-sm text-[#6B7280] mt-2 font-['Inter']">
            {isLoading ? 'Cargando...' : `${filteredPacientes.length} ${filteredPacientes.length === 1 ? 'paciente registrado' : 'pacientes registrados'}`}
          </p>
        </div>
        {canCreate && (
          <Button
            onClick={() => setShowCreateModal(true)}
            className="max-lg:hidden bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-md shadow-[#2563eb]/20 hover:shadow-lg hover:shadow-[#2563eb]/30 transition-all duration-200 rounded-[12px] px-6 py-3 h-auto font-medium"
          >
            <Plus className="h-5 w-5 mr-2 stroke-[2]" />
            Nuevo Paciente
          </Button>
        )}
      </div>

      {/* Filtros */}
      <Card className="!mt-0 border border-[#E5E7EB] rounded-[16px] max-lg:rounded-[12px] shadow-sm">
        <CardContent className="p-6 max-lg:p-4">
          <div className="flex flex-col sm:flex-row gap-4 max-lg:gap-3">
            {/* Buscador */}
            <div className="relative flex-1">
              <Search className="absolute left-4 max-lg:left-3 top-1/2 -translate-y-1/2 h-5 w-5 max-lg:h-4 max-lg:w-4 text-[#9CA3AF] stroke-[2]" />
              <Input
                placeholder="Buscar por nombre, DNI o email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-12 max-lg:pl-10 h-12 max-lg:h-9 border-[#D1D5DB] rounded-[10px] max-lg:rounded-[8px] text-[16px] max-lg:text-[14px] font-['Inter'] focus:border-[#2563eb] focus:ring-[#2563eb]/20 transition-all duration-200"
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
        <Card className="border border-[#E5E7EB] rounded-[16px] max-lg:rounded-[12px] shadow-sm overflow-hidden">
          <div className="max-lg:overflow-x-auto">
            <Table className="min-w-[720px]">
              <TableHeader>
                <TableRow className="bg-[#F9FAFB] border-b-2 border-[#E5E7EB] hover:bg-[#F9FAFB]">
                  <TableHead className="font-['Inter'] font-medium text-[14px] max-lg:text-[13px] text-[#374151] py-4 max-lg:py-3 w-[28%] min-w-[200px]">
                    Paciente
                  </TableHead>
                  <TableHead className="font-['Inter'] font-medium text-[14px] max-lg:text-[13px] text-[#374151] w-[12%] min-w-[100px]">
                    DNI
                  </TableHead>
                  <TableHead className="font-['Inter'] font-medium text-[14px] max-lg:text-[13px] text-[#374151] min-w-[110px]">
                    Teléfono
                  </TableHead>
                  {isProfesional && (
                    <TableHead className="font-['Inter'] font-medium text-[14px] max-lg:text-[13px] text-[#374151] min-w-[120px]">
                      Email
                    </TableHead>
                  )}
                  <TableHead className="font-['Inter'] font-medium text-[14px] max-lg:text-[13px] text-[#374151] w-[18%] min-w-[150px]">
                    Obra Social
                  </TableHead>
                  {!isProfesional && (
                    <TableHead className="font-['Inter'] font-medium text-[14px] max-lg:text-[13px] text-[#374151] min-w-[80px]">
                      Estado
                    </TableHead>
                  )}
                  <TableHead className="font-['Inter'] font-medium text-[14px] max-lg:text-[13px] text-[#374151] w-[100px] min-w-[100px] text-center">
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
                    <TableCell className="py-4 max-lg:py-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 max-lg:hidden rounded-full bg-gradient-to-br from-[#dbeafe] to-[#bfdbfe] shadow-sm">
                          <AvatarFallback className="bg-transparent text-[#2563eb] font-semibold text-sm">
                            {(paciente.nombre?.[0] ?? '').toUpperCase()}{(paciente.apellido?.[0] ?? '').toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="font-medium text-[#374151] font-['Inter'] text-[15px] max-lg:text-[14px] mb-0">
                            {formatDisplayText(paciente.apellido)}, {formatDisplayText(paciente.nombre)}
                          </p>
                          {!isProfesional && paciente.email && (
                            <p className="text-xs text-[#9CA3AF] hidden sm:block font-['Inter'] mb-0 truncate max-w-[180px]">
                              {paciente.email}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-[#6B7280] font-['Inter'] text-[14px] max-lg:text-[13px]">
                      {formatDNI(paciente.dni)}
                    </TableCell>
                    <TableCell className="max-lg:text-[13px]">
                    {paciente.telefono ? (
                      <span className="text-[#6B7280] font-['Inter'] text-[14px] max-lg:text-[13px]">{paciente.telefono}</span>
                    ) : (
                      <span className="text-[#9CA3AF]">-</span>
                    )}
                  </TableCell>
                  {isProfesional && (
                    <TableCell className="text-[#6B7280] font-['Inter'] text-[14px]">
                      {paciente.email || '-'}
                    </TableCell>
                  )}
                  <TableCell>
                    <Badge className="bg-[#dbeafe] text-[#2563eb] border-[#bfdbfe] hover:bg-[#bfdbfe] rounded-full px-3 py-1 text-xs max-lg:text-[11px] font-medium">
                      {paciente.obra_social || 'Sin cobertura'}
                    </Badge>
                  </TableCell>
                  {!isProfesional && (
                    <TableCell>
                      <Badge className={
                        paciente.activo
                          ? 'bg-[#D1FAE5] text-[#065F46] border-[#6EE7B7] hover:bg-[#A7F3D0] rounded-full px-3 py-1 text-xs max-lg:text-[11px] font-medium'
                          : 'bg-[#F3F4F6] text-[#4B5563] border-[#D1D5DB] hover:bg-[#E5E7EB] rounded-full px-3 py-1 text-xs max-lg:text-[11px] font-medium'
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
                              <p className="text-white">Vincular profesional</p>
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
          </div>
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
        <DialogContent className="max-w-md min-h-[280px] rounded-[20px] border border-[#E5E7EB] shadow-2xl gap-0 p-6">
          <DialogHeader className="pb-4 mb-0 border-b border-[#E5E7EB]">
            <DialogTitle className="text-[24px] font-bold text-[#111827] font-['Poppins'] mb-0">
              Desactivar Paciente
            </DialogTitle>
          </DialogHeader>
          <div className="mt-5 mb-1">
            <p className="text-base text-[#6B7280] font-['Inter'] leading-relaxed">
              ¿Está seguro de que desea desactivar a <span className="font-semibold text-[#374151]">{formatDisplayText(pacienteToDeactivate?.nombre)} {formatDisplayText(pacienteToDeactivate?.apellido)}</span>? No se podrán crear turnos, notas o evoluciones para pacientes inactivos.
            </p>
          </div>
          <DialogFooter className="flex flex-row justify-end gap-3 mt-0 pt-4 border-t border-[#E5E7EB]">
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

      {/* Modal Vincular profesional (desde listado) */}
      <Dialog
        open={showAsignarModal}
        onOpenChange={(open) => {
          setShowAsignarModal(open);
          if (!open) {
            setPacienteForAsignar(null);
            setSearchAsignarLista('');
            setSelectedProfesionalIdLista(null);
            setAsignarDropdownOpenLista(false);
            asignandoRef.current = false;
          }
        }}
      >
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
                  <span className="max-lg:hidden">Vincular profesional a {pacienteForAsignar ? `${formatDisplayText(pacienteForAsignar.nombre)} ${formatDisplayText(pacienteForAsignar.apellido)}` : 'paciente'}</span>
                  <span className="lg:hidden">Vincular profesional</span>
                </DialogTitle>
                <DialogDescription className="text-base max-lg:text-sm text-[#6B7280] font-['Inter'] mt-1.5 mb-0">
                  Seleccioná profesionales para que puedan atender a este paciente.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="px-8 max-lg:px-4 pt-4 pb-4 flex flex-col flex-1 min-h-0 overflow-y-auto">
              {/* Arriba: Seleccionar profesional (solo input; al elegir se agrega a la lista) */}
              <div className="flex-shrink-0 space-y-2">
                <label className="text-[14px] max-lg:text-[13px] font-medium text-[#374151] font-['Inter']">
                  Seleccionar profesional
                </label>
                <div className="relative">
                  <Input
                    type="text"
                    placeholder="Buscar por nombre o especialidad..."
                    value={searchAsignarLista}
                    onChange={(e) => { setSearchAsignarLista(e.target.value); if (!e.target.value.trim()) setSelectedProfesionalIdLista(null); }}
                    onFocus={() => setAsignarDropdownOpenLista(true)}
                    onBlur={() => setTimeout(() => setAsignarDropdownOpenLista(false), 200)}
                    className="h-11 max-lg:h-10 rounded-[10px] max-lg:rounded-[8px] border-[1.5px] border-[#D1D5DB] font-['Inter'] text-[14px] max-lg:text-[13px] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20"
                  />
                  {(asignarDropdownOpenLista || searchAsignarLista.trim().length > 0) && profesionalesLista
                    .filter((p) => !draftAsignacionesLista.some((a) => a.profesional_id === p.id))
                    .filter((p) => {
                      const q = searchAsignarLista.trim().toLowerCase();
                      if (!q) return true;
                      const nombre = `${p.nombre ?? ''} ${p.apellido ?? ''}`.toLowerCase();
                      const esp = (p.especialidad ?? '').toLowerCase();
                      return nombre.includes(q) || esp.includes(q);
                    }).length > 0 && (
                    <div className="absolute z-20 top-full left-0 right-0 mt-1 max-h-[260px] overflow-y-auto rounded-[10px] border border-[#E5E7EB] bg-white shadow-lg py-1">
                      {profesionalesLista
                        .filter((p) => !draftAsignacionesLista.some((a) => a.profesional_id === p.id))
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
                                setDraftAsignacionesLista((prev) => [
                                  ...prev,
                                  {
                                    id: `temp-${p.id}`,
                                    paciente_id: pacienteForAsignar!.id,
                                    asignado_por_usuario_id: user?.id ?? null,
                                    fecha_asignacion: new Date().toISOString(),
                                    profesional_id: p.id,
                                    profesional_nombre: p.nombre ?? '',
                                    profesional_apellido: p.apellido ?? '',
                                    profesional_especialidad: p.especialidad ?? '',
                                  },
                                ]);
                                setSearchAsignarLista('');
                                setSelectedProfesionalIdLista(null);
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
                {profesionalesLista.filter((p) => !draftAsignacionesLista.some((a) => a.profesional_id === p.id)).length === 0 && (
                  <p className="text-[13px] max-lg:text-[12px] text-[#6B7280] font-['Inter']">Todos los profesionales están asignados.</p>
                )}
              </div>

              {/* Abajo: Profesionales asignados (crece sin scroll interno; scroll del modal) */}
              <div className="flex flex-col flex-shrink-0 mt-6">
                <h4 className="text-[14px] max-lg:text-[13px] font-semibold text-[#374151] font-['Inter'] mb-0">
                  Profesionales asignados
                </h4>
                <div className="min-h-[120px] rounded-[12px] border border-[#E5E7EB] bg-[#F9FAFB] p-2 mt-2">
                  {draftAsignacionesLista.length === 0 ? (
                    <div className="flex items-center justify-center min-h-[100px]">
                      <p className="text-[13px] max-lg:text-[12px] text-[#6B7280] font-['Inter'] py-4 px-3 text-center mb-0">
                        Ningún profesional asignado
                      </p>
                    </div>
                  ) : (
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {draftAsignacionesLista.map((a) => (
                        <li key={a.id ?? a.profesional_id} className="flex items-center justify-between gap-2 py-2 px-3 rounded-[8px] bg-white border border-[#E5E7EB]">
                          <span className="text-[13px] max-lg:text-[12px] font-medium text-[#374151] font-['Inter'] truncate">
                            {formatDisplayText(a.profesional_nombre)} {formatDisplayText(a.profesional_apellido)}{a.profesional_especialidad ? ` - ${formatDisplayText(a.profesional_especialidad)}` : ''}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-[#EF4444] hover:text-[#EF4444] hover:bg-[#FEE2E2] rounded-[6px] h-8 w-8 shrink-0"
                            onClick={() => setDraftAsignacionesLista((prev) => prev.filter((x) => x.profesional_id !== a.profesional_id))}
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
                onClick={() => { setShowAsignarModal(false); setPacienteForAsignar(null); }}
                className="h-[48px] max-lg:h-11 px-6 rounded-[12px] border-[1.5px] border-[#2563eb] text-[#2563eb] font-medium font-['Inter'] text-[15px] hover:bg-[#dbeafe] hover:border-[#2563eb] transition-all duration-200 max-lg:w-full"
              >
                Cerrar
              </Button>
              <Button
                onClick={() => void handleGuardarAsignacionesLista()}
                disabled={!draftListaHasChanges || isSubmitting}
                className="h-[48px] max-lg:h-11 px-6 rounded-[12px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-semibold font-['Inter'] text-[15px] disabled:opacity-50 max-lg:w-full"
              >
                {isSubmitting ? (
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

      {/* FAB Nuevo Paciente (solo mobile) */}
      {canCreate && (
        <Button
          onClick={() => setShowCreateModal(true)}
          aria-label="Nuevo Paciente"
          className="lg:hidden fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-lg shadow-[#2563eb]/40 hover:shadow-xl hover:scale-105 transition-all duration-200 p-0"
        >
          <Plus className="h-6 w-6 stroke-[2]" />
        </Button>
      )}
    </div>
  );
}