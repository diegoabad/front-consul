import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { MessageSquare, Plus, ChevronLeft, ChevronRight, Loader2, Pencil, Trash2, ImageIcon, Paperclip, Eye, Lock, Unlock, ShieldCheck, Search, RefreshCw } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { toast as reactToastify } from 'react-toastify';
import { foroService, type ForoTema, type CreateTemaData, type ForoProfesionalHabilitado } from '@/services/foro.service';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/utils/permissions';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatDisplayText } from '@/lib/utils';
import { PAGE_SIZE } from '@/lib/constants';
import { ConfirmDeleteModal } from '@/components/shared/ConfirmDeleteModal';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/api\/?$/, '') || (typeof window !== 'undefined' ? window.location.origin : '');
const getImageUrl = (url: string | null | undefined) => (url ? `${API_BASE}${url}` : null);
const DEFAULT_LOGO = '/logo.png';

export default function ForoList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canCreateTema = hasPermission(user, 'foro.crear_tema');

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTema, setEditingTema] = useState<ForoTema | null>(null);
  const [temaToDelete, setTemaToDelete] = useState<ForoTema | null>(null);
  const [togglingActivoId, setTogglingActivoId] = useState<string | null>(null);
  const [editImagenFile, setEditImagenFile] = useState<File | null>(null);
  const [showPermisosModal, setShowPermisosModal] = useState(false);
  const [togglingPermisoId, setTogglingPermisoId] = useState<string | null>(null);
  const [permisosSearch, setPermisosSearch] = useState('');
  const [createForm, setCreateForm] = useState<CreateTemaData & { imagenFile?: File }>({
    titulo: '',
    descripcion: '',
    imagen_url: '',
    orden: 0,
  });

  const { data: permisosData, isLoading: loadingPermisos } = useQuery({
    queryKey: ['foro', 'permisos'],
    queryFn: () => foroService.getProfesionalesHabilitados(),
    enabled: showPermisosModal && canCreateTema,
  });

  const gridLimit = 6;
  const effectiveLimit = canCreateTema ? limit : gridLimit;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['foro', 'temas', page, effectiveLimit, canCreateTema],
    queryFn: () =>
      canCreateTema
        ? foroService.getTemas({ page, limit: effectiveLimit, includeInactive: true }) as Promise<{ data: ForoTema[]; total: number; totalPages: number }>
        : foroService.getTemas({ page, limit: effectiveLimit }) as Promise<{ data: ForoTema[]; total: number; totalPages: number }>,
  });

  const temas = data && !Array.isArray(data) ? (data as { data: ForoTema[] }).data : (Array.isArray(data) ? data : []);
  const total = data && !Array.isArray(data) ? (data as { total: number }).total : temas.length;
  const totalPages = data && !Array.isArray(data) ? (data as { totalPages: number }).totalPages : 1;

  const createMutation = useMutation({
    mutationFn: async (payload: CreateTemaData & { imagenFile?: File }) => {
      let imagen_url = payload.imagen_url || '';
      if (payload.imagenFile) {
        const { url } = await foroService.uploadImagenTema(payload.imagenFile);
        imagen_url = url;
      }
      return foroService.createTema({ ...payload, imagen_url: imagen_url || undefined });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['foro'] });
      setShowCreateModal(false);
      setCreateForm({ titulo: '', descripcion: '', imagen_url: '', orden: 0 });
      reactToastify.success('Tema creado correctamente');
    },
    onError: (e: unknown) => {
      reactToastify.error((e as Error)?.message || 'Error al crear tema');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<CreateTemaData> & { imagenFile?: File } }) => {
      let imagen_url = payload.imagen_url;
      if (payload.imagenFile) {
        const { url } = await foroService.uploadImagenTema(payload.imagenFile);
        imagen_url = url;
      }
      const { imagenFile: _, ...rest } = payload;
      return foroService.updateTema(id, { ...rest, imagen_url });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['foro'] });
      setEditingTema(null);
      setEditImagenFile(null);
      reactToastify.success('Tema actualizado');
    },
    onError: (e: unknown) => {
      reactToastify.error((e as Error)?.message || 'Error al actualizar');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => foroService.deleteTema(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['foro'] });
      setTemaToDelete(null);
      reactToastify.success('Tema eliminado');
    },
    onError: (e: unknown) => {
      reactToastify.error((e as Error)?.message || 'Error al eliminar');
    },
  });

  const updatePermisoMutation = useMutation({
    mutationFn: ({ usuarioId, habilitado }: { usuarioId: string; habilitado: boolean }) =>
      foroService.updatePermisoForo(usuarioId, habilitado),
    onSuccess: (_, { habilitado }) => {
      queryClient.invalidateQueries({ queryKey: ['foro', 'permisos'] });
      setTogglingPermisoId(null);
      reactToastify.success(habilitado ? 'Profesional habilitado para el foro' : 'Profesional deshabilitado para el foro');
    },
    onError: (e: unknown) => {
      setTogglingPermisoId(null);
      reactToastify.error((e as Error)?.message || 'Error al actualizar permiso');
    },
  });

  const toggleActivoMutation = useMutation({
    mutationFn: ({ id, activo }: { id: string; activo: boolean }) => foroService.updateTema(id, { activo }),
    onSuccess: (_, { activo }) => {
      queryClient.invalidateQueries({ queryKey: ['foro'] });
      setTogglingActivoId(null);
      reactToastify.success(activo ? 'Tema habilitado' : 'Tema deshabilitado');
    },
    onError: (e: unknown) => {
      setTogglingActivoId(null);
      reactToastify.error((e as Error)?.message || 'Error al actualizar');
    },
  });

  const handleToggleActivo = (t: ForoTema) => {
    setTogglingActivoId(t.id);
    toggleActivoMutation.mutate({ id: t.id, activo: !t.activo });
  };

  const handleCreate = () => {
    if (!createForm.titulo.trim()) {
      reactToastify.error('El título es requerido');
      return;
    }
    createMutation.mutate(createForm);
  };

  const handleUpdate = () => {
    if (!editingTema || !editingTema.titulo?.trim()) return;
    updateMutation.mutate({
      id: editingTema.id,
      payload: {
        titulo: editingTema.titulo,
        descripcion: editingTema.descripcion || '',
        imagen_url: editingTema.imagen_url || '',
        orden: editingTema.orden ?? 0,
        imagenFile: editImagenFile || undefined,
      },
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[280px]">
        <Loader2 className="h-10 w-10 text-[#2563eb] animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col space-y-8 max-lg:space-y-4 max-lg:pb-[46px] relative">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-[32px] font-bold text-[#111827] font-['Poppins'] leading-tight tracking-[-0.02em] mb-0">
              Foro Profesional
            </h1>
            <p className="text-base text-[#6B7280] mt-2 font-['Inter']">
              {canCreateTema
                ? `Gestión de temas del foro`
                : `${total} ${total === 1 ? 'tema' : 'temas'} disponibles`}
            </p>
          </div>
          {canCreateTema && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPermisosModal(true)}
              className="lg:hidden shrink-0 border-[#2563eb] ml-auto h-10 px-3 font-medium"
            >
              <ShieldCheck className="h-5 w-5 mr-2" />
              Permisos
            </Button>
          )}
        </div>
        {canCreateTema ? (
          <div className="flex gap-2 max-lg:hidden">
            <Button
              variant="outline"
              onClick={() => setShowPermisosModal(true)}
              className="border-[#2563eb] hover:bg-[#F9FAFB] rounded-[12px] px-5 py-3 h-auto font-medium"
            >
              <ShieldCheck className="h-5 w-5 mr-2" />
              Permisos del foro
            </Button>
            <Button
              onClick={() => setShowCreateModal(true)}
              className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-md shadow-[#2563eb]/20 rounded-[12px] px-6 py-3 h-auto font-medium"
            >
              <Plus className="h-5 w-5 mr-2" />
              Nuevo tema
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
            className="border-[#2563eb] hover:bg-[#EFF6FF] rounded-[10px] px-4 py-2 h-auto font-medium text-[#2563eb]"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Recargar
          </Button>
        )}
      </div>

      {canCreateTema ? (
        <Card className="flex-1 flex flex-col overflow-hidden min-h-0 border border-[#E5E7EB] rounded-[16px] shadow-sm">
          <div className="flex-1 overflow-auto min-h-0 pb-20 max-lg:pb-14">
            <Table className="table-fixed w-full min-w-[600px] max-lg:min-w-[720px]">
              <TableHeader>
                <TableRow className="bg-[#F9FAFB]">
                  <TableHead className="font-['Inter'] font-medium text-[14px] text-[#374151] w-[28%] min-w-[200px] max-lg:min-w-[220px] max-lg:w-[32%]">Título</TableHead>
                  <TableHead className="font-['Inter'] font-medium text-[14px] text-[#374151] w-[37%] min-w-[180px] max-lg:min-w-[240px] max-lg:w-[38%]">Descripción</TableHead>
                  <TableHead className="font-['Inter'] font-medium text-[14px] text-[#374151] w-[12%] min-w-[100px]">Estado</TableHead>
                  <TableHead className="font-['Inter'] font-medium text-[14px] text-[#374151] text-right w-[23%] min-w-[180px] max-lg:min-w-[180px]">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {temas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-16 text-center text-[#6B7280]">
                      No hay temas. Creá el primero.
                    </TableCell>
                  </TableRow>
                ) : (
                  temas.map((t) => (
                    <TableRow key={t.id} className="hover:bg-[#F9FAFB]">
                      <TableCell className="font-medium min-w-[200px] max-lg:min-w-[220px] truncate" title={formatDisplayText(t.titulo)}>
                        {formatDisplayText(t.titulo)}
                      </TableCell>
                      <TableCell className="text-[#6B7280] min-w-[180px] max-lg:min-w-[240px] truncate">{t.descripcion || '—'}</TableCell>
                      <TableCell>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${t.activo ? 'bg-[#D1FAE5] text-[#065F46]' : 'bg-[#F3F4F6] text-[#6B7280]'}`}>
                          {t.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right min-w-[180px] max-lg:min-w-[220px]">
                        <div className="flex items-center justify-end gap-0.5">
                          <TooltipProvider delayDuration={200}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={() => navigate(`/foro/${t.id}`)} className="h-8 w-8">
                                  <Eye className="h-4 w-4 stroke-[2]" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="bg-[#111827] text-white text-xs font-['Inter'] rounded-[8px] px-3 py-2 [&>p]:text-white">
                                <p>Ver</p>
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={() => setEditingTema({ ...t })} className="h-8 w-8">
                                  <Pencil className="h-4 w-4 stroke-[2]" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="bg-[#111827] text-white text-xs font-['Inter'] rounded-[8px] px-3 py-2 [&>p]:text-white">
                                <p>Editar</p>
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleToggleActivo(t)}
                                  disabled={togglingActivoId === t.id}
                                  className="h-8 w-8 text-[#6B7280] hover:text-[#374151]"
                                >
                                  {togglingActivoId === t.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin stroke-[2]" />
                                  ) : t.activo ? (
                                    <Lock className="h-4 w-4 stroke-[2]" />
                                  ) : (
                                    <Unlock className="h-4 w-4 stroke-[2]" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="bg-[#111827] text-white text-xs font-['Inter'] rounded-[8px] px-3 py-2 [&>p]:text-white">
                                <p>{t.activo ? 'Deshabilitar' : 'Habilitar'}</p>
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={() => setTemaToDelete(t)} className="h-8 w-8 text-[#EF4444] hover:text-[#DC2626]">
                                  <Trash2 className="h-4 w-4 stroke-[2]" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="bg-[#111827] text-white text-xs font-['Inter'] rounded-[8px] px-3 py-2 [&>p]:text-white">
                                <p>Eliminar</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {totalPages >= 1 && (
            <div className="flex items-center justify-between gap-3 px-4 py-3 max-lg:px-2 max-lg:gap-2 border-t border-[#E5E7EB] bg-[#F9FAFB]">
              <div className="flex items-center gap-6">
                <p className="text-sm text-[#6B7280] font-['Inter'] m-0">Página {page} de {totalPages || 1}</p>
                <div className="flex items-center gap-1.5">
                  <span className="max-lg:hidden text-sm text-[#6B7280] font-['Inter']">Cantidad</span>
                  <Select value={String(limit)} onValueChange={(v) => { setLimit(Number(v)); setPage(1); }}>
                    <SelectTrigger className="h-7 w-[80px] border-[#D1D5DB] rounded-[6px] text-[12px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                  <ChevronLeft className="h-4 w-4" /><span className="max-lg:hidden">Anterior</span>
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                  <span className="max-lg:hidden">Siguiente</span><ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      ) : (
        <Card className="flex-1 flex flex-col min-h-0 border border-[#E5E7EB] rounded-[16px] shadow-sm overflow-hidden bg-white max-lg:min-h-[280px]">
          <div className="flex-1 min-h-0 overflow-auto p-5 bg-[#FAFBFC]">
            <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 w-[90%] max-w-[90%] mx-auto">
              {temas.map((t) => {
                const imgUrl = getImageUrl(t.imagen_url) || DEFAULT_LOGO;
                const tituloText = formatDisplayText(t.titulo);
                const descText = t.descripcion || 'Sin descripción';
                return (
                  <Card
                    key={t.id}
                    className="border border-[#E5E7EB] rounded-[12px] shadow-sm hover:shadow-md hover:border-[#D1D5DB] transition-all duration-200 overflow-hidden cursor-pointer group relative bg-white"
                    onClick={() => navigate(`/foro/${t.id}`)}
                  >
                    {t.fecha_creacion && (
                      <span className="absolute top-1 right-1 z-10 text-[9px] text-[#6B7280] font-['Inter'] bg-white/90 backdrop-blur-sm px-1 py-0.5 rounded-[4px] shadow-sm border border-[#E5E7EB]">
                        {format(new Date(t.fecha_creacion), "d/MM/yy", { locale: es })}
                      </span>
                    )}
                    <div className="aspect-[23/9] bg-white overflow-hidden flex items-center justify-center border-b border-[#E5E7EB]">
                      <img src={imgUrl} alt="" className={`w-full h-full group-hover:scale-105 transition-transform duration-300 ${imgUrl === DEFAULT_LOGO ? 'object-contain' : 'object-cover'}`} />
                    </div>
                    <CardContent className="p-4 bg-white">
                      <h3 className="font-semibold text-[14px] text-[#111827] font-['Inter'] leading-tight mb-1 line-clamp-2">{tituloText}</h3>
                      <p className="text-[13px] text-[#6B7280] font-['Inter'] leading-relaxed line-clamp-4 mb-0">{descText}</p>
                    </CardContent>
                  </Card>
                );
              })}
              {temas.length === 0 && (
                <Card className="col-span-full p-16 text-center border-[#E5E7EB] bg-white">
                  <MessageSquare className="h-16 w-16 text-[#9CA3AF] mx-auto mb-4" />
                  <p className="text-[#6B7280] font-['Inter']">No hay temas disponibles</p>
                </Card>
              )}
            </div>
          </div>
          {totalPages >= 1 && (
            <div className="flex items-center justify-between gap-4 px-5 py-3.5 border-t border-[#E5E7EB] bg-[#F9FAFB] rounded-b-[16px]">
              <p className="text-[13px] font-medium text-[#374151] font-['Inter'] m-0">
                Página <span className="text-[#111827]">{page}</span> de <span className="text-[#111827]">{totalPages || 1}</span>
                <span className="text-[#9CA3AF] font-normal ml-1">· 6 por página</span>
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="h-8 px-3.5 border-[#D1D5DB] rounded-[8px] text-[13px] font-medium text-[#374151] hover:bg-[#F3F4F6] hover:border-[#9CA3AF] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="h-8 px-3.5 border-[#D1D5DB] rounded-[8px] text-[13px] font-medium text-[#374151] hover:bg-[#F3F4F6] hover:border-[#9CA3AF] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                >
                  Siguiente
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* FAB móvil: Nuevo tema */}
      {canCreateTema && (
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={() => setShowCreateModal(true)}
                aria-label="Nuevo tema"
                className="lg:hidden fixed bottom-4 right-4 z-40 h-14 w-14 rounded-full bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-lg shadow-[#2563eb]/40 hover:shadow-xl hover:scale-105 transition-all duration-200 p-0"
              >
                <Plus className="h-6 w-6 stroke-[2]" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left" className="bg-[#111827] text-white text-xs font-['Inter'] rounded-[8px] px-3 py-2 [&>p]:text-white">
              <p>Nuevo tema</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {/* Modal Permisos */}
      <Dialog open={showPermisosModal} onOpenChange={(open) => { setShowPermisosModal(open); if (!open) setPermisosSearch(''); }}>
        <DialogContent className="max-w-[960px] w-[95vw] min-h-[75vh] max-h-[95vh] rounded-[20px] p-0 border border-[#E5E7EB] shadow-2xl flex flex-col overflow-hidden">
          <DialogHeader className="px-8 max-lg:px-4 pt-6 max-lg:pt-4 pb-4 max-lg:pb-3 border-b border-[#E5E7EB] bg-gradient-to-b from-white to-[#F9FAFB] flex-shrink-0 mb-0">
            <div className="flex items-center gap-4">
              <div className="max-lg:hidden h-12 w-12 rounded-full bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] flex items-center justify-center shadow-lg shadow-[#2563eb]/20">
                <ShieldCheck className="h-6 w-6 text-white stroke-[2]" />
              </div>
              <div>
                <DialogTitle className="text-[28px] max-lg:text-[22px] font-bold text-[#111827] font-['Poppins'] leading-tight mb-0">
                  Permisos del foro
                </DialogTitle>
                <DialogDescription className="text-base max-lg:text-sm text-[#6B7280] font-['Inter'] mt-1 mb-0">
                  Habilitá o deshabilitá cada profesional para que pueda ver y participar en el foro
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden px-8 max-lg:px-4 py-4 max-lg:py-3">
            {/* Buscador */}
            <div className="flex-shrink-0 mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9CA3AF]" />
                <Input
                  placeholder="Buscar por nombre, apellido, email o especialidad..."
                  value={permisosSearch}
                  onChange={(e) => setPermisosSearch(e.target.value)}
                  className="pl-10 h-11 border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[15px] font-['Inter'] placeholder:text-[#9CA3AF] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20"
                />
              </div>
            </div>
            {/* Listado de profesionales */}
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {loadingPermisos ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-10 w-10 text-[#2563eb] animate-spin" />
              </div>
            ) : !permisosData?.length ? (
              <p className="text-[15px] text-[#6B7280] font-['Inter'] text-center py-8">
                No hay profesionales en el sistema.
              </p>
            ) : (() => {
              const q = permisosSearch.trim().toLowerCase();
              const filtered = q
                ? permisosData.filter(
                    (p: ForoProfesionalHabilitado) =>
                      (p.nombre || '').toLowerCase().includes(q) ||
                      (p.apellido || '').toLowerCase().includes(q) ||
                      (p.email || '').toLowerCase().includes(q) ||
                      (p.especialidad || '').toLowerCase().includes(q)
                  )
                : permisosData;
              if (!filtered.length) {
                return (
                  <p className="text-[15px] text-[#6B7280] font-['Inter'] text-center py-8">
                    No se encontraron profesionales con ese criterio.
                  </p>
                );
              }
              return (
              <div className="flex-1 min-h-0 overflow-y-auto scrollbar-violet border border-[#E5E7EB] rounded-[12px] bg-[#FAFBFC] p-2">
                <div className="space-y-1.5">
                {filtered.map((prof: ForoProfesionalHabilitado) => {
                  const nombreCompleto = [formatDisplayText(prof.nombre), formatDisplayText(prof.apellido)].filter(Boolean).join(' ');
                  const esp = (prof.especialidad || '').trim();
                  const especialidad = esp ? esp.charAt(0).toUpperCase() + esp.slice(1).toLowerCase() : '';
                  return (
                  <div
                    key={prof.id}
                    className="flex items-center justify-between gap-3 py-2 px-4 rounded-[10px] border border-[#E5E7EB] bg-white hover:bg-[#F9FAFB] transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-medium text-[#374151] font-['Inter'] truncate mb-0">
                        {nombreCompleto}{especialidad ? ' - ' : ''}{especialidad}
                        {prof.email && (
                          <span className="text-[12px] text-[#9CA3AF] font-normal ml-3">{prof.email}</span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-sm text-[#6B7280] font-['Inter']">
                        {prof.habilitado ? 'Habilitado' : 'Deshabilitado'}
                      </span>
                      <Switch
                        checked={prof.habilitado}
                        onCheckedChange={(checked) => {
                          setTogglingPermisoId(prof.usuario_id);
                          updatePermisoMutation.mutate({ usuarioId: prof.usuario_id, habilitado: checked });
                        }}
                        disabled={togglingPermisoId === prof.usuario_id}
                        className="data-[state=checked]:bg-[#2563eb]"
                      />
                    </div>
                  </div>
                  );
                })}
                </div>
              </div>
              );
            })()}
            </div>
          </div>
          <DialogFooter className="px-8 max-lg:px-4 py-3 max-lg:py-3 border-t border-[#E5E7EB] bg-[#F9FAFB] flex justify-end flex-shrink-0 mt-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowPermisosModal(false)}
              className="h-[48px] max-lg:h-11 px-6 rounded-[12px] border-[1.5px] border-[#D1D5DB] font-medium font-['Inter'] text-[15px] hover:bg-white hover:border-[#9CA3AF] transition-all duration-200"
            >
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Crear */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-[960px] w-[95vw] max-h-[90vh] rounded-[20px] p-0 border border-[#E5E7EB] shadow-2xl flex flex-col overflow-hidden">
          <DialogHeader className="px-8 max-lg:px-4 pt-6 max-lg:pt-4 pb-4 max-lg:pb-3 border-b border-[#E5E7EB] bg-gradient-to-b from-white to-[#F9FAFB] flex-shrink-0 mb-0">
            <div className="flex items-center gap-4">
              <div className="max-lg:hidden h-12 w-12 rounded-full bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] flex items-center justify-center shadow-lg shadow-[#2563eb]/20">
                <MessageSquare className="h-6 w-6 text-white stroke-[2]" />
              </div>
              <div>
                <DialogTitle className="text-[28px] max-lg:text-[22px] font-bold text-[#111827] font-['Poppins'] leading-tight mb-0">
                  Nuevo tema
                </DialogTitle>
                <DialogDescription className="text-base max-lg:text-sm text-[#6B7280] font-['Inter'] mt-1 mb-0">
                  Título, descripción e imagen opcional para el tema del foro
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-hidden px-8 max-lg:px-4 py-4 max-lg:py-3 flex flex-col gap-4">
            <div className="space-y-2">
              <Label htmlFor="create-titulo" className="text-[14px] font-medium text-[#374151] font-['Inter'] flex items-center gap-1.5">
                Título
                <span className="text-[#EF4444]">*</span>
              </Label>
              <Input
                id="create-titulo"
                value={createForm.titulo}
                onChange={(e) => setCreateForm((f) => ({ ...f, titulo: e.target.value }))}
                placeholder="Ej: Casos clínicos de interés"
                className="h-[48px] max-lg:h-10 border-[1.5px] border-[#D1D5DB] rounded-[10px] max-lg:rounded-[8px] text-[15px] max-lg:text-[14px] font-['Inter'] placeholder:text-[#9CA3AF] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200"
              />
            </div>
            <div className="space-y-2 flex-1 min-h-0 flex flex-col">
              <Label htmlFor="create-descripcion" className="text-[14px] font-medium text-[#374151] font-['Inter']">
                Descripción
              </Label>
              <textarea
                id="create-descripcion"
                value={createForm.descripcion}
                onChange={(e) => setCreateForm((f) => ({ ...f, descripcion: e.target.value }))}
                placeholder="Breve descripción del tema para orientar a los participantes"
                className="w-full flex-1 min-h-[180px] resize-none rounded-[10px] max-lg:rounded-[8px] border-[1.5px] border-[#D1D5DB] px-3 py-2.5 text-[15px] max-lg:text-[14px] font-['Inter'] placeholder:text-[#9CA3AF] outline-none focus:outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200"
              />
            </div>
            <div className="space-y-2 flex-shrink-0">
              <Label className="text-[14px] font-medium text-[#374151] font-['Inter'] flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-[#6B7280] stroke-[2]" />
                Imagen <span className="text-[#6B7280] font-normal">(opcional)</span>
              </Label>
              <div className="flex gap-4 items-stretch">
                <div className="w-[200px] h-[200px] shrink-0 rounded-[10px] border border-[#E5E7EB] bg-white overflow-hidden flex items-center justify-center">
                  {createForm.imagenFile ? (
                    <img
                      src={URL.createObjectURL(createForm.imagenFile)}
                      alt="Vista previa"
                      className="w-full h-full object-cover"
                    />
                  ) : createForm.imagen_url ? (
                    <img
                      src={getImageUrl(createForm.imagen_url)!}
                      alt="Vista previa"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <img src={DEFAULT_LOGO} alt="Cogniare" className="w-full h-full object-contain" />
                  )}
                </div>
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  {!createForm.imagenFile && !createForm.imagen_url ? (
                    <div className="w-full h-full min-h-[200px] border-2 border-dashed border-[#D1D5DB] rounded-[10px] flex items-center justify-center hover:border-[#2563eb] transition-all duration-200 cursor-pointer">
                      <input
                        id="create-imagen"
                        type="file"
                        accept="image/jpeg,image/png,image/jpg"
                        onChange={(e) => setCreateForm((f) => ({ ...f, imagenFile: e.target.files?.[0] }))}
                        className="hidden"
                      />
                      <label htmlFor="create-imagen" className="cursor-pointer flex flex-col items-center justify-center gap-2">
                        <Paperclip className="h-8 w-8 text-[#9CA3AF] stroke-[2]" />
                        <p className="text-[14px] text-[#6B7280] font-['Inter'] mb-0">
                          Haz clic para seleccionar
                        </p>
                      </label>
                    </div>
                    ) : (
                      <div className="flex flex-col gap-1">
                        <p className="text-[13px] text-[#6B7280] font-['Inter']">
                          {createForm.imagenFile?.name || 'Imagen cargada'}
                        </p>
                        <button
                          type="button"
                          onClick={() => setCreateForm((f) => ({ ...f, imagenFile: undefined, imagen_url: '' }))}
                          className="text-[12px] text-[#EF4444] hover:text-[#DC2626] font-['Inter'] text-left bg-transparent border-none cursor-pointer p-0"
                        >
                          Quitar
                        </button>
                      </div>
                    )}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="px-8 max-lg:px-4 py-3 max-lg:py-3 border-t border-[#E5E7EB] bg-[#F9FAFB] flex flex-row max-lg:flex-col justify-end items-center gap-3 max-lg:gap-2 flex-shrink-0 mt-0">
            <div className="flex gap-3 max-lg:flex-col max-lg:w-full max-lg:gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCreateModal(false)}
                className="h-[48px] max-lg:h-11 px-6 rounded-[12px] border-[1.5px] border-[#D1D5DB] font-medium font-['Inter'] text-[15px] hover:bg-white hover:border-[#9CA3AF] transition-all duration-200 max-lg:w-full"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleCreate}
                disabled={createMutation.isPending || !createForm.titulo.trim()}
                className="h-[48px] max-lg:h-11 px-8 rounded-[12px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-lg shadow-[#2563eb]/30 hover:shadow-xl hover:shadow-[#2563eb]/40 hover:scale-[1.02] font-semibold font-['Inter'] text-[15px] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 max-lg:w-full max-lg:hover:scale-100"
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin stroke-[2.5]" />
                    Creando...
                  </>
                ) : (
                  'Crear tema'
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Editar */}
      <Dialog open={!!editingTema} onOpenChange={(o) => !o && setEditingTema(null)}>
        <DialogContent className="max-w-[960px] w-[95vw] max-h-[90vh] rounded-[20px] p-0 border border-[#E5E7EB] shadow-2xl flex flex-col overflow-hidden">
          <DialogHeader className="px-8 max-lg:px-4 pt-6 max-lg:pt-4 pb-4 max-lg:pb-3 border-b border-[#E5E7EB] bg-gradient-to-b from-white to-[#F9FAFB] flex-shrink-0 mb-0">
            <div className="flex items-center gap-4">
              <div className="max-lg:hidden h-12 w-12 rounded-full bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] flex items-center justify-center shadow-lg shadow-[#2563eb]/20">
                <Pencil className="h-6 w-6 text-white stroke-[2]" />
              </div>
              <div>
                <DialogTitle className="text-[28px] max-lg:text-[22px] font-bold text-[#111827] font-['Poppins'] leading-tight mb-0">
                  Editar tema
                </DialogTitle>
                <DialogDescription className="text-base max-lg:text-sm text-[#6B7280] font-['Inter'] mt-1 mb-0">
                  Modificá el título, descripción o imagen del tema
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          {editingTema && (
            <div className="flex-1 min-h-0 overflow-hidden px-8 max-lg:px-4 py-4 max-lg:py-3 flex flex-col gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-titulo" className="text-[14px] font-medium text-[#374151] font-['Inter'] flex items-center gap-1.5">
                  Título
                  <span className="text-[#EF4444]">*</span>
                </Label>
                <Input
                  id="edit-titulo"
                  value={editingTema.titulo}
                  onChange={(e) => setEditingTema((t) => t ? { ...t, titulo: e.target.value } : null)}
                  placeholder="Ej: Casos clínicos de interés"
                  className="h-[48px] max-lg:h-10 border-[1.5px] border-[#D1D5DB] rounded-[10px] max-lg:rounded-[8px] text-[15px] max-lg:text-[14px] font-['Inter'] placeholder:text-[#9CA3AF] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200"
                />
              </div>
              <div className="space-y-2 flex-1 min-h-0 flex flex-col">
                <Label htmlFor="edit-descripcion" className="text-[14px] font-medium text-[#374151] font-['Inter']">
                  Descripción
                </Label>
                <textarea
                  id="edit-descripcion"
                  value={editingTema.descripcion || ''}
                  onChange={(e) => setEditingTema((t) => t ? { ...t, descripcion: e.target.value } : null)}
                  placeholder="Breve descripción del tema"
                  className="w-full flex-1 min-h-[180px] resize-none rounded-[10px] max-lg:rounded-[8px] border-[1.5px] border-[#D1D5DB] px-3 py-2.5 text-[15px] max-lg:text-[14px] font-['Inter'] placeholder:text-[#9CA3AF] outline-none focus:outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200"
                />
              </div>
              <div className="space-y-2 flex-shrink-0">
                <Label className="text-[14px] font-medium text-[#374151] font-['Inter'] flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-[#6B7280] stroke-[2]" />
                  Imagen <span className="text-[#6B7280] font-normal">(opcional)</span>
                </Label>
                <div className="flex gap-4 items-stretch">
<div className="w-[200px] h-[200px] shrink-0 rounded-[10px] border border-[#E5E7EB] bg-white overflow-hidden flex items-center justify-center">
                  {editImagenFile ? (
                      <img
                        src={URL.createObjectURL(editImagenFile)}
                        alt="Vista previa"
                        className="w-full h-full object-cover"
                      />
                    ) : editingTema.imagen_url ? (
                      <img
                        src={getImageUrl(editingTema.imagen_url)!}
                        alt="Vista previa"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <img src={DEFAULT_LOGO} alt="Cogniare" className="w-full h-full object-contain" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    {!editImagenFile && !editingTema.imagen_url ? (
                      <div className="w-full h-full min-h-[200px] border-2 border-dashed border-[#D1D5DB] rounded-[10px] flex items-center justify-center hover:border-[#2563eb] transition-all duration-200 cursor-pointer">
                        <input
                          id="edit-imagen"
                          type="file"
                          accept="image/jpeg,image/png,image/jpg"
                          onChange={(e) => setEditImagenFile(e.target.files?.[0] || null)}
                          className="hidden"
                        />
                        <label htmlFor="edit-imagen" className="cursor-pointer flex flex-col items-center justify-center gap-2">
                          <Paperclip className="h-8 w-8 text-[#9CA3AF] stroke-[2]" />
                          <p className="text-[14px] text-[#6B7280] font-['Inter'] mb-0">
                            Haz clic para seleccionar
                          </p>
                        </label>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1">
                        <p className="text-[13px] text-[#6B7280] font-['Inter']">
                          {editImagenFile?.name || 'Imagen actual'}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setEditImagenFile(null);
                            setEditingTema((t) => t ? { ...t, imagen_url: '' } : null);
                          }}
                          className="text-[12px] text-[#EF4444] hover:text-[#DC2626] font-['Inter'] text-left bg-transparent border-none cursor-pointer p-0"
                        >
                          Quitar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="px-8 max-lg:px-4 py-3 max-lg:py-3 border-t border-[#E5E7EB] bg-[#F9FAFB] flex flex-row max-lg:flex-col justify-end items-center gap-3 max-lg:gap-2 flex-shrink-0 mt-0">
            <div className="flex gap-3 max-lg:flex-col max-lg:w-full max-lg:gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingTema(null)}
                className="h-[48px] max-lg:h-11 px-6 rounded-[12px] border-[1.5px] border-[#D1D5DB] font-medium font-['Inter'] text-[15px] hover:bg-white hover:border-[#9CA3AF] transition-all duration-200 max-lg:w-full"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleUpdate}
                disabled={updateMutation.isPending || !editingTema?.titulo?.trim()}
                className="h-[48px] max-lg:h-11 px-8 rounded-[12px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-lg shadow-[#2563eb]/30 hover:shadow-xl hover:shadow-[#2563eb]/40 hover:scale-[1.02] font-semibold font-['Inter'] text-[15px] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 max-lg:w-full max-lg:hover:scale-100"
              >
                {updateMutation.isPending ? (
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

      <ConfirmDeleteModal
        open={!!temaToDelete}
        onOpenChange={(o) => !o && setTemaToDelete(null)}
        title="Eliminar tema"
        description={temaToDelete ? <>¿Estás seguro de que deseas eliminar el tema <span className="font-semibold text-[#374151]">&quot;{formatDisplayText(temaToDelete.titulo)}&quot;</span>? Se eliminarán todas las respuestas. Esta acción no se puede deshacer.</> : ''}
        onConfirm={async () => { if (temaToDelete) await deleteMutation.mutateAsync(temaToDelete.id); }}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
