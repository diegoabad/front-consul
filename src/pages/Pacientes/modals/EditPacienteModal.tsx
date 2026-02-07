import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { User, Loader2, Phone, Mail } from 'lucide-react';
import { toast as reactToastify } from 'react-toastify';
import type { CreatePacienteData } from '@/services/pacientes.service';
import type { Paciente } from '@/types';
import { obrasSocialesService } from '@/services/obras-sociales.service';
import { formatDisplayText } from '@/lib/utils';

interface EditPacienteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paciente: Paciente | null;
  onSubmit: (data: CreatePacienteData) => Promise<void>;
  isSubmitting?: boolean;
}

export function EditPacienteModal({
  open,
  onOpenChange,
  paciente,
  onSubmit,
  isSubmitting = false,
}: EditPacienteModalProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<CreatePacienteData>({
    dni: '',
    nombre: '',
    apellido: '',
    fecha_nacimiento: '',
    telefono: '',
    email: '',
    direccion: '',
    obra_social: '',
    numero_afiliado: '',
    plan: '',
    contacto_emergencia_nombre: '',
    contacto_emergencia_telefono: '',
    activo: true,
  });
  const [tieneCobertura, setTieneCobertura] = useState(false);
  const [tieneContactoEmergencia, setTieneContactoEmergencia] = useState(false);
  const [showCreateObraSocialInput, setShowCreateObraSocialInput] = useState(false);
  const [newObraSocialNombre, setNewObraSocialNombre] = useState('');
  const [isCreatingObraSocial, setIsCreatingObraSocial] = useState(false);

  const { data: obrasSocialesData } = useQuery({
    queryKey: ['obras-sociales'],
    queryFn: () => obrasSocialesService.getAll(),
    enabled: open,
  });
  const obrasSociales = Array.isArray(obrasSocialesData) ? obrasSocialesData : [];

  // Incluir la obra social del paciente en las opciones si no está en la lista (ej. guardada en minúsculas en BD)
  const obrasSocialesOpciones = useMemo(() => {
    const lista = [...obrasSociales];
    const valorActual = formData.obra_social?.trim();
    if (!valorActual) return lista;
    const yaExiste = lista.some((os) => os.nombre.trim().toLowerCase() === valorActual.toLowerCase());
    if (!yaExiste) {
      lista.push({ id: '__actual__', nombre: valorActual, activo: true });
    }
    return lista;
  }, [obrasSociales, formData.obra_social]);

  const handleCreateObraSocial = async () => {
    const nombre = newObraSocialNombre.trim();
    if (!nombre) {
      reactToastify.error('Ingrese el nombre de la obra social', { position: 'top-right', autoClose: 3000 });
      return;
    }
    setIsCreatingObraSocial(true);
    try {
      const creada = await obrasSocialesService.create({ nombre });
      queryClient.invalidateQueries({ queryKey: ['obras-sociales'] });
      setFormData((prev) => ({ ...prev, obra_social: creada.nombre }));
      setShowCreateObraSocialInput(false);
      setNewObraSocialNombre('');
      reactToastify.success('Obra social creada', { position: 'top-right', autoClose: 3000 });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Error al crear obra social';
      reactToastify.error(msg, { position: 'top-right', autoClose: 3000 });
    } finally {
      setIsCreatingObraSocial(false);
    }
  };

  // Normalizar obra_social al valor exacto de la lista (mismo texto que en el Select) para que quede seleccionada
  const obraSocialInicial = useMemo(() => {
    const valor = paciente?.obra_social?.trim();
    if (!valor || obrasSociales.length === 0) return valor || '';
    const match = obrasSociales.find((os) => (os.nombre || '').trim().toLowerCase() === valor.toLowerCase());
    return match ? match.nombre : valor;
  }, [paciente?.obra_social, obrasSociales]);

  useEffect(() => {
    if (paciente) {
      setFormData({
        dni: paciente.dni,
        nombre: paciente.nombre,
        apellido: paciente.apellido,
        fecha_nacimiento: paciente.fecha_nacimiento || '',
        telefono: paciente.telefono || '',
        email: paciente.email || '',
        direccion: paciente.direccion || '',
        obra_social: obraSocialInicial,
        numero_afiliado: paciente.numero_afiliado || '',
        plan: paciente.plan || '',
        contacto_emergencia_nombre: paciente.contacto_emergencia_nombre ? formatDisplayText(paciente.contacto_emergencia_nombre) : '',
        contacto_emergencia_telefono: paciente.contacto_emergencia_telefono || '',
        activo: paciente.activo,
      });
      setTieneCobertura(!!(paciente.obra_social?.trim() || paciente.numero_afiliado?.trim()));
      setTieneContactoEmergencia(!!(paciente.contacto_emergencia_nombre?.trim() || paciente.contacto_emergencia_telefono?.trim()));
    }
  }, [paciente, obraSocialInicial]);

  const handleSubmit = async () => {
    try {
      const telefonoTrim = formData.telefono?.trim();
      if (!telefonoTrim) {
        reactToastify.error('El teléfono es requerido', { position: 'top-right', autoClose: 3000 });
        return;
      }
      const digitosTelefono = telefonoTrim.replace(/\D/g, '');
      if (digitosTelefono.length < 6) {
        reactToastify.error('El teléfono debe tener al menos 6 números', { position: 'top-right', autoClose: 3000 });
        return;
      }
      if (tieneCobertura) {
        if (!formData.obra_social?.trim()) {
          reactToastify.error('Seleccione una obra social', { position: 'top-right', autoClose: 3000 });
          return;
        }
        if (!formData.numero_afiliado?.trim()) {
          reactToastify.error('El número de afiliado es requerido', { position: 'top-right', autoClose: 3000 });
          return;
        }
      }
      if (tieneContactoEmergencia) {
        if (!formData.contacto_emergencia_nombre?.trim()) {
          reactToastify.error('El nombre del contacto de emergencia es requerido', { position: 'top-right', autoClose: 3000 });
          return;
        }
        if (!formData.contacto_emergencia_telefono?.trim()) {
          reactToastify.error('El teléfono de emergencia es requerido', { position: 'top-right', autoClose: 3000 });
          return;
        }
        const digitosEmergencia = formData.contacto_emergencia_telefono.trim().replace(/\D/g, '');
        if (digitosEmergencia.length < 6) {
          reactToastify.error('El teléfono de emergencia debe tener al menos 6 números', { position: 'top-right', autoClose: 3000 });
          return;
        }
      }
      const dataToSubmit: CreatePacienteData = {
        dni: formData.dni.trim(),
        nombre: formData.nombre.trim(),
        apellido: formData.apellido.trim(),
        fecha_nacimiento: formData.fecha_nacimiento && formData.fecha_nacimiento.trim() ? formData.fecha_nacimiento.trim() : undefined,
        telefono: telefonoTrim,
        email: formData.email?.trim() || undefined,
        direccion: formData.direccion?.trim() || undefined,
        obra_social: tieneCobertura ? (formData.obra_social?.trim() || undefined) : undefined,
        numero_afiliado: tieneCobertura ? (formData.numero_afiliado?.trim() || undefined) : undefined,
        plan: formData.plan?.trim() || undefined,
        contacto_emergencia_nombre: tieneContactoEmergencia ? (formData.contacto_emergencia_nombre?.trim() || undefined) : undefined,
        contacto_emergencia_telefono: tieneContactoEmergencia ? (formData.contacto_emergencia_telefono?.trim() || undefined) : undefined,
        activo: formData.activo,
      };

      await onSubmit(dataToSubmit);
      // Close modal on success (handled by parent component)
      onOpenChange(false);
    } catch (error) {
      // Error handling is done in the parent component
    }
  };

  if (!paciente) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(openValue) => {
        onOpenChange(openValue);
        if (!openValue) {
          setShowCreateObraSocialInput(false);
          setNewObraSocialNombre('');
        }
      }}
    >
      <DialogContent className="max-w-[900px] h-[90vh] max-h-[90vh] max-lg:max-h-[85vh] rounded-[20px] p-0 border border-[#E5E7EB] shadow-2xl flex flex-col">
        {/* Header fijo - sin ícono en mobile */}
        <DialogHeader className="px-8 max-lg:px-4 pt-8 max-lg:pt-4 pb-4 border-b border-[#E5E7EB] bg-gradient-to-b from-white to-[#F9FAFB] flex-shrink-0 mb-0">
          <div className="flex items-center gap-4">
            <div className="max-lg:hidden h-12 w-12 rounded-full bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] flex items-center justify-center shadow-lg shadow-[#2563eb]/20">
              <User className="h-6 w-6 text-white stroke-[2]" />
            </div>
            <div>
              <DialogTitle className="text-[28px] max-lg:text-[22px] font-bold text-[#111827] font-['Poppins'] leading-tight mb-0">
                Editar Paciente
              </DialogTitle>
              <DialogDescription className="text-base max-lg:text-sm text-[#6B7280] font-['Inter'] mt-1 mb-0">
                Modifica la información del paciente
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Contenido scrolleable */}
        <div className="overflow-y-auto flex-1 min-h-0 px-8 max-lg:px-4 py-4 scrollbar-violet">
          <div className="space-y-5 max-lg:space-y-4">
            {/* Sección: Datos Personales */}
            <div className="space-y-3 max-lg:space-y-2">
              <div className="flex items-center gap-2 border-b border-[#E5E7EB]">
                <div className="h-2 w-2 rounded-full bg-[#2563eb]" />
                <h3 className="text-[17px] max-lg:text-[15px] font-semibold text-[#111827] font-['Inter'] mb-0">
                  Datos Personales
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-lg:gap-3">
                <div className="space-y-2">
                  <Label htmlFor="edit-nombre" className="text-[14px] font-medium text-[#374151] font-['Inter'] flex items-center gap-1.5">
                    Nombre
                    <span className="text-[#EF4444]">*</span>
                  </Label>
                  <Input
                    id="edit-nombre"
                    placeholder="Ej: Juan"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    autoComplete="off"
                    required
                    className="h-[48px] max-lg:h-10 border-[1.5px] border-[#D1D5DB] rounded-[10px] max-lg:rounded-[8px] text-[15px] max-lg:text-[14px] font-['Inter'] placeholder:text-[#9CA3AF] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-apellido" className="text-[14px] font-medium text-[#374151] font-['Inter'] flex items-center gap-1.5">
                    Apellido
                    <span className="text-[#EF4444]">*</span>
                  </Label>
                  <Input
                    id="edit-apellido"
                    placeholder="Ej: Pérez"
                    value={formData.apellido}
                    onChange={(e) => setFormData({ ...formData, apellido: e.target.value })}
                    autoComplete="off"
                    required
                    className="h-[48px] max-lg:h-10 border-[1.5px] border-[#D1D5DB] rounded-[10px] max-lg:rounded-[8px] text-[15px] max-lg:text-[14px] font-['Inter'] placeholder:text-[#9CA3AF] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-dni" className="text-[14px] font-medium text-[#374151] font-['Inter'] flex items-center gap-1.5">
                    DNI
                    <span className="text-[#EF4444]">*</span>
                  </Label>
                  <Input
                    id="edit-dni"
                    placeholder="Ej: 12345678"
                    value={formData.dni}
                    onChange={(e) => setFormData({ ...formData, dni: e.target.value })}
                    autoComplete="off"
                    required
                    className="h-[48px] max-lg:h-10 border-[1.5px] border-[#D1D5DB] rounded-[10px] max-lg:rounded-[8px] text-[15px] max-lg:text-[14px] font-['Inter'] placeholder:text-[#9CA3AF] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-fecha_nacimiento" className="text-[14px] font-medium text-[#374151] font-['Inter']">
                    Fecha de Nacimiento
                  </Label>
                  <Input
                    id="edit-fecha_nacimiento"
                    type="date"
                    value={formData.fecha_nacimiento || ''}
                    onChange={(e) => setFormData({ ...formData, fecha_nacimiento: e.target.value || '' })}
                    autoComplete="off"
                    className="h-[48px] max-lg:h-10 border-[1.5px] border-[#D1D5DB] rounded-[10px] max-lg:rounded-[8px] text-[15px] max-lg:text-[14px] font-['Inter'] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200"
                  />
                </div>
              </div>
            </div>

            {/* Sección: Contacto */}
            <div className="space-y-3 max-lg:space-y-2 pt-5 max-lg:pt-4">
              <div className="flex items-center gap-2 border-b border-[#E5E7EB]">
                <div className="h-2 w-2 rounded-full bg-[#3B82F6]" />
                <h3 className="text-[17px] max-lg:text-[15px] font-semibold text-[#111827] font-['Inter'] mb-0">
                  Información de Contacto
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-lg:gap-3">
                <div className="space-y-2">
                  <Label htmlFor="edit-telefono" className="text-[14px] max-lg:text-[13px] font-medium text-[#374151] font-['Inter'] flex items-center gap-2">
                    <Phone className="max-lg:hidden h-4 w-4 text-[#6B7280] stroke-[2]" />
                    Teléfono
                    <span className="text-[#EF4444]">*</span>
                  </Label>
                  <Input
                    id="edit-telefono"
                    placeholder="Ej: +54 11 1234-5678"
                    value={formData.telefono}
                    onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                    autoComplete="off"
                    className="h-[48px] max-lg:h-10 border-[1.5px] border-[#D1D5DB] rounded-[10px] max-lg:rounded-[8px] text-[15px] max-lg:text-[14px] font-['Inter'] placeholder:text-[#9CA3AF] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-email" className="text-[14px] max-lg:text-[13px] font-medium text-[#374151] font-['Inter'] flex items-center gap-2">
                    <Mail className="max-lg:hidden h-4 w-4 text-[#6B7280] stroke-[2]" />
                    Email
                  </Label>
                  <Input
                    id="edit-email"
                    type="email"
                    placeholder="Ej: juan.perez@email.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    autoComplete="off"
                    className="h-[48px] max-lg:h-10 border-[1.5px] border-[#D1D5DB] rounded-[10px] max-lg:rounded-[8px] text-[15px] max-lg:text-[14px] font-['Inter'] placeholder:text-[#9CA3AF] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200"
                  />
                </div>
              </div>

              <div className="space-y-2.5">
                <Label htmlFor="edit-direccion" className="text-[14px] font-medium text-[#374151] font-['Inter']">
                  Dirección
                </Label>
                <Input
                  id="edit-direccion"
                  placeholder="Ej: Av. Corrientes 1234, CABA"
                  value={formData.direccion}
                  onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                  autoComplete="off"
                  className="h-[48px] max-lg:h-10 border-[1.5px] border-[#D1D5DB] rounded-[10px] max-lg:rounded-[8px] text-[15px] max-lg:text-[14px] font-['Inter'] placeholder:text-[#9CA3AF] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200"
                />
              </div>
            </div>

            {/* Cobertura médica: opcional con switch */}
            <div className="space-y-3 max-lg:space-y-2 pt-5 max-lg:pt-4">
              <div className="flex items-center gap-3 mb-0">
                <Switch
                  id="edit-tiene-cobertura"
                  checked={tieneCobertura}
                  onCheckedChange={(checked) => setTieneCobertura(checked)}
                />
                <Label
                  htmlFor="edit-tiene-cobertura"
                  className="text-[15px] font-medium text-[#374151] font-['Inter'] cursor-pointer mb-0"
                >
                  Tiene cobertura médica
                </Label>
              </div>
              {tieneCobertura && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-lg:gap-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor="edit-obra_social" className="text-[14px] font-medium text-[#374151] font-['Inter'] mb-0 flex items-center gap-1.5">
                        Obra Social
                        <span className="text-[#EF4444]">*</span>
                      </Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-[13px] text-[#2563eb] font-['Inter'] p-0 h-auto min-w-0 m-0 hover:bg-transparent hover:text-[#2563eb]"
                        onClick={() => setShowCreateObraSocialInput((v) => !v)}
                      >
                        {showCreateObraSocialInput ? 'Cancelar' : '+ Crear obra social'}
                      </Button>
                    </div>
                    {showCreateObraSocialInput ? (
                      <div className="flex gap-2">
                        <Input
                          value={newObraSocialNombre}
                          onChange={(e) => setNewObraSocialNombre(e.target.value)}
                          placeholder="Nombre de la nueva obra social"
                          className="h-[48px] max-lg:h-10 border-[1.5px] border-[#D1D5DB] rounded-[10px] max-lg:rounded-[8px] font-['Inter'] text-[15px] max-lg:text-[14px] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200"
                          onKeyDown={(e) => e.key === 'Enter' && handleCreateObraSocial()}
                        />
                        <Button
                          type="button"
                          onClick={handleCreateObraSocial}
                          disabled={isCreatingObraSocial || !newObraSocialNombre.trim()}
                          className="h-[48px] max-lg:h-10 px-4 rounded-[10px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-medium font-['Inter'] disabled:opacity-50"
                        >
                          {isCreatingObraSocial ? <Loader2 className="h-4 w-4 animate-spin" /> : (<><span className="max-md:hidden">Agregar</span><span className="md:hidden">+</span></>)}
                        </Button>
                      </div>
                    ) : (
                      <Select
                        value={formData.obra_social}
                        onValueChange={(value) => setFormData({ ...formData, obra_social: value })}
                      >
                        <SelectTrigger className="h-[48px] max-lg:h-10 border-[1.5px] border-[#D1D5DB] rounded-[10px] max-lg:rounded-[8px] font-['Inter'] text-[15px] max-lg:text-[14px] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200">
                          <SelectValue placeholder="Seleccionar obra social" />
                        </SelectTrigger>
                        <SelectContent className="rounded-[12px] border-[#E5E7EB] shadow-xl max-h-[300px]">
                          {obrasSocialesOpciones.map((os) => (
                            <SelectItem key={os.id} value={os.nombre} className="rounded-[8px] font-['Inter'] text-[15px] py-3">
                              {os.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-numero_afiliado" className="text-[14px] font-medium text-[#374151] font-['Inter'] flex items-center gap-1.5">
                      Número de Afiliado
                      <span className="text-[#EF4444]">*</span>
                    </Label>
                    <Input
                      id="edit-numero_afiliado"
                      placeholder="Ej: 123456789"
                      value={formData.numero_afiliado}
                      onChange={(e) => setFormData({ ...formData, numero_afiliado: e.target.value })}
                      autoComplete="off"
                      className="h-[48px] max-lg:h-10 border-[1.5px] border-[#D1D5DB] rounded-[10px] max-lg:rounded-[8px] text-[15px] max-lg:text-[14px] font-['Inter'] placeholder:text-[#9CA3AF] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="edit-plan" className="text-[14px] font-medium text-[#374151] font-['Inter'] mb-0">
                      Plan <span className="text-[#6B7280] font-normal">(opcional)</span>
                    </Label>
                    <Input
                      id="edit-plan"
                      placeholder="Ej: Plan 210, Plan familiar"
                      value={formData.plan ?? ''}
                      onChange={(e) => setFormData({ ...formData, plan: e.target.value })}
                      autoComplete="off"
                      className="h-[48px] max-lg:h-10 border-[1.5px] border-[#D1D5DB] rounded-[10px] max-lg:rounded-[8px] text-[15px] max-lg:text-[14px] font-['Inter'] placeholder:text-[#9CA3AF] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Contacto de emergencia: opcional con switch */}
            <div className="space-y-3 max-lg:space-y-2 pt-5 max-lg:pt-4">
              <div className="flex items-center gap-3 mb-0">
                <Switch
                  id="edit-tiene-contacto-emergencia"
                  checked={tieneContactoEmergencia}
                  onCheckedChange={(checked) => setTieneContactoEmergencia(checked)}
                />
                <Label
                  htmlFor="edit-tiene-contacto-emergencia"
                  className="text-[15px] font-medium text-[#374151] font-['Inter'] cursor-pointer mb-0"
                >
                  Tiene contacto de emergencia
                </Label>
              </div>
              {tieneContactoEmergencia && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-lg:gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="edit-contacto_emergencia_nombre" className="text-[14px] font-medium text-[#374151] font-['Inter'] flex items-center gap-1.5">
                      Nombre del Contacto
                      <span className="text-[#EF4444]">*</span>
                    </Label>
                    <Input
                      id="edit-contacto_emergencia_nombre"
                      placeholder="Ej: María Pérez"
                      value={formData.contacto_emergencia_nombre}
                      onChange={(e) => setFormData({ ...formData, contacto_emergencia_nombre: e.target.value })}
                      autoComplete="off"
                      className="h-[48px] max-lg:h-10 border-[1.5px] border-[#D1D5DB] rounded-[10px] max-lg:rounded-[8px] text-[15px] max-lg:text-[14px] font-['Inter'] placeholder:text-[#9CA3AF] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-contacto_emergencia_telefono" className="text-[14px] font-medium text-[#374151] font-['Inter'] flex items-center gap-1.5">
                      Teléfono de Emergencia
                      <span className="text-[#EF4444]">*</span>
                    </Label>
                    <Input
                      id="edit-contacto_emergencia_telefono"
                      placeholder="Ej: +54 11 1234-5678"
                      value={formData.contacto_emergencia_telefono}
                      onChange={(e) => setFormData({ ...formData, contacto_emergencia_telefono: e.target.value })}
                      autoComplete="off"
                      className="h-[48px] max-lg:h-10 border-[1.5px] border-[#D1D5DB] rounded-[10px] max-lg:rounded-[8px] text-[15px] max-lg:text-[14px] font-['Inter'] placeholder:text-[#9CA3AF] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer fijo */}
        <DialogFooter className="px-8 max-lg:px-4 py-4 border-t border-[#E5E7EB] bg-[#F9FAFB] flex flex-row max-lg:flex-col justify-end items-center gap-3 max-lg:gap-2 flex-shrink-0 mt-0">
          <div className="flex gap-3 max-lg:flex-col max-lg:w-full max-lg:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="h-[48px] max-lg:h-11 px-6 rounded-[12px] border-[1.5px] border-[#D1D5DB] font-medium font-['Inter'] text-[15px] hover:bg-white hover:border-[#9CA3AF] transition-all duration-200 max-lg:w-full"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="h-[48px] max-lg:h-11 px-8 rounded-[12px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-lg shadow-[#2563eb]/30 hover:shadow-xl hover:shadow-[#2563eb]/40 hover:scale-[1.02] font-semibold font-['Inter'] text-[15px] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 max-lg:w-full max-lg:hover:scale-100"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin stroke-[2.5]" />
                  Guardando...
                </>
              ) : (
                'Actualizar Paciente'
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
