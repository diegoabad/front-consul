import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Image, X, Loader2 } from 'lucide-react';
import type { Archivo } from '@/services/archivos.service';
import { archivosService } from '@/services/archivos.service';
import { useAuth } from '@/contexts/AuthContext';
import { formatDisplayText } from '@/lib/utils';

interface ViewImageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  archivo: Archivo | null;
}

function formatFecha(fechaSubida?: string): string {
  if (!fechaSubida) return '-';
  const d = new Date(fechaSubida);
  const day = format(d, 'dd', { locale: es });
  const month = format(d, 'MMMM', { locale: es });
  const year = format(d, 'yyyy', { locale: es });
  return `${day} de ${month.charAt(0).toUpperCase() + month.slice(1)} de ${year}`;
}

export function ViewImageModal({
  open,
  onOpenChange,
  archivo,
}: ViewImageModalProps) {
  const { user } = useAuth();
  const [imageSrc, setImageSrc] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!archivo || !open) return;

    setIsLoading(true);
    setHasError(false);

    const loadImage = async () => {
      try {
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

    return () => {
      if (imageSrc && imageSrc.startsWith('blob:')) {
        URL.revokeObjectURL(imageSrc);
      }
    };
  }, [archivo, open]);

  if (!archivo) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent hideCloseButton className="max-w-[90vw] w-[90vw] max-h-[90vh] h-[90vh] max-lg:max-h-[75vh] max-lg:h-[75vh] max-lg:max-w-[95vw] max-lg:w-[95vw] rounded-[20px] p-0 border border-[#E5E7EB] shadow-2xl flex flex-col overflow-hidden max-lg:rounded-[16px]">
        {/* Header: título + botón cerrar */}
        <DialogHeader className="relative px-6 pt-5 pb-4 max-lg:px-4 max-lg:pt-3 max-lg:pb-3 border-b border-[#E5E7EB] bg-gradient-to-b from-white to-[#F9FAFB] flex-shrink-0 mb-0">
          <div className="flex items-start justify-between gap-4 pr-12">
            <DialogTitle className="text-[20px] max-lg:text-[16px] font-bold text-[#111827] font-['Poppins'] leading-tight mb-0 break-words min-w-0">
              {archivo.nombre_archivo}
            </DialogTitle>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="h-10 w-10 rounded-full hover:bg-[#F3F4F6] flex-shrink-0 absolute top-5 right-6 max-lg:top-3 max-lg:right-4"
            >
              <X className="h-5 w-5 text-[#6B7280] stroke-[2]" />
            </Button>
          </div>
        </DialogHeader>

        {/* Datos: fecha, subido por, comentario (más espacio) */}
        <div className="flex-shrink-0 px-6 py-4 max-lg:px-4 max-lg:py-3 space-y-3 border-b border-[#E5E7EB] bg-[#F9FAFB]">
          <p className="text-[13px] text-[#6B7280] font-['Inter']">
            <span className="font-medium text-[#374151]">Fecha:</span>{' '}
            {formatFecha(archivo.fecha_subida)}
          </p>
          <p className="text-[13px] text-[#6B7280] font-['Inter']">
            <span className="font-medium text-[#374151]">Subido por:</span>{' '}
            {archivo.usuario_id === user?.id ? (
              <span className="font-medium text-[#2563eb]">Usuario actual</span>
            ) : (
              <>
                {formatDisplayText(archivo.profesional_nombre ?? archivo.usuario_subido_nombre)}{' '}
                {formatDisplayText(archivo.profesional_apellido ?? archivo.usuario_subido_apellido)}
              </>
            )}
          </p>
          <p className="text-[13px] text-[#6B7280] font-['Inter'] min-h-[2.5rem] max-lg:min-h-[2rem]">
            <span className="font-medium text-[#374151]">Comentario:</span>{' '}
            <span className="break-words">{archivo.descripcion ? archivo.descripcion : 'Sin comentario'}</span>
          </p>
        </div>

        {/* Contenido - Imagen */}
        <div className="flex-1 min-h-0 p-6 max-lg:p-3 max-lg:min-h-[120px] flex items-center justify-center bg-[#F9FAFB] overflow-auto">
          <div className="w-full min-h-0 flex items-center justify-center">
            {isLoading ? (
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-12 w-12 animate-spin text-[#2563eb]" />
                <p className="text-[#6B7280] font-['Inter']">Cargando imagen...</p>
              </div>
            ) : hasError ? (
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="h-20 w-20 rounded-full bg-[#FEE2E2] flex items-center justify-center">
                  <Image className="h-10 w-10 text-[#EF4444]" />
                </div>
                <p className="text-[#6B7280] font-['Inter']">Error al cargar la imagen</p>
              </div>
            ) : (
              <img
                src={imageSrc}
                alt={archivo.nombre_archivo}
                className="max-w-full max-h-full w-auto h-auto object-contain rounded-[12px] shadow-lg"
                onError={() => setHasError(true)}
              />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
