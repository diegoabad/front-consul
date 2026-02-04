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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Stethoscope, Loader2, Calendar, User, FileText, Pill } from 'lucide-react';
import { profesionalesService } from '@/services/profesionales.service';
import { useQuery } from '@tanstack/react-query';
import type { CreateEvolucionData } from '@/services/evoluciones.service';
import { useAuth } from '@/contexts/AuthContext';

interface CreateEvolucionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pacienteId: string;
  onSubmit: (data: CreateEvolucionData) => Promise<void>;
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

export function CreateEvolucionModal({
  open,
  onOpenChange,
  pacienteId,
  onSubmit,
  isSubmitting = false,
}: CreateEvolucionModalProps) {
  const { user } = useAuth();
  const [formData, setFormData] = useState<CreateEvolucionData>(initialFormData);
  const [activeTab, setActiveTab] = useState('evolucion');

  const { data: profesionales = [] } = useQuery({
    queryKey: ['profesionales', 'for-evoluciones'],
    queryFn: () => profesionalesService.getAll({ bloqueado: false }),
    enabled: open,
  });

  // Buscar el profesional asociado al usuario logueado si es profesional
  const profesionalLogueado = profesionales.find(p => p.usuario_id === user?.id);
  const isProfesional = user?.rol === 'profesional';

  useEffect(() => {
    if (open) {
      setFormData(prev => ({
        ...prev,
        paciente_id: pacienteId,
        fecha_consulta: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      }));
      setActiveTab('evolucion');
    }
  }, [open, pacienteId]);

  // Actualizar profesional_id cuando se carguen los profesionales y el usuario sea profesional
  useEffect(() => {
    if (open && isProfesional && profesionalLogueado) {
      setFormData(prev => ({
        ...prev,
        profesional_id: profesionalLogueado.id,
      }));
    }
  }, [open, isProfesional, profesionalLogueado]);

  const handleSubmit = async () => {
    try {
      const fechaISO = new Date(formData.fecha_consulta).toISOString();
      const dataToSubmit: CreateEvolucionData = {
        ...formData,
        fecha_consulta: fechaISO,
        motivo_consulta: formData.motivo_consulta?.trim() || undefined,
        diagnostico: formData.diagnostico?.trim() || undefined,
        tratamiento: formData.tratamiento?.trim() || undefined,
        observaciones: formData.observaciones?.trim() || undefined,
      };
      
      await onSubmit(dataToSubmit);
      setFormData(initialFormData);
      onOpenChange(false);
    } catch {
      // Error handling is done in the parent component
    }
  };

  const handleCancel = () => {
    setFormData(initialFormData);
    setActiveTab('evolucion');
    onOpenChange(false);
  };

  const isFormValid = (formData.observaciones?.trim().length ?? 0) > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[1100px] h-[90vh] max-h-[90vh] rounded-[20px] p-0 border border-[#E5E7EB] shadow-2xl flex flex-col overflow-hidden">
        {/* Header fijo */}
        <DialogHeader className="px-8 pt-8 pb-4 border-b border-[#E5E7EB] bg-gradient-to-b from-white to-[#F9FAFB] flex-shrink-0 mb-0">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] flex items-center justify-center shadow-lg shadow-[#2563eb]/30">
              <Stethoscope className="h-7 w-7 text-white stroke-[2.5]" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-[32px] font-bold text-[#111827] font-['Poppins'] leading-tight mb-0">
                Nueva Evolución Clínica
              </DialogTitle>
              <DialogDescription className="text-base text-[#6B7280] font-['Inter'] mt-1.5 mb-0">
                Complete la información de la evolución clínica del paciente
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Campos de Fecha y Profesional - Arriba de las pestañas */}
        <div className="px-8 pb-4 border-b border-[#E5E7EB] bg-white flex-shrink-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
            <div className="space-y-3">
              <Label htmlFor="profesional" className="text-[15px] font-medium text-[#374151] font-['Inter'] flex items-center gap-2">
                <User className="h-4 w-4 text-[#6B7280] stroke-[2]" />
                Profesional
              </Label>
              <Select
                value={formData.profesional_id}
                onValueChange={(value) => setFormData({ ...formData, profesional_id: value })}
                disabled={isProfesional}
              >
                <SelectTrigger className="h-[52px] border-[1.5px] border-[#D1D5DB] rounded-[10px] font-['Inter'] text-[16px] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200">
                  <SelectValue placeholder="Seleccionar profesional" />
                </SelectTrigger>
                <SelectContent className="rounded-[12px] border-[#E5E7EB] shadow-xl max-h-[300px]">
                  {profesionales.map((prof) => (
                    <SelectItem key={prof.id} value={prof.id} className="rounded-[8px] font-['Inter'] text-[15px] py-3">
                      {prof.nombre} {prof.apellido} {prof.especialidad ? `- ${prof.especialidad}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label htmlFor="fecha_consulta" className="text-[15px] font-medium text-[#374151] font-['Inter'] flex items-center gap-2">
                <Calendar className="h-4 w-4 text-[#6B7280] stroke-[2]" />
                Fecha y Hora de Consulta
              </Label>
              <Input
                id="fecha_consulta"
                type="datetime-local"
                value={formData.fecha_consulta}
                onChange={(e) => setFormData({ ...formData, fecha_consulta: e.target.value })}
                required
                className="h-[52px] border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[16px] font-['Inter'] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200"
              />
            </div>
          </div>
        </div>

        {/* Tabs y Contenido */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          {/* TabsList */}
          <div className="px-8 pb-4 bg-white border-b border-[#E5E7EB] flex-shrink-0">
            <TabsList className="inline-flex h-12 items-center justify-center rounded-[12px] bg-[#F9FAFB] p-1.5 border border-[#E5E7EB] w-full gap-1.5">
              <TabsTrigger 
                value="evolucion"
                className="relative flex-1 inline-flex items-center justify-center whitespace-nowrap rounded-[10px] px-4 py-2.5 text-[13px] font-medium font-['Inter'] ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-[#2563eb] data-[state=active]:text-white data-[state=active]:shadow-sm text-[#6B7280] hover:text-[#374151] min-w-0"
              >
                <FileText className="h-4 w-4 mr-2 stroke-[2] flex-shrink-0 [&[data-state=active]]:text-white" />
                <span className="truncate">Evolución</span>
                <span className="text-[#EF4444] ml-1">*</span>
              </TabsTrigger>
              <TabsTrigger 
                value="motivo"
                className="relative flex-1 inline-flex items-center justify-center whitespace-nowrap rounded-[10px] px-4 py-2.5 text-[13px] font-medium font-['Inter'] ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-[#2563eb] data-[state=active]:text-white data-[state=active]:shadow-sm text-[#6B7280] hover:text-[#374151] min-w-0"
              >
                <FileText className="h-4 w-4 mr-2 stroke-[2] flex-shrink-0 [&[data-state=active]]:text-white" />
                <span className="truncate">Motivo</span>
              </TabsTrigger>
              <TabsTrigger 
                value="diagnostico"
                className="relative flex-1 inline-flex items-center justify-center whitespace-nowrap rounded-[10px] px-4 py-2.5 text-[13px] font-medium font-['Inter'] ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-[#2563eb] data-[state=active]:text-white data-[state=active]:shadow-sm text-[#6B7280] hover:text-[#374151] min-w-0"
              >
                <Stethoscope className="h-4 w-4 mr-2 stroke-[2] flex-shrink-0 [&[data-state=active]]:text-white" />
                <span className="truncate">Diagnóstico</span>
              </TabsTrigger>
              <TabsTrigger 
                value="tratamiento"
                className="relative flex-1 inline-flex items-center justify-center whitespace-nowrap rounded-[10px] px-4 py-2.5 text-[13px] font-medium font-['Inter'] ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-[#2563eb] data-[state=active]:text-white data-[state=active]:shadow-sm text-[#6B7280] hover:text-[#374151] min-w-0"
              >
                <Pill className="h-4 w-4 mr-2 stroke-[2] flex-shrink-0 [&[data-state=active]]:text-white" />
                <span className="truncate">Tratamiento</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Contenido con altura absoluta */}
          <div className="flex-1 min-h-0 relative">
            {/* Tab: Evolución */}
            <div className={`absolute inset-0 px-8 py-6 flex flex-col ${activeTab === 'evolucion' ? 'block' : 'hidden'}`}>
              <Textarea
                id="observaciones"
                value={formData.observaciones}
                onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                placeholder="Ej: Paciente colaborador durante la consulta. Familiar acompañante presente. Se entregó material educativo sobre manejo de migraña. Paciente comprende indicaciones y firmó consentimiento..."
                className="flex-1 min-h-0 border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[16px] font-['Inter'] placeholder:text-[#9CA3AF] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 resize-none transition-all duration-200 leading-relaxed"
              />
              <div className="flex items-center justify-between mt-3 flex-shrink-0">
                <p className="text-xs text-[#6B7280] font-['Inter']">
                  {formData.observaciones?.length || 0} caracteres
                </p>
              </div>
            </div>

            {/* Tab: Motivo de Consulta */}
            <div className={`absolute inset-0 px-8 py-6 flex flex-col ${activeTab === 'motivo' ? 'block' : 'hidden'}`}>
              <Textarea
                id="motivo_consulta"
                value={formData.motivo_consulta}
                onChange={(e) => setFormData({ ...formData, motivo_consulta: e.target.value })}
                placeholder="Ej: Paciente refiere dolor de cabeza persistente desde hace 3 días, acompañado de náuseas y sensibilidad a la luz. Antecedentes de migrañas ocasionales..."
                className="flex-1 min-h-0 border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[16px] font-['Inter'] placeholder:text-[#9CA3AF] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 resize-none transition-all duration-200 leading-relaxed"
              />
              <div className="flex items-center justify-between mt-3 flex-shrink-0">
                <p className="text-xs text-[#6B7280] font-['Inter']">
                  {formData.motivo_consulta?.length || 0} caracteres
                </p>
              </div>
            </div>

            {/* Tab: Diagnóstico */}
            <div className={`absolute inset-0 px-8 py-6 flex flex-col ${activeTab === 'diagnostico' ? 'block' : 'hidden'}`}>
              <Textarea
                id="diagnostico"
                value={formData.diagnostico}
                onChange={(e) => setFormData({ ...formData, diagnostico: e.target.value })}
                placeholder="Ej: Migraña común sin aura. Presenta criterios diagnósticos de cefalea primaria según clasificación internacional. Examen neurológico sin alteraciones. Se descarta patología orgánica grave..."
                className="flex-1 min-h-0 border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[16px] font-['Inter'] placeholder:text-[#9CA3AF] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 resize-none transition-all duration-200 leading-relaxed"
              />
              <div className="flex items-center justify-between mt-3 flex-shrink-0">
                <p className="text-xs text-[#6B7280] font-['Inter']">
                  {formData.diagnostico?.length || 0} caracteres
                </p>
              </div>
            </div>

            {/* Tab: Tratamiento */}
            <div className={`absolute inset-0 px-8 py-6 flex flex-col ${activeTab === 'tratamiento' ? 'block' : 'hidden'}`}>
              <Textarea
                id="tratamiento"
                value={formData.tratamiento}
                onChange={(e) => setFormData({ ...formData, tratamiento: e.target.value })}
                placeholder="Ej: 1) Ibuprofeno 400mg cada 8 horas por 5 días. 2) Reposo relativo en ambiente tranquilo. 3) Evitar estímulos visuales intensos y ruido. 4) Hidratación adecuada. 5) Control en 7 días o antes si empeora..."
                className="flex-1 min-h-0 border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[16px] font-['Inter'] placeholder:text-[#9CA3AF] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 resize-none transition-all duration-200 leading-relaxed"
              />
              <div className="flex items-center justify-between mt-3 flex-shrink-0">
                <p className="text-xs text-[#6B7280] font-['Inter']">
                  {formData.tratamiento?.length || 0} caracteres
                </p>
              </div>
            </div>
          </div>
        </Tabs>

        {/* Footer fijo */}
        <DialogFooter className="px-8 py-5 border-t border-[#E5E7EB] bg-[#F9FAFB] flex flex-row justify-end items-center gap-3 flex-shrink-0 mt-0">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            className="h-[48px] px-6 rounded-[12px] border-[1.5px] border-[#D1D5DB] font-medium font-['Inter'] text-[15px] hover:bg-white hover:border-[#9CA3AF] transition-all duration-200"
          >
            Cancelar
          </Button>
          
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !isFormValid}
            className="h-[48px] px-8 rounded-[12px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-lg shadow-[#2563eb]/30 hover:shadow-xl hover:shadow-[#2563eb]/40 hover:scale-[1.02] font-semibold font-['Inter'] text-[15px] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin stroke-[2.5]" />
                Guardando...
              </>
            ) : (
              'Crear Evolución'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}