import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Plus, Edit, Trash2, Loader2, StickyNote, Clock } from 'lucide-react';
import { notasService, type CreateNotaData, type UpdateNotaData } from '@/services/notas.service';
import { pacientesService } from '@/services/pacientes.service';
import type { Nota } from '@/types';
import { toast as reactToastify } from 'react-toastify';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/utils/permissions';
import { formatDisplayText } from '@/lib/utils';
import { AlertCircle } from 'lucide-react';
import { CreateNotaModal, EditNotaModal } from './modals';

interface PacienteNotasProps {
  pacienteId: string;
}

export default function PacienteNotas({ pacienteId }: PacienteNotasProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedNota, setSelectedNota] = useState<Nota | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: paciente } = useQuery({
    queryKey: ['paciente', pacienteId],
    queryFn: () => pacientesService.getById(pacienteId),
  });

  const isProfesional = user?.rol === 'profesional';

  const { data: notas = [], isLoading } = useQuery({
    queryKey: ['notas', 'paciente', pacienteId, user?.id],
    queryFn: () => {
      // Si es profesional, filtrar por usuario_id
      if (isProfesional && user?.id) {
        return notasService.getAll({
          paciente_id: pacienteId,
          usuario_id: user.id,
        });
      }
      // Si no es profesional, obtener todas las notas del paciente
      return notasService.getByPaciente(pacienteId);
    },
    enabled: !isProfesional || !!user?.id,
  });



  const createMutation = useMutation({
    mutationFn: (data: CreateNotaData) => notasService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notas', 'paciente', pacienteId] });
      setShowCreateModal(false);
      reactToastify.success('Nota creada correctamente', {
        position: 'top-right',
        autoClose: 3000,
      });
    },
    onError: (error: any) => {
      const errorData = error.response?.data?.error || {};
      let errorMessage = 'Error al crear nota';
      
      if (errorData.details && Array.isArray(errorData.details) && errorData.details.length > 0) {
        const detailsMessages = errorData.details.map((d: any) => d.message).join('. ');
        errorMessage = detailsMessages;
      } else if (errorData.message) {
        errorMessage = errorData.message;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      
      reactToastify.error(errorMessage, {
        position: 'top-right',
        autoClose: 3000,
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateNotaData }) =>
      notasService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notas', 'paciente', pacienteId] });
      setShowEditModal(false);
      setSelectedNota(null);
      reactToastify.success('Nota actualizada correctamente', {
        position: 'top-right',
        autoClose: 3000,
      });
    },
    onError: (error: any) => {
      const errorData = error.response?.data?.error || {};
      let errorMessage = 'Error al actualizar nota';
      
      if (errorData.details && Array.isArray(errorData.details) && errorData.details.length > 0) {
        const detailsMessages = errorData.details.map((d: any) => d.message).join('. ');
        errorMessage = detailsMessages;
      } else if (errorData.message) {
        errorMessage = errorData.message;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      
      reactToastify.error(errorMessage, {
        position: 'top-right',
        autoClose: 3000,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => notasService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notas', 'paciente', pacienteId] });
      reactToastify.success('Nota eliminada correctamente', {
        position: 'top-right',
        autoClose: 3000,
      });
    },
    onError: (error: any) => {
      const errorData = error.response?.data?.error || {};
      let errorMessage = 'Error al eliminar nota';
      
      if (errorData.details && Array.isArray(errorData.details) && errorData.details.length > 0) {
        const detailsMessages = errorData.details.map((d: any) => d.message).join('. ');
        errorMessage = detailsMessages;
      } else if (errorData.message) {
        errorMessage = errorData.message;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      
      reactToastify.error(errorMessage, {
        position: 'top-right',
        autoClose: 3000,
      });
    },
  });

  const handleCreate = async (data: CreateNotaData) => {
    setIsSubmitting(true);
    try {
      await createMutation.mutateAsync(data);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (nota: Nota) => {
    setSelectedNota(nota);
    setShowEditModal(true);
  };

  const handleUpdate = async (id: string, data: UpdateNotaData) => {
    setIsSubmitting(true);
    try {
      await updateMutation.mutateAsync({ id, data });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Está seguro de eliminar esta nota?')) {
      await deleteMutation.mutateAsync(id);
    }
  };

  const canCreate = hasPermission(user, 'notas.crear');
  const canUpdate = hasPermission(user, 'notas.actualizar');
  const canDelete = hasPermission(user, 'notas.eliminar');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-16">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-[#2563eb]" />
          <p className="text-[#6B7280] font-['Inter']">Cargando notas...</p>
        </div>
      </div>
    );
  }

  const pacienteInactivo = !!(paciente && !paciente.activo);

  return (
    <div className="space-y-6">
      {/* Alerta paciente inactivo */}
      {pacienteInactivo && (
        <Card className="bg-[#FEF3C7] border-[1.5px] border-[#F59E0B] rounded-[16px]">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-[#FDE047] flex items-center justify-center flex-shrink-0">
                <AlertCircle className="h-5 w-5 text-[#92400E] stroke-[2]" />
              </div>
              <div>
                <p className="text-sm text-[#92400E] font-semibold font-['Inter']">
                  Paciente Inactivo
                </p>
                <p className="text-sm text-[#92400E] font-['Inter'] mt-0.5">
                  No se pueden crear nuevas notas para pacientes inactivos.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-[24px] font-bold text-[#111827] font-['Poppins'] mb-0">
            Notas del Paciente
          </h2>
          <p className="text-base text-[#6B7280] mt-1 font-['Inter']">
            {notas.length} {notas.length === 1 ? 'nota registrada' : 'notas registradas'}
          </p>
        </div>
        <div className="flex gap-3">
          {canCreate && (
            <Button 
              onClick={() => setShowCreateModal(true)}
              disabled={pacienteInactivo}
              title={pacienteInactivo ? 'No se pueden crear notas para pacientes inactivos' : ''}
              className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-md shadow-[#2563eb]/20 hover:shadow-lg hover:shadow-[#2563eb]/30 transition-all duration-200 rounded-[12px] px-6 h-12 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="h-5 w-5 mr-2 stroke-[2]" />
              Nueva Nota
            </Button>
          )}
        </div>
      </div>

      {/* Empty State o Lista */}
      {notas.length === 0 ? (
        <Card className="border border-[#E5E7EB] rounded-[16px] shadow-sm">
          <CardContent className="p-16 text-center">
            <div className="h-20 w-20 rounded-full bg-[#dbeafe] flex items-center justify-center mx-auto mb-4">
              <StickyNote className="h-10 w-10 text-[#2563eb] stroke-[2]" />
            </div>
            <h3 className="text-lg font-semibold mb-2 text-[#374151] font-['Inter']">
              No hay notas
            </h3>
            <p className="text-[#6B7280] mb-6 font-['Inter']">
              {pacienteInactivo 
                ? 'Este paciente está inactivo. No se pueden crear nuevas notas.' 
                : 'Aún no se han creado notas para este paciente'
              }
            </p>
            {canCreate && !pacienteInactivo && (
              <Button 
                onClick={() => setShowCreateModal(true)}
                className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-md shadow-[#2563eb]/20 hover:shadow-lg hover:shadow-[#2563eb]/30 transition-all duration-200 rounded-[12px] px-6 py-3 h-auto font-medium"
              >
                <Plus className="h-5 w-5 mr-2 stroke-[2]" />
                Nueva Nota
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {notas.map((nota) => (
            <Card key={nota.id} className="border border-[#E5E7EB] rounded-[12px] shadow-sm hover:shadow-md transition-all duration-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#dbeafe] to-[#bfdbfe] flex items-center justify-center shadow-sm flex-shrink-0">
                      <StickyNote className="h-5 w-5 text-[#2563eb] stroke-[2]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <p className="text-[16px] font-semibold text-[#111827] font-['Inter'] mb-0">
                          {formatDisplayText(nota.usuario_nombre)} {formatDisplayText(nota.usuario_apellido)}
                          {nota.especialidad && (
                            <span className="text-[14px] font-normal text-[#6B7280] ml-2">
                              - {formatDisplayText(nota.especialidad)}
                            </span>
                          )}
                        </p>
                        <div className="flex items-center gap-2 text-[#6B7280]">
                          <Clock className="h-4 w-4 stroke-[2] flex-shrink-0" />
                          <p className="text-[14px] font-['Inter'] mb-0">
                            {nota.fecha_creacion
                              ? format(new Date(nota.fecha_creacion), "dd 'de' MMMM 'de' yyyy 'a las' HH:mm", {
                                  locale: es,
                                })
                              : '-'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {canUpdate && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              onClick={() => handleEdit(nota)}
                              variant="ghost"
                              size="icon"
                              className="h-10 w-10 rounded-[8px] hover:bg-[#F3F4F6]"
                            >
                              <Edit className="h-5 w-5 text-[#6B7280] stroke-[2]" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent className="bg-[#111827] text-white text-xs font-['Inter'] rounded-[8px] px-3 py-2 [&>p]:text-white">
                            <p className="text-white">Editar</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    {canDelete && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              onClick={() => handleDelete(nota.id)}
                              variant="ghost"
                              size="icon"
                              className="h-10 w-10 rounded-[8px] hover:bg-[#FEE2E2] hover:text-[#DC2626]"
                            >
                              <Trash2 className="h-5 w-5 text-[#EF4444] stroke-[2]" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent className="bg-[#111827] text-white text-xs font-['Inter'] rounded-[8px] px-3 py-2 [&>p]:text-white">
                            <p className="text-white">Eliminar</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-[#E5E7EB]">
                  <p className="text-[15px] text-[#374151] font-['Inter'] whitespace-pre-wrap leading-relaxed">
                    {nota.contenido}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modales */}
      <CreateNotaModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        pacienteId={pacienteId}
        onSubmit={handleCreate}
        isSubmitting={isSubmitting}
      />

      {selectedNota && (
        <EditNotaModal
          open={showEditModal}
          onOpenChange={setShowEditModal}
          nota={selectedNota}
          onSubmit={handleUpdate}
          isSubmitting={isSubmitting}
        />
      )}
    </div>
  );
}