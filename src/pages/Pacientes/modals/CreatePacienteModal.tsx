import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { User, Loader2, Phone, Mail, ExternalLink, Link2 } from 'lucide-react';
import { toast as reactToastify } from 'react-toastify';
import type { CreatePacienteData } from '@/services/pacientes.service';
import { pacientesService } from '@/services/pacientes.service';
import type { Paciente } from '@/types';
import { obrasSocialesService } from '@/services/obras-sociales.service';
import { formatDisplayText } from '@/lib/utils';

interface CreatePacienteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreatePacienteData) => Promise<void>;
  isSubmitting?: boolean;
  /** Si es profesional, al crear paciente se asigna; si existe por DNI, se ofrece vincular. */
  profesionalIdToAssign?: string | null;
  onVincularExistente?: (pacienteId: string) => Promise<void>;
}

// DNI con separador de miles (ej: 34.551.481)
function formatDNI(dni: string): string {
  if (!dni) return '';
  const clean = String(dni).replace(/\D/g, '');
  return clean.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

const initialFormData: CreatePacienteData = {
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
};

type Step = 'dni' | 'form';

export function CreatePacienteModal({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting = false,
  profesionalIdToAssign,
  onVincularExistente,
}: CreatePacienteModalProps) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>('dni');
  const [dniInput, setDniInput] = useState('');
  const [pacienteExistente, setPacienteExistente] = useState<Paciente | null>(null);
  const [isSearchingDni, setIsSearchingDni] = useState(false);
  const [formData, setFormData] = useState<CreatePacienteData>(initialFormData);
  const [tieneCobertura, setTieneCobertura] = useState(false);
  const [tieneContactoEmergencia, setTieneContactoEmergencia] = useState(false);
  const [showCreateObraSocialInput, setShowCreateObraSocialInput] = useState(false);
  const [newObraSocialNombre, setNewObraSocialNombre] = useState('');
  const [isCreatingObraSocial, setIsCreatingObraSocial] = useState(false);
  const [isVincularLoading, setIsVincularLoading] = useState(false);
  const [vinculadoOk, setVinculadoOk] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (open) {
      setStep('dni');
      setDniInput('');
      setPacienteExistente(null);
      setIsSearchingDni(false);
      setVinculadoOk(false);
      setFormData(initialFormData);
    }
  }, [open]);

  const { data: obrasSocialesData } = useQuery({
    queryKey: ['obras-sociales'],
    queryFn: () => obrasSocialesService.getAll(),
    enabled: open,
  });
  const obrasSociales = Array.isArray(obrasSocialesData) ? obrasSocialesData : [];

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
      // Reset form and close modal on success
      setFormData(initialFormData);
      onOpenChange(false);
    } catch (error) {
      // Error handling is done in the parent component
    }
  };

  const handleBuscarDni = async () => {
    const dni = dniInput.replace(/\D/g, '').trim();
    if (!dni) {
      reactToastify.error('Ingresá el DNI del paciente', { position: 'top-right', autoClose: 3000 });
      return;
    }
    setIsSearchingDni(true);
    setPacienteExistente(null);
    try {
      const encontrado = await pacientesService.getByDni(dni);
      setPacienteExistente(encontrado ?? null);
      if (!encontrado) {
        setFormData((prev) => ({ ...prev, dni }));
        setStep('form');
      } else {
        // Si el backend indica que ya estaba vinculado a este profesional, mostrar "Ver ficha"
        const yaAsignado = (encontrado as Paciente & { ya_asignado?: boolean }).ya_asignado;
        setVinculadoOk(!!yaAsignado);
      }
    } catch {
      reactToastify.error('Error al buscar por DNI', { position: 'top-right', autoClose: 3000 });
    } finally {
      setIsSearchingDni(false);
    }
  };

  const handleVincularExistente = async () => {
    if (!pacienteExistente?.id || !onVincularExistente) return;
    const pacienteId = String(pacienteExistente.id);
    setIsVincularLoading(true);
    try {
      await onVincularExistente(pacienteId);
      reactToastify.success('Paciente vinculado a tu lista', { position: 'top-right', autoClose: 3000 });
      setVinculadoOk(true);
    } catch {
      reactToastify.error('Error al vincular paciente', { position: 'top-right', autoClose: 3000 });
    } finally {
      setIsVincularLoading(false);
    }
  };

  const handleVerFicha = () => {
    if (!pacienteExistente?.id) return;
    onOpenChange(false);
    navigate(`/pacientes/${pacienteExistente.id}`);
  };

  const handleCancel = () => {
    setStep('dni');
    setDniInput('');
    setPacienteExistente(null);
    setVinculadoOk(false);
    setFormData(initialFormData);
    setTieneCobertura(false);
    setTieneContactoEmergencia(false);
    setShowCreateObraSocialInput(false);
    setNewObraSocialNombre('');
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(openValue) => {
        onOpenChange(openValue);
        if (!openValue) {
          setStep('dni');
          setDniInput('');
          setPacienteExistente(null);
          setVinculadoOk(false);
          setFormData(initialFormData);
          setTieneCobertura(false);
          setTieneContactoEmergencia(false);
          setShowCreateObraSocialInput(false);
          setNewObraSocialNombre('');
        }
      }}
    >
      <DialogContent
        className={`max-w-[900px] rounded-[20px] p-0 border border-[#E5E7EB] shadow-2xl flex flex-col ${
          step === 'dni' ? 'max-h-[380px]' : 'h-[90vh] max-h-[90vh]'
        }`}
      >
        {/* Header fijo */}
        <DialogHeader className="px-8 max-lg:px-4 pt-8 max-lg:pt-4 pb-4 border-b border-[#E5E7EB] bg-gradient-to-b from-white to-[#F9FAFB] flex-shrink-0 mb-0">
          <div className="flex items-center gap-4">
            <div className="max-lg:hidden h-12 w-12 rounded-full bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] flex items-center justify-center shadow-lg shadow-[#2563eb]/20">
              <User className="h-6 w-6 text-white stroke-[2]" />
            </div>
            <div>
              <DialogTitle className="text-[28px] font-bold text-[#111827] font-['Poppins'] leading-tight mb-0">
                Nuevo Paciente
              </DialogTitle>
              <DialogDescription className="text-base text-[#6B7280] font-['Inter'] mt-1 mb-0">
                {step === 'dni' ? 'Ingresá el DNI para buscar o crear' : 'Completa la información del nuevo paciente'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Contenido scrolleable */}
        <div className="overflow-y-auto flex-1 min-h-0 px-8 max-lg:px-4 py-4 scrollbar-violet">
          {step === 'dni' ? (
            <div className="space-y-4">
              {!pacienteExistente ? (
                <div className="space-y-2">
                  <Label htmlFor="dni-buscar" className="text-[14px] font-medium text-[#374151] font-['Inter']">
                    DNI del paciente
                  </Label>
                  <Input
                    id="dni-buscar"
                    placeholder="Ej: 12345678"
                    value={dniInput}
                    onChange={(e) => setDniInput(e.target.value.replace(/\D/g, ''))}
                    onKeyDown={(e) => e.key === 'Enter' && handleBuscarDni()}
                    autoComplete="off"
                    className="h-[48px] border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[15px] font-['Inter'] placeholder:text-[#9CA3AF] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20"
                  />
                </div>
              ) : (
                <div className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-4">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="text-[15px] font-medium text-[#111827] mb-0">
                      {formatDisplayText(pacienteExistente.nombre)} {formatDisplayText(pacienteExistente.apellido)}
                    </p>
                    <span className="text-[14px] text-[#6B7280]">DNI {formatDNI(pacienteExistente.dni)}</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
          <div className="space-y-4">
            {/* Sección: Datos Personales */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 border-b border-[#E5E7EB] mb-1">
                <div className="h-2 w-2 rounded-full bg-[#2563eb]" />
                <h3 className="text-[17px] font-semibold text-[#111827] font-['Inter'] mb-0">
                  Datos Personales
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nombre" className="text-[14px] font-medium text-[#374151] font-['Inter'] flex items-center gap-1.5">
                    Nombre
                    <span className="text-[#EF4444]">*</span>
                  </Label>
                  <Input
                    id="nombre"
                    placeholder="Ej: Juan"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    autoComplete="off"
                    required
                    className="h-[48px] border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[15px] font-['Inter'] placeholder:text-[#9CA3AF] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="apellido" className="text-[14px] font-medium text-[#374151] font-['Inter'] flex items-center gap-1.5">
                    Apellido
                    <span className="text-[#EF4444]">*</span>
                  </Label>
                  <Input
                    id="apellido"
                    placeholder="Ej: Pérez"
                    value={formData.apellido}
                    onChange={(e) => setFormData({ ...formData, apellido: e.target.value })}
                    autoComplete="off"
                    required
                    className="h-[48px] border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[15px] font-['Inter'] placeholder:text-[#9CA3AF] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dni" className="text-[14px] font-medium text-[#374151] font-['Inter'] flex items-center gap-1.5">
                    DNI
                    <span className="text-[#EF4444]">*</span>
                  </Label>
                  <Input
                    id="dni"
                    placeholder="Ej: 12345678"
                    value={formData.dni}
                    onChange={(e) => setFormData({ ...formData, dni: e.target.value })}
                    autoComplete="off"
                    required
                    className="h-[48px] border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[15px] font-['Inter'] placeholder:text-[#9CA3AF] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fecha_nacimiento" className="text-[14px] font-medium text-[#374151] font-['Inter']">
                    Fecha de Nacimiento
                  </Label>
                  <Input
                    id="fecha_nacimiento"
                    type="date"
                    value={formData.fecha_nacimiento || ''}
                    onChange={(e) => setFormData({ ...formData, fecha_nacimiento: e.target.value || '' })}
                    autoComplete="off"
                    className="h-[48px] border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[15px] font-['Inter'] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200"
                  />
                </div>
              </div>
            </div>

            {/* Sección: Contacto */}
            <div className="space-y-3 pt-5">
              <div className="flex items-center gap-2 border-b border-[#E5E7EB] mb-1">
                <div className="h-2 w-2 rounded-full bg-[#3B82F6]" />
                <h3 className="text-[17px] font-semibold text-[#111827] font-['Inter'] mb-0">
                  Información de Contacto
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="telefono" className="text-[14px] font-medium text-[#374151] font-['Inter'] flex items-center gap-2">
                    <Phone className="h-4 w-4 text-[#6B7280] stroke-[2]" />
                    Teléfono
                    <span className="text-[#EF4444]">*</span>
                  </Label>
                  <Input
                    id="telefono"
                    placeholder="Ej: +54 11 1234-5678"
                    value={formData.telefono}
                    onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                    autoComplete="off"
                    className="h-[48px] border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[15px] font-['Inter'] placeholder:text-[#9CA3AF] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-[14px] font-medium text-[#374151] font-['Inter'] flex items-center gap-2">
                    <Mail className="h-4 w-4 text-[#6B7280] stroke-[2]" />
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Ej: juan.perez@email.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    autoComplete="off"
                    className="h-[48px] border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[15px] font-['Inter'] placeholder:text-[#9CA3AF] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="direccion" className="text-[14px] font-medium text-[#374151] font-['Inter']">
                  Dirección
                </Label>
                <Input
                  id="direccion"
                  placeholder="Ej: Av. Corrientes 1234, CABA"
                  value={formData.direccion}
                  onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                  autoComplete="off"
                  className="h-[48px] border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[15px] font-['Inter'] placeholder:text-[#9CA3AF] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200"
                />
              </div>
            </div>

            {/* Cobertura médica: opcional con switch */}
            <div className="space-y-3 pt-5">
              <div className="flex items-center gap-3 mb-0">
                <Switch
                  id="tiene-cobertura"
                  checked={tieneCobertura}
                  onCheckedChange={(checked) => setTieneCobertura(checked)}
                />
                <Label
                  htmlFor="tiene-cobertura"
                  className="text-[15px] font-medium text-[#374151] font-['Inter'] cursor-pointer mb-0"
                >
                  Tiene cobertura médica
                </Label>
              </div>
              {tieneCobertura && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor="obra_social" className="text-[14px] font-medium text-[#374151] font-['Inter'] mb-0 flex items-center gap-1.5">
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
                          className="h-[48px] border-[1.5px] border-[#D1D5DB] rounded-[10px] font-['Inter'] text-[15px] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200"
                          onKeyDown={(e) => e.key === 'Enter' && handleCreateObraSocial()}
                        />
                        <Button
                          type="button"
                          onClick={handleCreateObraSocial}
                          disabled={isCreatingObraSocial || !newObraSocialNombre.trim()}
                          className="h-[48px] px-4 rounded-[10px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-medium font-['Inter'] disabled:opacity-50"
                        >
                          {isCreatingObraSocial ? <Loader2 className="h-4 w-4 animate-spin" /> : (<><span className="max-md:hidden">Agregar</span><span className="md:hidden">+</span></>)}
                        </Button>
                      </div>
                    ) : (
                      <Select
                        value={formData.obra_social}
                        onValueChange={(value) => setFormData({ ...formData, obra_social: value })}
                      >
                        <SelectTrigger className="h-[48px] border-[1.5px] border-[#D1D5DB] rounded-[10px] font-['Inter'] text-[15px] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200">
                          <SelectValue placeholder="Seleccionar obra social" />
                        </SelectTrigger>
                        <SelectContent className="rounded-[12px] border-[#E5E7EB] shadow-xl max-h-[300px]">
                          {obrasSociales.map((os) => (
                            <SelectItem key={os.id} value={os.nombre} className="rounded-[8px] font-['Inter'] text-[15px] py-3">
                              {os.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="numero_afiliado" className="text-[14px] font-medium text-[#374151] font-['Inter'] flex items-center gap-1.5">
                      Número de Afiliado
                      <span className="text-[#EF4444]">*</span>
                    </Label>
                    <Input
                      id="numero_afiliado"
                      placeholder="Ej: 123456789"
                      value={formData.numero_afiliado}
                      onChange={(e) => setFormData({ ...formData, numero_afiliado: e.target.value })}
                      autoComplete="off"
                      className="h-[48px] border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[15px] font-['Inter'] placeholder:text-[#9CA3AF] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="plan" className="text-[14px] font-medium text-[#374151] font-['Inter'] mb-0">
                      Plan <span className="text-[#6B7280] font-normal">(opcional)</span>
                    </Label>
                    <Input
                      id="plan"
                      placeholder="Ej: Plan 210, Plan familiar"
                      value={formData.plan ?? ''}
                      onChange={(e) => setFormData({ ...formData, plan: e.target.value })}
                      autoComplete="off"
                      className="h-[48px] border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[15px] font-['Inter'] placeholder:text-[#9CA3AF] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Contacto de emergencia: opcional con switch */}
            <div className="space-y-3 pt-5">
              <div className="flex items-center gap-3 mb-0">
                <Switch
                  id="tiene-contacto-emergencia"
                  checked={tieneContactoEmergencia}
                  onCheckedChange={(checked) => setTieneContactoEmergencia(checked)}
                />
                <Label
                  htmlFor="tiene-contacto-emergencia"
                  className="text-[15px] font-medium text-[#374151] font-['Inter'] cursor-pointer mb-0"
                >
                  Tiene contacto de emergencia
                </Label>
              </div>
              {tieneContactoEmergencia && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="contacto_emergencia_nombre" className="text-[14px] font-medium text-[#374151] font-['Inter'] flex items-center gap-1.5">
                      Nombre del Contacto
                      <span className="text-[#EF4444]">*</span>
                    </Label>
                    <Input
                      id="contacto_emergencia_nombre"
                      placeholder="Ej: María Pérez"
                      value={formData.contacto_emergencia_nombre}
                      onChange={(e) => setFormData({ ...formData, contacto_emergencia_nombre: e.target.value })}
                      autoComplete="off"
                      className="h-[48px] border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[15px] font-['Inter'] placeholder:text-[#9CA3AF] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contacto_emergencia_telefono" className="text-[14px] font-medium text-[#374151] font-['Inter'] flex items-center gap-1.5">
                      Teléfono de Emergencia
                      <span className="text-[#EF4444]">*</span>
                    </Label>
                    <Input
                      id="contacto_emergencia_telefono"
                      placeholder="Ej: +54 11 1234-5678"
                      value={formData.contacto_emergencia_telefono}
                      onChange={(e) => setFormData({ ...formData, contacto_emergencia_telefono: e.target.value })}
                      autoComplete="off"
                      className="h-[48px] border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[15px] font-['Inter'] placeholder:text-[#9CA3AF] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
          )}
        </div>

        {/* Footer fijo */}
        <DialogFooter className="px-8 max-lg:px-4 py-4 border-t border-[#E5E7EB] bg-[#F9FAFB] flex flex-row max-lg:flex-col justify-end items-center gap-3 max-lg:gap-2 flex-shrink-0 mt-0">
          <div className="flex gap-3 max-lg:flex-col max-lg:w-full max-lg:gap-2">
            {step === 'dni' ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={pacienteExistente ? () => { setPacienteExistente(null); setDniInput(''); } : handleCancel}
                  className="h-[48px] max-lg:h-11 px-6 rounded-[12px] border-[1.5px] border-[#D1D5DB] font-medium font-['Inter'] text-[15px] hover:bg-white hover:border-[#9CA3AF] transition-all duration-200 max-lg:w-full"
                >
                  {pacienteExistente ? 'Otro DNI' : 'Cerrar'}
                </Button>
                {!pacienteExistente ? (
                  <Button
                    type="button"
                    onClick={handleBuscarDni}
                    disabled={isSearchingDni}
                    className="h-[48px] max-lg:h-11 px-8 rounded-[12px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-lg shadow-[#2563eb]/30 font-semibold font-['Inter'] text-[15px] transition-all duration-200 disabled:opacity-50 max-lg:w-full"
                  >
                    {isSearchingDni ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin stroke-[2.5]" />
                        Buscando...
                      </>
                    ) : (
                      'Buscar por DNI'
                    )}
                  </Button>
                ) : (
                  <>
                    {profesionalIdToAssign != null && onVincularExistente && !vinculadoOk ? (
                      <Button
                        type="button"
                        onClick={handleVincularExistente}
                        disabled={isVincularLoading}
                        className="h-[48px] max-lg:h-11 px-8 rounded-[12px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-lg shadow-[#2563eb]/30 font-semibold font-['Inter'] text-[15px] transition-all duration-200 disabled:opacity-50 max-lg:w-full inline-flex items-center gap-2"
                      >
                        {isVincularLoading ? (
                          <Loader2 className="h-5 w-5 animate-spin stroke-[2.5]" />
                        ) : (
                          <Link2 className="h-5 w-5 stroke-[2]" />
                        )}
                        Vincular
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        onClick={handleVerFicha}
                        className="h-[48px] max-lg:h-11 px-8 rounded-[12px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-lg shadow-[#2563eb]/30 font-semibold font-['Inter'] text-[15px] transition-all duration-200 max-lg:w-full inline-flex items-center gap-2"
                      >
                        <ExternalLink className="h-5 w-5 stroke-[2]" />
                        Ver ficha
                      </Button>
                    )}
                  </>
                )}
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
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
                    'Crear Paciente'
                  )}
                </Button>
              </>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
