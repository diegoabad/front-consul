import type { Nota } from '@/types';
import { NotaModal } from './NotaModal';

interface ViewNotaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nota: Nota | null;
}

export function ViewNotaModal({
  open,
  onOpenChange,
  nota,
}: ViewNotaModalProps) {
  return (
    <NotaModal
      mode="view"
      open={open}
      onOpenChange={onOpenChange}
      pacienteId={nota?.paciente_id ?? ''}
      nota={nota}
    />
  );
}
