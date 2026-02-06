import type { UpdateNotaData } from '@/services/notas.service';
import type { Nota } from '@/types';
import { NotaModal } from './NotaModal';

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
  return (
    <NotaModal
      mode="edit"
      open={open}
      onOpenChange={onOpenChange}
      pacienteId={nota?.paciente_id ?? ''}
      nota={nota}
      onSubmitEdit={onSubmit}
      isSubmitting={isSubmitting}
    />
  );
}
