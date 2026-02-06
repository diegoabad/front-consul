import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Trash2 } from 'lucide-react';

export interface ConfirmDeleteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  onConfirm: () => void | Promise<void>;
  isLoading?: boolean;
  confirmLabel?: string;
  /** Texto del botón mientras carga (ej. "Desbloqueando..."). Si no se pasa, se usa "Eliminando...". */
  loadingLabel?: string;
}

/**
 * Modal genérico para confirmar eliminación.
 * Reutilizable en todas las páginas que necesiten confirmar antes de eliminar.
 */
export function ConfirmDeleteModal({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  isLoading = false,
  confirmLabel = 'Eliminar',
  loadingLabel = 'Eliminando...',
}: ConfirmDeleteModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md min-h-[280px] rounded-[20px] border border-[#E5E7EB] shadow-2xl gap-0 p-6">
        <DialogHeader className="pb-4 mb-0 border-b border-[#E5E7EB]">
          <DialogTitle className="text-[24px] font-bold text-[#111827] font-['Poppins'] mb-0">
            {title}
          </DialogTitle>
        </DialogHeader>
        <div className="mt-5 mb-1">
          <DialogDescription asChild>
            <div className="text-base text-[#6B7280] font-['Inter'] leading-relaxed">
              {description}
            </div>
          </DialogDescription>
        </div>
        <DialogFooter className="flex flex-row justify-end gap-3 mt-5 pt-4 border-t border-[#E5E7EB]">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            className="h-[48px] px-6 rounded-[12px] font-medium font-['Inter'] text-[15px]"
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={() => void onConfirm()}
            disabled={isLoading}
            className="h-[48px] px-8 rounded-[12px] font-semibold font-['Inter'] text-[15px]"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin stroke-[2.5]" />
                {loadingLabel}
              </>
            ) : (
              <>
                <Trash2 className="mr-2 h-5 w-5 stroke-[2]" />
                {confirmLabel}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
