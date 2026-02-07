import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Loader2, Trash2 } from 'lucide-react';

export interface ConfirmDeleteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  onConfirm: () => void | Promise<void>;
  isLoading?: boolean;
  /** Si true, el botón de confirmar queda deshabilitado (solo se puede cancelar). */
  confirmDisabled?: boolean;
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
  confirmDisabled = false,
  confirmLabel = 'Eliminar',
  loadingLabel = 'Eliminando...',
}: ConfirmDeleteModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md min-h-[280px] rounded-[20px] border border-[#E5E7EB] shadow-2xl gap-0 p-6 overflow-x-hidden min-w-0">
        <DialogHeader className="pb-4 mb-0 border-b border-[#E5E7EB]">
          <DialogTitle className="text-[24px] font-bold text-[#111827] font-['Poppins'] mb-0">
            {title}
          </DialogTitle>
        </DialogHeader>
        <div className="mt-5 mb-1 min-w-0">
          <DialogDescription asChild>
            <div className="text-base text-[#6B7280] font-['Inter'] leading-relaxed break-words">
              {description}
            </div>
          </DialogDescription>
        </div>
        <DialogFooter className="flex flex-row justify-end gap-3 mt-5 pt-4 border-t border-[#E5E7EB] min-w-0 flex-wrap">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            className="h-[48px] px-6 rounded-[12px] font-medium font-['Inter'] text-[15px] shrink-0"
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={() => void onConfirm()}
            disabled={isLoading || confirmDisabled}
            className="h-[48px] min-w-0 px-6 rounded-[12px] font-semibold font-['Inter'] text-[15px] inline-flex items-center justify-center gap-2 overflow-hidden"
          >
            <Loader2 className={cn("h-5 w-5 shrink-0", isLoading ? "animate-spin stroke-[2.5]" : "hidden")} />
            <Trash2 className={cn("h-5 w-5 shrink-0 stroke-[2]", isLoading ? "hidden" : "")} />
            <span className="truncate">{isLoading ? loadingLabel : confirmLabel}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
