import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Stethoscope, Calendar, User, FileText, Pill } from 'lucide-react';
import type { Evolucion } from '@/types';

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
  const [activeTab, setActiveTab] = useState('evolucion');

  // Resetear a la pestaña de evolución cuando se abre el modal
  useEffect(() => {
    if (open) {
      setActiveTab('evolucion');
    }
  }, [open]);

  if (!evolucion) return null;

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
                Evolución Clínica
              </DialogTitle>
              <DialogDescription className="text-base text-[#6B7280] font-['Inter'] mt-1.5 mb-0">
                Detalle de la evolución clínica del paciente
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
              <div className="h-[52px] border-[1.5px] border-[#D1D5DB] rounded-[10px] font-['Inter'] text-[16px] px-4 flex items-center bg-[#F9FAFB] text-[#374151]">
                {evolucion.profesional_nombre} {evolucion.profesional_apellido}
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="fecha_consulta" className="text-[15px] font-medium text-[#374151] font-['Inter'] flex items-center gap-2">
                <Calendar className="h-4 w-4 text-[#6B7280] stroke-[2]" />
                Fecha y Hora de Consulta
              </Label>
              <div className="h-[52px] border-[1.5px] border-[#D1D5DB] rounded-[10px] font-['Inter'] text-[16px] px-4 flex items-center bg-[#F9FAFB] text-[#374151]">
                {format(new Date(evolucion.fecha_consulta), "dd 'de' MMMM 'de' yyyy 'a las' HH:mm", { locale: es })}
              </div>
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
              <div className="flex-1 min-h-0 border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[16px] font-['Inter'] p-4 bg-[#F9FAFB] overflow-y-auto">
                <p className="text-[#374151] whitespace-pre-wrap leading-relaxed">
                  {evolucion.observaciones || 'No hay información registrada'}
                </p>
              </div>
              <div className="flex items-center justify-between mt-3 flex-shrink-0">
                <p className="text-xs text-[#6B7280] font-['Inter']">
                  {evolucion.observaciones?.length || 0} caracteres
                </p>
              </div>
            </div>

            {/* Tab: Motivo de Consulta */}
            <div className={`absolute inset-0 px-8 py-6 flex flex-col ${activeTab === 'motivo' ? 'block' : 'hidden'}`}>
              <div className="flex-1 min-h-0 border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[16px] font-['Inter'] p-4 bg-[#F9FAFB] overflow-y-auto">
                <p className="text-[#374151] whitespace-pre-wrap leading-relaxed">
                  {evolucion.motivo_consulta || 'No hay información registrada'}
                </p>
              </div>
              <div className="flex items-center justify-between mt-3 flex-shrink-0">
                <p className="text-xs text-[#6B7280] font-['Inter']">
                  {evolucion.motivo_consulta?.length || 0} caracteres
                </p>
              </div>
            </div>

            {/* Tab: Diagnóstico */}
            <div className={`absolute inset-0 px-8 py-6 flex flex-col ${activeTab === 'diagnostico' ? 'block' : 'hidden'}`}>
              <div className="flex-1 min-h-0 border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[16px] font-['Inter'] p-4 bg-[#F9FAFB] overflow-y-auto">
                <p className="text-[#374151] whitespace-pre-wrap leading-relaxed">
                  {evolucion.diagnostico || 'No hay información registrada'}
                </p>
              </div>
              <div className="flex items-center justify-between mt-3 flex-shrink-0">
                <p className="text-xs text-[#6B7280] font-['Inter']">
                  {evolucion.diagnostico?.length || 0} caracteres
                </p>
              </div>
            </div>

            {/* Tab: Tratamiento */}
            <div className={`absolute inset-0 px-8 py-6 flex flex-col ${activeTab === 'tratamiento' ? 'block' : 'hidden'}`}>
              <div className="flex-1 min-h-0 border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[16px] font-['Inter'] p-4 bg-[#F9FAFB] overflow-y-auto">
                <p className="text-[#374151] whitespace-pre-wrap leading-relaxed">
                  {evolucion.tratamiento || 'No hay información registrada'}
                </p>
              </div>
              <div className="flex items-center justify-between mt-3 flex-shrink-0">
                <p className="text-xs text-[#6B7280] font-['Inter']">
                  {evolucion.tratamiento?.length || 0} caracteres
                </p>
              </div>
            </div>
          </div>
        </Tabs>

        {/* Footer fijo */}
        <div className="px-8 py-5 border-t border-[#E5E7EB] bg-[#F9FAFB] flex flex-row justify-end items-center gap-3 flex-shrink-0 mt-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-[48px] px-6 rounded-[12px] border-[1.5px] border-[#D1D5DB] font-medium font-['Inter'] text-[15px] hover:bg-white hover:border-[#9CA3AF] transition-all duration-200"
          >
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
