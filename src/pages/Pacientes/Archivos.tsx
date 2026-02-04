import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { 
  Upload, Download, Trash2, Eye, FileText, 
  Image, File, Loader2, Paperclip, Calendar
} from 'lucide-react';
import { archivosService, type CreateArchivoData } from '@/services/archivos.service';
import { profesionalesService } from '@/services/profesionales.service';
import type { Archivo, Profesional } from '@/types';
import { toast as reactToastify } from 'react-toastify';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/utils/permissions';
import { UploadArchivoModal, ViewImageModal } from './modals';

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
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Obtener el profesional asociado al usuario logueado si es profesional
  const { data: profesionales = [] } = useQuery({
    queryKey: ['profesionales', 'for-filter-archivos'],
    queryFn: () => profesionalesService.getAll({ bloqueado: false }),
  });

  const profesionalLogueado = profesionales.find((p: Profesional) => p.usuario_id === user?.id);
  const isProfesional = user?.rol === 'profesional';

  const { data: archivos = [], isLoading } = useQuery({
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

  const handleDelete = async (id: string) => {
    if (confirm('¿Está seguro de eliminar este archivo?')) {
      await deleteMutation.mutateAsync(id);
    }
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-[24px] font-bold text-[#111827] font-['Poppins'] mb-0">
            Archivos del Paciente
          </h2>
          <p className="text-base text-[#6B7280] mt-1 font-['Inter']">
            {archivos.length} {archivos.length === 1 ? 'archivo adjunto' : 'archivos adjuntos'}
          </p>
        </div>
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

      {/* Empty State o Tabla */}
      {archivos.length === 0 ? (
        <Card className="border border-[#E5E7EB] rounded-[16px] shadow-sm">
          <CardContent className="p-16 text-center">
            <div className="h-20 w-20 rounded-full bg-[#dbeafe] flex items-center justify-center mx-auto mb-4">
              <Paperclip className="h-10 w-10 text-[#2563eb] stroke-[2]" />
            </div>
            <h3 className="text-lg font-semibold mb-2 text-[#374151] font-['Inter']">
              No hay archivos
            </h3>
            <p className="text-[#6B7280] mb-6 font-['Inter']">
              Aún no se han subido archivos para este paciente
            </p>
            {canUpload && (
              <Button 
                onClick={() => setShowUploadModal(true)}
                className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-md shadow-[#2563eb]/20 hover:shadow-lg hover:shadow-[#2563eb]/30 transition-all duration-200 rounded-[12px] px-6 py-3 h-auto font-medium"
              >
                <Upload className="h-5 w-5 mr-2 stroke-[2]" />
                Subir Archivo
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {archivos.map((archivo) => (
            <Card key={archivo.id} className="border border-[#E5E7EB] rounded-[12px] shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden max-w-[240px]">
              <CardContent className="p-4">
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

                {/* Descripción */}
                {archivo.descripcion && (
                  <p className="text-[14px] text-[#374151] font-['Inter'] mb-2 line-clamp-2">
                    {archivo.descripcion}
                  </p>
                )}

                {/* Fecha */}
                <div className="flex items-center gap-2 text-[#6B7280] mb-3">
                  <Calendar className="h-3.5 w-3.5 stroke-[2] flex-shrink-0" />
                  <span className="text-[12px] font-['Inter']">
                    {archivo.fecha_subida
                      ? format(new Date(archivo.fecha_subida), "dd 'de' MMMM 'de' yyyy", { locale: es })
                      : '-'}
                  </span>
                </div>

                {/* Acciones */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E5E7EB]">
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
                            onClick={() => handleDelete(archivo.id)}
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
    </div>
  );
}