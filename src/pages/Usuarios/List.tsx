import { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { especialidadesService } from '@/services/especialidades.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { 
  Users, Edit, Lock, Unlock, Plus, Loader2, Trash2, Key, 
  Search, Filter, Mail, Phone, UserCog, ShieldCheck, Eye, EyeOff, ChevronLeft, ChevronRight, Stethoscope, CreditCard, Calendar
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast as reactToastify } from 'react-toastify';
import { usuariosService, type CreateUsuarioData, type UpdateUsuarioData } from '@/services/usuarios.service';
import { profesionalesService } from '@/services/profesionales.service';
import type { User } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/utils/permissions';
import { formatDisplayText } from '@/lib/utils';

const ROLES = [
  { value: 'administrador', label: 'Administrador' },
  { value: 'profesional', label: 'Profesional' },
  { value: 'secretaria', label: 'Secretaria' },
];

/** Secretaria solo puede crear/editar usuarios con rol secretaria o profesional (no administrador). */
const ROLES_SECRETARIA = [
  { value: 'secretaria', label: 'Secretaria' },
  { value: 'profesional', label: 'Profesional' },
];

const estadoOptions = [
  { value: 'todos', label: 'Todos los estados' },
  { value: 'true', label: 'Activos' },
  { value: 'false', label: 'Inactivos' },
];

const rolOptions = [
  { value: 'todos', label: 'Todos los roles' },
  ...ROLES,
];

const TIPO_PERIODO_PAGO = [
  { value: 'mensual', label: 'Mensual' },
  { value: 'quincenal', label: 'Quincenal' },
  { value: 'semanal', label: 'Semanal' },
  { value: 'anual', label: 'Anual' },
];

function getEstadoBadge(activo: boolean) {
  return activo ? (
    <Badge className="bg-[#D1FAE5] text-[#065F46] border-[#6EE7B7] hover:bg-[#A7F3D0] rounded-full px-3 py-1 text-xs font-medium">
      Activo
    </Badge>
  ) : (
    <Badge className="bg-[#F3F4F6] text-[#4B5563] border-[#D1D5DB] hover:bg-[#E5E7EB] rounded-full px-3 py-1 text-xs font-medium">
      Inactivo
    </Badge>
  );
}

function getRolBadge(rol: string) {
  const roleColors: Record<string, string> = {
    administrador: 'bg-[#EDE9FE] text-[#5B21B6] border-[#C4B5FD]',
    profesional: 'bg-[#DBEAFE] text-[#1E40AF] border-[#BAE6FD]',
    secretaria: 'bg-[#FCE7F3] text-[#BE185D] border-[#FBCFE8]',
  };

  const roleLabels: Record<string, string> = {
    administrador: 'Administrador',
    profesional: 'Profesional',
    secretaria: 'Secretaria',
  };

  return (
    <Badge className={`${roleColors[rol] || 'bg-[#F3F4F6] text-[#6B7280] border-[#D1D5DB]'} hover:opacity-80 rounded-full px-3 py-1 text-xs font-medium`}>
      {roleLabels[rol] || rol}
    </Badge>
  );
}

export default function AdminUsuarios() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [rolFilter, setRolFilter] = useState('todos');
  const [estadoFilter, setEstadoFilter] = useState('todos');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedUsuario, setSelectedUsuario] = useState<User | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state para crear usuario
  const [createFormData, setCreateFormData] = useState<CreateUsuarioData>({
    email: '',
    password: '',
    nombre: '',
    apellido: '',
    telefono: '',
    rol: 'profesional',
    activo: true,
  });
  const [createConfirmPassword, setCreateConfirmPassword] = useState('');
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [showCreateConfirmPassword, setShowCreateConfirmPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [createStep, setCreateStep] = useState<1 | 2>(1);
  const [showCreateEspecialidadInput, setShowCreateEspecialidadInput] = useState(false);
  const [newEspecialidadNombre, setNewEspecialidadNombre] = useState('');
  const [isCreatingEspecialidad, setIsCreatingEspecialidad] = useState(false);
  const [profesionalExtraData, setProfesionalExtraData] = useState<{
    matricula: string;
    especialidad: string;
    tipo_periodo_pago: 'mensual' | 'quincenal' | 'semanal' | 'anual';
    valor: string;
    fecha_inicio: string;
  }>({
    matricula: '',
    especialidad: '',
    tipo_periodo_pago: 'mensual',
    valor: '',
    fecha_inicio: '',
  });
  const [contratoDatePickerOpen, setContratoDatePickerOpen] = useState(false);
  const [contratoDatePickerMonth, setContratoDatePickerMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [contratoDatePickerAnchor, setContratoDatePickerAnchor] = useState<DOMRect | null>(null);
  const contratoDatePickerButtonRef = useRef<HTMLButtonElement>(null);
  const contratoDatePickerRef = useRef<HTMLDivElement>(null);

  // Form state para editar usuario
  const [editFormData, setEditFormData] = useState<UpdateUsuarioData>({
    email: '',
    nombre: '',
    apellido: '',
    telefono: '',
    rol: 'profesional',
  });
  const [editProfesionalId, setEditProfesionalId] = useState<string | null>(null);
  const [editProfesionalData, setEditProfesionalData] = useState<{
    matricula: string;
    especialidad: string;
    tipo_periodo_pago: 'mensual' | 'quincenal' | 'semanal' | 'anual';
    valor: string;
    fecha_inicio: string;
  }>({
    matricula: '',
    especialidad: '',
    tipo_periodo_pago: 'mensual',
    valor: '',
    fecha_inicio: '',
  });
  const [editShowCreateEspecialidadInput, setEditShowCreateEspecialidadInput] = useState(false);
  const [editNewEspecialidadNombre, setEditNewEspecialidadNombre] = useState('');
  const [editContratoDatePickerOpen, setEditContratoDatePickerOpen] = useState(false);
  const [editContratoDatePickerMonth, setEditContratoDatePickerMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [editContratoDatePickerAnchor, setEditContratoDatePickerAnchor] = useState<DOMRect | null>(null);
  const editContratoDatePickerButtonRef = useRef<HTMLButtonElement>(null);
  const editContratoDatePickerRef = useRef<HTMLDivElement>(null);
  const [editStep, setEditStep] = useState<1 | 2>(1);

  // Form state para cambiar contraseña
  const [passwordData, setPasswordData] = useState({
    new_password: '',
    confirm_password: '',
  });

  // Fetch usuarios con filtros
  const filters = useMemo(() => {
    const f: { rol?: string; activo?: boolean } = {};
    if (rolFilter !== 'todos') {
      f.rol = rolFilter;
    }
    if (estadoFilter !== 'todos') {
      f.activo = estadoFilter === 'true';
    }
    return f;
  }, [rolFilter, estadoFilter]);

  const { data: usuarios = [], isLoading } = useQuery({
    queryKey: ['usuarios', filters],
    queryFn: () => usuariosService.getAll(filters),
  });

  const { data: especialidades = [] } = useQuery({
    queryKey: ['especialidades'],
    queryFn: () => especialidadesService.getAll(),
    enabled: showCreateModal || showEditModal,
  });

  // Cargar profesional al editar usuario con rol profesional
  const { data: profesionalParaEditar } = useQuery({
    queryKey: ['profesional-by-user', selectedUsuario?.id],
    queryFn: () => profesionalesService.getByUsuarioId(selectedUsuario!.id),
    enabled: !!showEditModal && !!selectedUsuario && selectedUsuario.rol === 'profesional',
  });

  // Cerrar date picker contrato al hacer clic fuera (no en el botón ni en el calendario en portal)
  useEffect(() => {
    if (!contratoDatePickerOpen) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node & Element;
      if (contratoDatePickerRef.current?.contains(target)) return;
      if (target.closest?.('[data-contrato-calendar-portal]')) return;
      setContratoDatePickerOpen(false);
      setContratoDatePickerAnchor(null);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [contratoDatePickerOpen]);

  // Cerrar date picker contrato (edición) al hacer clic fuera
  useEffect(() => {
    if (!editContratoDatePickerOpen) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node & Element;
      if (editContratoDatePickerRef.current?.contains(target)) return;
      if (target.closest?.('[data-edit-contrato-calendar-portal]')) return;
      setEditContratoDatePickerOpen(false);
      setEditContratoDatePickerAnchor(null);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [editContratoDatePickerOpen]);

  // Poblar editProfesionalData cuando se carga el profesional al editar
  useEffect(() => {
    if (!profesionalParaEditar) {
      setEditProfesionalId(null);
      setEditProfesionalData({
        matricula: '',
        especialidad: '',
        tipo_periodo_pago: 'mensual',
        valor: '',
        fecha_inicio: '',
      });
      return;
    }
    setEditProfesionalId(profesionalParaEditar.id);
    const valorStr =
      profesionalParaEditar.monto_mensual != null
        ? `$ ${new Intl.NumberFormat('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(profesionalParaEditar.monto_mensual)}`
        : '';
    setEditProfesionalData({
      matricula: profesionalParaEditar.matricula ?? '',
      especialidad: profesionalParaEditar.especialidad ?? '',
      tipo_periodo_pago: (profesionalParaEditar.tipo_periodo_pago as 'mensual' | 'quincenal' | 'semanal' | 'anual') ?? 'mensual',
      valor: valorStr,
      fecha_inicio: normalizeFechaInicioToYYYYMMDD(profesionalParaEditar.fecha_inicio_contrato ?? undefined),
    });
  }, [profesionalParaEditar]);

  const parseValorToNumber = (valorStr: string): number | undefined => {
    const trimmed = valorStr.trim().replace(/^\$\s*/, '');
    if (!trimmed) return undefined;
    const cleaned = trimmed.replace(/\./g, '').replace(',', '.');
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : undefined;
  };

  const formatValorDisplay = (valorStr: string): string => {
    const n = parseValorToNumber(valorStr);
    if (n === undefined) return '';
    const formatted = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n);
    return `$ ${formatted}`;
  };

  const formatFechaInicioDisplay = (fechaStr: string | undefined): string => {
    if (!fechaStr || typeof fechaStr !== 'string' || !fechaStr.trim()) return 'Seleccionar fecha';
    const dateOnly = fechaStr.includes('T') ? fechaStr.slice(0, 10) : fechaStr;
    const [y, m, d] = dateOnly.split('-').map(Number);
    if (!y || !m || !d) return 'Seleccionar fecha';
    const dLocal = new Date(y, m - 1, d);
    if (Number.isNaN(dLocal.getTime())) return 'Seleccionar fecha';
    return format(dLocal, "d 'de' MMMM, yyyy", { locale: es });
  };

  const normalizeFechaInicioToYYYYMMDD = (value: string | Date | undefined | null): string => {
    if (value == null || value === '') return '';
    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) return '';
      const y = value.getUTCFullYear();
      const m = String(value.getUTCMonth() + 1).padStart(2, '0');
      const d = String(value.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    if (typeof value !== 'string') return '';
    const trimmed = value.trim();
    if (!trimmed) return '';
    if (trimmed.includes('T')) return trimmed.slice(0, 10);
    return trimmed.length >= 10 ? trimmed.slice(0, 10) : trimmed;
  };

  // Filtrar por búsqueda
  const filteredUsuarios = useMemo(() => {
    if (!search) return usuarios;
    const searchLower = search.toLowerCase();
    return usuarios.filter(
      (u) =>
        u.nombre?.toLowerCase().includes(searchLower) ||
        u.apellido?.toLowerCase().includes(searchLower) ||
        u.email.toLowerCase().includes(searchLower) ||
        u.telefono?.includes(search)
    );
  }, [usuarios, search]);

  const getApiErrorMessage = (
    error: { response?: { data?: { error?: { message?: string; details?: Array<{ field?: string; message?: string }> }; message?: string } }; message?: string },
    fallback: string
  ): string => {
    const data = error.response?.data;
    const err = data?.error;
    const details = err?.details;
    if (details && Array.isArray(details) && details.length > 0) {
      return details.map((d) => d.message || '').filter(Boolean).join(' ') || fallback;
    }
    return err?.message || data?.message || error.message || fallback;
  };

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: CreateUsuarioData) => usuariosService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      reactToastify.success('Usuario creado correctamente', {
        position: 'top-right',
        autoClose: 3000,
      });
      setShowCreateModal(false);
      setCreateFormData({
        email: '',
        password: '',
        nombre: '',
        apellido: '',
        telefono: '',
        rol: 'profesional',
        activo: true,
      });
      setCreateConfirmPassword('');
    },
    onError: (error: any) => {
      reactToastify.error(getApiErrorMessage(error, 'Error al crear usuario'), {
        position: 'top-right',
        autoClose: 3000,
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => usuariosService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      reactToastify.success('Usuario eliminado correctamente', {
        position: 'top-right',
        autoClose: 3000,
      });
      setShowDeleteModal(false);
      setSelectedUsuario(null);
    },
    onError: (error: any) => {
      reactToastify.error(getApiErrorMessage(error, 'Error al eliminar usuario'), {
        position: 'top-right',
        autoClose: 3000,
      });
    },
  });

  // Activate mutation
  const activateMutation = useMutation({
    mutationFn: (id: string) => usuariosService.activate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      reactToastify.success('Usuario activado correctamente', {
        position: 'top-right',
        autoClose: 3000,
      });
    },
    onError: (error: any) => {
      reactToastify.error(getApiErrorMessage(error, 'Error al activar usuario'), {
        position: 'top-right',
        autoClose: 3000,
      });
    },
  });

  // Deactivate mutation
  const deactivateMutation = useMutation({
    mutationFn: (id: string) => usuariosService.deactivate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      reactToastify.success('Usuario desactivado correctamente', {
        position: 'top-right',
        autoClose: 3000,
      });
    },
    onError: (error: any) => {
      reactToastify.error(getApiErrorMessage(error, 'Error al desactivar usuario'), {
        position: 'top-right',
        autoClose: 3000,
      });
    },
  });

  // Update password mutation
  const handleCreate = async () => {
    if (!createFormData.email || !createFormData.password || !createFormData.nombre || !createFormData.apellido) {
      reactToastify.error('Complete todos los campos requeridos', {
        position: 'top-right',
        autoClose: 3000,
      });
      return;
    }
    if (createFormData.password.length < 8) {
      reactToastify.error('La contraseña debe tener al menos 8 caracteres', {
        position: 'top-right',
        autoClose: 3000,
      });
      return;
    }
    if (createFormData.password !== createConfirmPassword) {
      reactToastify.error('Las contraseñas no coinciden', {
        position: 'top-right',
        autoClose: 3000,
      });
      return;
    }

    // Paso 1 con rol profesional: ir al paso 2
    if (createStep === 1 && createFormData.rol === 'profesional') {
      setCreateStep(2);
      return;
    }

    // Paso 2: crear usuario y luego profesional (sin usar mutation para no cerrar antes)
    if (createStep === 2 && createFormData.rol === 'profesional') {
      setIsSubmitting(true);
      try {
        const nuevoUsuario = await usuariosService.create(createFormData);
        const monto = parseValorToNumber(profesionalExtraData.valor);
        await profesionalesService.create({
          usuario_id: nuevoUsuario.id,
          matricula: profesionalExtraData.matricula || undefined,
          especialidad: profesionalExtraData.especialidad || undefined,
          estado_pago: 'pendiente',
          monto_mensual: monto,
          fecha_inicio_contrato: profesionalExtraData.fecha_inicio ? `${profesionalExtraData.fecha_inicio}T12:00:00.000Z` : undefined,
          tipo_periodo_pago: profesionalExtraData.tipo_periodo_pago,
        });
        queryClient.invalidateQueries({ queryKey: ['usuarios'] });
        queryClient.invalidateQueries({ queryKey: ['profesionales'] });
        reactToastify.success('Usuario y profesional creados correctamente', {
          position: 'top-right',
          autoClose: 3000,
        });
        setShowCreateModal(false);
        setCreateFormData({
          email: '',
          password: '',
          nombre: '',
          apellido: '',
          telefono: '',
          rol: 'profesional',
          activo: true,
        });
        setCreateConfirmPassword('');
        setCreateStep(1);
        setProfesionalExtraData({
          matricula: '',
          especialidad: '',
          tipo_periodo_pago: 'mensual',
          valor: '',
          fecha_inicio: '',
        });
      } catch (err: any) {
        reactToastify.error(getApiErrorMessage(err, 'Error al crear'), { position: 'top-right', autoClose: 3000 });
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // Paso 1 con rol no profesional: crear solo usuario
    setIsSubmitting(true);
    try {
      await createMutation.mutateAsync(createFormData);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetCreateModal = () => {
    setCreateStep(1);
    setShowCreateEspecialidadInput(false);
    setNewEspecialidadNombre('');
    setProfesionalExtraData({
      matricula: '',
      especialidad: '',
      tipo_periodo_pago: 'mensual',
      valor: '',
      fecha_inicio: '',
    });
    setCreateFormData({
      email: '',
      password: '',
      nombre: '',
      apellido: '',
      telefono: '',
      rol: 'profesional',
      activo: true,
    });
    setCreateConfirmPassword('');
  };

  const handleCreateEspecialidad = async () => {
    const nombre = (showEditModal ? editNewEspecialidadNombre : newEspecialidadNombre).trim();
    if (!nombre) {
      reactToastify.error('Ingrese el nombre de la especialidad', { position: 'top-right', autoClose: 3000 });
      return;
    }
    setIsCreatingEspecialidad(true);
    try {
      const creada = await especialidadesService.create({ nombre });
      queryClient.invalidateQueries({ queryKey: ['especialidades'] });
      if (showEditModal) {
        setEditProfesionalData((prev) => ({ ...prev, especialidad: creada.nombre }));
        setEditShowCreateEspecialidadInput(false);
        setEditNewEspecialidadNombre('');
      } else {
        setProfesionalExtraData((prev) => ({ ...prev, especialidad: creada.nombre }));
        setShowCreateEspecialidadInput(false);
        setNewEspecialidadNombre('');
      }
      reactToastify.success('Especialidad creada', { position: 'top-right', autoClose: 3000 });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Error al crear especialidad';
      reactToastify.error(msg, { position: 'top-right', autoClose: 3000 });
    } finally {
      setIsCreatingEspecialidad(false);
    }
  };

  const handleEdit = (usuario: User) => {
    setSelectedUsuario(usuario);
    setEditFormData({
      email: usuario.email,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      telefono: usuario.telefono || '',
      rol: usuario.rol,
    });
    setPasswordData({ new_password: '', confirm_password: '' });
    setEditStep(1);
    setShowEditModal(true);
  };

  const handleUpdate = async () => {
    if (!selectedUsuario || !editFormData.email || !editFormData.nombre || !editFormData.apellido) {
      reactToastify.error('Complete todos los campos requeridos', {
        position: 'top-right',
        autoClose: 3000,
      });
      return;
    }
    const wantChangePassword = passwordData.new_password.trim() !== '';
    if (wantChangePassword) {
      if (passwordData.new_password.length < 8) {
        reactToastify.error('La contraseña debe tener al menos 8 caracteres', {
          position: 'top-right',
          autoClose: 3000,
        });
        return;
      }
      if (passwordData.new_password !== passwordData.confirm_password) {
        reactToastify.error('Las contraseñas no coinciden', {
          position: 'top-right',
          autoClose: 3000,
        });
        return;
      }
    }
    setIsSubmitting(true);
    try {
      await usuariosService.update(selectedUsuario.id, editFormData);
      if (selectedUsuario.rol === 'profesional' && editProfesionalId) {
        const monto = parseValorToNumber(editProfesionalData.valor);
        await profesionalesService.update(editProfesionalId, {
          matricula: editProfesionalData.matricula || undefined,
          especialidad: editProfesionalData.especialidad || undefined,
          tipo_periodo_pago: editProfesionalData.tipo_periodo_pago,
          monto_mensual: monto,
          fecha_inicio_contrato: editProfesionalData.fecha_inicio ? `${editProfesionalData.fecha_inicio}T12:00:00.000Z` : undefined,
        });
      }
      if (wantChangePassword) {
        await usuariosService.updatePassword(selectedUsuario.id, { new_password: passwordData.new_password });
      }
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      queryClient.invalidateQueries({ queryKey: ['profesionales'] });
      reactToastify.success('Usuario actualizado correctamente', {
        position: 'top-right',
        autoClose: 3000,
      });
      setShowEditModal(false);
      setSelectedUsuario(null);
      setPasswordData({ new_password: '', confirm_password: '' });
    } catch (err: unknown) {
      reactToastify.error(getApiErrorMessage(err as Parameters<typeof getApiErrorMessage>[0], 'Error al actualizar'), {
        position: 'top-right',
        autoClose: 3000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (usuario: User) => {
    setSelectedUsuario(usuario);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedUsuario) return;
    setIsSubmitting(true);
    try {
      await deleteMutation.mutateAsync(selectedUsuario.id);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActivate = async (usuario: User) => {
    if (usuario.activo) {
      await deactivateMutation.mutateAsync(usuario.id);
    } else {
      await activateMutation.mutateAsync(usuario.id);
    }
  };

  const clearFilters = () => {
    setSearch('');
    setRolFilter('todos');
    setEstadoFilter('todos');
  };

  const hasActiveFilters = search || rolFilter !== 'todos' || estadoFilter !== 'todos';
  const canCreate = hasPermission(user, 'usuarios.crear');
  const canUpdate = hasPermission(user, 'usuarios.actualizar');
  const canDelete = hasPermission(user, 'usuarios.eliminar');
  const canActivate = hasPermission(user, 'usuarios.activar');
  const canDeactivate = hasPermission(user, 'usuarios.desactivar');

  // Secretarias no pueden editar/desactivar/eliminar administradores. Nadie puede eliminarse o desactivarse a sí mismo.
  const canEditUsuario = (usuario: User) =>
    canUpdate && !(user?.rol === 'secretaria' && usuario.rol === 'administrador');
  const canToggleActivateUsuario = (usuario: User) =>
    (canActivate || canDeactivate) &&
    usuario.id !== user?.id &&
    !(user?.rol === 'secretaria' && usuario.rol === 'administrador');
  const canDeleteUsuario = (usuario: User) =>
    canDelete &&
    usuario.id !== user?.id &&
    !(user?.rol === 'secretaria' && usuario.rol === 'administrador');

  return (
    <div className="space-y-8 max-lg:pb-[46px] relative">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[32px] font-bold text-[#111827] font-['Poppins'] leading-tight tracking-[-0.02em] mb-0">
            Usuarios del Sistema
          </h1>
          <p className="text-base text-[#6B7280] mt-2 font-['Inter']">
            {isLoading ? 'Cargando...' : `${filteredUsuarios.length} ${filteredUsuarios.length === 1 ? 'usuario registrado' : 'usuarios registrados'}`}
          </p>
        </div>
        {canCreate && (
          <Button
            onClick={() => setShowCreateModal(true)}
            className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-md shadow-[#2563eb]/20 hover:shadow-lg hover:shadow-[#2563eb]/30 transition-all duration-200 rounded-[12px] px-6 py-3 h-auto font-medium max-lg:hidden"
          >
            <Plus className="h-5 w-5 mr-2 stroke-[2]" />
            Nuevo Usuario
          </Button>
        )}
      </div>

      {/* Filtros */}
      <Card className="border border-[#E5E7EB] rounded-[16px] shadow-sm">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#9CA3AF] stroke-[2]" />
              <Input
                placeholder="Buscar por nombre..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-12 h-12 border-[#D1D5DB] rounded-[10px] text-[16px] font-['Inter'] focus:border-[#2563eb] focus:ring-[#2563eb]/20 transition-all duration-200"
              />
            </div>

            <Select value={rolFilter} onValueChange={setRolFilter}>
              <SelectTrigger className="h-12 border-[#D1D5DB] rounded-[10px] font-['Inter'] text-[15px] focus:border-[#2563eb] focus:ring-[#2563eb]/20">
                <div className="flex items-center gap-2">
                  <UserCog className="h-4 w-4 text-[#6B7280] stroke-[2]" />
                  <SelectValue placeholder="Todos los roles" />
                </div>
              </SelectTrigger>
              <SelectContent className="rounded-[12px]">
                {rolOptions.map((rol) => (
                  <SelectItem key={rol.value} value={rol.value} className="font-['Inter']">
                    {rol.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex gap-2">
              <Select value={estadoFilter} onValueChange={setEstadoFilter}>
                <SelectTrigger className="flex-1 h-12 border-[#D1D5DB] rounded-[10px] font-['Inter'] text-[15px] focus:border-[#2563eb] focus:ring-[#2563eb]/20">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-[#6B7280] stroke-[2]" />
                    <SelectValue placeholder="Estado" />
                  </div>
                </SelectTrigger>
                <SelectContent className="rounded-[12px]">
                  {estadoOptions.map((estado) => (
                    <SelectItem key={estado.value} value={estado.value} className="font-['Inter']">
                      {estado.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {hasActiveFilters && (
                <Button
                  variant="outline"
                  onClick={clearFilters}
                  className="h-12 px-4 rounded-[10px] border-[#D1D5DB] font-['Inter'] text-[14px] hover:bg-[#F9FAFB]"
                >
                  Limpiar
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabla o Empty State */}
      {isLoading ? (
        <Card className="border border-[#E5E7EB] rounded-[16px] shadow-sm">
          <CardContent className="p-16 text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-[#2563eb]" />
            <p className="text-[#6B7280] font-['Inter'] text-base">Cargando usuarios...</p>
          </CardContent>
        </Card>
      ) : filteredUsuarios.length === 0 ? (
        <Card className="border border-[#E5E7EB] rounded-[16px] shadow-sm">
          <CardContent className="p-16 text-center">
            <div className="h-20 w-20 rounded-full bg-[#dbeafe] flex items-center justify-center mx-auto mb-4">
              <Users className="h-10 w-10 text-[#2563eb] stroke-[2]" />
            </div>
            <h3 className="text-lg font-semibold mb-2 text-[#374151] font-['Inter']">
              No hay usuarios
            </h3>
            <p className="text-[#6B7280] mb-6 font-['Inter']">
              {hasActiveFilters 
                ? 'No se encontraron usuarios con los filtros aplicados' 
                : 'Comienza agregando tu primer usuario'}
            </p>
            {!hasActiveFilters && canCreate && (
              <Button
                onClick={() => setShowCreateModal(true)}
                className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-md shadow-[#2563eb]/20 hover:shadow-lg hover:shadow-[#2563eb]/30 transition-all duration-200 rounded-[12px] px-6 py-3 h-auto font-medium"
              >
                <Plus className="h-5 w-5 mr-2 stroke-[2]" />
                Nuevo Usuario
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="border border-[#E5E7EB] rounded-[16px] shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#F9FAFB] border-b-2 border-[#E5E7EB] hover:bg-[#F9FAFB]">
                <TableHead className="font-['Inter'] font-medium text-[14px] text-[#374151] py-4 min-w-[240px]">
                  Nombre y apellido
                </TableHead>
                <TableHead className="font-['Inter'] font-medium text-[14px] text-[#374151]">
                  Rol
                </TableHead>
                <TableHead className="font-['Inter'] font-medium text-[14px] text-[#374151]">
                  Estado
                </TableHead>
                <TableHead className="font-['Inter'] font-medium text-[14px] text-[#374151] w-[140px] text-center">
                  Acciones
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsuarios.map((usuario) => (
                <TableRow
                  key={usuario.id}
                  className="border-b border-[#E5E7EB] hover:bg-[#F9FAFB] transition-colors duration-150"
                >
                  <TableCell className="py-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="hidden sm:flex h-10 w-10 rounded-full bg-gradient-to-br from-[#dbeafe] to-[#bfdbfe] shadow-sm">
                        <AvatarFallback className="bg-transparent text-[#2563eb] font-semibold text-sm uppercase">
                          {(usuario.nombre?.[0] || '').toUpperCase()}{(usuario.apellido?.[0] || '').toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <p className="font-medium text-[#374151] font-['Inter'] text-[15px] m-0">
                        {formatDisplayText(usuario.nombre)} {formatDisplayText(usuario.apellido)}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>{getRolBadge(usuario.rol)}</TableCell>
                  <TableCell>{getEstadoBadge(usuario.activo)}</TableCell>
                  <TableCell className="text-right">
                    <TooltipProvider>
                      <div className="flex items-center justify-end gap-1">
                        {canEditUsuario(usuario) && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEdit(usuario)}
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
                        {canToggleActivateUsuario(usuario) && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleToggleActivate(usuario)}
                                className="h-8 w-8 rounded-[8px] hover:bg-[#F3F4F6] transition-all duration-200 text-[#6B7280] hover:text-[#374151]"
                              >
                                {usuario.activo ? (
                                  <Lock className="h-4 w-4 stroke-[2]" />
                                ) : (
                                  <Unlock className="h-4 w-4 stroke-[2]" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent className="bg-[#111827] text-white text-xs font-['Inter'] rounded-[8px] px-3 py-2 [&>p]:text-white">
                              <p className="text-white">{usuario.activo ? 'Desactivar' : 'Activar'}</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {canDeleteUsuario(usuario) && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(usuario)}
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

      {/* Info de paginación */}
      <div className="flex items-center justify-between text-sm text-[#6B7280] font-['Inter']">
        <span>
          Mostrando {filteredUsuarios.length} de {usuarios.length} usuarios
        </span>
      </div>

      {/* FAB móvil: Nuevo Usuario */}
      {canCreate && (
        <div className="lg:hidden fixed bottom-6 right-6 z-40">
          <Button
            onClick={() => setShowCreateModal(true)}
            className="h-14 w-14 rounded-full shadow-lg shadow-[#2563eb]/30 bg-[#2563eb] hover:bg-[#1d4ed8] text-white p-0"
            title="Nuevo Usuario"
            aria-label="Nuevo Usuario"
          >
            <Plus className="h-6 w-6 stroke-[2]" />
          </Button>
        </div>
      )}

      {/* Modal Crear Usuario */}
      <Dialog
        open={showCreateModal}
        onOpenChange={(open) => {
          setShowCreateModal(open);
          if (!open) {
            resetCreateModal();
            setContratoDatePickerOpen(false);
            setContratoDatePickerAnchor(null);
          }
        }}
      >
        <DialogContent
          className="max-w-[1100px] w-[95vw] max-h-[90vh] min-h-0 rounded-[20px] p-0 border border-[#E5E7EB] shadow-2xl flex flex-col overflow-hidden"
          onInteractOutside={(e) => {
            const target = e.target as Node;
            const calendar = document.querySelector('[data-contrato-calendar-portal]');
            if (calendar?.contains(target)) e.preventDefault();
          }}
        >
          <DialogHeader className="px-8 pt-8 pb-6 border-b border-[#E5E7EB] bg-gradient-to-b from-white to-[#F9FAFB] mb-0 flex-shrink-0">
            <div className="flex items-center gap-4">
              <div className="max-md:hidden h-12 w-12 rounded-full bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] flex items-center justify-center shadow-lg shadow-[#2563eb]/20">
                <Plus className="h-6 w-6 text-white stroke-[2]" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-[28px] font-bold text-[#111827] font-['Poppins'] leading-tight mb-0">
                  {createStep === 2 ? 'Datos del profesional' : 'Nuevo Usuario'}
                </DialogTitle>
                <DialogDescription className={`text-base text-[#6B7280] font-['Inter'] mt-1 mb-0 ${createStep === 2 ? 'max-md:hidden' : ''}`}>
                  {createStep === 2
                    ? 'Matrícula, especialidad y contrato (período, valor y fecha de inicio)'
                    : 'Crear un nuevo usuario en el sistema'}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto">
          {createStep === 1 ? (
          <div className="px-8 py-6 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <Label htmlFor="create-nombre" className="text-[15px] font-medium text-[#374151] font-['Inter']">
                  Nombre
                  <span className="text-[#EF4444]">*</span>
                </Label>
                <Input
                  id="create-nombre"
                  value={createFormData.nombre}
                  onChange={(e) => setCreateFormData({ ...createFormData, nombre: e.target.value })}
                  required
                  className="h-[52px] border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[16px] font-['Inter'] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200"
                  placeholder="Juan"
                />
              </div>

              <div className="space-y-3">
                <Label htmlFor="create-apellido" className="text-[15px] font-medium text-[#374151] font-['Inter']">
                  Apellido
                  <span className="text-[#EF4444]">*</span>
                </Label>
                <Input
                  id="create-apellido"
                  value={createFormData.apellido}
                  onChange={(e) => setCreateFormData({ ...createFormData, apellido: e.target.value })}
                  required
                  className="h-[52px] border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[16px] font-['Inter'] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200"
                  placeholder="Pérez"
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="create-email" className="text-[15px] font-medium text-[#374151] font-['Inter'] flex items-center gap-2">
                <Mail className="max-md:hidden h-4 w-4 text-[#6B7280] stroke-[2]" />
                Email
                <span className="text-[#EF4444]">*</span>
              </Label>
              <Input
                id="create-email"
                type="email"
                autoComplete="off"
                value={createFormData.email}
                onChange={(e) => setCreateFormData({ ...createFormData, email: e.target.value })}
                required
                className="h-[52px] border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[16px] font-['Inter'] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200"
                placeholder="usuario@ejemplo.com"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <Label htmlFor="create-password" className="text-[15px] font-medium text-[#374151] font-['Inter'] flex items-center gap-2">
                  <Key className="max-md:hidden h-4 w-4 text-[#6B7280] stroke-[2]" />
                  Contraseña
                  <span className="text-[#EF4444]">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="create-password"
                    type={showCreatePassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={createFormData.password}
                    onChange={(e) => setCreateFormData({ ...createFormData, password: e.target.value })}
                    required
                    className="h-[52px] border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[16px] font-['Inter'] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200 pr-12"
                    placeholder="••••••••"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-9 w-9 rounded-[8px] text-[#6B7280] hover:text-[#374151]"
                    onClick={() => setShowCreatePassword((v) => !v)}
                    tabIndex={-1}
                  >
                    {showCreatePassword ? <EyeOff className="h-5 w-5 stroke-[2]" /> : <Eye className="h-5 w-5 stroke-[2]" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <Label htmlFor="create-confirm-password" className="text-[15px] font-medium text-[#374151] font-['Inter'] flex items-center gap-2">
                  <Key className="max-md:hidden h-4 w-4 text-[#6B7280] stroke-[2]" />
                  Repetir contraseña
                  <span className="text-[#EF4444]">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="create-confirm-password"
                    type={showCreateConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={createConfirmPassword}
                    onChange={(e) => setCreateConfirmPassword(e.target.value)}
                    required
                    className="h-[52px] border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[16px] font-['Inter'] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200 pr-12"
                    placeholder="••••••••"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-9 w-9 rounded-[8px] text-[#6B7280] hover:text-[#374151]"
                    onClick={() => setShowCreateConfirmPassword((v) => !v)}
                    tabIndex={-1}
                  >
                    {showCreateConfirmPassword ? <EyeOff className="h-5 w-5 stroke-[2]" /> : <Eye className="h-5 w-5 stroke-[2]" />}
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <Label htmlFor="create-telefono" className="text-[15px] font-medium text-[#374151] font-['Inter'] flex items-center gap-2">
                  <Phone className="max-md:hidden h-4 w-4 text-[#6B7280] stroke-[2]" />
                  Teléfono
                </Label>
                <Input
                  id="create-telefono"
                  value={createFormData.telefono}
                  onChange={(e) => setCreateFormData({ ...createFormData, telefono: e.target.value })}
                  className="h-[52px] border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[16px] font-['Inter'] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200"
                  placeholder="+54 11 1234-5678"
                />
              </div>

              <div className="space-y-3">
                <Label htmlFor="create-rol" className="text-[15px] font-medium text-[#374151] font-['Inter'] flex items-center gap-2">
                  <ShieldCheck className="max-md:hidden h-4 w-4 text-[#6B7280] stroke-[2]" />
                  Rol
                  <span className="text-[#EF4444]">*</span>
                </Label>
                <Select
                  value={createFormData.rol}
                  onValueChange={(value: any) => setCreateFormData({ ...createFormData, rol: value })}
                >
                  <SelectTrigger className="h-[52px] border-[1.5px] border-[#D1D5DB] rounded-[10px] font-['Inter'] text-[16px] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-[12px] border-[#E5E7EB] shadow-xl">
                    {(user?.rol === 'secretaria' ? ROLES_SECRETARIA : ROLES).map((rol) => (
                      <SelectItem key={rol.value} value={rol.value} className="rounded-[8px] font-['Inter'] text-[15px] py-3">
                        {rol.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          ) : (
          <div className="px-8 py-6">
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <Label htmlFor="create-matricula" className="text-[15px] font-medium text-[#374151] font-['Inter'] flex items-center gap-2">
                    <Stethoscope className="max-md:hidden h-4 w-4 text-[#6B7280] stroke-[2]" />
                    Matrícula
                  </Label>
                  <Input
                    id="create-matricula"
                    value={profesionalExtraData.matricula}
                    onChange={(e) => setProfesionalExtraData({ ...profesionalExtraData, matricula: e.target.value })}
                    className="h-[52px] border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[14px] md:text-[16px] font-['Inter'] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200"
                    placeholder="Ej. 12345"
                  />
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="create-especialidad" className="text-[15px] font-medium text-[#374151] font-['Inter'] mb-0">
                      Especialidad
                    </Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-[13px] text-[#2563eb] font-['Inter'] p-0 h-auto min-w-0 m-0 hover:bg-transparent hover:text-[#2563eb]"
                      onClick={() => setShowCreateEspecialidadInput((v) => !v)}
                    >
                      {showCreateEspecialidadInput ? 'Cancelar' : '+ Crear especialidad'}
                    </Button>
                  </div>
                  {showCreateEspecialidadInput ? (
                    <div className="flex gap-2">
                      <Input
                        value={newEspecialidadNombre}
                        onChange={(e) => setNewEspecialidadNombre(e.target.value)}
                        placeholder="Nombre de la nueva especialidad"
                        className="h-[52px] border-[1.5px] border-[#D1D5DB] rounded-[10px] font-['Inter'] text-[14px] md:text-[16px] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200"
                        onKeyDown={(e) => e.key === 'Enter' && handleCreateEspecialidad()}
                      />
                      <Button
                        type="button"
                        onClick={handleCreateEspecialidad}
                        disabled={isCreatingEspecialidad || !newEspecialidadNombre.trim()}
                        className="h-[52px] px-4 rounded-[10px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-medium font-['Inter'] disabled:opacity-50"
                      >
                        {isCreatingEspecialidad ? <Loader2 className="h-4 w-4 animate-spin" /> : (<><span className="max-md:hidden">Agregar</span><span className="md:hidden">+</span></>)}
                      </Button>
                    </div>
                  ) : (
                    <Select
                      value={profesionalExtraData.especialidad}
                      onValueChange={(value) => setProfesionalExtraData({ ...profesionalExtraData, especialidad: value })}
                    >
                      <SelectTrigger className="h-[52px] border-[1.5px] border-[#D1D5DB] rounded-[10px] font-['Inter'] text-[16px] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200">
                        <SelectValue placeholder="Seleccionar especialidad" />
                      </SelectTrigger>
                      <SelectContent className="rounded-[12px] border-[#E5E7EB] shadow-xl">
                        {especialidades.map((esp) => (
                          <SelectItem key={esp.id} value={esp.nombre} className="rounded-[8px] font-['Inter'] text-[15px] py-3">
                            {esp.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
              <div className="rounded-[12px] border border-[#E5E7EB] bg-[#F9FAFB] p-5 max-md:border-0 max-md:bg-transparent max-md:rounded-none max-md:p-0">
                <h4 className="text-[15px] font-semibold text-[#374151] font-['Inter'] flex items-center gap-2 mb-4 max-md:mb-3">
                  <CreditCard className="max-md:hidden h-4 w-4 text-[#6B7280] stroke-[2]" />
                  Contrato
                </h4>
                <div className="space-y-4">
                <div className="space-y-3 relative" ref={contratoDatePickerRef}>
                  <Label className="text-[14px] font-medium text-[#374151] font-['Inter'] flex items-center gap-2">
                    <Calendar className="max-md:hidden h-4 w-4 text-[#6B7280] stroke-[2]" />
                    Fecha de inicio
                  </Label>
                  <button
                    ref={contratoDatePickerButtonRef}
                    type="button"
                    onClick={() => {
                      const willOpen = !contratoDatePickerOpen;
                      setContratoDatePickerOpen(willOpen);
                      if (willOpen) {
                        setContratoDatePickerMonth(profesionalExtraData.fecha_inicio ? startOfMonth(new Date(profesionalExtraData.fecha_inicio + 'T12:00:00')) : startOfMonth(new Date()));
                        setContratoDatePickerAnchor(contratoDatePickerButtonRef.current?.getBoundingClientRect() ?? null);
                      } else {
                        setContratoDatePickerAnchor(null);
                      }
                    }}
                    className="h-[52px] w-full flex items-center gap-2 px-4 border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[16px] font-['Inter'] text-left bg-white focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200 hover:border-[#9CA3AF]"
                  >
                    <Calendar className="max-md:hidden h-4 w-4 text-[#6B7280] stroke-[2] flex-shrink-0" />
                    <span className="text-[#374151]">
                      {formatFechaInicioDisplay(profesionalExtraData.fecha_inicio)}
                    </span>
                    <ChevronRight className={`h-4 w-4 text-[#6B7280] ml-auto transition-transform ${contratoDatePickerOpen ? 'rotate-90' : ''}`} />
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <Label className="text-[14px] font-medium text-[#374151] font-['Inter']">
                      Período
                    </Label>
                    <Select
                      value={profesionalExtraData.tipo_periodo_pago}
                      onValueChange={(value: 'mensual' | 'quincenal' | 'semanal' | 'anual') =>
                        setProfesionalExtraData({ ...profesionalExtraData, tipo_periodo_pago: value })
                      }
                    >
                      <SelectTrigger className="h-[52px] border-[1.5px] border-[#D1D5DB] rounded-[10px] font-['Inter'] text-[16px] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-[12px] border-[#E5E7EB] shadow-xl">
                        {TIPO_PERIODO_PAGO.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value} className="rounded-[8px] font-['Inter'] text-[15px] py-3">
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="create-valor-pago" className="text-[14px] font-medium text-[#374151] font-['Inter']">
                      Valor
                    </Label>
                    <Input
                      id="create-valor-pago"
                      type="text"
                      inputMode="decimal"
                      value={profesionalExtraData.valor}
                      onChange={(e) => {
                        const v = e.target.value.replace(/[^\d,.]/g, '');
                        setProfesionalExtraData({ ...profesionalExtraData, valor: v });
                      }}
                      onBlur={() => {
                        if (profesionalExtraData.valor.trim()) {
                          const formatted = formatValorDisplay(profesionalExtraData.valor);
                          if (formatted !== '') setProfesionalExtraData((p) => ({ ...p, valor: formatted }));
                        }
                      }}
                      onFocus={() => {
                        const n = parseValorToNumber(profesionalExtraData.valor);
                        if (n !== undefined) setProfesionalExtraData((p) => ({ ...p, valor: String(n) }));
                      }}
                      className="h-[52px] border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[14px] md:text-[16px] font-['Inter'] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200"
                      placeholder="Ej. 500.000"
                    />
                  </div>
                </div>
              </div>
              </div>
            </div>
          </div>
          )}
          </div>

          <DialogFooter className="px-8 py-5 border-t border-[#E5E7EB] bg-[#F9FAFB] flex flex-col md:flex-row md:justify-end gap-3 mt-0 flex-shrink-0">
            <Button
              variant="outline"
              onClick={() => (createStep === 2 ? setCreateStep(1) : setShowCreateModal(false))}
              disabled={isSubmitting}
              className="h-[48px] w-full md:w-auto px-6 rounded-[12px] border-[1.5px] border-[#D1D5DB] font-medium font-['Inter'] text-[15px] hover:bg-white hover:border-[#9CA3AF] transition-all duration-200 order-1 md:order-1"
            >
              {createStep === 2 ? (
                <>
                  <ChevronLeft className="max-md:hidden mr-2 h-5 w-5 stroke-[2]" />
                  Atrás
                </>
              ) : (
                'Cancelar'
              )}
            </Button>
            <Button
              onClick={handleCreate}
              disabled={isSubmitting}
              className="h-[48px] w-full md:w-auto px-8 rounded-[12px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-lg shadow-[#2563eb]/30 hover:shadow-xl hover:shadow-[#2563eb]/40 hover:scale-[1.02] font-semibold font-['Inter'] text-[15px] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 order-2 md:order-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="max-md:hidden mr-2 h-5 w-5 animate-spin stroke-[2.5]" />
                  Guardando...
                </>
              ) : createStep === 2 ? (
                <>
                  <Plus className="max-md:hidden mr-2 h-5 w-5 stroke-[2]" />
                  Crear usuario y profesional
                </>
              ) : createFormData.rol === 'profesional' ? (
                'Siguiente'
              ) : (
                <>
                  <Plus className="max-md:hidden mr-2 h-5 w-5 stroke-[2]" />
                  Crear Usuario
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Calendario Fecha de inicio (portal para que no se corte dentro del modal) */}
      {contratoDatePickerOpen && contratoDatePickerAnchor && createPortal(
        <div
          data-contrato-calendar-portal
          className="bg-white border border-[#E5E7EB] rounded-[16px] shadow-xl p-4 z-[9999] pointer-events-auto min-w-[280px] max-w-[450px]"
          style={{ position: 'fixed', top: contratoDatePickerAnchor.bottom + 8, left: contratoDatePickerAnchor.left, width: Math.min(Math.max(contratoDatePickerAnchor.width, 280), 450) }}
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-[16px] font-semibold text-[#111827] font-['Poppins']">
              {format(contratoDatePickerMonth, 'MMMM yyyy', { locale: es }).charAt(0).toUpperCase() + format(contratoDatePickerMonth, 'MMMM yyyy', { locale: es }).slice(1)}
            </span>
            <div className="flex gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-[8px] hover:bg-[#dbeafe] text-[#2563eb]"
                onClick={() => setContratoDatePickerMonth((m) => subMonths(m, 1))}
              >
                <ChevronLeft className="h-4 w-4 stroke-[2]" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-[8px] hover:bg-[#dbeafe] text-[#2563eb]"
                onClick={() => setContratoDatePickerMonth((m) => addMonths(m, 1))}
              >
                <ChevronRight className="h-4 w-4 stroke-[2]" />
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'].map((d) => (
              <span key={d} className="text-[11px] font-medium text-[#6B7280] font-['Inter'] py-1">{d}</span>
            ))}
            {(() => {
              const monthStart = contratoDatePickerMonth;
              const monthEnd = endOfMonth(contratoDatePickerMonth);
              const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
              const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
              const days = eachDayOfInterval({ start: calStart, end: calEnd });
              const selectedDate = profesionalExtraData.fecha_inicio ? new Date(profesionalExtraData.fecha_inicio + 'T12:00:00') : null;
              return days.map((day) => {
                const isCurrentMonth = isSameMonth(day, contratoDatePickerMonth);
                const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => {
                      setProfesionalExtraData((p) => ({ ...p, fecha_inicio: format(day, 'yyyy-MM-dd') }));
                      setContratoDatePickerMonth(startOfMonth(day));
                      setContratoDatePickerOpen(false);
                      setContratoDatePickerAnchor(null);
                    }}
                    className={`h-9 rounded-[10px] text-[13px] font-medium font-['Inter'] transition-all
                      ${isSelected ? 'bg-[#2563eb] text-white hover:bg-[#1d4ed8]' : ''}
                      ${!isSelected && !isCurrentMonth ? 'text-[#9CA3AF] hover:bg-[#F3F4F6] cursor-pointer' : ''}
                      ${!isSelected && isCurrentMonth ? 'text-[#374151] hover:bg-[#dbeafe] cursor-pointer' : ''}`}
                  >
                    {format(day, 'd')}
                  </button>
                );
              });
            })()}
          </div>
        </div>,
        document.body
      )}

      {/* Calendario Fecha de inicio (edición) - portal */}
      {editContratoDatePickerOpen && editContratoDatePickerAnchor && createPortal(
        (() => {
          const editDisplayMonth = editContratoDatePickerMonth && !Number.isNaN(editContratoDatePickerMonth.getTime())
            ? editContratoDatePickerMonth
            : startOfMonth(new Date());
          const monthLabel = format(editDisplayMonth, 'MMMM yyyy', { locale: es });
          const monthLabelCap = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
          return (
        <div
          data-edit-contrato-calendar-portal
          className="bg-white border border-[#E5E7EB] rounded-[16px] shadow-xl p-4 z-[9999] pointer-events-auto min-w-[280px] max-w-[450px]"
          style={{ position: 'fixed', top: editContratoDatePickerAnchor.bottom + 8, left: editContratoDatePickerAnchor.left, width: Math.min(Math.max(editContratoDatePickerAnchor.width, 280), 450) }}
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-[16px] font-semibold text-[#111827] font-['Poppins']">
              {monthLabelCap}
            </span>
            <div className="flex gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-[8px] hover:bg-[#dbeafe] text-[#2563eb]"
                onClick={() => setEditContratoDatePickerMonth((m) => {
                  const safe = m && !Number.isNaN(m.getTime()) ? m : startOfMonth(new Date());
                  return subMonths(safe, 1);
                })}
              >
                <ChevronLeft className="h-4 w-4 stroke-[2]" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-[8px] hover:bg-[#dbeafe] text-[#2563eb]"
                onClick={() => setEditContratoDatePickerMonth((m) => {
                  const safe = m && !Number.isNaN(m.getTime()) ? m : startOfMonth(new Date());
                  return addMonths(safe, 1);
                })}
              >
                <ChevronRight className="h-4 w-4 stroke-[2]" />
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'].map((d) => (
              <span key={d} className="text-[11px] font-medium text-[#6B7280] font-['Inter'] py-1">{d}</span>
            ))}
            {(() => {
              const monthStart = editDisplayMonth;
              const monthEnd = endOfMonth(monthStart);
              const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
              const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
              const days = eachDayOfInterval({ start: calStart, end: calEnd });
              const parsedFecha = editProfesionalData.fecha_inicio ? new Date(editProfesionalData.fecha_inicio + 'T12:00:00') : null;
              const selectedDate = parsedFecha && !Number.isNaN(parsedFecha.getTime()) ? parsedFecha : null;
              return days.map((day) => {
                const isCurrentMonth = isSameMonth(day, monthStart);
                const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => {
                      setEditProfesionalData((p) => ({ ...p, fecha_inicio: format(day, 'yyyy-MM-dd') }));
                      setEditContratoDatePickerMonth(startOfMonth(day));
                      setEditContratoDatePickerOpen(false);
                      setEditContratoDatePickerAnchor(null);
                    }}
                    className={`h-9 rounded-[10px] text-[13px] font-medium font-['Inter'] transition-all
                      ${isSelected ? 'bg-[#2563eb] text-white hover:bg-[#1d4ed8]' : ''}
                      ${!isSelected && !isCurrentMonth ? 'text-[#9CA3AF] hover:bg-[#F3F4F6] cursor-pointer' : ''}
                      ${!isSelected && isCurrentMonth ? 'text-[#374151] hover:bg-[#dbeafe] cursor-pointer' : ''}`}
                  >
                    {format(day, 'd')}
                  </button>
                );
              });
            })()}
          </div>
        </div>
          );
        })(),
        document.body
      )}

      {/* Modal Editar Usuario */}
      <Dialog
        open={showEditModal}
          onOpenChange={(open) => {
            setShowEditModal(open);
            if (!open) {
              setEditStep(1);
              setEditContratoDatePickerOpen(false);
              setEditContratoDatePickerAnchor(null);
              setEditShowCreateEspecialidadInput(false);
              setEditNewEspecialidadNombre('');
              setPasswordData({ new_password: '', confirm_password: '' });
            }
          }}
      >
        <DialogContent
          className="max-w-[1100px] w-[95vw] max-h-[90vh] min-h-0 rounded-[20px] p-0 border border-[#E5E7EB] shadow-2xl flex flex-col overflow-hidden"
          onInteractOutside={(e) => {
            const target = e.target as Node;
            const calendar = document.querySelector('[data-edit-contrato-calendar-portal]');
            if (calendar?.contains(target)) e.preventDefault();
          }}
        >
          <DialogHeader className="px-8 pt-8 pb-6 border-b border-[#E5E7EB] bg-gradient-to-b from-white to-[#F9FAFB] mb-0 flex-shrink-0">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] flex items-center justify-center shadow-lg shadow-[#2563eb]/20">
                <Edit className="h-6 w-6 text-white stroke-[2]" />
              </div>
              <div>
                <DialogTitle className="text-[28px] font-bold text-[#111827] font-['Poppins'] leading-tight mb-0">
                  {selectedUsuario?.rol === 'profesional' && editStep === 2 ? 'Datos del profesional' : 'Editar Usuario'}
                </DialogTitle>
                <DialogDescription className="text-base text-[#6B7280] font-['Inter'] mt-1 mb-0">
                  {selectedUsuario?.rol === 'profesional' && editStep === 2
                    ? 'Matrícula, especialidad y contrato (período, valor y fecha de inicio)'
                    : selectedUsuario?.rol === 'profesional'
                      ? 'Actualizar datos del usuario (paso 1 de 2)'
                      : 'Actualizar información del usuario'}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto">
          {(selectedUsuario?.rol !== 'profesional' || editStep === 1) ? (
          <div className="px-8 py-6 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <Label htmlFor="edit-nombre" className="text-[15px] font-medium text-[#374151] font-['Inter']">
                  Nombre
                  <span className="text-[#EF4444]">*</span>
                </Label>
                <Input
                  id="edit-nombre"
                  value={editFormData.nombre}
                  onChange={(e) => setEditFormData({ ...editFormData, nombre: e.target.value })}
                  required
                  className="h-[52px] border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[16px] font-['Inter'] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200"
                />
              </div>

              <div className="space-y-3">
                <Label htmlFor="edit-apellido" className="text-[15px] font-medium text-[#374151] font-['Inter']">
                  Apellido
                  <span className="text-[#EF4444]">*</span>
                </Label>
                <Input
                  id="edit-apellido"
                  value={editFormData.apellido}
                  onChange={(e) => setEditFormData({ ...editFormData, apellido: e.target.value })}
                  required
                  className="h-[52px] border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[16px] font-['Inter'] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200"
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="edit-email" className="text-[15px] font-medium text-[#374151] font-['Inter'] flex items-center gap-2">
                <Mail className="h-4 w-4 text-[#6B7280] stroke-[2]" />
                Email
                <span className="text-[#EF4444]">*</span>
              </Label>
              <Input
                id="edit-email"
                type="email"
                autoComplete="off"
                value={editFormData.email}
                onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                required
                className="h-[52px] border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[16px] font-['Inter'] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <Label htmlFor="edit-telefono" className="text-[15px] font-medium text-[#374151] font-['Inter'] flex items-center gap-2">
                  <Phone className="h-4 w-4 text-[#6B7280] stroke-[2]" />
                  Teléfono
                </Label>
                <Input
                  id="edit-telefono"
                  value={editFormData.telefono}
                  onChange={(e) => setEditFormData({ ...editFormData, telefono: e.target.value })}
                  className="h-[52px] border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[16px] font-['Inter'] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200"
                />
              </div>

              <div className="space-y-3">
                <Label htmlFor="edit-rol" className="text-[15px] font-medium text-[#374151] font-['Inter'] flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-[#6B7280] stroke-[2]" />
                  Rol
                  <span className="text-[#EF4444]">*</span>
                </Label>
                <Select
                  value={editFormData.rol}
                  onValueChange={(value: any) => setEditFormData({ ...editFormData, rol: value })}
                >
                  <SelectTrigger className="h-[52px] border-[1.5px] border-[#D1D5DB] rounded-[10px] font-['Inter'] text-[16px] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-[12px] border-[#E5E7EB] shadow-xl">
                    {(user?.rol === 'secretaria' ? ROLES_SECRETARIA : ROLES).map((rol) => (
                      <SelectItem key={rol.value} value={rol.value} className="rounded-[8px] font-['Inter'] text-[15px] py-3">
                        {rol.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-4 rounded-[12px] border border-[#E5E7EB] bg-[#F9FAFB] p-5">
              <h4 className="text-[15px] font-semibold text-[#374151] font-['Inter'] flex items-center gap-2">
                <Key className="h-4 w-4 text-[#6B7280] stroke-[2]" />
                Cambiar contraseña (opcional)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <Label htmlFor="edit-new-password" className="text-[14px] font-medium text-[#374151] font-['Inter']">
                    Nueva contraseña
                  </Label>
                  <div className="relative">
                    <Input
                      id="edit-new-password"
                      type={showNewPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={passwordData.new_password}
                      onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
                      className="h-[52px] border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[16px] font-['Inter'] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200 pr-12"
                      placeholder="Dejar en blanco para no cambiar"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-9 w-9 rounded-[8px] text-[#6B7280] hover:text-[#374151]"
                      onClick={() => setShowNewPassword((v) => !v)}
                      tabIndex={-1}
                    >
                      {showNewPassword ? <EyeOff className="h-5 w-5 stroke-[2]" /> : <Eye className="h-5 w-5 stroke-[2]" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-3">
                  <Label htmlFor="edit-confirm-password" className="text-[14px] font-medium text-[#374151] font-['Inter']">
                    Repetir contraseña
                  </Label>
                  <div className="relative">
                    <Input
                      id="edit-confirm-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={passwordData.confirm_password}
                      onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
                      className="h-[52px] border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[16px] font-['Inter'] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200 pr-12"
                      placeholder="Dejar en blanco para no cambiar"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-9 w-9 rounded-[8px] text-[#6B7280] hover:text-[#374151]"
                      onClick={() => setShowConfirmPassword((v) => !v)}
                      tabIndex={-1}
                    >
                      {showConfirmPassword ? <EyeOff className="h-5 w-5 stroke-[2]" /> : <Eye className="h-5 w-5 stroke-[2]" />}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          ) : (
          <div className="px-8 py-6">
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <Label htmlFor="edit-matricula" className="text-[15px] font-medium text-[#374151] font-['Inter'] flex items-center gap-2">
                    <Stethoscope className="h-4 w-4 text-[#6B7280] stroke-[2]" />
                    Matrícula
                  </Label>
                  <Input
                    id="edit-matricula"
                    value={editProfesionalData.matricula}
                    onChange={(e) => setEditProfesionalData({ ...editProfesionalData, matricula: e.target.value })}
                    className="h-[52px] border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[14px] md:text-[16px] font-['Inter'] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200"
                    placeholder="Ej. 12345"
                  />
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="edit-especialidad" className="text-[15px] font-medium text-[#374151] font-['Inter'] mb-0">
                      Especialidad
                    </Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-[13px] text-[#2563eb] font-['Inter'] p-0 h-auto min-w-0 m-0 hover:bg-transparent hover:text-[#2563eb]"
                      onClick={() => setEditShowCreateEspecialidadInput((v) => !v)}
                    >
                      {editShowCreateEspecialidadInput ? 'Cancelar' : '+ Crear especialidad'}
                    </Button>
                  </div>
                  {editShowCreateEspecialidadInput ? (
                    <div className="flex gap-2">
                      <Input
                        value={editNewEspecialidadNombre}
                        onChange={(e) => setEditNewEspecialidadNombre(e.target.value)}
                        placeholder="Nombre de la nueva especialidad"
                        className="h-[52px] border-[1.5px] border-[#D1D5DB] rounded-[10px] font-['Inter'] text-[14px] md:text-[16px] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200"
                        onKeyDown={(e) => e.key === 'Enter' && handleCreateEspecialidad()}
                      />
                      <Button
                        type="button"
                        onClick={handleCreateEspecialidad}
                        disabled={isCreatingEspecialidad || !editNewEspecialidadNombre.trim()}
                        className="h-[52px] px-4 rounded-[10px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-medium font-['Inter'] disabled:opacity-50"
                      >
                        {isCreatingEspecialidad ? <Loader2 className="h-4 w-4 animate-spin" /> : (<><span className="max-md:hidden">Agregar</span><span className="md:hidden">+</span></>)}
                      </Button>
                    </div>
                  ) : (
                    <Select
                      value={editProfesionalData.especialidad}
                      onValueChange={(value) => setEditProfesionalData({ ...editProfesionalData, especialidad: value })}
                    >
                      <SelectTrigger className="h-[52px] border-[1.5px] border-[#D1D5DB] rounded-[10px] font-['Inter'] text-[16px] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200">
                        <SelectValue placeholder="Seleccionar especialidad" />
                      </SelectTrigger>
                      <SelectContent className="rounded-[12px] border-[#E5E7EB] shadow-xl">
                        {especialidades.map((esp) => (
                          <SelectItem key={esp.id} value={esp.nombre} className="rounded-[8px] font-['Inter'] text-[15px] py-3">
                            {esp.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
              <div className="rounded-[12px] border border-[#E5E7EB] bg-[#F9FAFB] p-5 max-md:border-0 max-md:bg-transparent max-md:rounded-none max-md:p-0">
                <h4 className="text-[15px] font-semibold text-[#374151] font-['Inter'] flex items-center gap-2 mb-4 max-md:mb-3">
                  <CreditCard className="max-md:hidden h-4 w-4 text-[#6B7280] stroke-[2]" />
                  Contrato
                </h4>
                <div className="space-y-4">
                    <div className="space-y-3 relative" ref={editContratoDatePickerRef}>
                      <Label className="text-[14px] font-medium text-[#374151] font-['Inter'] flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-[#6B7280] stroke-[2]" />
                        Fecha de inicio
                      </Label>
                      <button
                        ref={editContratoDatePickerButtonRef}
                        type="button"
                        onClick={() => {
                          const willOpen = !editContratoDatePickerOpen;
                          setEditContratoDatePickerOpen(willOpen);
                          if (willOpen) {
                            const parsed = editProfesionalData.fecha_inicio ? new Date(editProfesionalData.fecha_inicio + 'T12:00:00') : null;
                            const safeMonth = parsed && !Number.isNaN(parsed.getTime()) ? startOfMonth(parsed) : startOfMonth(new Date());
                            setEditContratoDatePickerMonth(safeMonth);
                            setEditContratoDatePickerAnchor(editContratoDatePickerButtonRef.current?.getBoundingClientRect() ?? null);
                          } else {
                            setEditContratoDatePickerAnchor(null);
                          }
                        }}
                        className="h-[52px] w-full flex items-center gap-2 px-4 border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[16px] font-['Inter'] text-left bg-white focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200 hover:border-[#9CA3AF]"
                      >
                        <Calendar className="h-4 w-4 text-[#6B7280] stroke-[2] flex-shrink-0" />
                        <span className="text-[#374151]">
                          {formatFechaInicioDisplay(editProfesionalData.fecha_inicio)}
                        </span>
                        <ChevronRight className={`h-4 w-4 text-[#6B7280] ml-auto transition-transform ${editContratoDatePickerOpen ? 'rotate-90' : ''}`} />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <Label className="text-[14px] font-medium text-[#374151] font-['Inter']">
                          Período
                        </Label>
                        <Select
                          value={editProfesionalData.tipo_periodo_pago}
                          onValueChange={(value: 'mensual' | 'quincenal' | 'semanal' | 'anual') =>
                            setEditProfesionalData({ ...editProfesionalData, tipo_periodo_pago: value })
                          }
                        >
                          <SelectTrigger className="h-[52px] border-[1.5px] border-[#D1D5DB] rounded-[10px] font-['Inter'] text-[16px] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-[12px] border-[#E5E7EB] shadow-xl">
                            {TIPO_PERIODO_PAGO.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value} className="rounded-[8px] font-['Inter'] text-[15px] py-3">
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-3">
                        <Label htmlFor="edit-valor-pago" className="text-[14px] font-medium text-[#374151] font-['Inter']">
                          Valor
                        </Label>
                        <Input
                          id="edit-valor-pago"
                          type="text"
                          inputMode="decimal"
                          value={editProfesionalData.valor}
                          onChange={(e) => {
                            const v = e.target.value.replace(/[^\d,.]/g, '');
                            setEditProfesionalData({ ...editProfesionalData, valor: v });
                          }}
                          onBlur={() => {
                            if (editProfesionalData.valor.trim()) {
                              const formatted = formatValorDisplay(editProfesionalData.valor);
                              if (formatted !== '') setEditProfesionalData((p) => ({ ...p, valor: formatted }));
                            }
                          }}
                          onFocus={() => {
                            const n = parseValorToNumber(editProfesionalData.valor);
                            if (n !== undefined) setEditProfesionalData((p) => ({ ...p, valor: String(n) }));
                          }}
                          className="h-[52px] border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[14px] md:text-[16px] font-['Inter'] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200"
                          placeholder="Ej. 500.000"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
          </div>
          )}
          </div>

          <DialogFooter className="px-8 py-5 border-t border-[#E5E7EB] bg-[#F9FAFB] flex flex-row justify-end gap-3 mt-0 flex-shrink-0">
            <Button
              variant="outline"
              onClick={() => (selectedUsuario?.rol === 'profesional' && editStep === 2 ? setEditStep(1) : setShowEditModal(false))}
              disabled={isSubmitting}
              className="h-[48px] px-6 rounded-[12px] border-[1.5px] border-[#D1D5DB] font-medium font-['Inter'] text-[15px] hover:bg-white hover:border-[#9CA3AF] transition-all duration-200"
            >
              {selectedUsuario?.rol === 'profesional' && editStep === 2 ? (
                <>
                  <ChevronLeft className="mr-2 h-5 w-5 stroke-[2]" />
                  Atrás
                </>
              ) : (
                'Cancelar'
              )}
            </Button>
            <Button
              onClick={() => {
                if (selectedUsuario?.rol === 'profesional' && editStep === 1) {
                  setEditStep(2);
                } else {
                  handleUpdate();
                }
              }}
              disabled={isSubmitting}
              className="h-[48px] px-8 rounded-[12px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-lg shadow-[#2563eb]/30 hover:shadow-xl hover:shadow-[#2563eb]/40 hover:scale-[1.02] font-semibold font-['Inter'] text-[15px] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin stroke-[2.5]" />
                  Guardando...
                </>
              ) : selectedUsuario?.rol === 'profesional' && editStep === 1 ? (
                'Siguiente'
              ) : (
                'Guardar Cambios'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteModal
        open={showDeleteModal}
        onOpenChange={(open) => { setShowDeleteModal(open); if (!open) setSelectedUsuario(null); }}
        title="Eliminar Usuario"
        description={<>¿Estás seguro de que deseas eliminar a <span className="font-semibold text-[#374151]">{formatDisplayText(selectedUsuario?.nombre)} {formatDisplayText(selectedUsuario?.apellido)}</span>? Esta acción no se puede deshacer.</>}
        onConfirm={handleConfirmDelete}
        isLoading={isSubmitting}
      />

    </div>
  );
}