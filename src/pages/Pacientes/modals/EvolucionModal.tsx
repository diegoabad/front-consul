import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Stethoscope, Loader2, User, FileText, Pill, Calendar } from 'lucide-react';
import { profesionalesService } from '@/services/profesionales.service';
import { useQuery } from '@tanstack/react-query';
import type { CreateEvolucionData, UpdateEvolucionData } from '@/services/evoluciones.service';
import { useAuth } from '@/contexts/AuthContext';
import { formatDisplayText, formatEvolucionDateTime } from '@/lib/utils';
import type { Evolucion } from '@/types';

export type EvolucionModalMode = 'create' | 'view' | 'edit';

export interface EvolucionModalProps {
  mode: EvolucionModalMode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pacienteId: string;
  evolucion: Evolucion | null;
  onSubmitCreate?: (data: CreateEvolucionData) => Promise<void>;
  onSubmitEdit?: (id: string, data: UpdateEvolucionData) => Promise<void>;
  isSubmitting?: boolean;
}

const initialFormData: CreateEvolucionData = {
  paciente_id: '',
  profesional_id: '',
  fecha_consulta: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
  motivo_consulta: '',
  diagnostico: '',
  tratamiento: '',
  observaciones: '',
};

export function EvolucionModal({
  mode,
  open,
  onOpenChange,
  pacienteId,
  evolucion,
  onSubmitCreate,
  onSubmitEdit,
  isSubmitting = false,
}: EvolucionModalProps) {
  const { user } = useAuth();
  const [formData, setFormData] = useState<CreateEvolucionData & { fecha_consulta_edit?: string }>(initialFormData);
  const [activeTab, setActiveTab] = useState('evolucion');

  const { data: profesionalesData = [] } = useQuery({
    queryKey: ['profesionales', 'for-evoluciones', mode],
    queryFn: () => profesionalesService.getAll({ bloqueado: false }),
    enabled: open && (mode === 'create' || mode === 'edit'),
  });
  const profesionales = Array.isArray(profesionalesData) ? profesionalesData : [];

  const profesionalLogueado = profesionales.find(p => p.usuario_id === user?.id);
  const isProfesional = user?.rol === 'profesional';
  const isView = mode === 'view';
  const isEdit = mode === 'edit';
  const isCreate = mode === 'create';

  useEffect(() => {
    if (open) {
      if (isCreate) {
        setFormData(() => ({ ...initialFormData, paciente_id: pacienteId }));
        setActiveTab('evolucion');
      } else if (evolucion) {
        if (isEdit) {
          const fechaConsulta = evolucion.fecha_consulta
            ? format(new Date(evolucion.fecha_consulta), "yyyy-MM-dd'T'HH:mm")
            : format(new Date(), "yyyy-MM-dd'T'HH:mm");
          setFormData({
            paciente_id: evolucion.paciente_id,
            profesional_id: evolucion.profesional_id || '',
            fecha_consulta: fechaConsulta,
            motivo_consulta: evolucion.motivo_consulta || '',
            diagnostico: evolucion.diagnostico || '',
            tratamiento: evolucion.tratamiento || '',
            observaciones: evolucion.observaciones || '',
          });
        }
        setActiveTab('evolucion');
      }
    }
  }, [open, pacienteId, evolucion, isCreate, isEdit]);

  useEffect(() => {
    if (open && isCreate && isProfesional && profesionalLogueado) {
      setFormData(prev => ({ ...prev, profesional_id: profesionalLogueado.id }));
    }
  }, [open, isCreate, isProfesional, profesionalLogueado]);

  useEffect(() => {
    if (open && isEdit && isProfesional && profesionalLogueado && evolucion) {
      setFormData(prev => ({ ...prev, profesional_id: profesionalLogueado.id }));
    }
  }, [open, isEdit, isProfesional, profesionalLogueado, evolucion]);

  const handleSubmit = async () => {
    try {
      if (isCreate && onSubmitCreate) {
        const dataToSubmit: CreateEvolucionData = {
          ...formData,
          fecha_consulta: new Date().toISOString(),
          motivo_consulta: formData.motivo_consulta?.trim() || undefined,
          diagnostico: formData.diagnostico?.trim() || undefined,
          tratamiento: formData.tratamiento?.trim() || undefined,
          observaciones: formData.observaciones?.trim() || undefined,
        };
        await onSubmitCreate(dataToSubmit);
        setFormData(initialFormData);
        onOpenChange(false);
      } else if (isEdit && evolucion && onSubmitEdit) {
        // El backend no permite cambiar profesional_id ni fecha_consulta al editar; solo contenido.
        const dataToSubmit: UpdateEvolucionData = {
          motivo_consulta: formData.motivo_consulta?.trim() || undefined,
          diagnostico: formData.diagnostico?.trim() || undefined,
          tratamiento: formData.tratamiento?.trim() || undefined,
          observaciones: formData.observaciones?.trim() || undefined,
        };
        await onSubmitEdit(evolucion.id, dataToSubmit);
        onOpenChange(false);
      }
    } catch {
      // Error handling is done in the parent component
    }
  };

  const handleCancel = () => {
    setFormData(initialFormData);
    setActiveTab('evolucion');
    onOpenChange(false);
  };

  const isFormValid = isCreate
    ? (formData.observaciones?.trim().length ?? 0) > 0
    : isEdit
      ? !!formData.fecha_consulta
      : true;

  if ((isView || isEdit) && !evolucion) return null;

  const title =
    mode === 'create'
      ? 'Nueva evolución'
      : mode === 'view'
        ? 'Evolución clínica'
        : 'Editar evolución clínica';
  const description =
    mode === 'create'
      ? 'Complete la información de la evolución clínica del paciente'
      : mode === 'view'
        ? 'Detalle de la evolución clínica del paciente'
        : 'Actualizar la información de la evolución clínica del paciente';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[1100px] h-[90vh] max-h-[90vh] max-lg:max-h-[85vh] max-lg:h-[85vh] rounded-[20px] p-0 border border-[#E5E7EB] shadow-2xl flex flex-col overflow-hidden">
        {/* Header fijo */}
        <DialogHeader className="px-8 max-lg:px-4 pt-8 max-lg:pt-5 pb-4 max-lg:pb-3 border-b border-[#E5E7EB] bg-gradient-to-b from-white to-[#F9FAFB] flex-shrink-0 mb-0">
          <div className="flex items-center gap-4">
            <div className="max-lg:hidden h-14 w-14 rounded-full bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] flex items-center justify-center shadow-lg shadow-[#2563eb]/30 flex-shrink-0">
              <Stethoscope className="h-7 w-7 text-white stroke-[2.5]" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-[32px] max-lg:text-[22px] font-bold text-[#111827] font-['Poppins'] leading-tight mb-0">
                {title}
              </DialogTitle>
              <DialogDescription className="text-base max-lg:text-sm text-[#6B7280] font-['Inter'] mt-1.5 mb-0 max-lg:mt-1">
                {description}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Profesional y (en view/edit) Fecha y hora */}
        <div className="px-8 max-lg:px-4 pb-4 max-lg:pb-3 border-b border-[#E5E7EB] bg-white flex-shrink-0">
          <div className={`max-w-4xl ${isView && evolucion ? 'grid grid-cols-1 md:grid-cols-2 gap-6' : ''}`}>
            <div className={isCreate ? 'max-w-4xl' : ''}>
              <Label className="text-[15px] font-medium text-[#374151] font-['Inter'] flex items-center gap-2">
                <User className="h-4 w-4 text-[#6B7280] stroke-[2]" />
                Profesional
              </Label>
              {isView && evolucion ? (
                <div className="h-[52px] border-[1.5px] border-[#D1D5DB] rounded-[10px] font-['Inter'] text-[16px] px-4 flex items-center bg-[#F9FAFB] text-[#374151] mt-2">
                  {evolucion.profesional_nombre} {evolucion.profesional_apellido}
                </div>
              ) : (
                <Select
                  value={formData.profesional_id}
                  onValueChange={(value) => setFormData({ ...formData, profesional_id: value })}
                  disabled={isProfesional}
                >
                  <SelectTrigger className="h-[52px] border-[1.5px] border-[#D1D5DB] rounded-[10px] font-['Inter'] text-[16px] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200 mt-2">
                    <SelectValue placeholder="Seleccionar profesional" />
                  </SelectTrigger>
                  <SelectContent className="rounded-[12px] border-[#E5E7EB] shadow-xl max-h-[300px]">
                    {profesionales.map((prof) => (
                      <SelectItem key={prof.id} value={prof.id} className="rounded-[8px] font-['Inter'] text-[15px] py-3">
                        {formatDisplayText(prof.nombre)} {formatDisplayText(prof.apellido)} {prof.especialidad ? `- ${formatDisplayText(prof.especialidad)}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            {/* Fecha y hora: solo en view (al editar no se muestra ni se modifica) */}
            {isView && evolucion ? (
              <div className="space-y-2">
                <Label className="text-[15px] font-medium text-[#374151] font-['Inter'] flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-[#6B7280] stroke-[2]" />
                  Fecha y hora de consulta
                </Label>
                <div className="h-[52px] border-[1.5px] border-[#D1D5DB] rounded-[10px] font-['Inter'] text-[16px] px-4 flex items-center bg-[#F9FAFB] text-[#374151]">
                  {formatEvolucionDateTime(evolucion.fecha_consulta)}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* Tabs y Contenido */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <div className="px-8 max-lg:px-4 pb-4 max-lg:pb-3 bg-white border-b border-[#E5E7EB] flex-shrink-0 min-w-0">
            <TabsList className="flex h-12 max-lg:h-14 items-center rounded-[12px] bg-[#F9FAFB] p-1.5 border border-[#E5E7EB] w-full gap-1.5 max-lg:overflow-x-auto max-lg:overflow-y-hidden max-lg:flex-nowrap max-lg:justify-start">
              <TabsTrigger
                value="evolucion"
                className="relative flex-1 max-lg:flex-none max-lg:shrink-0 inline-flex items-center justify-center whitespace-nowrap rounded-[10px] px-4 py-2.5 max-lg:px-4 max-lg:py-3 max-lg:text-[15px] text-[13px] font-medium font-['Inter'] ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-[#2563eb] data-[state=active]:text-white data-[state=active]:shadow-sm text-[#6B7280] hover:text-[#374151] min-w-0"
              >
                <FileText className="h-4 w-4 mr-2 max-lg:hidden stroke-[2] flex-shrink-0 [&[data-state=active]]:text-white" />
                <span className="truncate">Evolución</span>
                {isCreate && <span className="text-[#EF4444] ml-1">*</span>}
              </TabsTrigger>
              <TabsTrigger
                value="motivo"
                className="relative flex-1 max-lg:flex-none max-lg:shrink-0 inline-flex items-center justify-center whitespace-nowrap rounded-[10px] px-4 py-2.5 max-lg:px-4 max-lg:py-3 max-lg:text-[15px] text-[13px] font-medium font-['Inter'] ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-[#2563eb] data-[state=active]:text-white data-[state=active]:shadow-sm text-[#6B7280] hover:text-[#374151] min-w-0"
              >
                <FileText className="h-4 w-4 mr-2 max-lg:hidden stroke-[2] flex-shrink-0 [&[data-state=active]]:text-white" />
                <span className="truncate">Motivo</span>
              </TabsTrigger>
              <TabsTrigger
                value="diagnostico"
                className="relative flex-1 max-lg:flex-none max-lg:shrink-0 inline-flex items-center justify-center whitespace-nowrap rounded-[10px] px-4 py-2.5 max-lg:px-4 max-lg:py-3 max-lg:text-[15px] text-[13px] font-medium font-['Inter'] ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-[#2563eb] data-[state=active]:text-white data-[state=active]:shadow-sm text-[#6B7280] hover:text-[#374151] min-w-0"
              >
                <Stethoscope className="h-4 w-4 mr-2 max-lg:hidden stroke-[2] flex-shrink-0 [&[data-state=active]]:text-white" />
                <span className="truncate">Diagnóstico</span>
              </TabsTrigger>
              <TabsTrigger
                value="tratamiento"
                className="relative flex-1 max-lg:flex-none max-lg:shrink-0 inline-flex items-center justify-center whitespace-nowrap rounded-[10px] px-4 py-2.5 max-lg:px-4 max-lg:py-3 max-lg:text-[15px] text-[13px] font-medium font-['Inter'] ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-[#2563eb] data-[state=active]:text-white data-[state=active]:shadow-sm text-[#6B7280] hover:text-[#374151] min-w-0"
              >
                <Pill className="h-4 w-4 mr-2 max-lg:hidden stroke-[2] flex-shrink-0 [&[data-state=active]]:text-white" />
                <span className="truncate">Tratamiento</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {/* Tab Evolución */}
            <div className={`flex-1 min-h-0 flex flex-col overflow-hidden ${activeTab === 'evolucion' ? 'flex' : 'hidden'}`}>
              <div className="flex-1 min-h-0 flex flex-col px-8 max-lg:px-4 py-6 max-lg:py-4">
                {isView && evolucion ? (
                  <div className="flex-1 min-h-0 w-full border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[16px] max-lg:text-[17px] font-['Inter'] p-4 bg-[#F9FAFB] overflow-y-auto">
                    <p className="text-[#374151] whitespace-pre-wrap leading-relaxed">
                      {evolucion.observaciones || 'No hay información registrada'}
                    </p>
                  </div>
                ) : (
                  <Textarea
                    id="observaciones"
                    value={formData.observaciones}
                    onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                    placeholder="Ej: Paciente colaborador durante la consulta..."
                    className="flex-1 min-h-0 w-full border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[16px] max-lg:text-[17px] font-['Inter'] placeholder:text-[#9CA3AF] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 resize-none transition-all duration-200 leading-relaxed overflow-y-auto"
                    readOnly={isView}
                  />
                )}
              </div>
            </div>
            {/* Tab Motivo */}
            <div className={`flex-1 min-h-0 flex flex-col overflow-hidden ${activeTab === 'motivo' ? 'flex' : 'hidden'}`}>
              <div className="flex-1 min-h-0 flex flex-col px-8 max-lg:px-4 py-6 max-lg:py-4">
                {isView && evolucion ? (
                  <div className="flex-1 min-h-0 w-full border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[16px] max-lg:text-[17px] font-['Inter'] p-4 bg-[#F9FAFB] overflow-y-auto">
                    <p className="text-[#374151] whitespace-pre-wrap leading-relaxed">
                      {evolucion.motivo_consulta || 'No hay información registrada'}
                    </p>
                  </div>
                ) : (
                  <Textarea
                    id="motivo_consulta"
                    value={formData.motivo_consulta}
                    onChange={(e) => setFormData({ ...formData, motivo_consulta: e.target.value })}
                    placeholder="Ej: Paciente refiere dolor de cabeza..."
                    className="flex-1 min-h-0 w-full border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[16px] max-lg:text-[17px] font-['Inter'] placeholder:text-[#9CA3AF] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 resize-none transition-all duration-200 leading-relaxed overflow-y-auto"
                    readOnly={isView}
                  />
                )}
              </div>
            </div>
            {/* Tab Diagnóstico */}
            <div className={`flex-1 min-h-0 flex flex-col overflow-hidden ${activeTab === 'diagnostico' ? 'flex' : 'hidden'}`}>
              <div className="flex-1 min-h-0 flex flex-col px-8 max-lg:px-4 py-6 max-lg:py-4">
                {isView && evolucion ? (
                  <div className="flex-1 min-h-0 w-full border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[16px] max-lg:text-[17px] font-['Inter'] p-4 bg-[#F9FAFB] overflow-y-auto">
                    <p className="text-[#374151] whitespace-pre-wrap leading-relaxed">
                      {evolucion.diagnostico || 'No hay información registrada'}
                    </p>
                  </div>
                ) : (
                  <Textarea
                    id="diagnostico"
                    value={formData.diagnostico}
                    onChange={(e) => setFormData({ ...formData, diagnostico: e.target.value })}
                    placeholder="Ej: Migraña común sin aura..."
                    className="flex-1 min-h-0 w-full border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[16px] max-lg:text-[17px] font-['Inter'] placeholder:text-[#9CA3AF] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 resize-none transition-all duration-200 leading-relaxed overflow-y-auto"
                    readOnly={isView}
                  />
                )}
              </div>
            </div>
            {/* Tab Tratamiento */}
            <div className={`flex-1 min-h-0 flex flex-col overflow-hidden ${activeTab === 'tratamiento' ? 'flex' : 'hidden'}`}>
              <div className="flex-1 min-h-0 flex flex-col px-8 max-lg:px-4 py-6 max-lg:py-4">
                {isView && evolucion ? (
                  <div className="flex-1 min-h-0 w-full border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[16px] max-lg:text-[17px] font-['Inter'] p-4 bg-[#F9FAFB] overflow-y-auto">
                    <p className="text-[#374151] whitespace-pre-wrap leading-relaxed">
                      {evolucion.tratamiento || 'No hay información registrada'}
                    </p>
                  </div>
                ) : (
                  <Textarea
                    id="tratamiento"
                    value={formData.tratamiento}
                    onChange={(e) => setFormData({ ...formData, tratamiento: e.target.value })}
                    placeholder="Ej: 1) Ibuprofeno 400mg..."
                    className="flex-1 min-h-0 w-full border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[16px] max-lg:text-[17px] font-['Inter'] placeholder:text-[#9CA3AF] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 resize-none transition-all duration-200 leading-relaxed overflow-y-auto"
                    readOnly={isView}
                  />
                )}
              </div>
            </div>
          </div>
        </Tabs>

        {/* Footer */}
        {isView ? (
          <div className="px-8 max-lg:px-4 py-5 max-lg:py-4 border-t border-[#E5E7EB] bg-[#F9FAFB] flex flex-row justify-end items-center gap-3 flex-shrink-0 mt-0">
            <Button
              type="button"
              onClick={() => onOpenChange(false)}
              className="h-[48px] max-lg:h-12 max-lg:w-full px-6 rounded-[12px] border-[1.5px] border-[#D1D5DB] font-medium font-['Inter'] text-[15px] hover:bg-white hover:border-[#9CA3AF] transition-all duration-200"
            >
              Cerrar
            </Button>
          </div>
        ) : (
          <DialogFooter className="px-8 max-lg:px-4 py-5 max-lg:py-4 border-t border-[#E5E7EB] bg-[#F9FAFB] flex flex-row max-lg:flex-col justify-end items-center gap-3 flex-shrink-0 mt-0">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              className="h-[48px] max-lg:h-12 max-lg:w-full px-6 rounded-[12px] border-[1.5px] border-[#D1D5DB] font-medium font-['Inter'] text-[15px] hover:bg-white hover:border-[#9CA3AF] transition-all duration-200"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !isFormValid}
              className="h-[48px] max-lg:h-12 max-lg:w-full px-8 rounded-[12px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-lg shadow-[#2563eb]/30 hover:shadow-xl hover:shadow-[#2563eb]/40 hover:scale-[1.02] max-lg:hover:scale-100 font-semibold font-['Inter'] text-[15px] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 max-lg:hidden h-5 w-5 animate-spin stroke-[2.5]" />
                  Guardando...
                </>
              ) : isCreate ? (
                'Crear Evolución'
              ) : (
                'Guardar Cambios'
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
