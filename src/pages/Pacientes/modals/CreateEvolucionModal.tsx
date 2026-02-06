import type { CreateEvolucionData } from '@/services/evoluciones.service';
import { EvolucionModal } from './EvolucionModal';

interface CreateEvolucionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pacienteId: string;
  onSubmit: (data: CreateEvolucionData) => Promise<void>;
  isSubmitting?: boolean;
}

export function CreateEvolucionModal({
  open,
  onOpenChange,
  pacienteId,
  onSubmit,
  isSubmitting = false,
}: CreateEvolucionModalProps) {
  return (
    <EvolucionModal
      mode="create"
      open={open}
      onOpenChange={onOpenChange}
      pacienteId={pacienteId}
      evolucion={null}
      onSubmitCreate={onSubmit}
      isSubmitting={isSubmitting}
    />
  );
}
