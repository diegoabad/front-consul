import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DatePicker } from '@/components/ui/date-picker';
import { Loader2 } from 'lucide-react';
import { agendaService, type CreateAgendaData } from '@/services/agenda.service';
import { profesionalesService } from '@/services/profesionales.service';
import type { ConfiguracionAgenda } from '@/types';
import { cn, formatDisplayText } from '@/lib/utils';
import { toast as reactToastify } from 'react-toastify';
import { DIAS_SEMANA, formatTime, getDiaSemanaLabel, horariosSeSolapan } from '../utils';
import { startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';

export interface CreateAgendaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Si se pasa, se oculta el selector de profesional y se usa este id (ej. desde Turnos) */
  presetProfesionalId?: string;
  /** Para editar una configuración de un solo día */
  editingAgenda?: ConfiguracionAgenda | null;
  onSuccess?: () => void;
}

const defaultForm: CreateAgendaData & { vigencia_desde?: string } = {
  profesional_id: '',
  dia_semana: 1,
  hora_inicio: '09:00',
  hora_fin: '18:00',
  duracion_turno_minutos: 30,
  activo: true,
  vigencia_desde: format(new Date(), 'yyyy-MM-dd'),
};

export function CreateAgendaModal({
  open,
  onOpenChange,
  presetProfesionalId,
  editingAgenda,
  onSuccess,
}: CreateAgendaModalProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [agendaForm, setAgendaForm] = useState<CreateAgendaData & { vigencia_desde?: string }>(() => ({ ...defaultForm, vigencia_desde: format(new Date(), 'yyyy-MM-dd') }));
  const [diasHorarios, setDiasHorarios] = useState<Record<number, { hora_inicio: string; hora_fin: string }>>(
    () => Object.fromEntries(DIAS_SEMANA.map((d) => [d.value, { hora_inicio: '09:00', hora_fin: '18:00' }]))
  );
  const [diasActivos, setDiasActivos] = useState<Record<number, boolean>>(
    () => Object.fromEntries(DIAS_SEMANA.map((d) => [d.value, d.value >= 1 && d.value <= 5]))
  );
  const [diasFijosSemana, setDiasFijosSemana] = useState(true);
  const [, setPrimeraFechaPuntual] = useState({
    fecha: format(new Date(), 'yyyy-MM-dd'),
    hora_inicio: '09:00',
    hora_fin: '18:00',
    duracion_turno_minutos: 30,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: profesionales = [] } = useQuery({
    queryKey: ['profesionales'],
    queryFn: () => profesionalesService.getAll(),
    enabled: open,
  });

  const profesionalLogueado = useMemo(
    () => profesionales.find((p: { usuario_id?: string }) => p.usuario_id === user?.id),
    [profesionales, user?.id]
  );
  const effectivePresetProfesionalId = presetProfesionalId ?? (user?.rol === 'profesional' && profesionalLogueado ? profesionalLogueado.id : undefined);
  /** Cuando hay preset (desde Turnos o porque es profesional), el selector se muestra pero deshabilitado con ese valor */
  const profesionalSelectorDisabled = Boolean(effectivePresetProfesionalId);

  const excepcionesDateRangeLista = useMemo(() => {
    const start = startOfMonth(subMonths(new Date(), 12));
    const end = endOfMonth(addMonths(new Date(), 24));
    return { fecha_desde: format(start, 'yyyy-MM-dd'), fecha_hasta: format(end, 'yyyy-MM-dd') };
  }, []);
  const { data: todasLasAgendas = [] } = useQuery({
    queryKey: ['agendas', 'todos-para-nueva'],
    queryFn: () => agendaService.getAllAgenda({ activo: true, vigente: false }),
    enabled: open,
  });
  const { data: todasLasExcepciones = [] } = useQuery({
    queryKey: ['excepciones', 'todos-para-lista', excepcionesDateRangeLista.fecha_desde, excepcionesDateRangeLista.fecha_hasta],
    queryFn: () => agendaService.getAllExcepciones(excepcionesDateRangeLista),
    enabled: open,
  });
  const profesionalesConAgendaIds = useMemo(
    () =>
      new Set([
        ...todasLasAgendas.map((a) => a.profesional_id),
        ...todasLasExcepciones.map((e) => e.profesional_id),
      ]),
    [todasLasAgendas, todasLasExcepciones]
  );

  useEffect(() => {
    if (!open) return;
    if (effectivePresetProfesionalId) {
      setAgendaForm((prev) => ({ ...prev, profesional_id: effectivePresetProfesionalId }));
    }
    if (editingAgenda) {
      setAgendaForm({
        profesional_id: editingAgenda.profesional_id,
        dia_semana: editingAgenda.dia_semana,
        hora_inicio: formatTime(editingAgenda.hora_inicio),
        hora_fin: formatTime(editingAgenda.hora_fin),
        duracion_turno_minutos: editingAgenda.duracion_turno_minutos,
        activo: editingAgenda.activo,
      });
    } else if (!effectivePresetProfesionalId) {
      setAgendaForm({ ...defaultForm, vigencia_desde: format(new Date(), 'yyyy-MM-dd') });
      setDiasHorarios(Object.fromEntries(DIAS_SEMANA.map((d) => [d.value, { hora_inicio: '09:00', hora_fin: '18:00' }])));
      setDiasActivos(Object.fromEntries(DIAS_SEMANA.map((d) => [d.value, d.value >= 1 && d.value <= 5])));
      setDiasFijosSemana(true);
      setPrimeraFechaPuntual({
        fecha: format(new Date(), 'yyyy-MM-dd'),
        hora_inicio: '09:00',
        hora_fin: '18:00',
        duracion_turno_minutos: 30,
      });
    }
  }, [open, effectivePresetProfesionalId, editingAgenda]);

  const updateAgendaMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateAgendaData> }) =>
      agendaService.updateAgenda(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agendas'] });
      onOpenChange(false);
      onSuccess?.();
      reactToastify.success('Configuración de agenda actualizada correctamente', { position: 'top-right', autoClose: 3000 });
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      reactToastify.error(err?.response?.data?.message || 'Error al actualizar', { position: 'top-right', autoClose: 3000 });
    },
  });

  const handleSubmit = async () => {
    const profesionalId = agendaForm.profesional_id || effectivePresetProfesionalId;
    if (!profesionalId) {
      reactToastify.error('Selecciona un profesional', { position: 'top-right', autoClose: 3000 });
      return;
    }
    if (editingAgenda) {
      await updateAgendaMutation.mutateAsync({ id: editingAgenda.id, data: agendaForm });
      return;
    }
    if (diasFijosSemana) {
      const algunDiaActivo = DIAS_SEMANA.some((d) => diasActivos[d.value]);
      if (!algunDiaActivo) {
        reactToastify.error('Seleccioná al menos un día de la semana', { position: 'top-right', autoClose: 3000 });
        return;
      }
    }
    setIsSubmitting(true);
    try {
      if (!diasFijosSemana) {
        // Sin días fijos: un solo período abierto (vigencia desde, sin hasta). El calendario no muestra ningún día hasta que use "Habilitar" en Turnos.
        const vigenciaDesde = (agendaForm.vigencia_desde ?? format(new Date(), 'yyyy-MM-dd')).toString().trim().slice(0, 10);
        await agendaService.guardarHorariosSemana(
          profesionalId,
          [],
          vigenciaDesde,
          agendaForm.duracion_turno_minutos ?? 30,
          undefined
        );
        queryClient.invalidateQueries({ queryKey: ['agendas'] });
        reactToastify.success('Listo. Podés usar el botón "Habilitar" en Turnos para agregar los días que atienda.', {
          position: 'top-right',
          autoClose: 5000,
        });
        onOpenChange(false);
        onSuccess?.();
        return;
      }
      const agendasExistentes = await agendaService.getAgendaByProfesional(profesionalId);
      const diasConSolapamiento: string[] = [];
      for (const dia of DIAS_SEMANA) {
        if (!diasActivos[dia.value]) continue;
        const { hora_inicio, hora_fin } = diasHorarios[dia.value] ?? { hora_inicio: '09:00', hora_fin: '18:00' };
        if (!hora_inicio || !hora_fin || hora_inicio >= hora_fin) continue;
        const existentesDelDia = agendasExistentes.filter((a) => a.dia_semana === dia.value);
        const configsAComparar = existentesDelDia.length > 0 ? existentesDelDia.slice(1) : existentesDelDia;
        const solapa = configsAComparar.some((a) =>
          horariosSeSolapan(hora_inicio, hora_fin, formatTime(a.hora_inicio), formatTime(a.hora_fin))
        );
        if (solapa) diasConSolapamiento.push(getDiaSemanaLabel(dia.value));
      }
      if (diasConSolapamiento.length > 0) {
        reactToastify.error(`El profesional ya tiene horarios en: ${diasConSolapamiento.join(', ')}. No se pueden superponer.`, {
          position: 'top-right',
          autoClose: 5000,
        });
        return;
      }
      let creados = 0;
      let actualizados = 0;
      for (const dia of DIAS_SEMANA) {
        if (!diasActivos[dia.value]) continue;
        const { hora_inicio, hora_fin } = diasHorarios[dia.value] ?? { hora_inicio: '09:00', hora_fin: '18:00' };
        if (!hora_inicio || !hora_fin || hora_inicio >= hora_fin) continue;
        const existentesDelDia = agendasExistentes.filter((a) => a.dia_semana === dia.value);
        const dataDia = {
          hora_inicio,
          hora_fin,
          duracion_turno_minutos: agendaForm.duracion_turno_minutos ?? 30,
          activo: agendaForm.activo ?? true,
        };
        if (existentesDelDia.length > 0) {
          await agendaService.updateAgenda(existentesDelDia[0].id, dataDia);
          actualizados++;
        } else {
          await agendaService.createAgenda({
            profesional_id: profesionalId,
            dia_semana: dia.value,
            ...dataDia,
            vigencia_desde: agendaForm.vigencia_desde ?? format(new Date(), 'yyyy-MM-dd'),
          });
          creados++;
        }
      }
      if (creados > 0 || actualizados > 0) {
        queryClient.invalidateQueries({ queryKey: ['agendas'] });
        const mensajes: string[] = [];
        if (creados > 0) mensajes.push(creados === 1 ? '1 día creado' : `${creados} días creados`);
        if (actualizados > 0) mensajes.push(actualizados === 1 ? '1 día actualizado' : `${actualizados} días actualizados`);
        reactToastify.success(`Agenda guardada: ${mensajes.join(', ')}.`, { position: 'top-right', autoClose: 3000 });
        onOpenChange(false);
        onSuccess?.();
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Error al guardar la agenda';
      reactToastify.error(msg, { position: 'top-right', autoClose: 4000 });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[900px] max-h-[90vh] rounded-[20px] p-0 border border-[#E5E7EB] shadow-2xl gap-0 flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 max-lg:px-4 max-lg:pt-5 border-b border-[#E5E7EB] bg-gradient-to-b from-white to-[#F9FAFB] mb-0">
          <DialogTitle className="text-[24px] max-lg:text-[20px] font-bold text-[#111827] font-['Poppins'] leading-tight mb-0">
            {editingAgenda ? 'Editar configuración' : 'Nueva Agenda'}
          </DialogTitle>
          <DialogDescription className="text-base max-lg:text-sm text-[#6B7280] font-['Inter'] mt-1 mb-0">
            {editingAgenda ? 'Modifica horario y duración del turno' : 'Configura los horarios disponibles por día'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-6 max-lg:px-4 max-lg:py-4 space-y-5">
          {editingAgenda ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <Label className="text-[15px] font-medium text-[#374151] font-['Inter']">Día</Label>
                  <p className="h-[52px] flex items-center text-[#374151] font-['Inter']">{getDiaSemanaLabel(agendaForm.dia_semana)}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <Label className="text-[15px] font-medium text-[#374151] font-['Inter']">Hora inicio</Label>
                    <Input
                      type="time"
                      value={agendaForm.hora_inicio}
                      onChange={(e) => setAgendaForm({ ...agendaForm, hora_inicio: e.target.value })}
                      className="h-[52px] border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[16px] font-['Inter']"
                    />
                  </div>
                  <div className="space-y-3">
                    <Label className="text-[15px] font-medium text-[#374151] font-['Inter']">Hora fin</Label>
                    <Input
                      type="time"
                      value={agendaForm.hora_fin}
                      onChange={(e) => setAgendaForm({ ...agendaForm, hora_fin: e.target.value })}
                      className="h-[52px] border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[16px] font-['Inter']"
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-3 w-full">
                <Label htmlFor="duracion_turno_minutos" className="text-[15px] font-medium text-[#374151] font-['Inter']">
                  Duración del turno (min)
                </Label>
                <Input
                  id="duracion_turno_minutos"
                  type="number"
                  min={5}
                  max={480}
                  value={agendaForm.duracion_turno_minutos}
                  onChange={(e) => setAgendaForm({ ...agendaForm, duracion_turno_minutos: parseInt(e.target.value) || 30 })}
                  className="h-[52px] border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[16px] font-['Inter']"
                  placeholder="30"
                />
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col md:flex-row gap-4 w-full">
                <div className="space-y-2 w-full flex-1 min-w-0">
                  <Label htmlFor="profesional_id" className="text-[15px] font-medium text-[#374151] font-['Inter']">
                    Profesional <span className="text-[#EF4444]">*</span>
                  </Label>
                  <Select
                    value={agendaForm.profesional_id}
                    onValueChange={(value) => setAgendaForm({ ...agendaForm, profesional_id: value })}
                    disabled={profesionalSelectorDisabled}
                  >
                    <SelectTrigger id="profesional_id" className="h-[52px] w-full border-[1.5px] border-[#D1D5DB] rounded-[10px] font-['Inter'] text-[16px] text-left justify-start focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 [&>span]:text-left [&>span]:line-clamp-none [&>span]:whitespace-nowrap disabled:opacity-100 disabled:cursor-not-allowed">
                      <SelectValue placeholder="Seleccionar profesional" />
                    </SelectTrigger>
                    <SelectContent className="rounded-[12px] border-[#E5E7EB] shadow-xl max-h-[300px]">
                      {profesionales.map((prof) => {
                        const yaTieneAgenda = profesionalesConAgendaIds.has(prof.id);
                        return (
                          <SelectItem
                            key={prof.id}
                            value={prof.id}
                            disabled={yaTieneAgenda}
                            className="font-['Inter'] rounded-[8px] text-[15px] py-3"
                          >
                            <span className="truncate">
                              {formatDisplayText(prof.nombre)} {formatDisplayText(prof.apellido)}
                              {prof.especialidad ? ` - ${formatDisplayText(prof.especialidad)}` : ''}
                            </span>
                            {yaTieneAgenda && <span className="ml-2 text-xs text-[#6B7280] whitespace-nowrap">— Ya tiene agenda</span>}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 w-full flex-1 min-w-0">
                  <Label htmlFor="dias-fijos-switch" className="text-[15px] font-medium text-[#374151] font-['Inter']">Tipo de agenda</Label>
                  <div className="flex items-center gap-3 h-[52px] px-4 rounded-[10px] border-[1.5px] border-[#D1D5DB] bg-[#F9FAFB]">
                    {/* Mobile: switch + un solo texto que cambia según el estado */}
                    <div className="flex items-center justify-between w-full gap-3 md:hidden">
                      <span className="font-[Inter] text-[14px] text-[#374151] font-medium">
                        {diasFijosSemana ? 'Días fijos por semana' : 'Solo días puntuales'}
                      </span>
                      <Switch
                        id="dias-fijos-switch-mobile"
                        checked={diasFijosSemana}
                        onCheckedChange={(checked) => {
                          const v = checked === true;
                          setDiasFijosSemana(v);
                          if (!v) setDiasActivos(Object.fromEntries(DIAS_SEMANA.map((d) => [d.value, false])));
                        }}
                        className="data-[state=checked]:bg-[#2563eb] flex-shrink-0"
                      />
                    </div>
                    {/* Desktop: ambos textos con el switch en el medio */}
                    <>
                      <span className={cn('font-[Inter] text-[14px] hidden md:inline', !diasFijosSemana ? 'text-[#374151] font-medium' : 'text-[#9CA3AF]')}>Solo días puntuales</span>
                      <Switch
                        id="dias-fijos-switch"
                        checked={diasFijosSemana}
                        onCheckedChange={(checked) => {
                          const v = checked === true;
                          setDiasFijosSemana(v);
                          if (!v) setDiasActivos(Object.fromEntries(DIAS_SEMANA.map((d) => [d.value, false])));
                        }}
                        className="data-[state=checked]:bg-[#2563eb] flex-shrink-0 hidden md:inline-flex"
                      />
                      <span className={cn('font-[Inter] text-[14px] hidden md:inline', diasFijosSemana ? 'text-[#374151] font-medium' : 'text-[#9CA3AF]')}>Días fijos por semana</span>
                    </>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-4 w-full">
                <div className="flex flex-col sm:flex-row gap-4 w-full sm:gap-4">
                  <div className="space-y-2 w-full flex-1 min-w-0">
                    <Label htmlFor="agenda-vigencia-desde" className="text-[15px] font-medium text-[#374151] font-['Inter']">
                      Vigente desde
                    </Label>
                    <DatePicker
                      id="agenda-vigencia-desde"
                      value={agendaForm.vigencia_desde ?? format(new Date(), 'yyyy-MM-dd')}
                      onChange={(v) => setAgendaForm({ ...agendaForm, vigencia_desde: v })}
                      placeholder="Elegir fecha"
                      className="h-[52px] w-full text-[#374151] justify-start pl-3"
                      min={format(new Date(), 'yyyy-MM-dd')}
                      inline
                    />
                  </div>
                  <div className="space-y-2 w-full flex-1 min-w-0">
                    <Label htmlFor="duracion_turno_minutos_new" className="text-[15px] font-medium text-[#374151] font-['Inter']">
                      Duración del turno (min)
                    </Label>
                    <Input
                      id="duracion_turno_minutos_new"
                      type="number"
                      min={5}
                      max={480}
                      value={agendaForm.duracion_turno_minutos}
                      onChange={(e) => setAgendaForm({ ...agendaForm, duracion_turno_minutos: parseInt(e.target.value) || 30 })}
                      disabled={!diasFijosSemana}
                      className="h-[52px] w-full border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[16px] font-['Inter'] disabled:opacity-60 disabled:cursor-not-allowed"
                      placeholder="30"
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <Label className="text-[15px] font-medium text-[#374151] font-['Inter'] flex flex-wrap items-baseline gap-1">
                  Horario por día
                  <span className="text-[13px] font-normal text-[#6B7280]">
                    {diasFijosSemana
                      ? '— Marca los días que trabaja y el horario de cada uno.'
                      : '— Agregá días desde Habilitar.'}
                  </span>
                </Label>
                <div className={`rounded-[12px] border border-[#E5E7EB] overflow-x-auto ${!diasFijosSemana ? 'opacity-70 pointer-events-none' : ''}`}>
                  <Table className="w-full min-w-[320px]">
                    <TableHeader>
                      <TableRow className="bg-[#F9FAFB] border-[#E5E7EB]">
                        <TableHead className="font-['Inter'] text-[14px] text-[#374151] w-[80px]">Trabaja</TableHead>
                        <TableHead className="font-['Inter'] text-[14px] text-[#374151]">Día</TableHead>
                        <TableHead className="font-['Inter'] text-[14px] text-[#374151] min-w-[100px]">Hora inicio</TableHead>
                        <TableHead className="font-['Inter'] text-[14px] text-[#374151] min-w-[100px]">Hora fin</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {DIAS_SEMANA.map((dia) => (
                        <TableRow key={dia.value} className="border-[#E5E7EB]">
                          <TableCell className="py-3 w-[80px]">
                            <Switch
                              id={`dia-${dia.value}`}
                              checked={!!diasActivos[dia.value]}
                              onCheckedChange={(checked) => setDiasActivos((prev) => ({ ...prev, [dia.value]: checked }))}
                              disabled={!diasFijosSemana}
                              className="data-[state=checked]:bg-[#2563eb]"
                            />
                          </TableCell>
                          <TableCell className="font-['Inter'] text-[15px] text-[#374151] py-3">{dia.label}</TableCell>
                          <TableCell className="py-2 min-w-[100px]">
                            <Input
                              type="time"
                              value={diasHorarios[dia.value]?.hora_inicio ?? '09:00'}
                              onChange={(e) =>
                                setDiasHorarios((prev) => ({
                                  ...prev,
                                  [dia.value]: { ...prev[dia.value], hora_inicio: e.target.value, hora_fin: prev[dia.value]?.hora_fin ?? '18:00' },
                                }))
                              }
                              disabled={!diasFijosSemana || !diasActivos[dia.value]}
                              className="h-10 border-[#D1D5DB] rounded-[8px] text-[14px] font-['Inter'] w-full disabled:opacity-50 disabled:bg-[#F9FAFB]"
                            />
                          </TableCell>
                          <TableCell className="py-2 min-w-[100px]">
                            <Input
                              type="time"
                              value={diasHorarios[dia.value]?.hora_fin ?? '18:00'}
                              onChange={(e) =>
                                setDiasHorarios((prev) => ({
                                  ...prev,
                                  [dia.value]: { hora_inicio: prev[dia.value]?.hora_inicio ?? '09:00', hora_fin: e.target.value },
                                }))
                              }
                              disabled={!diasFijosSemana || !diasActivos[dia.value]}
                              className="h-10 border-[#D1D5DB] rounded-[8px] text-[14px] font-['Inter'] w-full disabled:opacity-50 disabled:bg-[#F9FAFB]"
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="flex-shrink-0 px-6 py-4 max-lg:px-4 border-t border-[#E5E7EB] bg-[#F9FAFB] flex flex-row justify-end gap-3 max-lg:flex-col max-lg:gap-4 mt-0 pt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-[48px] px-6 max-lg:w-full rounded-[12px] border-[1.5px] border-[#D1D5DB] font-medium font-['Inter'] text-[15px]"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              isSubmitting ||
              updateAgendaMutation.isPending ||
              (!editingAgenda && (!agendaForm.profesional_id && !effectivePresetProfesionalId)) ||
              (!editingAgenda && diasFijosSemana && !DIAS_SEMANA.some((d) => diasActivos[d.value]))
            }
            className="h-[48px] px-8 max-lg:w-full rounded-[12px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-lg font-semibold font-['Inter'] text-[15px] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting || updateAgendaMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin stroke-[2.5]" />
                Guardando...
              </>
            ) : editingAgenda ? (
              'Actualizar'
            ) : (
              'Crear agenda'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
