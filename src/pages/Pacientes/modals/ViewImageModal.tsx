import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Image, X, Loader2 } from 'lucide-react';
import type { Archivo } from '@/types';
import { archivosService } from '@/services/archivos.service';

interface ViewImageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  archivo: Archivo | null;
}

export function ViewImageModal({
  open,
  onOpenChange,
  archivo,
}: ViewImageModalProps) {
  const [imageSrc, setImageSrc] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!archivo || !open) return;

    setIsLoading(true);
    setHasError(false);

    const loadImage = async () => {
      try {
        // Usar el endpoint de descarga que maneja la autenticación correctamente
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

    // Cleanup: revoke object URL when component unmounts or image changes
    return () => {
      if (imageSrc && imageSrc.startsWith('blob:')) {
        URL.revokeObjectURL(imageSrc);
      }
    };
  }, [archivo, open]);

  if (!archivo) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent hideCloseButton className="max-w-[90vw] w-[90vw] max-h-[90vh] h-[90vh] rounded-[20px] p-0 border border-[#E5E7EB] shadow-2xl flex flex-col overflow-hidden">
        {/* Header fijo */}
        <DialogHeader className="px-8 pt-6 pb-4 border-b border-[#E5E7EB] bg-gradient-to-b from-white to-[#F9FAFB] flex-shrink-0 mb-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 min-w-0">
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] flex items-center justify-center shadow-lg shadow-[#2563eb]/30 flex-shrink-0">
                <Image className="h-6 w-6 text-white stroke-[2.5]" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-[24px] font-bold text-[#111827] font-['Poppins'] leading-tight mb-0 truncate">
                  {archivo.nombre_archivo}
                </DialogTitle>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="h-10 w-10 rounded-full hover:bg-[#F3F4F6] flex-shrink-0"
            >
              <X className="h-5 w-5 text-[#6B7280] stroke-[2]" />
            </Button>
          </div>
        </DialogHeader>

        {/* Contenido - Imagen: ocupa el resto del modal, sin scroll; la imagen se adapta al ancho y alto */}
        <div className="flex-1 min-h-0 p-8 flex items-center justify-center bg-[#F9FAFB] overflow-hidden">
          <div className="w-full h-full flex items-center justify-center min-w-0 min-h-0">
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
