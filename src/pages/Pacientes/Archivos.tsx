import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { 
  Upload, Download, Trash2, Eye, FileText, 
  Image, File, Loader2, Calendar, ChevronLeft, ChevronRight, X
} from 'lucide-react';
import { formatDisplayText } from '@/lib/utils';
import { archivosService, type CreateArchivoData } from '@/services/archivos.service';
import { profesionalesService } from '@/services/profesionales.service';
import type { Archivo, Profesional } from '@/types';
import { toast as reactToastify } from 'react-toastify';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/utils/permissions';
import { ConfirmDeleteModal } from '@/components/shared/ConfirmDeleteModal';
import { UploadArchivoModal, ViewImageModal } from './modals';
import { PAGE_SIZE } from '@/lib/constants';

interface PacienteArchivosProps {
  pacienteId: string;
}

function getFileIcon(tipo?: string) {
  if (!tipo) return <File className="h-5 w-5 stroke-[2]" />;
  if (tipo.startsWith('image/')) return <Image className="h-5 w-5 stroke-[2]" />;
  if (tipo.includes('pdf')) return <FileText className="h-5 w-5 stroke-[2]" />;
  return <File className="h-5 w-5 stroke-[2]" />;
}

function getFileColor(tipo?: string) {
  if (!tipo) return 'text-[#6B7280]';
  if (tipo.startsWith('image/')) return 'text-[#2563eb]';
  if (tipo.includes('pdf')) return 'text-[#EF4444]';
  if (tipo.includes('word') || tipo.includes('document')) return 'text-[#3B82F6]';
  if (tipo.includes('excel') || tipo.includes('sheet')) return 'text-[#10B981]';
  return 'text-[#6B7280]';
}

// Componente para cargar la miniatura de imagen con autenticación
function ImageThumbnail({ archivo }: { archivo: Archivo }) {
  const [imageSrc, setImageSrc] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const loadImage = async () => {
      try {
        setIsLoading(true);
        setHasError(false);
        
        // Usar el endpoint de descarga que maneja la autenticación
        const blob = await archivosService.download(archivo.id);
        const url = URL.createObjectURL(blob);
        setImageSrc(url);
      } catch {
        setHasError(true);
      } finally {
        setIsLoading(false);
      }
    };

    loadImage();

    // Cleanup: revoke object URL cuando el componente se desmonte o cambie el archivo
    return () => {
      setImageSrc(prev => {
        if (prev && prev.startsWith('blob:')) {
          URL.revokeObjectURL(prev);
        }
        return '';
      });
    };
  }, [archivo.id]);

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#F9FAFB]">
        <Loader2 className="h-8 w-8 animate-spin text-[#2563eb]" />
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#dbeafe] to-[#bfdbfe]">
        <div className="text-[#2563eb]">
          <Image className="h-12 w-12 stroke-[2]" />
        </div>
      </div>
    );
  }

  return (
    <img
      src={imageSrc}
      alt={archivo.nombre_archivo}
      className="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform duration-200"
    />
  );
}

export default function PacienteArchivos({ pacienteId }: PacienteArchivosProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedArchivo, setSelectedArchivo] = useState<Archivo | null>(null);
  const [archivoToDelete, setArchivoToDelete] = useState<Archivo | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [filterProfesionalId, setFilterProfesionalId] = useState<string>('todos');
  const [filterFechaDesde, setFilterFechaDesde] = useState<string>('');
  const [filterFechaHasta, setFilterFechaHasta] = useState<string>('');
  const [pageArchivos, setPageArchivos] = useState(1);

  const [datePickerDesdeOpen, setDatePickerDesdeOpen] = useState(false);
  const [datePickerHastaOpen, setDatePickerHastaOpen] = useState(false);
  const [datePickerDesdeMonth, setDatePickerDesdeMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [datePickerHastaMonth, setDatePickerHastaMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [datePickerDesdeAnchor, setDatePickerDesdeAnchor] = useState<DOMRect | null>(null);
  const [datePickerHastaAnchor, setDatePickerHastaAnchor] = useState<DOMRect | null>(null);
  const datePickerDesdeButtonRef = useRef<HTMLButtonElement>(null);
  const datePickerHastaButtonRef = useRef<HTMLButtonElement>(null);
  const datePickerDesdeRef = useRef<HTMLDivElement>(null);
  const datePickerHastaRef = useRef<HTMLDivElement>(null);

  // Obtener el profesional asociado al usuario logueado si es profesional
  const { data: profesionalesData = [] } = useQuery({
    queryKey: ['profesionales', 'for-filter-archivos'],
    queryFn: () => profesionalesService.getAll({ bloqueado: false }),
  });
  const profesionales = Array.isArray(profesionalesData) ? profesionalesData : [];

  const profesionalLogueado = profesionales.find((p: Profesional) => p.usuario_id === user?.id);
  const isProfesional = user?.rol === 'profesional';

  const { data: archivosData = [], isLoading } = useQuery({
    queryKey: ['archivos', 'paciente', pacienteId, profesionalLogueado?.id],
    queryFn: () => {
      // Si es profesional, filtrar por profesional_id
      if (isProfesional && profesionalLogueado) {
        return archivosService.getAll({
          paciente_id: pacienteId,
          profesional_id: profesionalLogueado.id,
        });
      }
      // Si no es profesional, obtener todos los archivos del paciente
      return archivosService.getByPaciente(pacienteId);
    },
    enabled: !isProfesional || !!profesionalLogueado,
  });
  const archivos = Array.isArray(archivosData) ? archivosData : [];

  const sortedArchivos = useMemo(() => {
    return [...archivos].sort((a, b) => {
      const da = a.fecha_subida ? new Date(a.fecha_subida).getTime() : 0;
      const db = b.fecha_subida ? new Date(b.fecha_subida).getTime() : 0;
      return db - da;
    });
  }, [archivos]);

  const filteredArchivos = useMemo(() => {
    let list = sortedArchivos;
    if (filterProfesionalId && filterProfesionalId !== 'todos') {
      list = list.filter((a) => a.profesional_id === filterProfesionalId);
    }
    if (filterFechaDesde) {
      const desde = new Date(filterFechaDesde + 'T00:00:00').getTime();
      list = list.filter((a) => (a.fecha_subida ? new Date(a.fecha_subida).getTime() : 0) >= desde);
    }
    if (filterFechaHasta) {
      const hasta = new Date(filterFechaHasta + 'T23:59:59').getTime();
      list = list.filter((a) => (a.fecha_subida ? new Date(a.fecha_subida).getTime() : 0) <= hasta);
    }
    return list;
  }, [sortedArchivos, filterProfesionalId, filterFechaDesde, filterFechaHasta]);

  const totalArchivos = filteredArchivos.length;
  const totalPagesArchivos = Math.ceil(totalArchivos / PAGE_SIZE) || 0;
  const archivosPaginados = useMemo(() => {
    const start = (pageArchivos - 1) * PAGE_SIZE;
    return filteredArchivos.slice(start, start + PAGE_SIZE);
  }, [filteredArchivos, pageArchivos]);

  useEffect(() => {
    setPageArchivos(1);
  }, [filterProfesionalId, filterFechaDesde, filterFechaHasta]);

  const profesionalesEnArchivos = useMemo(() => {
    const ids = new Set(archivos.map((a) => a.profesional_id));
    return profesionales.filter((p) => ids.has(p.id));
  }, [archivos, profesionales]);

  // Opciones del filtro: si es profesional logueado, siempre incluir su nombre (aunque no tenga archivos)
  const opcionesFiltroProfesional = useMemo(() => {
    const list = [...profesionalesEnArchivos];
    if (isProfesional && profesionalLogueado && !list.some((p) => p.id === profesionalLogueado.id)) {
      list.unshift(profesionalLogueado);
    }
    return list;
  }, [profesionalesEnArchivos, isProfesional, profesionalLogueado]);

  useEffect(() => {
    if (!datePickerDesdeOpen) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (datePickerDesdeButtonRef.current?.contains(target)) return;
      if (datePickerDesdeRef.current?.contains(target)) return;
      if ((e.target as Element).closest?.('[data-calendar-desde-portal]')) return;
      setDatePickerDesdeOpen(false);
      setDatePickerDesdeAnchor(null);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [datePickerDesdeOpen]);

  useEffect(() => {
    if (!datePickerHastaOpen) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (datePickerHastaButtonRef.current?.contains(target)) return;
      if (datePickerHastaRef.current?.contains(target)) return;
      if ((e.target as Element).closest?.('[data-calendar-hasta-portal]')) return;
      setDatePickerHastaOpen(false);
      setDatePickerHastaAnchor(null);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [datePickerHastaOpen]);

  const uploadMutation = useMutation({
    mutationFn: (data: CreateArchivoData) => archivosService.upload(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['archivos', 'paciente', pacienteId] });
      reactToastify.success('Archivo subido correctamente', {
        position: 'top-right',
        autoClose: 3000,
      });
      setShowUploadModal(false);
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.error?.message 
        || error?.response?.data?.message 
        || error?.message 
        || 'Error al subir archivo';
      reactToastify.error(errorMessage, {
        position: 'top-right',
        autoClose: 3000,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => archivosService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['archivos', 'paciente', pacienteId] });
      reactToastify.success('Archivo eliminado correctamente', {
        position: 'top-right',
        autoClose: 3000,
      });
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.error?.message 
        || error?.response?.data?.message 
        || error?.message 
        || 'Error al eliminar archivo';
      reactToastify.error(errorMessage, {
        position: 'top-right',
        autoClose: 3000,
      });
    },
  });

  const handleUpload = async (data: CreateArchivoData) => {
    setIsSubmitting(true);
    try {
      await uploadMutation.mutateAsync(data);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownload = async (archivo: Archivo) => {
    try {
      const blob = await archivosService.download(archivo.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = archivo.nombre_archivo;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error: any) {
      const errorMessage = error?.response?.data?.error?.message 
        || error?.response?.data?.message 
        || error?.message 
        || 'Error al descargar archivo';
      reactToastify.error(errorMessage, {
        position: 'top-right',
        autoClose: 3000,
      });
    }
  };

  const handleDeleteClick = (archivo: Archivo) => {
    setArchivoToDelete(archivo);
  };

  const handleConfirmDelete = async () => {
    if (!archivoToDelete) return;
    await deleteMutation.mutateAsync(archivoToDelete.id);
    setArchivoToDelete(null);
  };

  const handleView = (archivo: Archivo) => {
    setSelectedArchivo(archivo);
    setShowViewModal(true);
  };

  const isImage = (tipo?: string): boolean => {
    return tipo?.startsWith('image/') || false;
  };

  const canUpload = hasPermission(user, 'archivos.subir');
  const canDelete = hasPermission(user, 'archivos.eliminar');
  const canDownload = hasPermission(user, 'archivos.descargar');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-16">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-[#2563eb]" />
          <p className="text-[#6B7280] font-['Inter']">Cargando archivos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-lg:pb-20 max-lg:overflow-x-hidden relative">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-[24px] max-lg:text-[20px] font-bold text-[#111827] font-['Poppins'] mb-0">
            Archivos del Paciente
          </h2>
          <p className="text-base max-lg:text-sm text-[#6B7280] mt-1 font-['Inter']">
            {filteredArchivos.length === sortedArchivos.length
              ? `${sortedArchivos.length} ${sortedArchivos.length === 1 ? 'archivo adjunto' : 'archivos adjuntos'}`
              : `${filteredArchivos.length} de ${sortedArchivos.length} archivos`}
          </p>
        </div>
        <div className="flex gap-3 max-lg:hidden">
          {canUpload && (
            <Button 
              onClick={() => setShowUploadModal(true)}
              className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-md shadow-[#2563eb]/20 hover:shadow-lg hover:shadow-[#2563eb]/30 transition-all duration-200 rounded-[12px] px-6 h-12 font-medium"
            >
              <Upload className="h-5 w-5 mr-2 stroke-[2]" />
              Subir Archivo
            </Button>
          )}
        </div>
      </div>

      {/* Filtros: profesional y fecha */}
      <Card className="border border-[#E5E7EB] rounded-[16px] shadow-sm">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-4">
            <div className="flex-1 min-w-[200px]">
              <Label className="text-[13px] font-medium text-[#374151] font-['Inter'] mb-1.5 block">Profesional</Label>
              <Select
                value={isProfesional && profesionalLogueado ? profesionalLogueado.id : filterProfesionalId}
                onValueChange={setFilterProfesionalId}
                disabled={!!(isProfesional && profesionalLogueado)}
              >
                <SelectTrigger className="h-11 w-full rounded-[10px] border-[#E5E7EB] font-['Inter'] text-[14px]">
                  <SelectValue placeholder="Todos los profesionales" />
                </SelectTrigger>
                <SelectContent className="rounded-[12px]">
                  <SelectItem value="todos">Todos los profesionales</SelectItem>
                  {opcionesFiltroProfesional.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {formatDisplayText(p.nombre)} {formatDisplayText(p.apellido)}
                      {p.especialidad ? ` — ${formatDisplayText(p.especialidad)}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[200px] relative flex flex-col gap-1.5" ref={datePickerDesdeRef}>
              <Label className="text-[13px] font-medium text-[#374151] font-['Inter']">Fecha desde</Label>
              <div className="flex items-center gap-2">
                <button
                  ref={datePickerDesdeButtonRef}
                  type="button"
                  onClick={() => {
                    const willOpen = !datePickerDesdeOpen;
                    setDatePickerDesdeOpen(willOpen);
                    if (willOpen) {
                      setDatePickerHastaOpen(false);
                      setDatePickerDesdeMonth(filterFechaDesde ? startOfMonth(new Date(filterFechaDesde + 'T12:00:00')) : startOfMonth(new Date()));
                      setDatePickerDesdeAnchor(datePickerDesdeButtonRef.current?.getBoundingClientRect() ?? null);
                    } else {
                      setDatePickerDesdeAnchor(null);
                    }
                  }}
                  className="h-11 flex-1 min-w-0 flex items-center gap-2 px-4 border border-[#E5E7EB] rounded-[10px] text-[14px] font-['Inter'] text-left bg-white hover:border-[#9CA3AF] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all"
                >
                  <Calendar className="h-4 w-4 text-[#6B7280] stroke-[2] flex-shrink-0" />
                  <span className="text-[#374151] truncate">
                    {filterFechaDesde ? format(new Date(filterFechaDesde + 'T12:00:00'), "d 'de' MMMM yyyy", { locale: es }) : 'Seleccionar'}
                  </span>
                  <ChevronRight className={`h-4 w-4 text-[#6B7280] ml-auto flex-shrink-0 transition-transform ${datePickerDesdeOpen ? 'rotate-90' : ''}`} />
                </button>
                {filterFechaDesde && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setFilterFechaDesde('')}
                    className="h-11 w-11 shrink-0 rounded-[10px] text-[#6B7280] hover:text-[#374151] hover:bg-[#FEE2E2]"
                    aria-label="Quitar fecha desde"
                  >
                    <X className="h-5 w-5 stroke-[2]" />
                  </Button>
                )}
              </div>
            </div>
            <div className="flex-1 min-w-[200px] relative flex flex-col gap-1.5" ref={datePickerHastaRef}>
              <Label className="text-[13px] font-medium text-[#374151] font-['Inter']">Fecha hasta</Label>
              <div className="flex items-center gap-2">
                <button
                  ref={datePickerHastaButtonRef}
                  type="button"
                  onClick={() => {
                    const willOpen = !datePickerHastaOpen;
                    setDatePickerHastaOpen(willOpen);
                    if (willOpen) {
                      setDatePickerDesdeOpen(false);
                      setDatePickerHastaMonth(filterFechaHasta ? startOfMonth(new Date(filterFechaHasta + 'T12:00:00')) : startOfMonth(new Date()));
                      setDatePickerHastaAnchor(datePickerHastaButtonRef.current?.getBoundingClientRect() ?? null);
                    } else {
                      setDatePickerHastaAnchor(null);
                    }
                  }}
                  className="h-11 flex-1 min-w-0 flex items-center gap-2 px-4 border border-[#E5E7EB] rounded-[10px] text-[14px] font-['Inter'] text-left bg-white hover:border-[#9CA3AF] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all"
                >
                  <Calendar className="h-4 w-4 text-[#6B7280] stroke-[2] flex-shrink-0" />
                  <span className="text-[#374151] truncate">
                    {filterFechaHasta ? format(new Date(filterFechaHasta + 'T12:00:00'), "d 'de' MMMM yyyy", { locale: es }) : 'Seleccionar'}
                  </span>
                  <ChevronRight className={`h-4 w-4 text-[#6B7280] ml-auto flex-shrink-0 transition-transform ${datePickerHastaOpen ? 'rotate-90' : ''}`} />
                </button>
                {filterFechaHasta && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setFilterFechaHasta('')}
                    className="h-11 w-11 shrink-0 rounded-[10px] text-[#6B7280] hover:text-[#374151] hover:bg-[#FEE2E2]"
                    aria-label="Quitar fecha hasta"
                  >
                    <X className="h-5 w-5 stroke-[2]" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Empty State o Lista */}
      {sortedArchivos.length === 0 ? (
        <Card className="border border-[#E5E7EB] rounded-[16px] shadow-sm">
          <CardContent className="p-8 max-lg:p-5 text-center">
            <h3 className="text-base max-lg:text-[15px] font-semibold text-[#374151] font-['Inter'] mb-0">
              No hay archivos
            </h3>
          </CardContent>
        </Card>
      ) : filteredArchivos.length === 0 ? (
        <Card className="border border-[#E5E7EB] rounded-[16px] shadow-sm">
          <CardContent className="p-8 max-lg:p-6 text-center">
            <h3 className="text-lg font-semibold mb-1 text-[#374151] font-['Inter']">
              No hay resultados
            </h3>
            <p className="text-[#6B7280] font-['Inter'] mb-0">
              No se encontraron archivos con los filtros aplicados. Probá cambiando profesional o rango de fechas.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 max-lg:gap-5">
            {archivosPaginados.map((archivo) => (
            <Card key={archivo.id} className="border border-[#E5E7EB] rounded-[12px] shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden w-full max-w-[360px] max-lg:max-w-none">
              <CardContent className="p-4 max-lg:p-5">
                {/* Imagen o Icono */}
                <div className="mb-3">
                  {isImage(archivo.tipo_archivo) ? (
                    <div 
                      className="w-full h-32 rounded-[10px] overflow-hidden bg-[#F9FAFB] cursor-pointer group relative flex items-center justify-center"
                      onClick={() => handleView(archivo)}
                    >
                      <ImageThumbnail archivo={archivo} />
                    </div>
                  ) : (
                    <div className="w-full h-32 rounded-[10px] bg-gradient-to-br from-[#dbeafe] to-[#bfdbfe] flex items-center justify-center">
                      <div className={getFileColor(archivo.tipo_archivo)}>
                        {getFileIcon(archivo.tipo_archivo)}
                      </div>
                    </div>
                  )}
                </div>

                {/* Comentario: se corta con ... si es muy largo; en el detalle se ve completo */}
                <p className="text-[13px] text-[#6B7280] font-['Inter'] mb-2 line-clamp-2 break-words overflow-hidden text-ellipsis">
                  {archivo.descripcion ? archivo.descripcion : 'Sin comentario'}
                </p>

                {/* Subido por */}
                <p className="text-[12px] text-[#6B7280] font-['Inter'] mb-2">
                  {archivo.usuario_id === user?.id ? (
                    <span className="font-medium text-[#2563eb]">Usuario actual</span>
                  ) : (
                    <>Subido por: {formatDisplayText(archivo.profesional_nombre ?? archivo.usuario_subido_nombre)} {formatDisplayText(archivo.profesional_apellido ?? archivo.usuario_subido_apellido)}</>
                  )}
                </p>

                {/* Fecha (sin icono; primera letra en mayúscula) */}
                <p className="text-[12px] text-[#6B7280] font-['Inter'] mb-3">
                  {archivo.fecha_subida
                    ? (() => {
                        const d = new Date(archivo.fecha_subida);
                        const day = format(d, 'dd', { locale: es });
                        const month = format(d, 'MMMM', { locale: es });
                        const year = format(d, 'yyyy', { locale: es });
                        return `${day} de ${month.charAt(0).toUpperCase() + month.slice(1)} de ${year}`;
                      })()
                    : '-'}
                </p>

                {/* Acciones: iconos; en mobile centradas */}
                <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-[#E5E7EB] max-lg:justify-center max-lg:gap-3">
                  {isImage(archivo.tipo_archivo) && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            onClick={() => handleView(archivo)}
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-[8px] hover:bg-[#F3F4F6]"
                          >
                            <Eye className="h-4 w-4 text-[#6B7280] stroke-[2]" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent className="bg-[#111827] text-white text-xs font-['Inter'] rounded-[8px] px-3 py-2 [&>p]:text-white">
                          <p className="text-white">Ver imagen</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  {canDownload && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            onClick={() => handleDownload(archivo)}
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-[8px] hover:bg-[#F3F4F6]"
                          >
                            <Download className="h-4 w-4 text-[#6B7280] stroke-[2]" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent className="bg-[#111827] text-white text-xs font-['Inter'] rounded-[8px] px-3 py-2 [&>p]:text-white">
                          <p className="text-white">Descargar</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  {canDelete && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            onClick={() => handleDeleteClick(archivo)}
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-[8px] hover:bg-[#FEE2E2] hover:text-[#DC2626]"
                          >
                            <Trash2 className="h-4 w-4 text-[#EF4444] stroke-[2]" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent className="bg-[#111827] text-white text-xs font-['Inter'] rounded-[8px] px-3 py-2 [&>p]:text-white">
                          <p className="text-white">Eliminar</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          </div>
          {(totalPagesArchivos >= 1) && !isLoading && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-4 border border-[#E5E7EB] border-t-0 rounded-b-[16px] bg-[#F9FAFB]">
              <p className="text-sm text-[#6B7280] font-['Inter'] m-0">
                Página {pageArchivos} de {totalPagesArchivos || 1}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPageArchivos((p) => Math.max(1, p - 1))}
                  disabled={pageArchivos <= 1}
                  className="h-9 rounded-[8px] border-[#D1D5DB] font-['Inter'] m-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPageArchivos((p) => Math.min(totalPagesArchivos, p + 1))}
                  disabled={pageArchivos >= totalPagesArchivos}
                  className="h-9 rounded-[8px] border-[#D1D5DB] font-['Inter'] m-0"
                >
                  Siguiente
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* FAB móvil: Subir archivo */}
      {canUpload && (
        <div className="lg:hidden fixed bottom-6 right-6 z-40">
          <Button
            onClick={() => setShowUploadModal(true)}
            className="h-14 w-14 rounded-full shadow-lg shadow-[#2563eb]/30 bg-[#2563eb] hover:bg-[#1d4ed8] text-white p-0"
            title="Subir Archivo"
            aria-label="Subir Archivo"
          >
            <Upload className="h-6 w-6 stroke-[2]" />
          </Button>
        </div>
      )}

      {/* Modales */}
      <UploadArchivoModal
        open={showUploadModal}
        onOpenChange={setShowUploadModal}
        pacienteId={pacienteId}
        onSubmit={handleUpload}
        isSubmitting={isSubmitting}
      />

      {selectedArchivo && (
        <ViewImageModal
          open={showViewModal}
          onOpenChange={setShowViewModal}
          archivo={selectedArchivo}
        />
      )}

      {/* Calendario Fecha desde (portal) */}
      {datePickerDesdeOpen && datePickerDesdeAnchor &&
        createPortal(
          <div
            data-calendar-desde-portal
            className="bg-white border border-[#E5E7EB] rounded-[16px] shadow-xl p-4 z-[9999] pointer-events-auto min-w-[280px] max-w-[450px]"
            style={{ position: 'fixed', top: datePickerDesdeAnchor.bottom + 8, left: datePickerDesdeAnchor.left, width: Math.min(Math.max(datePickerDesdeAnchor.width, 280), 450) }}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-[16px] font-semibold text-[#111827] font-['Poppins']">
                {format(datePickerDesdeMonth, 'MMMM yyyy', { locale: es }).charAt(0).toUpperCase() + format(datePickerDesdeMonth, 'MMMM yyyy', { locale: es }).slice(1)}
              </span>
              <div className="flex gap-1">
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-[8px] hover:bg-[#dbeafe] text-[#2563eb]" onClick={() => setDatePickerDesdeMonth((m) => subMonths(m, 1))}>
                  <ChevronLeft className="h-4 w-4 stroke-[2]" />
                </Button>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-[8px] hover:bg-[#dbeafe] text-[#2563eb]" onClick={() => setDatePickerDesdeMonth((m) => addMonths(m, 1))}>
                  <ChevronRight className="h-4 w-4 stroke-[2]" />
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center">
              {['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'].map((d) => (
                <span key={d} className="text-[11px] font-medium text-[#6B7280] font-['Inter'] py-1">{d}</span>
              ))}
              {(() => {
                const monthEnd = endOfMonth(datePickerDesdeMonth);
                const calStart = startOfWeek(datePickerDesdeMonth, { weekStartsOn: 1 });
                const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
                const days = eachDayOfInterval({ start: calStart, end: calEnd });
                const selectedDate = filterFechaDesde ? new Date(filterFechaDesde + 'T12:00:00') : null;
                return days.map((day) => {
                  const isCurrentMonth = isSameMonth(day, datePickerDesdeMonth);
                  const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
                  return (
                    <button
                      key={day.toISOString()}
                      type="button"
                      onClick={() => {
                        setFilterFechaDesde(format(day, 'yyyy-MM-dd'));
                        setDatePickerDesdeMonth(startOfMonth(day));
                        setDatePickerDesdeOpen(false);
                        setDatePickerDesdeAnchor(null);
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

      {/* Calendario Fecha hasta (portal) */}
      {datePickerHastaOpen && datePickerHastaAnchor &&
        createPortal(
          <div
            data-calendar-hasta-portal
            className="bg-white border border-[#E5E7EB] rounded-[16px] shadow-xl p-4 z-[9999] pointer-events-auto min-w-[280px] max-w-[450px]"
            style={{ position: 'fixed', top: datePickerHastaAnchor.bottom + 8, left: datePickerHastaAnchor.left, width: Math.min(Math.max(datePickerHastaAnchor.width, 280), 450) }}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-[16px] font-semibold text-[#111827] font-['Poppins']">
                {format(datePickerHastaMonth, 'MMMM yyyy', { locale: es }).charAt(0).toUpperCase() + format(datePickerHastaMonth, 'MMMM yyyy', { locale: es }).slice(1)}
              </span>
              <div className="flex gap-1">
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-[8px] hover:bg-[#dbeafe] text-[#2563eb]" onClick={() => setDatePickerHastaMonth((m) => subMonths(m, 1))}>
                  <ChevronLeft className="h-4 w-4 stroke-[2]" />
                </Button>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-[8px] hover:bg-[#dbeafe] text-[#2563eb]" onClick={() => setDatePickerHastaMonth((m) => addMonths(m, 1))}>
                  <ChevronRight className="h-4 w-4 stroke-[2]" />
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center">
              {['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'].map((d) => (
                <span key={d} className="text-[11px] font-medium text-[#6B7280] font-['Inter'] py-1">{d}</span>
              ))}
              {(() => {
                const monthEnd = endOfMonth(datePickerHastaMonth);
                const calStart = startOfWeek(datePickerHastaMonth, { weekStartsOn: 1 });
                const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
                const days = eachDayOfInterval({ start: calStart, end: calEnd });
                const selectedDate = filterFechaHasta ? new Date(filterFechaHasta + 'T12:00:00') : null;
                return days.map((day) => {
                  const isCurrentMonth = isSameMonth(day, datePickerHastaMonth);
                  const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
                  return (
                    <button
                      key={day.toISOString()}
                      type="button"
                      onClick={() => {
                        setFilterFechaHasta(format(day, 'yyyy-MM-dd'));
                        setDatePickerHastaMonth(startOfMonth(day));
                        setDatePickerHastaOpen(false);
                        setDatePickerHastaAnchor(null);
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

      <ConfirmDeleteModal
        open={!!archivoToDelete}
        onOpenChange={(open) => { if (!open) setArchivoToDelete(null); }}
        title="Eliminar archivo"
        description={
          archivoToDelete ? (
            <>
              ¿Está seguro de que desea eliminar el archivo <span className="font-semibold text-[#374151]">{archivoToDelete.nombre_archivo}</span>? Esta acción no se puede deshacer.
            </>
          ) : (
            ''
          )
        }
        onConfirm={handleConfirmDelete}
        isLoading={deleteMutation.isPending}
        confirmLabel="Eliminar"
      />
    </div>
  );
}