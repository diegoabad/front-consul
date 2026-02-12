import type { Evolucion } from '@/types';
import { EvolucionModal } from './EvolucionModal';

interface ViewEvolucionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  evolucion: Evolucion | null;
  /** Al hacer clic en "Ver evolución anterior" */
  onVerEvolucionAnterior?: (evolucionAnteriorId: string) => void;
  /** Si esta evolución fue corregida por otra posterior */
  fueCorregida?: boolean;
  /** Evolución que corrigió a esta (para enlace "Corregida por") */
  corregidaPorEvolucion?: Evolucion | null;
  /** Al hacer clic en "Corregida por" para ir a la evolución que la corrigió */
  onVerEvolucionCorrectora?: (evolucionId: string) => void;
}

export function ViewEvolucionModal({
  open,
  onOpenChange,
  evolucion,
  onVerEvolucionAnterior,
  fueCorregida = false,
  corregidaPorEvolucion = null,
  onVerEvolucionCorrectora,
}: ViewEvolucionModalProps) {
  return (
    <EvolucionModal
      mode="view"
      open={open}
      onOpenChange={onOpenChange}
      pacienteId={evolucion?.paciente_id ?? ''}
      evolucion={evolucion}
      onVerEvolucionAnterior={onVerEvolucionAnterior}
      fueCorregida={fueCorregida}
      corregidaPorEvolucion={corregidaPorEvolucion}
      onVerEvolucionCorrectora={onVerEvolucionCorrectora}
    />
  );
}
