import type { UpdateEvolucionData } from '@/services/evoluciones.service';
import type { Evolucion } from '@/types';
import { EvolucionModal } from './EvolucionModal';

interface EditEvolucionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  evolucion: Evolucion | null;
  onSubmit: (id: string, data: UpdateEvolucionData) => Promise<void>;
  /** Si esta evolución fue corregida por otra posterior */
  fueCorregida?: boolean;
  /** Evolución que corrigió a esta (para enlace "Corregida por") */
  corregidaPorEvolucion?: Evolucion | null;
  /** Al hacer clic en "Corregida por" para ir a la evolución que la corrigió */
  onVerEvolucionCorrectora?: (evolucionId: string) => void;
  isSubmitting?: boolean;
}

export function EditEvolucionModal({
  open,
  onOpenChange,
  evolucion,
  onSubmit,
  fueCorregida = false,
  corregidaPorEvolucion = null,
  onVerEvolucionCorrectora,
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
      fueCorregida={fueCorregida}
      corregidaPorEvolucion={corregidaPorEvolucion}
      onVerEvolucionCorrectora={onVerEvolucionCorrectora}
      isSubmitting={isSubmitting}
    />
  );
}
