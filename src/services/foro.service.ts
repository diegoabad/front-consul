import api, { getData } from './api';
import type { ApiResponse } from '@/types';

export interface ForoTema {
  id: string;
  titulo: string;
  descripcion?: string;
  imagen_url?: string;
  creado_por: string;
  creador_nombre?: string;
  creador_apellido?: string;
  activo: boolean;
  orden: number;
  fecha_creacion: string;
  fecha_actualizacion?: string;
}

export interface ForoPost {
  id: string;
  tema_id: string;
  usuario_id: string;
  parent_id?: string | null;
  parent_autor_nombre?: string;
  parent_autor_apellido?: string;
  parent_autor_rol?: string;
  parent_autor_especialidad?: string;
  autor_nombre?: string;
  autor_apellido?: string;
  autor_rol?: string;
  autor_especialidad?: string;
  contenido: string;
  moderado: boolean;
  fecha_creacion: string;
}

export interface CreateTemaData {
  titulo: string;
  descripcion?: string;
  imagen_url?: string;
  orden?: number;
}

export interface UpdateTemaData {
  titulo?: string;
  descripcion?: string;
  imagen_url?: string;
  activo?: boolean;
  orden?: number;
}

export interface PaginatedTemasResponse {
  data: ForoTema[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedPostsResponse {
  data: ForoPost[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface RootWithReplies {
  post: ForoPost;
  replies: ForoPost[];
  totalReplies: number;
}

export interface PaginatedRootsResponse {
  mode: 'roots';
  roots: RootWithReplies[];
  totalRoots: number;
  rootsPage: number;
  rootsTotalPages: number;
  repliesPerRoot: number;
  total: number;
}

export interface ForoProfesionalHabilitado {
  id: string;
  usuario_id: string;
  nombre?: string;
  apellido?: string;
  especialidad?: string;
  email?: string;
  habilitado: boolean;
}

export const foroService = {
  getProfesionalesHabilitados: async (): Promise<ForoProfesionalHabilitado[]> => {
    const response = await api.get<ApiResponse<ForoProfesionalHabilitado[]>>('/foro/permisos');
    const data = getData(response);
    return data ?? [];
  },

  updatePermisoForo: async (usuarioId: string, habilitado: boolean): Promise<void> => {
    await api.put<ApiResponse<{ usuario_id: string; habilitado: boolean }>>(`/foro/permisos/${usuarioId}`, { habilitado });
  },

  uploadImagenTema: async (file: File): Promise<{ url: string }> => {
    const formData = new FormData();
    formData.append('imagen', file);
    const response = await api.post<ApiResponse<{ url: string }>>('/foro/temas/upload-imagen', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    const data = getData(response);
    if (!data?.url) throw new Error('Error al subir la imagen');
    return data;
  },

  getTemas: async (params?: { page?: number; limit?: number; includeInactive?: boolean }): Promise<ForoTema[] | PaginatedTemasResponse> => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.includeInactive) searchParams.set('includeInactive', 'true');
    const qs = searchParams.toString();
    const response = await api.get<ApiResponse<ForoTema[] | PaginatedTemasResponse>>(`/foro/temas${qs ? `?${qs}` : ''}`);
    const data = getData(response);
    return data ?? (Array.isArray(data) ? [] : { data: [], total: 0, page: 1, limit: 10, totalPages: 0 });
  },

  getTemaById: async (id: string): Promise<ForoTema | null> => {
    const response = await api.get<ApiResponse<ForoTema>>(`/foro/temas/${id}`);
    return getData(response);
  },

  createTema: async (data: CreateTemaData): Promise<ForoTema> => {
    const response = await api.post<ApiResponse<ForoTema>>('/foro/temas', data);
    const result = getData(response);
    if (!result) throw new Error('Error al crear tema');
    return result;
  },

  updateTema: async (id: string, data: UpdateTemaData): Promise<ForoTema> => {
    const response = await api.put<ApiResponse<ForoTema>>(`/foro/temas/${id}`, data);
    const result = getData(response);
    if (!result) throw new Error('Error al actualizar tema');
    return result;
  },

  deleteTema: async (id: string): Promise<void> => {
    await api.delete<ApiResponse<void>>(`/foro/temas/${id}`);
  },

  getPosts: async (temaId: string, params?: { page?: number; limit?: number; includeModerados?: boolean; order?: 'asc' | 'desc' }): Promise<PaginatedPostsResponse> => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.includeModerados) searchParams.set('includeModerados', 'true');
    if (params?.order) searchParams.set('order', params.order);
    const qs = searchParams.toString();
    const response = await api.get<ApiResponse<PaginatedPostsResponse>>(`/foro/temas/${temaId}/posts${qs ? `?${qs}` : ''}`);
    const data = getData(response);
    return data ?? { data: [], total: 0, page: 1, limit: 20, totalPages: 0 };
  },

  getPostsByRoots: async (temaId: string, params?: { rootsPage?: number; rootsLimit?: number; repliesPerRoot?: number; order?: 'asc' | 'desc' }): Promise<PaginatedRootsResponse> => {
    const searchParams = new URLSearchParams();
    searchParams.set('rootsPage', String(params?.rootsPage ?? 1));
    searchParams.set('rootsLimit', String(params?.rootsLimit ?? 10));
    searchParams.set('repliesPerRoot', String(params?.repliesPerRoot ?? 2));
    if (params?.order) searchParams.set('order', params.order);
    const response = await api.get<ApiResponse<PaginatedRootsResponse>>(`/foro/temas/${temaId}/posts?${searchParams.toString()}`);
    const data = getData(response);
    if (!data || data.mode !== 'roots') throw new Error('Respuesta inesperada');
    return data;
  },

  getRepliesByRoot: async (temaId: string, rootId: string, params?: { offset?: number; limit?: number; order?: 'asc' | 'desc' }): Promise<{ data: ForoPost[]; total: number; offset: number; limit: number; totalPages: number }> => {
    const searchParams = new URLSearchParams();
    if (params?.offset !== undefined) searchParams.set('offset', String(params.offset));
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.order) searchParams.set('order', params.order);
    const qs = searchParams.toString();
    const response = await api.get<ApiResponse<{ data: ForoPost[]; total: number; offset: number; limit: number; totalPages: number }>>(`/foro/temas/${temaId}/posts/${rootId}/replies${qs ? `?${qs}` : ''}`);
    const data = getData(response);
    return data ?? { data: [], total: 0, offset: 0, limit: 10, totalPages: 0 };
  },

  createPost: async (temaId: string, contenido: string, parentId?: string | null): Promise<ForoPost> => {
    const response = await api.post<ApiResponse<ForoPost>>(`/foro/temas/${temaId}/posts`, {
      contenido,
      ...(parentId ? { parent_id: parentId } : {}),
    });
    const result = getData(response);
    if (!result) throw new Error('Error al publicar respuesta');
    return result;
  },

  updatePost: async (postId: string, contenido: string): Promise<ForoPost> => {
    const response = await api.put<ApiResponse<ForoPost>>(`/foro/posts/${postId}`, { contenido });
    const result = getData(response);
    if (!result) throw new Error('Error al actualizar');
    return result;
  },

  deletePost: async (postId: string): Promise<void> => {
    await api.delete<ApiResponse<void>>(`/foro/posts/${postId}`);
  },

  moderarPost: async (postId: string, moderado: boolean): Promise<ForoPost> => {
    const response = await api.put<ApiResponse<ForoPost>>(`/foro/posts/${postId}/moderar`, { moderado });
    const result = getData(response);
    if (!result) throw new Error('Error al moderar');
    return result;
  },
};
