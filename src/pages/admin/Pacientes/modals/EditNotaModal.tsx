import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { StickyNote, Loader2, FileText } from 'lucide-react';
import type { UpdateNotaData } from '@/services/notas.service';
import type { Nota } from '@/types';

interface EditNotaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nota: Nota | null;
  onSubmit: (id: string, data: UpdateNotaData) => Promise<void>;
  isSubmitting?: boolean;
}

export function EditNotaModal({
  open,
  onOpenChange,
  nota,
  onSubmit,
  isSubmitting = false,
}: EditNotaModalProps) {
  const [contenido, setContenido] = useState('');

  useEffect(() => {
    if (open && nota) {
      setContenido(nota.contenido || '');
    }
  }, [open, nota]);

  const handleSubmit = async () => {
    if (!nota) return;
    
    try {
      const dataToSubmit: UpdateNotaData = {
        contenido: contenido.trim(),
      };
      
      await onSubmit(nota.id, dataToSubmit);
      onOpenChange(false);
    } catch (error) {
      // Error handling is done in the parent component
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  const isFormValid = contenido.trim();

  if (!nota) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[900px] h-[90vh] max-h-[90vh] rounded-[20px] p-0 border border-[#E5E7EB] shadow-2xl flex flex-col overflow-hidden">
        {/* Header fijo */}
        <DialogHeader className="px-8 pt-8 pb-6 border-b border-[#E5E7EB] bg-gradient-to-b from-white to-[#F9FAFB] flex-shrink-0 mb-0">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#6D28D9] flex items-center justify-center shadow-lg shadow-[#7C3AED]/30">
              <StickyNote className="h-7 w-7 text-white stroke-[2.5]" />
            </div>
            <div>
              <DialogTitle className="text-[32px] font-bold text-[#111827] font-['Poppins'] leading-tight mb-0">
                Editar Nota
              </DialogTitle>
              <DialogDescription className="text-base text-[#6B7280] font-['Inter'] mt-1.5 mb-0">
                Actualizar el contenido de la nota
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Contenido sin scroll */}
        <div className="flex-1 min-h-0 h-full px-8 pt-6 pb-4 flex flex-col">
          {/* Sección: Contenido */}
          <div className="flex-1 flex flex-col min-h-0 h-full">
            <Label htmlFor="edit-contenido" className="text-[15px] font-medium text-[#374151] font-['Inter'] flex items-center gap-2 mb-3 flex-shrink-0">
              <FileText className="h-4 w-4 text-[#6B7280] stroke-[2]" />
              Contenido
              <span className="text-[#EF4444]">*</span>
            </Label>
            <div className="flex-1 flex flex-col min-h-0 h-full">
              <Textarea
                id="edit-contenido"
                value={contenido}
                onChange={(e) => setContenido(e.target.value)}
                placeholder="Ej: Paciente mostró buen nivel de compromiso con el tratamiento. Familiar reporta mejoría en hábitos de sueño. Importante recordar seguimiento en próxima sesión..."
                className="flex-1 min-h-[200px] max-h-none border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[16px] font-['Inter'] placeholder:text-[#9CA3AF] focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20 resize-none transition-all duration-200 leading-relaxed w-full h-full"
              />
              <div className="flex items-center justify-between mt-3 flex-shrink-0">
                <p className="text-xs text-[#6B7280] font-['Inter']">
                  {contenido.length} caracteres
                </p>
                {contenido.trim().length > 0 && (
                  <p className="text-xs text-[#10B981] font-['Inter'] font-medium">
                    ✓ Contenido agregado
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer fijo */}
        <DialogFooter className="px-8 py-5 border-t border-[#E5E7EB] bg-[#F9FAFB] flex flex-row justify-end items-center gap-3 flex-shrink-0 mt-0">
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              className="h-[48px] px-6 rounded-[12px] border-[1.5px] border-[#D1D5DB] font-medium font-['Inter'] text-[15px] hover:bg-white hover:border-[#9CA3AF] transition-all duration-200"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !isFormValid}
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
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
