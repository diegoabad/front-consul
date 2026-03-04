import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Loader2, Send, MessageSquare, Reply, Pencil, Trash2, ArrowUpDown, ChevronDown } from 'lucide-react';
import { toast as reactToastify } from 'react-toastify';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { foroService, type ForoTema, type ForoPost, type RootWithReplies } from '@/services/foro.service';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/utils/permissions';
import { formatDisplayText } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { ConfirmDeleteModal } from '@/components/shared/ConfirmDeleteModal';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/api\/?$/, '') || (typeof window !== 'undefined' ? window.location.origin : '');
const getImageUrl = (url: string | null | undefined) => (url ? `${API_BASE}${url}` : null);
const DEFAULT_LOGO = '/logo.png';

/** Formatea el nombre del autor: Administrador para admin, o "Profesional: Nombre Apellido - Especialidad" para profesionales */
function formatAutor(post: {
  autor_rol?: string;
  autor_nombre?: string;
  autor_apellido?: string;
  autor_especialidad?: string;
}): string {
  if (post.autor_rol === 'administrador') return 'Administrador';
  const nombre = formatDisplayText(post.autor_nombre);
  const apellido = formatDisplayText(post.autor_apellido);
  const esp = post.autor_especialidad?.trim() || '';
  const especialidad = esp ? esp.charAt(0).toUpperCase() + esp.slice(1).toLowerCase() : '';
  const base = [nombre, apellido].filter(Boolean).join(' ');
  return especialidad ? `Profesional: ${base} - ${especialidad}` : `Profesional: ${base}`;
}

export default function ForoTemaDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, refreshUser } = useAuth();
  const canRespond = hasPermission(user, 'foro.responder');

  const [nuevoContenido, setNuevoContenido] = useState('');
  const [rootsPage, setRootsPage] = useState(1);
  const [postsOrder, setPostsOrder] = useState<'asc' | 'desc'>('asc');
  const [showPostModal, setShowPostModal] = useState(false);
  const [expandedReplies, setExpandedReplies] = useState<Record<string, ForoPost[]>>({});
  const [expandingRootId, setExpandingRootId] = useState<string | null>(null);

  const { data: tema, isLoading: loadingTema } = useQuery({
    queryKey: ['foro', 'tema', id],
    queryFn: () => foroService.getTemaById(id!),
    enabled: !!id,
  });

  const { data: rootsData, isLoading: loadingPosts } = useQuery({
    queryKey: ['foro', 'posts', id, rootsPage, postsOrder],
    queryFn: () => foroService.getPostsByRoots(id!, { rootsPage, rootsLimit: 10, repliesPerRoot: 2, order: postsOrder }),
    enabled: !!id,
  });

  const createPostMutation = useMutation({
    mutationFn: ({ contenido, parentId }: { contenido: string; parentId?: string | null }) =>
      foroService.createPost(id!, contenido, parentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['foro', 'posts', id] });
      setNuevoContenido('');
      setReplyingTo(null);
      setEditingPostId(null);
      setShowPostModal(false);
      setExpandedReplies({});
      reactToastify.success('Respuesta publicada');
    },
    onError: async (e: unknown) => {
      const err = e as { response?: { status?: number } };
      if (err.response?.status === 403) {
        await refreshUser();
        reactToastify.error('Ya no tenés acceso al foro. El administrador puede haber deshabilitado tu permiso. Actualizá la página.');
        return;
      }
      reactToastify.error((e as Error)?.message || 'Error al publicar');
    },
  });

  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [deletePostId, setDeletePostId] = useState<string | null>(null);

  const updatePostMutation = useMutation({
    mutationFn: ({ postId, contenido }: { postId: string; contenido: string }) =>
      foroService.updatePost(postId, contenido),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['foro', 'posts', id] });
      setEditingPostId(null);
      setNuevoContenido('');
      setShowPostModal(false);
      reactToastify.success('Mensaje actualizado');
    },
    onError: async (e: unknown) => {
      const err = e as { response?: { status?: number } };
      if (err.response?.status === 403) {
        await refreshUser();
        reactToastify.error('Ya no tenés acceso al foro. El administrador puede haber deshabilitado tu permiso. Actualizá la página.');
        return;
      }
      reactToastify.error((e as Error)?.message || 'Error al actualizar');
    },
  });

  const deletePostMutation = useMutation({
    mutationFn: (postId: string) => foroService.deletePost(postId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['foro', 'posts', id] });
      setDeletePostId(null);
      setExpandedReplies({});
      reactToastify.success('Mensaje eliminado');
    },
    onError: async (e: unknown) => {
      const err = e as { response?: { status?: number } };
      if (err.response?.status === 403) {
        await refreshUser();
        reactToastify.error('Ya no tenés acceso al foro. El administrador puede haber deshabilitado tu permiso. Actualizá la página.');
        return;
      }
      reactToastify.error((e as Error)?.message || 'Error al eliminar');
    },
  });

  const handleSubmitForm = () => {
    const trimmed = nuevoContenido.trim();
    if (!trimmed) {
      reactToastify.error('Escribí tu respuesta');
      return;
    }
    if (editingPostId) {
      updatePostMutation.mutate({ postId: editingPostId, contenido: trimmed });
    } else {
      createPostMutation.mutate({ contenido: trimmed, parentId: replyingTo ?? undefined });
    }
  };

  const handleCancelForm = () => {
    setReplyingTo(null);
    setEditingPostId(null);
    setNuevoContenido('');
    setShowPostModal(false);
  };

  if (loadingTema || !tema) {
    return (
      <div className="flex items-center justify-center min-h-[280px]">
        <Loader2 className="h-10 w-10 text-[#2563eb] animate-spin" />
      </div>
    );
  }

  const roots = rootsData?.roots ?? [];
  const rootsTotalPages = rootsData?.rootsTotalPages ?? 0;
  const totalRespuestas = rootsData?.total ?? 0;
  const imgUrl = getImageUrl(tema.imagen_url) || DEFAULT_LOGO;

  const findPostById = (postId: string): ForoPost | undefined => {
    for (const r of roots) {
      if (r.post.id === postId) return r.post;
      const reply = r.replies.find((p) => p.id === postId) ?? expandedReplies[r.post.id]?.find((p) => p.id === postId);
      if (reply) return reply;
    }
    return undefined;
  };

  const handleExpandReplies = async (root: RootWithReplies) => {
    const rootId = root.post.id;
    const baseReplies = root.replies;
    const extra = expandedReplies[rootId] ?? [];
    const currentCount = baseReplies.length + extra.length;
    if (currentCount >= root.totalReplies) return;
    setExpandingRootId(rootId);
    try {
      const res = await foroService.getRepliesByRoot(id!, rootId, { offset: currentCount, limit: 10, order: postsOrder });
      setExpandedReplies((prev) => ({
        ...prev,
        [rootId]: [...(prev[rootId] ?? []), ...res.data],
      }));
    } finally {
      setExpandingRootId(null);
    }
  };

  return (
    <div className={`flex-1 flex flex-col space-y-6 max-lg:space-y-4 relative ${canRespond && tema.activo ? 'pb-24 max-lg:pb-20' : ''}`}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate('/foro')}
        className="self-start -ml-2 -my-1 h-auto min-h-0 py-1 px-2 text-sm text-[#6B7280] hover:text-[#374151] font-['Inter']"
      >
        <ChevronLeft className="h-4 w-4 mr-1" />
        Volver al foro
      </Button>

      <Card className="border border-[#E5E7EB] rounded-[16px] shadow-sm overflow-hidden relative">
        {tema.fecha_creacion && (
          <span className="absolute top-4 right-4 z-10 text-[12px] text-[#6B7280] font-['Inter']">
            {format(new Date(tema.fecha_creacion), "d 'de' MMMM 'de' yyyy", { locale: es })}
          </span>
        )}
        <div className="flex flex-col lg:flex-row lg:items-stretch">
          {/* Imagen: se adapta al recuadro y llena el espacio (logo Cogniare si no hay imagen) */}
          <div className="lg:w-[320px] lg:shrink-0 lg:border-r lg:border-[#E5E7EB] p-4 lg:p-5 flex items-center justify-center">
            <div className="w-full max-w-[280px] mx-auto aspect-[4/3] max-lg:max-h-[260px] bg-white overflow-hidden rounded-[12px] shadow-sm flex items-center justify-center">
              <img src={imgUrl} alt="" className={`w-full h-full object-center ${imgUrl === DEFAULT_LOGO ? 'object-contain' : 'object-cover'}`} />
            </div>
          </div>
          {/* Título y descripción: el contenedor crece para que entre todo el texto */}
          <CardContent className="p-6 lg:p-8 flex-1 min-w-0 overflow-visible">
            <h1 className="text-[28px] lg:text-[32px] font-bold text-[#111827] font-['Poppins'] leading-tight mb-4">
              {formatDisplayText(tema.titulo)}
            </h1>
            {tema.descripcion && (
              <p className="text-[15px] lg:text-[16px] text-[#374151] font-['Inter'] whitespace-pre-wrap leading-relaxed break-words">
                {tema.descripcion}
              </p>
            )}
          </CardContent>
        </div>
      </Card>

      <Card className="border border-[#E5E7EB] rounded-[16px] shadow-sm flex flex-col">
        <div className="flex items-center justify-between gap-3 p-4 pb-4">
          <h2 className="text-[20px] font-semibold text-[#111827] font-['Poppins'] m-0">
            Respuestas ({totalRespuestas})
          </h2>
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setPostsOrder((o) => (o === 'asc' ? 'desc' : 'asc')); setRootsPage(1); setExpandedReplies({}); }}
                  className="h-8 px-3 text-[13px] border-[#2563eb] text-[#2563eb] hover:bg-[#EFF6FF] rounded-[8px]"
                >
                  <ArrowUpDown className="h-4 w-4 mr-1.5" />
                  {postsOrder === 'asc' ? 'Más antiguas primero' : 'Más recientes primero'}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="bg-[#111827] text-white text-xs font-['Inter'] rounded-[8px] px-3 py-2 [&>p]:text-white">
                <p>Cambiar orden de las respuestas</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {loadingPosts ? (
          <div className="flex justify-center py-8 px-4">
            <Loader2 className="h-8 w-8 animate-spin text-[#2563eb]" />
          </div>
        ) : roots.length === 0 ? (
          <div className="p-12 text-center">
            <MessageSquare className="h-12 w-12 text-[#9CA3AF] mx-auto mb-3" />
            <p className="text-[#6B7280] font-['Inter']">Aún no hay respuestas. Sé el primero en participar.</p>
          </div>
        ) : (
          <>
            <div className="space-y-6 px-4 pt-2 pb-4">
              {roots.map((r) => {
                const extra = expandedReplies[r.post.id] ?? [];
                const allReplies = [...r.replies, ...extra];
                const canExpand = r.totalReplies > allReplies.length;
                const isLoadingExpand = expandingRootId === r.post.id;
                return (
                  <div key={r.post.id} className="space-y-3">
                    <PostCard
                      post={r.post}
                      currentUserId={user?.id}
                      canRespond={canRespond && tema.activo}
                      isTemaActivo={tema.activo}
                      onStartReply={() => {
                        setReplyingTo(r.post.id);
                        setEditingPostId(null);
                        setNuevoContenido('');
                        setShowPostModal(true);
                      }}
                      onStartEdit={() => {
                        setEditingPostId(r.post.id);
                        setReplyingTo(null);
                        setNuevoContenido(r.post.contenido);
                        setShowPostModal(true);
                      }}
                      onDelete={() => setDeletePostId(r.post.id)}
                    />
                    {(allReplies.length > 0 || canExpand) && (
                      <div className="space-y-3 ml-6 pl-4 border-l-2 border-l-[#E5E7EB]">
                        {allReplies.map((reply) => (
                          <PostCard
                            key={reply.id}
                            post={reply}
                            currentUserId={user?.id}
                            canRespond={canRespond && tema.activo}
                            isTemaActivo={tema.activo}
                            onStartReply={() => {
                              setReplyingTo(reply.id);
                              setEditingPostId(null);
                              setNuevoContenido('');
                              setShowPostModal(true);
                            }}
                            onStartEdit={() => {
                              setEditingPostId(reply.id);
                              setReplyingTo(null);
                              setNuevoContenido(reply.contenido);
                              setShowPostModal(true);
                            }}
                            onDelete={() => setDeletePostId(reply.id)}
                          />
                        ))}
                        {canExpand && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-[#2563eb] hover:text-[#1d4ed8] hover:bg-[#EFF6FF] font-medium"
                            onClick={() => handleExpandReplies(r)}
                            disabled={isLoadingExpand}
                          >
                            {isLoadingExpand ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2 inline" />
                            ) : (
                              <ChevronDown className="h-4 w-4 mr-2 inline" />
                            )}
                            Ver más respuestas ({allReplies.length} de {r.totalReplies})
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <ConfirmDeleteModal
              open={!!deletePostId}
              onOpenChange={(open) => !open && setDeletePostId(null)}
              title="Eliminar mensaje"
              description="¿Estás seguro de que querés eliminar este mensaje? Esta acción no se puede deshacer."
              onConfirm={async () => {
                if (deletePostId) await deletePostMutation.mutateAsync(deletePostId);
              }}
              isLoading={deletePostMutation.isPending}
              confirmLabel="Eliminar"
            />
          </>
        )}

        {rootsTotalPages > 1 && (
          <div className="flex items-center justify-between gap-4 px-5 py-3.5 border-t border-[#E5E7EB] bg-[#F9FAFB] rounded-b-[16px]">
            <p className="text-[13px] font-medium text-[#374151] font-['Inter'] m-0">
              Página <span className="text-[#111827]">{rootsPage}</span> de <span className="text-[#111827]">{rootsTotalPages}</span>
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setRootsPage((x) => Math.max(1, x - 1)); setExpandedReplies({}); }}
                disabled={rootsPage <= 1}
                className="h-8 px-3.5 border-[#D1D5DB] rounded-[8px] text-[13px] font-medium text-[#374151] hover:bg-[#F3F4F6] hover:border-[#9CA3AF] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setRootsPage((x) => Math.min(rootsTotalPages, x + 1)); setExpandedReplies({}); }}
                disabled={rootsPage >= rootsTotalPages}
                className="h-8 px-3.5 border-[#D1D5DB] rounded-[8px] text-[13px] font-medium text-[#374151] hover:bg-[#F3F4F6] hover:border-[#9CA3AF] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              >
                Siguiente
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {!tema.activo ? (
        <Card className="border border-[#E5E7EB] rounded-[16px] shadow-sm bg-[#F9FAFB]">
          <CardContent className="p-6">
            <p className="text-[15px] text-[#6B7280] font-['Inter'] text-center mb-0">
              Este tema fue deshabilitado por el administrador.
            </p>
          </CardContent>
        </Card>
      ) : canRespond ? (
        <div className="fixed bottom-4 right-4 z-40 max-lg:bottom-4 max-lg:right-4 lg:bottom-6 lg:right-8">
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => {
                    setReplyingTo(null);
                    setEditingPostId(null);
                    setNuevoContenido('');
                    setShowPostModal(true);
                  }}
                  className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-[12px] px-6 py-3 font-medium shadow-lg shadow-[#2563eb]/30 hover:shadow-xl transition-all max-lg:h-14 max-lg:w-14 max-lg:rounded-full max-lg:p-0 max-lg:flex max-lg:items-center max-lg:justify-center lg:flex lg:gap-2"
                >
                  <Send className="h-4 w-4 max-lg:h-6 max-lg:w-6 lg:mr-2" />
                  <span className="max-lg:hidden">Publicar en el foro</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="bg-[#111827] text-white text-xs font-['Inter'] rounded-[8px] px-3 py-2 [&>p]:text-white">
                <p>Publicar en el foro</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      ) : null}

      {/* Modal para escribir respuesta o editar */}
      <Dialog open={showPostModal} onOpenChange={(open) => { setShowPostModal(open); if (!open) handleCancelForm(); }}>
        <DialogContent className="max-w-[960px] w-[95vw] max-h-[90vh] min-h-[min(400px,85vh)] max-lg:min-h-[min(380px,80vh)] rounded-[20px] p-0 border border-[#E5E7EB] shadow-2xl flex flex-col overflow-hidden">
          <DialogHeader className="px-8 max-lg:px-4 pt-6 max-lg:pt-4 pb-4 max-lg:pb-3 border-b border-[#E5E7EB] bg-gradient-to-b from-white to-[#F9FAFB] flex-shrink-0 mb-0">
            <div className="flex items-center gap-4">
              <div className="max-lg:hidden h-12 w-12 rounded-full bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] flex items-center justify-center shadow-lg shadow-[#2563eb]/20">
                <MessageSquare className="h-6 w-6 text-white stroke-[2]" />
              </div>
              <div>
                <DialogTitle className="text-[28px] max-lg:text-[22px] font-bold text-[#111827] font-['Poppins'] leading-tight mb-0">
                  {editingPostId
                    ? 'Editando tu mensaje'
                    : replyingTo
                      ? `Respondiendo a ${formatAutor(findPostById(replyingTo) ?? {})}`
                      : 'Publicar en el foro'}
                </DialogTitle>
                <DialogDescription className="text-base max-lg:text-sm text-[#6B7280] font-['Inter'] mt-1 mb-0">
                  {editingPostId
                    ? 'Modificá el texto de tu mensaje.'
                    : 'Escribí tu respuesta. Solo texto, sin enlaces.'}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="flex-1 min-h-[220px] max-lg:min-h-[200px] overflow-hidden px-8 max-lg:px-4 py-4 max-lg:py-3 flex flex-col">
            <textarea
              value={nuevoContenido}
              onChange={(e) => setNuevoContenido(e.target.value)}
              placeholder="Escribí tu mensaje..."
              className="w-full flex-1 min-h-[200px] resize-none rounded-[12px] max-lg:rounded-[10px] border-[1.5px] border-[#D1D5DB] px-4 py-3 text-[15px] max-lg:text-[14px] font-['Inter'] placeholder:text-[#9CA3AF] outline-none focus:outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200"
              autoFocus
            />
          </div>
          <DialogFooter className="px-8 max-lg:px-4 py-3 max-lg:py-3 border-t border-[#E5E7EB] bg-[#F9FAFB] flex flex-row max-lg:flex-col justify-end items-center gap-3 max-lg:gap-2 flex-shrink-0 mt-0">
            <Button
              variant="outline"
              onClick={handleCancelForm}
              className="h-[48px] max-lg:h-11 px-6 rounded-[12px] border-[1.5px] border-[#D1D5DB] font-medium font-['Inter'] text-[15px] hover:bg-white hover:border-[#9CA3AF] transition-all duration-200 max-lg:w-full"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmitForm}
              disabled={(createPostMutation.isPending || updatePostMutation.isPending) || !nuevoContenido.trim()}
              className="h-[48px] max-lg:h-11 px-8 rounded-[12px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-lg shadow-[#2563eb]/30 font-semibold font-['Inter'] text-[15px] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed max-lg:w-full"
            >
              {(createPostMutation.isPending || updatePostMutation.isPending) ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  {editingPostId ? 'Guardar cambios' : 'Publicar'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface PostCardProps {
  post: ForoPost;
  currentUserId?: string;
  canRespond?: boolean;
  isTemaActivo?: boolean;
  onStartReply?: () => void;
  onStartEdit?: () => void;
  onDelete?: () => void;
}

function PostCard({
  post,
  currentUserId,
  canRespond,
  isTemaActivo = true,
  onStartReply,
  onStartEdit,
  onDelete,
}: PostCardProps) {
  const isReply = !!post.parent_id;
  const isOwnPost = !!currentUserId && post.usuario_id === currentUserId;
  const canEditDelete = isOwnPost && isTemaActivo;

  return (
    <Card
      className={`border border-[#E5E7EB] rounded-[12px] shadow-sm ${isReply ? 'ml-6 border-l-2 border-l-[#2563eb]/40' : ''}`}
    >
      <CardContent className="p-0">
        {/* Cabecera: autor, fecha, botones */}
        <div className="px-4 py-3 bg-[#F9FAFB] border-b border-[#E5E7EB]">
          {isReply && (post.parent_autor_nombre || post.parent_autor_apellido || post.parent_autor_rol === 'administrador') && (
            <p className="text-[13px] text-[#6B7280] mb-1.5 font-['Inter']">
              Respondiendo a {formatAutor({
                autor_rol: post.parent_autor_rol,
                autor_nombre: post.parent_autor_nombre,
                autor_apellido: post.parent_autor_apellido,
                autor_especialidad: post.parent_autor_especialidad,
              })}
            </p>
          )}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2 min-w-0">
              <div className="flex items-center gap-2 min-w-0 shrink">
                <span className="font-semibold text-[16px] text-[#111827] font-['Inter'] truncate">
                  {formatAutor(post)}
                </span>
                <span className="text-[14px] text-[#6B7280] font-['Inter'] shrink-0 hidden lg:inline">
                  {format(new Date(post.fecha_creacion), "d 'de' MMM yyyy, HH:mm", { locale: es })}
                </span>
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                <TooltipProvider delayDuration={200}>
                  {canRespond && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-[#2563eb] hover:text-[#1d4ed8] hover:bg-[#EFF6FF]"
                          onClick={onStartReply}
                        >
                          <Reply className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="bg-[#111827] text-white text-xs font-['Inter'] rounded-[8px] px-3 py-2 [&>p]:text-white">
                        <p>Responder</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                  {canEditDelete && (
                    <>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-[#6B7280] hover:text-[#374151] hover:bg-[#F3F4F6]"
                            onClick={onStartEdit}
                          >
                            <Pencil className="h-4 w-4" />
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
                            className="h-9 w-9 text-[#DC2626] hover:text-[#B91C1C] hover:bg-[#FEF2F2]"
                            onClick={onDelete}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="bg-[#111827] text-white text-xs font-['Inter'] rounded-[8px] px-3 py-2 [&>p]:text-white">
                          <p>Eliminar</p>
                        </TooltipContent>
                      </Tooltip>
                    </>
                  )}
                </TooltipProvider>
              </div>
            </div>
            <span className="text-[14px] text-[#6B7280] font-['Inter'] lg:hidden">
              {format(new Date(post.fecha_creacion), "d 'de' MMM yyyy, HH:mm", { locale: es })}
            </span>
          </div>
        </div>
        <p className="text-[15px] text-[#374151] font-['Inter'] whitespace-pre-wrap p-4 pt-3 mb-0">
          {post.contenido}
        </p>
      </CardContent>
    </Card>
  );
}
