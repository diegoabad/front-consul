import type { CreateNotaData } from '@/services/notas.service';
import { NotaModal } from './NotaModal';

interface CreateNotaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pacienteId: string;
  onSubmit: (data: CreateNotaData) => Promise<void>;
  isSubmitting?: boolean;
}

export function CreateNotaModal({
  open,
  onOpenChange,
  pacienteId,
  onSubmit,
  isSubmitting = false,
}: CreateNotaModalProps) {
  return (
    <NotaModal
      mode="create"
      open={open}
      onOpenChange={onOpenChange}
      pacienteId={pacienteId}
      nota={null}
      onSubmitCreate={onSubmit}
      isSubmitting={isSubmitting}
    />
  );
}
