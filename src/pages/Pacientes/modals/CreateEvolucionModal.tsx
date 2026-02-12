import type { CreateEvolucionData } from '@/services/evoluciones.service';
import type { Evolucion } from '@/types';
import { EvolucionModal } from './EvolucionModal';

interface CreateEvolucionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pacienteId: string;
  /** Lista de evoluciones del paciente para poder marcar la nueva como corrección de una anterior */
  evolucionesParaCorreccion?: Evolucion[];
  onSubmit: (data: CreateEvolucionData) => Promise<void>;
  isSubmitting?: boolean;
}

export function CreateEvolucionModal({
  open,
  onOpenChange,
  pacienteId,
  evolucionesParaCorreccion = [],
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
      evolucionesParaCorreccion={evolucionesParaCorreccion}
      onSubmitCreate={onSubmit}
      isSubmitting={isSubmitting}
    />
  );
}
