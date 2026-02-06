import type { Evolucion } from '@/types';
import { EvolucionModal } from './EvolucionModal';

interface ViewEvolucionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  evolucion: Evolucion | null;
}

export function ViewEvolucionModal({
  open,
  onOpenChange,
  evolucion,
}: ViewEvolucionModalProps) {
  return (
    <EvolucionModal
      mode="view"
      open={open}
      onOpenChange={onOpenChange}
      pacienteId={evolucion?.paciente_id ?? ''}
      evolucion={evolucion}
    />
  );
}
