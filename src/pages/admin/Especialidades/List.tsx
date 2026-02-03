import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { GraduationCap, Plus, Pencil, Lock, Unlock, Trash2, Loader2, Search } from 'lucide-react';
import { toast as reactToastify } from 'react-toastify';
import {
  especialidadesService,
  type Especialidad,
  type CreateEspecialidadData,
  type UpdateEspecialidadData,
} from '@/services/especialidades.service';

export default function AdminEspecialidades() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selected, setSelected] = useState<Especialidad | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createData, setCreateData] = useState<CreateEspecialidadData>({ nombre: '' });
  const [editData, setEditData] = useState<UpdateEspecialidadData>({ nombre: '', activo: true });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['especialidades', true],
    queryFn: () => especialidadesService.getAll(true),
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const s = search.toLowerCase();
    return items.filter((e) => e.nombre.toLowerCase().includes(s));
  }, [items, search]);

  const createMutation = useMutation({
    mutationFn: (data: CreateEspecialidadData) => especialidadesService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['especialidades'] });
      reactToastify.success('Especialidad creada correctamente', { position: 'top-right', autoClose: 3000 });
      setShowCreateModal(false);
      setCreateData({ nombre: '' });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Error al crear';
      reactToastify.error(msg, { position: 'top-right', autoClose: 3000 });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateEspecialidadData }) =>
      especialidadesService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['especialidades'] });
      reactToastify.success('Especialidad actualizada correctamente', { position: 'top-right', autoClose: 3000 });
      setShowEditModal(false);
      setSelected(null);
      setTogglingId(null);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Error al actualizar';
      reactToastify.error(msg, { position: 'top-right', autoClose: 3000 });
      setTogglingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => especialidadesService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['especialidades'] });
      reactToastify.success('Especialidad eliminada correctamente', { position: 'top-right', autoClose: 3000 });
      setShowDeleteModal(false);
      setSelected(null);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Error al eliminar';
      reactToastify.error(msg, { position: 'top-right', autoClose: 3000 });
    },
  });

  const openEdit = (item: Especialidad) => {
    setSelected(item);
    setEditData({
      nombre: item.nombre,
      activo: item.activo,
    });
    setShowEditModal(true);
  };

  const handleToggleActivo = async (item: Especialidad) => {
    setTogglingId(item.id);
    try {
      await updateMutation.mutateAsync({
        id: item.id,
        data: { activo: !item.activo },
      });
    } catch {
      // error ya manejado en onError
    } finally {
      setTogglingId(null);
    }
  };

  const handleCreate = async () => {
    const nombre = createData.nombre?.trim();
    if (!nombre) {
      reactToastify.error('El nombre es requerido', { position: 'top-right', autoClose: 3000 });
      return;
    }
    setIsSubmitting(true);
    try {
      await createMutation.mutateAsync({ nombre: nombre });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openDelete = (item: Especialidad) => {
    setSelected(item);
    setShowDeleteModal(true);
  };

  const handleUpdate = async () => {
    const nombre = editData.nombre?.trim();
    if (!selected || !nombre) {
      reactToastify.error('El nombre es requerido', { position: 'top-right', autoClose: 3000 });
      return;
    }
    setIsSubmitting(true);
    try {
      await updateMutation.mutateAsync({
        id: selected.id,
data: {
        nombre,
        activo: editData.activo,
      },
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    setIsSubmitting(true);
    try {
      await deleteMutation.mutateAsync(selected.id);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[32px] font-bold text-[#111827] font-['Poppins'] leading-tight tracking-[-0.02em] mb-0">
            Especialidades Médicas
          </h1>
          <p className="text-base text-[#6B7280] mt-2 font-['Inter']">
            {isLoading ? 'Cargando...' : `${filtered.length} ${filtered.length === 1 ? 'especialidad registrada' : 'especialidades registradas'}`}
          </p>
        </div>
        <Button
          onClick={() => setShowCreateModal(true)}
          className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white shadow-md shadow-[#7C3AED]/20 hover:shadow-lg hover:shadow-[#7C3AED]/30 transition-all duration-200 rounded-[12px] px-6 py-3 h-auto font-medium"
        >
          <Plus className="h-5 w-5 mr-2 stroke-[2]" />
          Nueva Especialidad
        </Button>
      </div>

      {/* Filtros */}
      <Card className="border border-[#E5E7EB] rounded-[16px] shadow-sm">
        <CardContent className="p-6">
          <div className="relative max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#9CA3AF] stroke-[2]" />
            <Input
              placeholder="Buscar por nombre o descripción..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-12 h-12 border-[#D1D5DB] rounded-[10px] text-[16px] font-['Inter'] focus:border-[#7C3AED] focus:ring-[#7C3AED]/20 transition-all duration-200"
            />
          </div>
        </CardContent>
      </Card>

      {/* Tabla o Empty State */}
      {isLoading ? (
        <Card className="border border-[#E5E7EB] rounded-[16px] shadow-sm">
          <CardContent className="p-16 text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-[#7C3AED]" />
            <p className="text-[#6B7280] font-['Inter'] text-base">Cargando especialidades...</p>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="border border-[#E5E7EB] rounded-[16px] shadow-sm">
          <CardContent className="p-16 text-center">
            <div className="h-20 w-20 rounded-full bg-[#EDE9FE] flex items-center justify-center mx-auto mb-4">
              <GraduationCap className="h-10 w-10 text-[#7C3AED] stroke-[2]" />
            </div>
            <h3 className="text-lg font-semibold mb-2 text-[#374151] font-['Inter']">
              No hay especialidades
            </h3>
            <p className="text-[#6B7280] mb-6 font-['Inter']">
              {items.length === 0
                ? 'Comienza agregando tu primera especialidad médica'
                : 'No se encontraron especialidades con la búsqueda aplicada'}
            </p>
            {items.length === 0 && (
              <Button
                onClick={() => setShowCreateModal(true)}
                className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white shadow-md shadow-[#7C3AED]/20 hover:shadow-lg hover:shadow-[#7C3AED]/30 transition-all duration-200 rounded-[12px] px-6 py-3 h-auto font-medium"
              >
                <Plus className="h-5 w-5 mr-2 stroke-[2]" />
                Nueva Especialidad
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
                  Nombre
                </TableHead>
                <TableHead className="font-['Inter'] font-medium text-[14px] text-[#374151]">
                  Estado
                </TableHead>
                <TableHead className="font-['Inter'] font-medium text-[14px] text-[#374151] text-right w-[120px]">
                  Acciones
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((item) => (
                <TableRow
                  key={item.id}
                  className="border-b border-[#E5E7EB] hover:bg-[#F9FAFB] transition-colors duration-150"
                >
                  <TableCell className="py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#7C3AED]/10 to-[#6D28D9]/10 flex items-center justify-center">
                        <GraduationCap className="h-5 w-5 text-[#7C3AED] stroke-[2]" />
                      </div>
                      <span className="font-medium text-[#374151] font-['Inter'] text-[15px]">
                        {item.nombre}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {item.activo ? (
                      <Badge className="bg-[#D1FAE5] text-[#065F46] border-[#6EE7B7] hover:bg-[#A7F3D0] rounded-full px-3 py-1 text-xs font-medium">
                        Activo
                      </Badge>
                    ) : (
                      <Badge className="bg-[#F3F4F6] text-[#4B5563] border-[#D1D5DB] hover:bg-[#E5E7EB] rounded-full px-3 py-1 text-xs font-medium">
                        Inactivo
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <TooltipProvider>
                      <div className="flex items-center justify-end gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEdit(item)}
                              className="h-8 w-8 rounded-[8px] hover:bg-[#EDE9FE] transition-all duration-200 text-[#7C3AED] hover:text-[#6D28D9]"
                            >
                              <Pencil className="h-4 w-4 stroke-[2]" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent className="bg-[#111827] text-white text-xs font-['Inter'] rounded-[8px] px-3 py-2 [&>p]:text-white">
                            <p className="text-white">Editar</p>
                          </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleToggleActivo(item)}
                              disabled={togglingId === item.id}
                              className="h-8 w-8 rounded-[8px] hover:bg-[#F3F4F6] transition-all duration-200 text-[#6B7280] hover:text-[#374151]"
                            >
                              {togglingId === item.id ? (
                                <Loader2 className="h-4 w-4 stroke-[2] animate-spin" />
                              ) : item.activo ? (
                                <Lock className="h-4 w-4 stroke-[2]" />
                              ) : (
                                <Unlock className="h-4 w-4 stroke-[2]" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent className="bg-[#111827] text-white text-xs font-['Inter'] rounded-[8px] px-3 py-2 [&>p]:text-white">
                            <p className="text-white">{item.activo ? 'Desactivar' : 'Activar'}</p>
                          </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openDelete(item)}
                              className="h-8 w-8 rounded-[8px] hover:bg-[#FEE2E2] transition-all duration-200 text-[#EF4444] hover:text-[#DC2626]"
                            >
                              <Trash2 className="h-4 w-4 stroke-[2]" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent className="bg-[#111827] text-white text-xs font-['Inter'] rounded-[8px] px-3 py-2 [&>p]:text-white">
                            <p className="text-white">Eliminar</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </TooltipProvider>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Modal Crear */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-[600px] rounded-[20px] p-0 border border-[#E5E7EB] shadow-2xl">
          <DialogHeader className="px-8 pt-8 pb-6 mb-0 border-b border-[#E5E7EB] bg-gradient-to-b from-white to-[#F9FAFB]">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#6D28D9] flex items-center justify-center shadow-lg shadow-[#7C3AED]/20">
                <GraduationCap className="h-6 w-6 text-white stroke-[2]" />
              </div>
              <div>
                <DialogTitle className="text-[28px] font-bold text-[#111827] font-['Poppins'] leading-tight mb-0">
                  Nueva Especialidad
                </DialogTitle>
                <DialogDescription className="text-base text-[#6B7280] font-['Inter'] mt-1 mb-0">
                  Ingresa el nombre de la especialidad
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="px-8 py-6 space-y-5">
            <div className="space-y-3">
              <Label htmlFor="create-nombre" className="text-[15px] font-medium text-[#374151] font-['Inter']">
                Nombre
                <span className="text-[#EF4444]">*</span>
              </Label>
              <Input
                id="create-nombre"
                value={createData.nombre}
                onChange={(e) => setCreateData((p) => ({ ...p, nombre: e.target.value }))}
                placeholder="Ej: Psicología"
                className="h-[52px] border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[16px] font-['Inter'] placeholder:text-[#9CA3AF] focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20 transition-all duration-200"
              />
            </div>

            </div>

          <DialogFooter className="px-8 py-5 mt-0 border-t border-[#E5E7EB] bg-[#F9FAFB] flex flex-row justify-end items-center gap-3">
              <Button
                variant="outline"
                onClick={() => setShowCreateModal(false)}
                className="h-[48px] px-6 rounded-[12px] border-[1.5px] border-[#D1D5DB] font-medium font-['Inter'] text-[15px] hover:bg-white hover:border-[#9CA3AF] transition-all duration-200"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleCreate}
                disabled={isSubmitting}
                className="h-[48px] px-8 rounded-[12px] bg-[#7C3AED] hover:bg-[#6D28D9] text-white shadow-lg shadow-[#7C3AED]/30 hover:shadow-xl hover:shadow-[#7C3AED]/40 hover:scale-[1.02] font-semibold font-['Inter'] text-[15px] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin stroke-[2.5]" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-5 w-5 stroke-[2]" />
                    Crear
                  </>
                )}
              </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Editar */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-[600px] rounded-[20px] p-0 border border-[#E5E7EB] shadow-2xl">
          <DialogHeader className="px-8 pt-8 pb-6 mb-0 border-b border-[#E5E7EB] bg-gradient-to-b from-white to-[#F9FAFB]">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#6D28D9] flex items-center justify-center shadow-lg shadow-[#7C3AED]/20">
                <Pencil className="h-6 w-6 text-white stroke-[2]" />
              </div>
              <div>
                <DialogTitle className="text-[28px] font-bold text-[#111827] font-['Poppins'] leading-tight mb-0">
                  Editar Especialidad
                </DialogTitle>
                <DialogDescription className="text-base text-[#6B7280] font-['Inter'] mt-1 mb-0">
                  Modifica nombre o estado
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="px-8 py-6 space-y-5">
            <div className="space-y-3">
              <Label htmlFor="edit-nombre" className="text-[15px] font-medium text-[#374151] font-['Inter']">
                Nombre
                <span className="text-[#EF4444]">*</span>
              </Label>
              <Input
                id="edit-nombre"
                value={editData.nombre || ''}
                onChange={(e) => setEditData((p) => ({ ...p, nombre: e.target.value }))}
                placeholder="Ej: Psicología"
                className="h-[52px] border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[16px] font-['Inter'] placeholder:text-[#9CA3AF] focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20 transition-all duration-200"
              />
            </div>
          </div>

          <DialogFooter className="px-8 py-5 mt-0 border-t border-[#E5E7EB] bg-[#F9FAFB] flex flex-row justify-end items-center gap-3">
            <Button
              variant="outline"
              onClick={() => setShowEditModal(false)}
                className="h-[48px] px-6 rounded-[12px] border-[1.5px] border-[#D1D5DB] font-medium font-['Inter'] text-[15px] hover:bg-white hover:border-[#9CA3AF] transition-all duration-200"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleUpdate}
                disabled={isSubmitting}
                className="h-[48px] px-8 rounded-[12px] bg-[#7C3AED] hover:bg-[#6D28D9] text-white shadow-lg shadow-[#7C3AED]/30 hover:shadow-xl hover:shadow-[#7C3AED]/40 hover:scale-[1.02] font-semibold font-['Inter'] text-[15px] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin stroke-[2.5]" />
                    Guardando...
                  </>
                ) : (
                  'Guardar Cambios'
                )}
              </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Eliminar */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="max-w-md rounded-[20px] border border-[#E5E7EB] shadow-2xl">
          <DialogHeader className="mb-0">
            <DialogTitle className="text-[24px] font-bold text-[#111827] font-['Poppins'] mb-0">
              Eliminar Especialidad
            </DialogTitle>
          </DialogHeader>
          <p className="text-base text-[#6B7280] font-['Inter'] mt-2 mb-0">
            ¿Estás seguro de que deseas eliminar la especialidad <span className="font-semibold text-[#374151]">&quot;{selected?.nombre}&quot;</span>? Esta acción no se puede deshacer.
          </p>
          <DialogFooter className="flex flex-row justify-end gap-3 mt-0">
            <Button
              variant="outline"
              onClick={() => setShowDeleteModal(false)}
              className="h-[48px] px-6 rounded-[12px] font-medium font-['Inter'] text-[15px]"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
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