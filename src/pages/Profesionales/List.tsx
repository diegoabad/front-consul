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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ConfirmDeleteModal } from '@/components/shared/ConfirmDeleteModal';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Search, Plus, Eye, Edit, Lock, Unlock, Calendar, 
  CreditCard, Loader2, Stethoscope, Trash2, Mail, Phone, User
} from 'lucide-react';
import { toast as reactToastify } from 'react-toastify';
import { profesionalesService, type CreateProfesionalData, type BlockProfesionalData } from '@/services/profesionales.service';
import { usuariosService } from '@/services/usuarios.service';
import { especialidadesService } from '@/services/especialidades.service';
import type { Profesional } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/utils/permissions';

const estadoOptions = [
  { value: 'todos', label: 'Todos los estados' },
  { value: 'activos', label: 'Activos' },
  { value: 'bloqueados', label: 'Bloqueados' },
];

const estadoPagoOptions = [
  { value: 'todos', label: 'Todos' },
  { value: 'al_dia', label: 'Al día' },
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'moroso', label: 'Moroso' },
];

function getEstadoBadge(bloqueado: boolean, activo?: boolean) {
  if (activo === false) {
    return (
      <Badge className="bg-[#F3F4F6] text-[#4B5563] border-[#D1D5DB] hover:bg-[#E5E7EB] rounded-full px-3 py-1 text-xs font-medium">
        Inactivo
      </Badge>
    );
  }
  return bloqueado ? (
    <Badge className="bg-[#FEE2E2] text-[#991B1B] border-[#FECACA] hover:bg-[#FCA5A5] rounded-full px-3 py-1 text-xs font-medium">
      Bloqueado
    </Badge>
  ) : (
    <Badge className="bg-[#D1FAE5] text-[#065F46] border-[#6EE7B7] hover:bg-[#A7F3D0] rounded-full px-3 py-1 text-xs font-medium">
      Activo
    </Badge>
  );
}

function getEstadoPagoBadge(estado: string) {
  switch (estado) {
    case 'al_dia':
      return (
        <Badge className="bg-[#D1FAE5] text-[#065F46] border-[#6EE7B7] hover:bg-[#A7F3D0] rounded-full px-3 py-1 text-xs font-medium">
          Al día
        </Badge>
      );
    case 'pendiente':
      return (
        <Badge className="bg-[#FEF3C7] text-[#92400E] border-[#FDE047] hover:bg-[#FDE68A] rounded-full px-3 py-1 text-xs font-medium">
          Pendiente
        </Badge>
      );
    case 'moroso':
      return (
        <Badge className="bg-[#FEE2E2] text-[#991B1B] border-[#FECACA] hover:bg-[#FCA5A5] rounded-full px-3 py-1 text-xs font-medium">
          Moroso
        </Badge>
      );
    default:
      return (
        <Badge className="bg-[#F3F4F6] text-[#4B5563] border-[#D1D5DB] hover:bg-[#E5E7EB] rounded-full px-3 py-1 text-xs font-medium">
          -
        </Badge>
      );
  }
}

export default function AdminProfesionales() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [estadoFilter, setEstadoFilter] = useState<string>('todos');
  const [estadoPagoFilter, setEstadoPagoFilter] = useState<string>('todos');
  const [especialidadFilter, setEspecialidadFilter] = useState<string>('todas');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [selectedProfesional, setSelectedProfesional] = useState<Profesional | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState<CreateProfesionalData>({
    usuario_id: '',
    matricula: '',
    especialidad: '',
    estado_pago: 'al_dia',
    bloqueado: false,
    monto_mensual: undefined,
    observaciones: '',
  });

  const [blockData, setBlockData] = useState<BlockProfesionalData>({
    razon_bloqueo: '',
  });

  // Fetch profesionales
  const { data: profesionales = [], isLoading } = useQuery({
    queryKey: ['profesionales', estadoFilter, estadoPagoFilter, especialidadFilter],
    queryFn: async () => {
      const filters: any = {};
      if (estadoFilter === 'activos') {
        filters.activo = true;
        filters.bloqueado = false;
      } else if (estadoFilter === 'bloqueados') {
        filters.bloqueado = true;
      }
      if (estadoPagoFilter !== 'todos') {
        filters.estado_pago = estadoPagoFilter;
      }
      if (especialidadFilter !== 'todas' && especialidadFilter) {
        filters.especialidad = especialidadFilter;
      }
      return profesionalesService.getAll(filters);
    },
  });

  // Fetch usuarios con rol profesional para el select
  const { data: usuariosProfesionales = [] } = useQuery({
    queryKey: ['usuarios', 'profesional'],
    queryFn: () => usuariosService.getAll({ rol: 'profesional', activo: true }),
    enabled: showCreateModal || showEditModal,
  });

  const { data: especialidades = [] } = useQuery({
    queryKey: ['especialidades'],
    queryFn: () => especialidadesService.getAll(),
  });

  // Filter profesionales
  const filteredProfesionales = useMemo(() => {
    let result = profesionales;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(p => 
        `${p.nombre || ''} ${p.apellido || ''}`.toLowerCase().includes(term) ||
        p.email?.toLowerCase().includes(term) ||
        p.matricula?.toLowerCase().includes(term) ||
        p.especialidad?.toLowerCase().includes(term)
      );
    }

    return result;
  }, [profesionales, searchTerm]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: CreateProfesionalData) => profesionalesService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profesionales'] });
      reactToastify.success('Profesional creado correctamente', {
        position: 'top-right',
        autoClose: 3000,
      });
      setShowCreateModal(false);
      resetForm();
    },
    onError: (error: any) => {
      const errorData = error.response?.data?.error || {};
      let errorMessage = 'Error al crear profesional';
      
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
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateProfesionalData> }) =>
      profesionalesService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profesionales'] });
      reactToastify.success('Profesional actualizado correctamente', {
        position: 'top-right',
        autoClose: 3000,
      });
      setShowEditModal(false);
      setSelectedProfesional(null);
      resetForm();
    },
    onError: (error: any) => {
      const errorData = error.response?.data?.error || {};
      let errorMessage = 'Error al actualizar profesional';
      
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
    mutationFn: (id: string) => profesionalesService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profesionales'] });
      reactToastify.success('Profesional eliminado correctamente', {
        position: 'top-right',
        autoClose: 3000,
      });
    },
    onError: (error: any) => {
      const errorData = error.response?.data?.error || {};
      let errorMessage = 'Error al eliminar profesional';
      
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

  // Block mutation
  const blockMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: BlockProfesionalData }) =>
      profesionalesService.block(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profesionales'] });
      reactToastify.success('Profesional bloqueado correctamente', {
        position: 'top-right',
        autoClose: 3000,
      });
      setShowBlockModal(false);
      setBlockData({ razon_bloqueo: '' });
    },
    onError: (error: any) => {
      const errorData = error.response?.data?.error || {};
      let errorMessage = 'Error al bloquear profesional';
      
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

  // Unblock mutation
  const unblockMutation = useMutation({
    mutationFn: (id: string) => profesionalesService.unblock(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profesionales'] });
      reactToastify.success('Profesional desbloqueado correctamente', {
        position: 'top-right',
        autoClose: 3000,
      });
    },
    onError: (error: any) => {
      const errorData = error.response?.data?.error || {};
      let errorMessage = 'Error al desbloquear profesional';
      
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

  const resetForm = () => {
    setFormData({
      usuario_id: '',
      matricula: '',
      especialidad: '',
      estado_pago: 'al_dia',
      bloqueado: false,
      monto_mensual: undefined,
      observaciones: '',
    });
  };

  const handleCreate = async () => {
    if (!formData.usuario_id) {
      reactToastify.error('Debe seleccionar un usuario', {
        position: 'top-right',
        autoClose: 3000,
      });
      return;
    }
    setIsSubmitting(true);
    try {
      await createMutation.mutateAsync(formData);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (profesional: Profesional) => {
    setSelectedProfesional(profesional);
    setFormData({
      usuario_id: profesional.usuario_id,
      matricula: profesional.matricula || '',
      especialidad: profesional.especialidad || '',
      estado_pago: profesional.estado_pago,
      bloqueado: profesional.bloqueado,
      razon_bloqueo: profesional.razon_bloqueo || '',
      fecha_ultimo_pago: profesional.fecha_ultimo_pago || '',
      monto_mensual: profesional.monto_mensual,
      observaciones: profesional.observaciones || '',
    });
    setShowEditModal(true);
  };

  const handleUpdate = async () => {
    if (!selectedProfesional) return;
    setIsSubmitting(true);
    try {
      await updateMutation.mutateAsync({
        id: selectedProfesional.id,
        data: formData,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [profesionalToDelete, setProfesionalToDelete] = useState<Profesional | null>(null);

  const handleDelete = (profesional: Profesional) => {
    setProfesionalToDelete(profesional);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!profesionalToDelete) return;
    setIsSubmitting(true);
    try {
      await deleteMutation.mutateAsync(profesionalToDelete.id);
      setShowDeleteModal(false);
      setProfesionalToDelete(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBlock = (profesional: Profesional) => {
    setSelectedProfesional(profesional);
    setBlockData({ razon_bloqueo: '' });
    setShowBlockModal(true);
  };

  const handleBlockSubmit = async () => {
    if (!selectedProfesional || !blockData.razon_bloqueo.trim()) {
      reactToastify.error('Debe proporcionar una razón de bloqueo', {
        position: 'top-right',
        autoClose: 3000,
      });
      return;
    }
    setIsSubmitting(true);
    try {
      await blockMutation.mutateAsync({
        id: selectedProfesional.id,
        data: blockData,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnblock = async (id: string) => {
    await unblockMutation.mutateAsync(id);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setEstadoFilter('todos');
    setEstadoPagoFilter('todos');
    setEspecialidadFilter('todas');
  };

  const hasActiveFilters = searchTerm || estadoFilter !== 'todos' || estadoPagoFilter !== 'todos' || especialidadFilter !== 'todas';

  const canCreate = hasPermission(user, 'profesionales.crear');
  const canUpdate = hasPermission(user, 'profesionales.actualizar');
  const canDelete = hasPermission(user, 'profesionales.eliminar');
  const canBlock = hasPermission(user, 'profesionales.bloquear');
  const canUnblock = hasPermission(user, 'profesionales.desbloquear');

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[32px] font-bold text-[#111827] font-['Poppins'] leading-tight tracking-[-0.02em] mb-0">
            Profesionales
          </h1>
          <p className="text-base text-[#6B7280] mt-2 font-['Inter']">
            {isLoading ? 'Cargando...' : `${filteredProfesionales.length} ${filteredProfesionales.length === 1 ? 'profesional registrado' : 'profesionales registrados'}`}
          </p>
        </div>
        {canCreate && (
          <Button
            onClick={() => { resetForm(); setShowCreateModal(true); }}
            className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-md shadow-[#2563eb]/20 hover:shadow-lg hover:shadow-[#2563eb]/30 transition-all duration-200 rounded-[12px] px-6 py-3 h-auto font-medium"
          >
            <Plus className="h-5 w-5 mr-2 stroke-[2]" />
            Nuevo Profesional
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
                placeholder="Buscar por nombre, email, matrícula o especialidad..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-12 h-12 border-[#D1D5DB] rounded-[10px] text-[16px] font-['Inter'] focus:border-[#2563eb] focus:ring-[#2563eb]/20 transition-all duration-200"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={estadoFilter} onValueChange={setEstadoFilter}>
                <SelectTrigger className="h-12 border-[#D1D5DB] rounded-[10px] text-[16px] font-['Inter'] focus:border-[#2563eb] focus:ring-[#2563eb]/20 transition-all duration-200">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent className="rounded-[12px] border-[#E5E7EB] shadow-xl">
                  {estadoOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value} className="rounded-[8px] font-['Inter'] text-[15px] py-3">
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={estadoPagoFilter} onValueChange={setEstadoPagoFilter}>
                <SelectTrigger className="h-12 border-[#D1D5DB] rounded-[10px] text-[16px] font-['Inter'] focus:border-[#2563eb] focus:ring-[#2563eb]/20 transition-all duration-200">
                  <SelectValue placeholder="Estado Pago" />
                </SelectTrigger>
                <SelectContent className="rounded-[12px] border-[#E5E7EB] shadow-xl">
                  {estadoPagoOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value} className="rounded-[8px] font-['Inter'] text-[15px] py-3">
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={especialidadFilter} onValueChange={setEspecialidadFilter}>
                <SelectTrigger className="h-12 border-[#D1D5DB] rounded-[10px] text-[16px] font-['Inter'] focus:border-[#2563eb] focus:ring-[#2563eb]/20 transition-all duration-200">
                  <SelectValue placeholder="Especialidad" />
                </SelectTrigger>
                <SelectContent className="rounded-[12px] border-[#E5E7EB] shadow-xl">
                  <SelectItem value="todas" className="rounded-[8px] font-['Inter'] text-[15px] py-3">Todas</SelectItem>
                  {especialidades.map((esp) => (
                    <SelectItem key={esp.id} value={esp.nombre} className="rounded-[8px] font-['Inter'] text-[15px] py-3">{esp.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {hasActiveFilters && (
                <Button 
                  variant="outline" 
                  onClick={clearFilters}
                  className="h-12 rounded-[10px] border-[#D1D5DB] font-['Inter'] text-[15px] hover:bg-[#F9FAFB] hover:border-[#9CA3AF] transition-all duration-200"
                >
                  Limpiar filtros
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabla / Empty States */}
      {isLoading ? (
        <Card className="border border-[#E5E7EB] rounded-[16px] shadow-sm">
          <CardContent className="p-16 text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-[#2563eb]" />
            <p className="text-[#6B7280] font-['Inter'] text-base">Cargando profesionales...</p>
          </CardContent>
        </Card>
      ) : filteredProfesionales.length === 0 ? (
        <Card className="border border-[#E5E7EB] rounded-[16px] shadow-sm">
          <CardContent className="p-16 text-center">
            <div className="h-20 w-20 rounded-full bg-[#dbeafe] flex items-center justify-center mx-auto mb-4">
              <Stethoscope className="h-10 w-10 text-[#2563eb] stroke-[2]" />
            </div>
            <h3 className="text-lg font-semibold mb-2 text-[#374151] font-['Inter']">
              No hay profesionales
            </h3>
            <p className="text-[#6B7280] mb-6 font-['Inter']">
              {hasActiveFilters ? 'No se encontraron profesionales con los filtros aplicados' : 'Comienza agregando tu primer profesional'}
            </p>
            {canCreate && !hasActiveFilters && (
              <Button
                onClick={() => { resetForm(); setShowCreateModal(true); }}
                className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-md shadow-[#2563eb]/20 hover:shadow-lg hover:shadow-[#2563eb]/30 transition-all duration-200 rounded-[12px] px-6 py-3 h-auto font-medium"
              >
                <Plus className="h-5 w-5 mr-2 stroke-[2]" />
                Agregar Profesional
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
                  Profesional
                </TableHead>
                <TableHead className="hidden md:table-cell font-['Inter'] font-medium text-[14px] text-[#374151]">
                  Email
                </TableHead>
                <TableHead className="hidden lg:table-cell font-['Inter'] font-medium text-[14px] text-[#374151]">
                  Especialidad
                </TableHead>
                <TableHead className="hidden lg:table-cell font-['Inter'] font-medium text-[14px] text-[#374151]">
                  Matrícula
                </TableHead>
                <TableHead className="hidden md:table-cell font-['Inter'] font-medium text-[14px] text-[#374151]">
                  Estado
                </TableHead>
                <TableHead className="hidden sm:table-cell font-['Inter'] font-medium text-[14px] text-[#374151]">
                  Pago
                </TableHead>
                <TableHead className="font-['Inter'] font-medium text-[14px] text-[#374151] w-[120px]">
                  Acciones
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProfesionales.map((prof) => (
                <TableRow
                  key={prof.id}
                  className="border-b border-[#E5E7EB] hover:bg-[#F9FAFB] transition-colors duration-150"
                >
                  <TableCell className="py-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10 rounded-full bg-gradient-to-br from-[#dbeafe] to-[#bfdbfe] shadow-sm">
                        <AvatarFallback className="bg-transparent text-[#2563eb] font-semibold text-sm">
                          {prof.nombre?.[0] || ''}{prof.apellido?.[0] || ''}
                        </AvatarFallback>
                      </Avatar>
                      <div className="m-0">
                        <p className="font-medium text-[#374151] font-['Inter'] text-[15px] m-0">
                          {prof.apellido}, {prof.nombre}
                        </p>
                        <p className="text-sm text-[#6B7280] md:hidden font-['Inter'] m-0">
                          {prof.email}
                        </p>
                        {prof.telefono && (
                          <p className="text-xs text-[#9CA3AF] hidden sm:block font-['Inter'] flex items-center gap-1 m-0">
                            <Phone className="h-3 w-3" />
                            {prof.telefono}
                          </p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {prof.email ? (
                      <div className="flex items-center gap-2 text-[#6B7280] font-['Inter'] text-[14px]">
                        <Mail className="h-4 w-4 stroke-[2]" />
                        {prof.email}
                      </div>
                    ) : (
                      <span className="text-[#9CA3AF]">-</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {prof.especialidad ? (
                      <Badge className="bg-[#dbeafe] text-[#2563eb] border-[#bfdbfe] hover:bg-[#bfdbfe] rounded-full px-3 py-1 text-xs font-medium">
                        {prof.especialidad}
                      </Badge>
                    ) : (
                      <span className="text-[#9CA3AF]">-</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-[#6B7280] font-['Inter'] text-[14px]">
                    {prof.matricula || '-'}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {getEstadoBadge(prof.bloqueado, prof.activo)}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {getEstadoPagoBadge(prof.estado_pago)}
                  </TableCell>
                  <TableCell className="text-right">
                    <TooltipProvider>
                      <div className="flex items-center justify-end gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => navigate(`/admin/profesionales/${prof.id}`)}
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
                                onClick={() => handleEdit(prof)}
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
                        {canBlock && !prof.bloqueado && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleBlock(prof)}
                                className="h-8 w-8 rounded-[8px] hover:bg-[#FEF3C7] transition-all duration-200 text-[#F59E0B] hover:text-[#D97706]"
                              >
                                <Lock className="h-4 w-4 stroke-[2]" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent className="bg-[#111827] text-white text-xs font-['Inter'] rounded-[8px] px-3 py-2 [&>p]:text-white">
                              <p className="text-white">Bloquear</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {canUnblock && prof.bloqueado && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleUnblock(prof.id)}
                                className="h-8 w-8 rounded-[8px] hover:bg-[#D1FAE5] transition-all duration-200 text-[#10B981] hover:text-[#059669]"
                              >
                                <Unlock className="h-4 w-4 stroke-[2]" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent className="bg-[#111827] text-white text-xs font-['Inter'] rounded-[8px] px-3 py-2 [&>p]:text-white">
                              <p className="text-white">Desbloquear</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => navigate(`/agendas?profesional=${prof.id}`)}
                              className="h-8 w-8 rounded-[8px] hover:bg-[#DBEAFE] transition-all duration-200 text-[#3B82F6] hover:text-[#2563EB]"
                            >
                              <Calendar className="h-4 w-4 stroke-[2]" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent className="bg-[#111827] text-white text-xs font-['Inter'] rounded-[8px] px-3 py-2 [&>p]:text-white">
                            <p className="text-white">Ver Agenda</p>
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => navigate(`/admin/pagos?profesional=${prof.id}`)}
                              className="h-8 w-8 rounded-[8px] hover:bg-[#F3F4F6] transition-all duration-200 text-[#6B7280] hover:text-[#374151]"
                            >
                              <CreditCard className="h-4 w-4 stroke-[2]" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent className="bg-[#111827] text-white text-xs font-['Inter'] rounded-[8px] px-3 py-2 [&>p]:text-white">
                            <p className="text-white">Historial de Pagos</p>
                          </TooltipContent>
                        </Tooltip>
                        {canDelete && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(prof)}
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

      {/* Modal Crear Profesional */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-[900px] h-[90vh] max-h-[90vh] rounded-[20px] p-0 border border-[#E5E7EB] shadow-2xl flex flex-col overflow-hidden">
          <DialogHeader className="px-8 pt-8 pb-6 border-b border-[#E5E7EB] bg-gradient-to-b from-white to-[#F9FAFB] flex-shrink-0 mb-0">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-full bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] flex items-center justify-center shadow-lg shadow-[#2563eb]/30">
                <Stethoscope className="h-7 w-7 text-white stroke-[2.5]" />
              </div>
              <div>
                <DialogTitle className="text-[32px] font-bold text-[#111827] font-['Poppins'] leading-tight mb-0">
                  Nuevo Profesional
                </DialogTitle>
                <DialogDescription className="text-base text-[#6B7280] font-['Inter'] mt-1.5 mb-0">
                  Completa los datos del nuevo profesional
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="flex-1 min-h-0 h-full px-8 pt-6 pb-4 flex flex-col overflow-y-auto">
            <div className="space-y-6">
              <div className="space-y-3">
                <Label htmlFor="usuario_id" className="text-[15px] font-medium text-[#374151] font-['Inter'] flex items-center gap-2">
                  <User className="h-4 w-4 text-[#6B7280] stroke-[2]" />
                  Usuario
                  <span className="text-[#EF4444]">*</span>
                </Label>
                <Select
                  value={formData.usuario_id}
                  onValueChange={(value) => setFormData({ ...formData, usuario_id: value })}
                >
                  <SelectTrigger className="h-[52px] border-[1.5px] border-[#D1D5DB] rounded-[10px] font-['Inter'] text-[16px] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200">
                    <SelectValue placeholder="Seleccionar usuario con rol profesional" />
                  </SelectTrigger>
                  <SelectContent className="rounded-[12px] border-[#E5E7EB] shadow-xl max-h-[300px]">
                    {usuariosProfesionales.map((usuario) => (
                      <SelectItem key={usuario.id} value={usuario.id} className="rounded-[8px] font-['Inter'] text-[15px] py-3">
                        {usuario.nombre} {usuario.apellido} ({usuario.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-[#6B7280] font-['Inter']">
                  Solo se muestran usuarios con rol "profesional" que no tengan un profesional asociado
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label htmlFor="matricula" className="text-[15px] font-medium text-[#374151] font-['Inter']">
                    Matrícula
                  </Label>
                  <Input
                    id="matricula"
                    value={formData.matricula}
                    onChange={(e) => setFormData({ ...formData, matricula: e.target.value })}
                    className="h-[52px] border-[1.5px] border-[#D1D5DB] rounded-[10px] font-['Inter'] text-[16px] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200"
                  />
                </div>
                <div className="space-y-3">
                  <Label htmlFor="especialidad" className="text-[15px] font-medium text-[#374151] font-['Inter']">
                    Especialidad
                  </Label>
                  <Select
                    value={formData.especialidad}
                    onValueChange={(value) => setFormData({ ...formData, especialidad: value })}
                  >
                    <SelectTrigger className="h-[52px] border-[1.5px] border-[#D1D5DB] rounded-[10px] font-['Inter'] text-[16px] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200">
                      <SelectValue placeholder="Seleccionar especialidad" />
                    </SelectTrigger>
                    <SelectContent className="rounded-[12px] border-[#E5E7EB] shadow-xl">
                      {especialidades.map((esp) => (
                        <SelectItem key={esp.id} value={esp.nombre} className="rounded-[8px] font-['Inter'] text-[15px] py-3">{esp.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label htmlFor="estado_pago" className="text-[15px] font-medium text-[#374151] font-['Inter']">
                    Estado de Pago
                  </Label>
                  <Select
                    value={formData.estado_pago}
                    onValueChange={(value: any) => setFormData({ ...formData, estado_pago: value })}
                  >
                    <SelectTrigger className="h-[52px] border-[1.5px] border-[#D1D5DB] rounded-[10px] font-['Inter'] text-[16px] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-[12px] border-[#E5E7EB] shadow-xl">
                      <SelectItem value="al_dia" className="rounded-[8px] font-['Inter'] text-[15px] py-3">Al día</SelectItem>
                      <SelectItem value="pendiente" className="rounded-[8px] font-['Inter'] text-[15px] py-3">Pendiente</SelectItem>
                      <SelectItem value="moroso" className="rounded-[8px] font-['Inter'] text-[15px] py-3">Moroso</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-3">
                  <Label htmlFor="monto_mensual" className="text-[15px] font-medium text-[#374151] font-['Inter']">
                    Monto Mensual
                  </Label>
                  <Input
                    id="monto_mensual"
                    type="number"
                    step="0.01"
                    value={formData.monto_mensual || ''}
                    onChange={(e) => setFormData({ ...formData, monto_mensual: e.target.value ? parseFloat(e.target.value) : undefined })}
                    className="h-[52px] border-[1.5px] border-[#D1D5DB] rounded-[10px] font-['Inter'] text-[16px] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200"
                  />
                </div>
              </div>
              <div className="space-y-3">
                <Label htmlFor="observaciones" className="text-[15px] font-medium text-[#374151] font-['Inter']">
                  Observaciones
                </Label>
                <Textarea
                  id="observaciones"
                  value={formData.observaciones}
                  onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                  className="min-h-[120px] border-[1.5px] border-[#D1D5DB] rounded-[10px] font-['Inter'] text-[16px] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200 resize-none"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="px-8 py-5 border-t border-[#E5E7EB] bg-[#F9FAFB] flex flex-row justify-end items-center gap-3 flex-shrink-0 mt-0">
            <Button
              variant="outline"
              onClick={() => setShowCreateModal(false)}
              disabled={isSubmitting}
              className="h-[48px] px-6 rounded-[12px] border-[1.5px] border-[#D1D5DB] font-medium font-['Inter'] text-[15px] hover:bg-white hover:border-[#9CA3AF] transition-all duration-200"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreate}
              disabled={isSubmitting || !formData.usuario_id}
              className="h-[48px] px-8 rounded-[12px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-lg shadow-[#2563eb]/30 hover:shadow-xl hover:shadow-[#2563eb]/40 hover:scale-[1.02] font-semibold font-['Inter'] text-[15px] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin stroke-[2.5]" />
                  Guardando...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-5 w-5 stroke-[2.5]" />
                  Crear Profesional
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Editar Profesional */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-[900px] h-[90vh] max-h-[90vh] rounded-[20px] p-0 border border-[#E5E7EB] shadow-2xl flex flex-col overflow-hidden">
          <DialogHeader className="px-8 pt-8 pb-6 border-b border-[#E5E7EB] bg-gradient-to-b from-white to-[#F9FAFB] flex-shrink-0 mb-0">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-full bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] flex items-center justify-center shadow-lg shadow-[#2563eb]/30">
                <Stethoscope className="h-7 w-7 text-white stroke-[2.5]" />
              </div>
              <div>
                <DialogTitle className="text-[32px] font-bold text-[#111827] font-['Poppins'] leading-tight mb-0">
                  Editar Profesional
                </DialogTitle>
                <DialogDescription className="text-base text-[#6B7280] font-['Inter'] mt-1.5 mb-0">
                  Modifica los datos del profesional
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="flex-1 min-h-0 h-full px-8 pt-6 pb-4 flex flex-col overflow-y-auto">
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label htmlFor="edit-matricula" className="text-[15px] font-medium text-[#374151] font-['Inter']">
                    Matrícula
                  </Label>
                  <Input
                    id="edit-matricula"
                    value={formData.matricula}
                    onChange={(e) => setFormData({ ...formData, matricula: e.target.value })}
                    className="h-[52px] border-[1.5px] border-[#D1D5DB] rounded-[10px] font-['Inter'] text-[16px] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200"
                  />
                </div>
                <div className="space-y-3">
                  <Label htmlFor="edit-especialidad" className="text-[15px] font-medium text-[#374151] font-['Inter']">
                    Especialidad
                  </Label>
                  <Select
                    value={formData.especialidad}
                    onValueChange={(value) => setFormData({ ...formData, especialidad: value })}
                  >
                    <SelectTrigger className="h-[52px] border-[1.5px] border-[#D1D5DB] rounded-[10px] font-['Inter'] text-[16px] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200">
                      <SelectValue placeholder="Seleccionar especialidad" />
                    </SelectTrigger>
                    <SelectContent className="rounded-[12px] border-[#E5E7EB] shadow-xl">
                      {especialidades.map((esp) => (
                        <SelectItem key={esp.id} value={esp.nombre} className="rounded-[8px] font-['Inter'] text-[15px] py-3">{esp.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label htmlFor="edit-estado_pago" className="text-[15px] font-medium text-[#374151] font-['Inter']">
                    Estado de Pago
                  </Label>
                  <Select
                    value={formData.estado_pago}
                    onValueChange={(value: any) => setFormData({ ...formData, estado_pago: value })}
                  >
                    <SelectTrigger className="h-[52px] border-[1.5px] border-[#D1D5DB] rounded-[10px] font-['Inter'] text-[16px] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-[12px] border-[#E5E7EB] shadow-xl">
                      <SelectItem value="al_dia" className="rounded-[8px] font-['Inter'] text-[15px] py-3">Al día</SelectItem>
                      <SelectItem value="pendiente" className="rounded-[8px] font-['Inter'] text-[15px] py-3">Pendiente</SelectItem>
                      <SelectItem value="moroso" className="rounded-[8px] font-['Inter'] text-[15px] py-3">Moroso</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-3">
                  <Label htmlFor="edit-monto_mensual" className="text-[15px] font-medium text-[#374151] font-['Inter']">
                    Monto Mensual
                  </Label>
                  <Input
                    id="edit-monto_mensual"
                    type="number"
                    step="0.01"
                    value={formData.monto_mensual || ''}
                    onChange={(e) => setFormData({ ...formData, monto_mensual: e.target.value ? parseFloat(e.target.value) : undefined })}
                    className="h-[52px] border-[1.5px] border-[#D1D5DB] rounded-[10px] font-['Inter'] text-[16px] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200"
                  />
                </div>
              </div>
              <div className="space-y-3">
                <Label htmlFor="edit-observaciones" className="text-[15px] font-medium text-[#374151] font-['Inter']">
                  Observaciones
                </Label>
                <Textarea
                  id="edit-observaciones"
                  value={formData.observaciones}
                  onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                  className="min-h-[120px] border-[1.5px] border-[#D1D5DB] rounded-[10px] font-['Inter'] text-[16px] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200 resize-none"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="px-8 py-5 border-t border-[#E5E7EB] bg-[#F9FAFB] flex flex-row justify-end items-center gap-3 flex-shrink-0 mt-0">
            <Button
              variant="outline"
              onClick={() => setShowEditModal(false)}
              disabled={isSubmitting}
              className="h-[48px] px-6 rounded-[12px] border-[1.5px] border-[#D1D5DB] font-medium font-['Inter'] text-[15px] hover:bg-white hover:border-[#9CA3AF] transition-all duration-200"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={isSubmitting}
              className="h-[48px] px-8 rounded-[12px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-lg shadow-[#2563eb]/30 hover:shadow-xl hover:shadow-[#2563eb]/40 hover:scale-[1.02] font-semibold font-['Inter'] text-[15px] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin stroke-[2.5]" />
                  Guardando...
                </>
              ) : (
                'Actualizar Profesional'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Bloquear Profesional */}
      <Dialog open={showBlockModal} onOpenChange={setShowBlockModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bloquear Profesional</DialogTitle>
            <DialogDescription>
              Indique la razón del bloqueo para {selectedProfesional?.nombre} {selectedProfesional?.apellido}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="razon_bloqueo">Razón del Bloqueo *</Label>
              <Textarea
                id="razon_bloqueo"
                value={blockData.razon_bloqueo}
                onChange={(e) => setBlockData({ razon_bloqueo: e.target.value })}
                placeholder="Ej: Pago pendiente, incumplimiento de horarios, etc."
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBlockModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleBlockSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Bloqueando...
                </>
              ) : (
                'Bloquear Profesional'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteModal
        open={showDeleteModal}
        onOpenChange={(open) => { setShowDeleteModal(open); if (!open) setProfesionalToDelete(null); }}
        title="Eliminar profesional"
        description={<>¿Está seguro de que desea eliminar a {profesionalToDelete?.nombre} {profesionalToDelete?.apellido}? Esta acción no se puede deshacer.</>}
        onConfirm={handleConfirmDelete}
        isLoading={isSubmitting}
      />
    </div>
  );
}
