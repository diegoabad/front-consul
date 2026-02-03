import { useState, useEffect, useRef } from 'react';
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
import { Paperclip, Loader2, User, Upload, X, FileText } from 'lucide-react';
import { profesionalesService } from '@/services/profesionales.service';
import { useQuery } from '@tanstack/react-query';
import type { CreateArchivoData } from '@/services/archivos.service';
import { useAuth } from '@/contexts/AuthContext';

interface UploadArchivoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pacienteId: string;
  onSubmit: (data: CreateArchivoData) => Promise<void>;
  isSubmitting?: boolean;
}

const initialFormData = {
  paciente_id: '',
  profesional_id: '',
  descripcion: '',
  archivo: null as File | null,
};

export function UploadArchivoModal({
  open,
  onOpenChange,
  pacienteId,
  onSubmit,
  isSubmitting = false,
}: UploadArchivoModalProps) {
  const { user } = useAuth();
  const [formData, setFormData] = useState(initialFormData);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: profesionales = [] } = useQuery({
    queryKey: ['profesionales', 'for-archivos'],
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
      }));
    } else {
      // Resetear el formulario cuando se cierra el modal
      setFormData({
        ...initialFormData,
        paciente_id: pacienteId,
      });
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData(prev => ({ 
        ...prev, 
        archivo: file,
        paciente_id: pacienteId, // Asegurar que siempre tenga el paciente_id
      }));
    }
  };

  const handleRemoveFile = () => {
    setFormData({ ...formData, archivo: null });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async () => {
    if (!formData.archivo) return;
    
    try {
      const dataToSubmit: CreateArchivoData = {
        paciente_id: pacienteId,
        profesional_id: formData.profesional_id,
        descripcion: formData.descripcion?.trim() || undefined,
        archivo: formData.archivo,
      };
      
      await onSubmit(dataToSubmit);
      setFormData({
        ...initialFormData,
        paciente_id: pacienteId,
      });
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      onOpenChange(false);
    } catch {
      // Error handling is done in the parent component
    }
  };

  const handleCancel = () => {
    setFormData({
      ...initialFormData,
      paciente_id: pacienteId,
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onOpenChange(false);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const isFormValid = formData.profesional_id && formData.archivo;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[900px] h-[90vh] max-h-[90vh] rounded-[20px] p-0 border border-[#E5E7EB] shadow-2xl flex flex-col overflow-hidden">
        {/* Header fijo */}
        <DialogHeader className="px-8 pt-8 pb-6 border-b border-[#E5E7EB] bg-gradient-to-b from-white to-[#F9FAFB] flex-shrink-0 mb-0">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#6D28D9] flex items-center justify-center shadow-lg shadow-[#7C3AED]/30">
              <Paperclip className="h-7 w-7 text-white stroke-[2.5]" />
            </div>
            <div>
              <DialogTitle className="text-[32px] font-bold text-[#111827] font-['Poppins'] leading-tight mb-0">
                Subir Archivo
              </DialogTitle>
              <DialogDescription className="text-base text-[#6B7280] font-['Inter'] mt-1.5 mb-0">
                Subir un nuevo archivo para este paciente
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Contenido - usando flex */}
        <div className="flex-1 min-h-0 px-8 pt-6 pb-4 flex flex-col space-y-6">
          {/* Sección: Información Básica */}
          <div className="space-y-3 flex-shrink-0">
            <Label htmlFor="profesional" className="text-[15px] font-medium text-[#374151] font-['Inter'] flex items-center gap-2">
              <User className="h-4 w-4 text-[#6B7280] stroke-[2]" />
              Profesional
              <span className="text-[#EF4444]">*</span>
            </Label>
            <Select
              value={formData.profesional_id}
              onValueChange={(value) => setFormData({ ...formData, profesional_id: value })}
              disabled={isProfesional}
            >
              <SelectTrigger className="h-[52px] border-[1.5px] border-[#D1D5DB] rounded-[10px] font-['Inter'] text-[16px] focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20 transition-all duration-200">
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

          {/* Sección: Archivo */}
          <div className="space-y-3 flex-shrink-0">
            <Label htmlFor="archivo" className="text-[15px] font-medium text-[#374151] font-['Inter'] flex items-center gap-2">
              <Upload className="h-4 w-4 text-[#6B7280] stroke-[2]" />
              Seleccionar Archivo
              <span className="text-[#EF4444]">*</span>
            </Label>
            {!formData.archivo ? (
              <div className="border-2 border-dashed border-[#D1D5DB] rounded-[10px] p-8 text-center hover:border-[#7C3AED] transition-all duration-200 cursor-pointer">
                <input
                  ref={fileInputRef}
                  type="file"
                  id="archivo"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label htmlFor="archivo" className="cursor-pointer">
                  <Paperclip className="h-10 w-10 text-[#9CA3AF] mx-auto mb-3 stroke-[2]" />
                  <p className="text-[15px] text-[#6B7280] font-['Inter'] mb-1">
                    Haz clic para seleccionar un archivo
                  </p>
                  <p className="text-sm text-[#9CA3AF] font-['Inter']">
                    o arrastra y suelta el archivo aquí
                  </p>
                </label>
              </div>
            ) : (
              <div className="border border-[#E5E7EB] rounded-[10px] p-4 bg-[#F9FAFB]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Paperclip className="h-5 w-5 text-[#7C3AED] stroke-[2]" />
                    <div>
                      <p className="text-[15px] font-medium text-[#374151] font-['Inter']">
                        {formData.archivo.name}
                      </p>
                      <p className="text-sm text-[#6B7280] font-['Inter']">
                        {formatFileSize(formData.archivo.size)}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={handleRemoveFile}
                    className="h-8 w-8 rounded-[8px] hover:bg-[#FEE2E2] text-[#EF4444] hover:text-[#DC2626]"
                  >
                    <X className="h-4 w-4 stroke-[2]" />
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Sección: Descripción - ocupa todo el espacio disponible */}
          <div className="flex-1 min-h-0 flex flex-col space-y-3">
            <Label htmlFor="descripcion" className="text-[15px] font-medium text-[#374151] font-['Inter'] flex items-center gap-2 flex-shrink-0">
              <FileText className="h-4 w-4 text-[#6B7280] stroke-[2]" />
              Descripción
            </Label>
            <div className="flex-1 min-h-0 relative">
              <Textarea
                id="descripcion"
                value={formData.descripcion}
                onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                placeholder="Agregar una descripción del archivo (opcional)..."
                className="absolute inset-0 w-full h-full border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[16px] font-['Inter'] placeholder:text-[#9CA3AF] focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20 resize-none transition-all duration-200 leading-relaxed"
              />
            </div>
          </div>
        </div>

        {/* Footer fijo */}
        <DialogFooter className="px-8 py-5 border-t border-[#E5E7EB] bg-[#F9FAFB] flex flex-row justify-end items-center gap-3 flex-shrink-0 mt-0">
          <div className="flex gap-3">
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
              className="h-[48px] px-8 rounded-[12px] bg-[#7C3AED] hover:bg-[#6D28D9] text-white shadow-lg shadow-[#7C3AED]/30 hover:shadow-xl hover:shadow-[#7C3AED]/40 hover:scale-[1.02] font-semibold font-['Inter'] text-[15px] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin stroke-[2.5]" />
                  Subiendo...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-5 w-5 stroke-[2.5]" />
                  Subir Archivo
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}