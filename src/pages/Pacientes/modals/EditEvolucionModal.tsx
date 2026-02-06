import type { UpdateEvolucionData } from '@/services/evoluciones.service';
import type { Evolucion } from '@/types';
import { EvolucionModal } from './EvolucionModal';

interface EditEvolucionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  evolucion: Evolucion | null;
  onSubmit: (id: string, data: UpdateEvolucionData) => Promise<void>;
  isSubmitting?: boolean;
}

export function EditEvolucionModal({
  open,
  onOpenChange,
  evolucion,
  onSubmit,
  isSubmitting = false,
}: EditEvolucionModalProps) {
  return (
    <EvolucionModal
      mode="edit"
      open={open}
      onOpenChange={onOpenChange}
      pacienteId={evolucion?.paciente_id ?? ''}
      evolucion={evolucion}
      onSubmitEdit={onSubmit}
      isSubmitting={isSubmitting}
    />
  );
}
