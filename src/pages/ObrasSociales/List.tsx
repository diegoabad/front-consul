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
import { ConfirmDeleteModal } from '@/components/shared/ConfirmDeleteModal';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Building2, Plus, Pencil, Lock, Unlock, Trash2, Loader2, Search } from 'lucide-react';
import { toast as reactToastify } from 'react-toastify';
import {
  obrasSocialesService,
  type ObraSocial,
  type CreateObraSocialData,
  type UpdateObraSocialData,
} from '@/services/obras-sociales.service';

export default function AdminObrasSociales() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selected, setSelected] = useState<ObraSocial | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createData, setCreateData] = useState<CreateObraSocialData>({ nombre: '' });
  const [editData, setEditData] = useState<UpdateObraSocialData & { nombre: string }>({ nombre: '', activo: true });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['obras-sociales', true],
    queryFn: () => obrasSocialesService.getAll(true),
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const s = search.toLowerCase();
    return items.filter((e) => e.nombre.toLowerCase().includes(s));
  }, [items, search]);

  const createMutation = useMutation({
    mutationFn: (data: CreateObraSocialData) => obrasSocialesService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['obras-sociales'] });
      reactToastify.success('Obra social creada correctamente', { position: 'top-right', autoClose: 3000 });
      setShowCreateModal(false);
      setCreateData({ nombre: '' });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Error al crear';
      reactToastify.error(msg, { position: 'top-right', autoClose: 3000 });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateObraSocialData }) =>
      obrasSocialesService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['obras-sociales'] });
      reactToastify.success('Obra social actualizada correctamente', { position: 'top-right', autoClose: 3000 });
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
    mutationFn: (id: string) => obrasSocialesService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['obras-sociales'] });
      reactToastify.success('Obra social eliminada correctamente', { position: 'top-right', autoClose: 3000 });
      setShowDeleteModal(false);
      setSelected(null);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Error al eliminar';
      reactToastify.error(msg, { position: 'top-right', autoClose: 3000 });
    },
  });

  const openEdit = (item: ObraSocial) => {
    setSelected(item);
    setEditData({
      nombre: item.nombre,
      activo: item.activo,
    });
    setShowEditModal(true);
  };

  const handleToggleActivo = async (item: ObraSocial) => {
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
      await createMutation.mutateAsync({ nombre });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openDelete = (item: ObraSocial) => {
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
    <div className="space-y-8 max-lg:pb-[46px] relative">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[32px] font-bold text-[#111827] font-['Poppins'] leading-tight tracking-[-0.02em] mb-0">
            Obras Sociales
          </h1>
          <p className="text-base text-[#6B7280] mt-2 font-['Inter']">
            {isLoading ? 'Cargando...' : `${filtered.length} ${filtered.length === 1 ? 'obra social registrada' : 'obras sociales registradas'}`}
          </p>
        </div>
        <Button
          onClick={() => setShowCreateModal(true)}
          className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-md shadow-[#2563eb]/20 hover:shadow-lg hover:shadow-[#2563eb]/30 transition-all duration-200 rounded-[12px] px-6 py-3 h-auto font-medium max-lg:hidden"
        >
          <Plus className="h-5 w-5 mr-2 stroke-[2]" />
          Nueva Obra Social
        </Button>
      </div>

      {/* Filtros */}
      <Card className="border border-[#E5E7EB] rounded-[16px] shadow-sm">
        <CardContent className="p-6">
          <div className="relative max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#9CA3AF] stroke-[2]" />
            <Input
              placeholder="Buscar por nombre..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-12 h-12 border-[#D1D5DB] rounded-[10px] text-[16px] font-['Inter'] focus:border-[#2563eb] focus:ring-[#2563eb]/20 transition-all duration-200"
            />
          </div>
        </CardContent>
      </Card>

      {/* Tabla o Empty State */}
      {isLoading ? (
        <Card className="border border-[#E5E7EB] rounded-[16px] shadow-sm">
          <CardContent className="p-16 text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-[#2563eb]" />
            <p className="text-[#6B7280] font-['Inter'] text-base">Cargando obras sociales...</p>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="border border-[#E5E7EB] rounded-[16px] shadow-sm">
          <CardContent className="p-16 text-center">
            <div className="h-20 w-20 rounded-full bg-[#dbeafe] flex items-center justify-center mx-auto mb-4">
              <Building2 className="h-10 w-10 text-[#2563eb] stroke-[2]" />
            </div>
            <h3 className="text-lg font-semibold mb-2 text-[#374151] font-['Inter']">
              No hay obras sociales
            </h3>
            <p className="text-[#6B7280] mb-6 font-['Inter']">
              {items.length === 0
                ? 'Comienza agregando tu primera obra social'
                : 'No se encontraron obras sociales con la búsqueda aplicada'}
            </p>
            {items.length === 0 && (
              <Button
                onClick={() => setShowCreateModal(true)}
                className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-md shadow-[#2563eb]/20 hover:shadow-lg hover:shadow-[#2563eb]/30 transition-all duration-200 rounded-[12px] px-6 py-3 h-auto font-medium"
              >
                <Plus className="h-5 w-5 mr-2 stroke-[2]" />
                Nueva Obra Social
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="border border-[#E5E7EB] rounded-[16px] shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#F9FAFB] border-b-2 border-[#E5E7EB] hover:bg-[#F9FAFB]">
                <TableHead className="font-['Inter'] font-medium text-[14px] text-[#374151] py-4 min-w-[200px]">
                  Nombre
                </TableHead>
                <TableHead className="font-['Inter'] font-medium text-[14px] text-[#374151]">
                  Estado
                </TableHead>
                <TableHead className="font-['Inter'] font-medium text-[14px] text-[#374151] w-[120px] text-center">
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
                    <span className="font-medium text-[#374151] font-['Inter'] text-[15px]">
                      {item.nombre}
                    </span>
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
                              className="h-8 w-8 rounded-[8px] hover:bg-[#dbeafe] transition-all duration-200 text-[#2563eb] hover:text-[#1d4ed8]"
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

      {/* FAB móvil: Nueva Obra Social */}
      <div className="lg:hidden fixed bottom-6 right-6 z-40">
        <Button
          onClick={() => setShowCreateModal(true)}
          className="h-14 w-14 rounded-full shadow-lg shadow-[#2563eb]/30 bg-[#2563eb] hover:bg-[#1d4ed8] text-white p-0"
          title="Nueva Obra Social"
          aria-label="Nueva Obra Social"
        >
          <Plus className="h-6 w-6 stroke-[2]" />
        </Button>
      </div>

      {/* Modal Crear */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-[600px] rounded-[20px] p-0 border border-[#E5E7EB] shadow-2xl">
          <DialogHeader className="px-8 pt-8 pb-6 mb-0 border-b border-[#E5E7EB] bg-gradient-to-b from-white to-[#F9FAFB]">
            <div className="flex items-center gap-4">
              <div className="max-md:hidden h-12 w-12 rounded-full bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] flex items-center justify-center shadow-lg shadow-[#2563eb]/20">
                <Building2 className="h-6 w-6 text-white stroke-[2]" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-[28px] font-bold text-[#111827] font-['Poppins'] leading-tight mb-0">
                  Nueva Obra Social
                </DialogTitle>
                <DialogDescription className="text-base text-[#6B7280] font-['Inter'] mt-1 mb-0">
                  Ingresa el nombre de la obra social
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
                placeholder="Ej: OSDE"
                className="h-[52px] border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[16px] font-['Inter'] placeholder:text-[#9CA3AF] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200"
              />
            </div>
          </div>

          <DialogFooter className="px-8 py-5 mt-0 border-t border-[#E5E7EB] bg-[#F9FAFB] flex flex-col md:flex-row md:justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setShowCreateModal(false)}
                disabled={isSubmitting}
                className="h-[48px] w-full md:w-auto px-6 rounded-[12px] border-[1.5px] border-[#D1D5DB] font-medium font-['Inter'] text-[15px] hover:bg-white hover:border-[#9CA3AF] transition-all duration-200 order-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleCreate}
                disabled={isSubmitting}
                className="h-[48px] w-full md:w-auto px-8 rounded-[12px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-lg shadow-[#2563eb]/30 hover:shadow-xl hover:shadow-[#2563eb]/40 hover:scale-[1.02] font-semibold font-['Inter'] text-[15px] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 order-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="max-md:hidden mr-2 h-5 w-5 animate-spin stroke-[2.5]" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Plus className="max-md:hidden mr-2 h-5 w-5 stroke-[2]" />
                    Crear obra social
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
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] flex items-center justify-center shadow-lg shadow-[#2563eb]/20">
                <Pencil className="h-6 w-6 text-white stroke-[2]" />
              </div>
              <div>
                <DialogTitle className="text-[28px] font-bold text-[#111827] font-['Poppins'] leading-tight mb-0">
                  Editar Obra Social
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
                placeholder="Ej: OSDE"
                className="h-[52px] border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[16px] font-['Inter'] placeholder:text-[#9CA3AF] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200"
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
              className="h-[48px] px-8 rounded-[12px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-lg shadow-[#2563eb]/30 hover:shadow-xl hover:shadow-[#2563eb]/40 hover:scale-[1.02] font-semibold font-['Inter'] text-[15px] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
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

      <ConfirmDeleteModal
        open={showDeleteModal}
        onOpenChange={(open) => { setShowDeleteModal(open); if (!open) setSelected(null); }}
        title="Eliminar Obra Social"
        description={<>¿Estás seguro de que deseas eliminar la obra social <span className="font-semibold text-[#374151]">&quot;{selected?.nombre}&quot;</span>? Esta acción no se puede deshacer.</>}
        onConfirm={handleDelete}
        isLoading={isSubmitting}
      />
    </div>
  );
}