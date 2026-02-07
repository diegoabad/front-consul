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
import { StickyNote, Loader2, User, FileText } from 'lucide-react';
import type { CreateNotaData, UpdateNotaData } from '@/services/notas.service';
import { useAuth } from '@/contexts/AuthContext';
import { formatDisplayText } from '@/lib/utils';
import type { Nota } from '@/types';

export type NotaModalMode = 'create' | 'edit' | 'view';

export interface NotaModalProps {
  mode: NotaModalMode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pacienteId: string;
  nota: Nota | null;
  onSubmitCreate?: (data: CreateNotaData) => Promise<void>;
  onSubmitEdit?: (id: string, data: UpdateNotaData) => Promise<void>;
  isSubmitting?: boolean;
}

const initialFormData: CreateNotaData = {
  paciente_id: '',
  usuario_id: '',
  contenido: '',
};

export function NotaModal({
  mode,
  open,
  onOpenChange,
  pacienteId,
  nota,
  onSubmitCreate,
  onSubmitEdit,
  isSubmitting = false,
}: NotaModalProps) {
  const { user } = useAuth();
  const [formData, setFormData] = useState(initialFormData);
  const isEdit = mode === 'edit';
  const isCreate = mode === 'create';
  const isView = mode === 'view';

  useEffect(() => {
    if (open) {
      if (isCreate) {
        setFormData({
          paciente_id: pacienteId,
          usuario_id: user?.id || '',
          contenido: '',
        });
      } else if ((isEdit || isView) && nota) {
        setFormData({
          paciente_id: nota.paciente_id,
          usuario_id: nota.usuario_id,
          contenido: nota.contenido || '',
        });
      }
    }
  }, [open, pacienteId, nota, isCreate, isEdit, isView, user?.id]);

  const handleSubmit = async () => {
    try {
      if (isCreate && onSubmitCreate) {
        await onSubmitCreate({
          paciente_id: pacienteId,
          usuario_id: user?.id || '',
          contenido: formData.contenido.trim(),
        });
        setFormData(initialFormData);
        onOpenChange(false);
      } else if (isEdit && nota && onSubmitEdit) {
        await onSubmitEdit(nota.id, { contenido: formData.contenido.trim() });
        onOpenChange(false);
      }
    } catch {
      // Error handling in parent
    }
  };

  const handleCancel = () => {
    setFormData(initialFormData);
    onOpenChange(false);
  };

  const isFormValid = !!user?.id && formData.contenido.trim().length > 0;

  if ((isEdit || isView) && !nota) return null;

  const title = isCreate ? 'Nueva Nota' : isView ? 'Ver Nota' : 'Editar Nota';
  const description = isCreate
    ? 'Crear una nueva nota confidencial para este paciente'
    : isView
      ? 'Contenido de la nota'
      : 'Actualizar el contenido de la nota';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[900px] w-full h-[90vh] max-h-[90vh] max-lg:max-h-[90dvh] max-lg:h-[90dvh] max-lg:w-full max-lg:rounded-[16px] rounded-[20px] p-0 border border-[#E5E7EB] shadow-2xl flex flex-col overflow-hidden">
        <DialogHeader className="px-8 max-lg:px-4 pt-8 max-lg:pt-5 pb-4 max-lg:pb-3 border-b border-[#E5E7EB] bg-gradient-to-b from-white to-[#F9FAFB] flex-shrink-0 mb-0">
          <div className="flex items-center gap-4">
            <div className="max-lg:hidden h-14 w-14 rounded-full bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] flex items-center justify-center shadow-lg shadow-[#2563eb]/30 flex-shrink-0">
              <StickyNote className="h-7 w-7 text-white stroke-[2.5]" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-[32px] max-lg:text-[22px] font-bold text-[#111827] font-['Poppins'] leading-tight mb-0">
                {title}
              </DialogTitle>
              <DialogDescription className="text-base max-lg:text-sm text-[#6B7280] font-['Inter'] mt-1.5 mb-0 max-lg:mt-1">
                {description}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 flex flex-col px-8 max-lg:px-4 py-6 max-lg:py-4 overflow-hidden">
          {(isCreate || isView) && (
            <div className="space-y-2 flex-shrink-0 mb-4 max-lg:mb-3">
              <Label className="text-[15px] font-medium text-[#374151] font-['Inter'] flex items-center gap-2">
                <User className="h-4 w-4 text-[#6B7280] stroke-[2]" />
                Creador de la nota
              </Label>
              <div className="h-[52px] flex items-center px-4 border-[1.5px] border-[#E5E7EB] rounded-[10px] bg-[#F9FAFB] font-['Inter'] text-[16px] text-[#374151]">
                {isCreate && user
                  ? `${formatDisplayText(user.nombre)} ${formatDisplayText(user.apellido)}`
                  : nota
                    ? `${formatDisplayText(nota.usuario_nombre)} ${formatDisplayText(nota.usuario_apellido)}${nota.especialidad ? ` — ${formatDisplayText(nota.especialidad)}` : ''}`
                    : '—'}
              </div>
            </div>
          )}

          <div className="flex-1 flex flex-col min-h-0 overflow-hidden basis-0">
            <Label htmlFor={isView ? undefined : 'contenido'} className="text-[15px] max-lg:text-[14px] font-medium text-[#374151] font-['Inter'] flex items-center gap-2 mb-3 flex-shrink-0">
              <FileText className="h-4 w-4 text-[#6B7280] stroke-[2]" />
              Contenido
              {!isView && <span className="text-[#EF4444]">*</span>}
            </Label>
            <div className="flex-1 min-h-[120px] flex flex-col overflow-hidden basis-0">
              {isView ? (
                <div className="flex-1 min-h-[120px] w-full border-[1.5px] border-[#E5E7EB] rounded-[10px] bg-[#F9FAFB] px-4 py-3 text-[16px] max-lg:text-[17px] font-['Inter'] text-[#374151] leading-relaxed overflow-y-auto whitespace-pre-wrap">
                  {formData.contenido || '—'}
                </div>
              ) : (
                <>
                  <Textarea
                    id="contenido"
                    value={formData.contenido}
                    onChange={(e) => setFormData({ ...formData, contenido: e.target.value })}
                    placeholder="Ej: Paciente mostró buen nivel de compromiso con el tratamiento..."
                    className="flex-1 min-h-[120px] w-full border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[16px] max-lg:text-[17px] font-['Inter'] placeholder:text-[#9CA3AF] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 resize-none leading-relaxed overflow-y-auto"
                  />
                  <div className="flex items-center mt-3 flex-shrink-0">
                    {formData.contenido.trim().length > 0 && (
                      <p className="text-xs text-[#10B981] font-['Inter'] font-medium">✓ Contenido agregado</p>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="px-8 max-lg:px-4 py-5 max-lg:py-4 border-t border-[#E5E7EB] bg-[#F9FAFB] flex flex-row max-lg:flex-col max-lg:gap-2 justify-end items-center gap-3 flex-shrink-0 mt-0">
          {isView ? (
            <Button
              type="button"
              onClick={() => onOpenChange(false)}
              className="h-[48px] max-lg:h-12 max-lg:w-full px-8 rounded-[12px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-lg shadow-[#2563eb]/30 font-semibold font-['Inter'] text-[15px] transition-all duration-200"
            >
              Cerrar
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                className="h-[48px] max-lg:h-12 max-lg:w-full px-6 rounded-[12px] border-[1.5px] border-[#D1D5DB] font-medium font-['Inter'] text-[15px] hover:bg-white hover:border-[#9CA3AF] transition-all duration-200"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || !isFormValid}
                className="h-[48px] max-lg:h-12 max-lg:w-full px-8 rounded-[12px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-lg shadow-[#2563eb]/30 font-semibold font-['Inter'] text-[15px] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed max-lg:hover:scale-100"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 max-lg:hidden h-5 w-5 animate-spin stroke-[2.5]" />
                    Guardando...
                  </>
                ) : isCreate ? (
                  'Crear Nota'
                ) : (
                  'Guardar Cambios'
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
