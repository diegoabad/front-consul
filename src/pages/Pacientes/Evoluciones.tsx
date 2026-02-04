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
import { ConfirmDeleteModal } from '@/components/shared/ConfirmDeleteModal';
import { Plus, Edit, Trash2, Loader2, Stethoscope, Calendar, Eye } from 'lucide-react';
import { evolucionesService, type CreateEvolucionData, type UpdateEvolucionData } from '@/services/evoluciones.service';
import { pacientesService } from '@/services/pacientes.service';
import { profesionalesService } from '@/services/profesionales.service';
import type { Evolucion } from '@/types';
import { toast as reactToastify } from 'react-toastify';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/utils/permissions';
import { AlertCircle } from 'lucide-react';
import { CreateEvolucionModal, EditEvolucionModal, ViewEvolucionModal } from './modals';

interface PacienteEvolucionesProps {
  pacienteId: string;
}

export default function PacienteEvoluciones({ pacienteId }: PacienteEvolucionesProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedEvolucion, setSelectedEvolucion] = useState<Evolucion | null>(null);
  const [evolucionToDelete, setEvolucionToDelete] = useState<Evolucion | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: paciente } = useQuery({
    queryKey: ['paciente', pacienteId],
    queryFn: () => pacientesService.getById(pacienteId),
  });

  // Obtener el profesional asociado al usuario logueado si es profesional
  const { data: profesionales = [] } = useQuery({
    queryKey: ['profesionales', 'for-filter'],
    queryFn: () => profesionalesService.getAll({ bloqueado: false }),
  });

  const profesionalLogueado = profesionales.find(p => p.usuario_id === user?.id);
  const isProfesional = user?.rol === 'profesional';

  const { data: evoluciones = [], isLoading } = useQuery({
    queryKey: ['evoluciones', 'paciente', pacienteId, profesionalLogueado?.id],
    queryFn: () => {
      // Si es profesional, filtrar por profesional_id
      if (isProfesional && profesionalLogueado) {
        return evolucionesService.getAll({
          paciente_id: pacienteId,
          profesional_id: profesionalLogueado.id,
        });
      }
      // Si no es profesional, obtener todas las evoluciones del paciente
      return evolucionesService.getByPaciente(pacienteId);
    },
    enabled: !isProfesional || !!profesionalLogueado,
  });


  const sortedEvoluciones = [...evoluciones].sort((a, b) => {
    return new Date(b.fecha_consulta).getTime() - new Date(a.fecha_consulta).getTime();
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateEvolucionData) => evolucionesService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evoluciones', 'paciente', pacienteId] });
      setShowCreateModal(false);
      reactToastify.success('Evolución creada correctamente', {
        position: 'top-right',
        autoClose: 3000,
      });
    },
    onError: (error: any) => {
      const errorData = error.response?.data?.error || {};
      let errorMessage = 'Error al crear evolución';
      
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
    mutationFn: ({ id, data }: { id: string; data: UpdateEvolucionData }) =>
      evolucionesService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evoluciones', 'paciente', pacienteId] });
      setShowEditModal(false);
      setSelectedEvolucion(null);
      reactToastify.success('Evolución actualizada correctamente', {
        position: 'top-right',
        autoClose: 3000,
      });
    },
    onError: (error: any) => {
      const errorData = error.response?.data?.error || {};
      let errorMessage = 'Error al actualizar evolución';
      
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
    mutationFn: (id: string) => evolucionesService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evoluciones', 'paciente', pacienteId] });
      reactToastify.success('Evolución eliminada correctamente', {
        position: 'top-right',
        autoClose: 3000,
      });
    },
    onError: (error: any) => {
      const errorData = error.response?.data?.error || {};
      let errorMessage = 'Error al eliminar evolución';
      
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

  const handleCreate = async (data: CreateEvolucionData) => {
    setIsSubmitting(true);
    try {
      await createMutation.mutateAsync(data);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (evolucion: Evolucion) => {
    setSelectedEvolucion(evolucion);
    setShowEditModal(true);
  };

  const handleUpdate = async (id: string, data: UpdateEvolucionData) => {
    setIsSubmitting(true);
    try {
      await updateMutation.mutateAsync({ id, data });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (evolucion: Evolucion) => {
    setEvolucionToDelete(evolucion);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!evolucionToDelete) return;
    setIsSubmitting(true);
    try {
      await deleteMutation.mutateAsync(evolucionToDelete.id);
      setShowDeleteModal(false);
      setEvolucionToDelete(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const canCreate = hasPermission(user, 'evoluciones.crear');
  const canUpdate = hasPermission(user, 'evoluciones.actualizar');
  const canDelete = hasPermission(user, 'evoluciones.eliminar');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-16">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-[#2563eb]" />
          <p className="text-[#6B7280] font-['Inter']">Cargando evoluciones...</p>
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
                  No se pueden crear nuevas evoluciones clínicas para pacientes inactivos.
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
            Evoluciones Clínicas
          </h2>
          <p className="text-base text-[#6B7280] mt-1 font-['Inter']">
            {sortedEvoluciones.length} {sortedEvoluciones.length === 1 ? 'evolución registrada' : 'evoluciones registradas'}
          </p>
        </div>
        <div className="flex gap-3">
          {canCreate && (
            <Button 
              onClick={() => setShowCreateModal(true)}
              disabled={pacienteInactivo}
              title={pacienteInactivo ? 'No se pueden crear evoluciones para pacientes inactivos' : ''}
              className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-md shadow-[#2563eb]/20 hover:shadow-lg hover:shadow-[#2563eb]/30 transition-all duration-200 rounded-[12px] px-6 h-12 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="h-5 w-5 mr-2 stroke-[2]" />
              Nueva Evolución
            </Button>
          )}
        </div>
      </div>

      {/* Empty State o Lista */}
      {sortedEvoluciones.length === 0 ? (
        <Card className="border border-[#E5E7EB] rounded-[16px] shadow-sm">
          <CardContent className="p-16 text-center">
            <div className="h-20 w-20 rounded-full bg-[#dbeafe] flex items-center justify-center mx-auto mb-4">
              <Stethoscope className="h-10 w-10 text-[#2563eb] stroke-[2]" />
            </div>
            <h3 className="text-lg font-semibold mb-2 text-[#374151] font-['Inter']">
              No hay evoluciones clínicas
            </h3>
            <p className="text-[#6B7280] mb-6 font-['Inter']">
              {pacienteInactivo 
                ? 'Este paciente está inactivo. No se pueden crear nuevas evoluciones clínicas.' 
                : 'Aún no se han registrado evoluciones clínicas para este paciente'
              }
            </p>
            {canCreate && !pacienteInactivo && (
              <Button 
                onClick={() => setShowCreateModal(true)}
                className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-md shadow-[#2563eb]/20 hover:shadow-lg hover:shadow-[#2563eb]/30 transition-all duration-200 rounded-[12px] px-6 py-3 h-auto font-medium"
              >
                <Plus className="h-5 w-5 mr-2 stroke-[2]" />
                Nueva Evolución
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {sortedEvoluciones.map((evolucion) => (
            <Card key={evolucion.id} className="border border-[#E5E7EB] rounded-[12px] shadow-sm hover:shadow-md transition-all duration-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#DBEAFE] to-[#BFDBFE] flex items-center justify-center shadow-sm flex-shrink-0">
                      <Stethoscope className="h-5 w-5 text-[#3B82F6] stroke-[2]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <p className="text-[16px] font-semibold text-[#111827] font-['Inter'] mb-0">
                          {evolucion.profesional_nombre} {evolucion.profesional_apellido}
                        </p>
                        <div className="flex items-center gap-2 text-[#6B7280]">
                          <Calendar className="h-4 w-4 stroke-[2] flex-shrink-0" />
                          <p className="text-[14px] font-['Inter'] mb-0">
                            {format(new Date(evolucion.fecha_consulta), "dd 'de' MMMM 'de' yyyy 'a las' HH:mm", { locale: es })}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            onClick={() => {
                              setSelectedEvolucion(evolucion);
                              setShowViewModal(true);
                            }}
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 rounded-[8px] hover:bg-[#F3F4F6]"
                          >
                            <Eye className="h-5 w-5 text-[#6B7280] stroke-[2]" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent className="bg-[#111827] text-white text-xs font-['Inter'] rounded-[8px] px-3 py-2 [&>p]:text-white">
                          <p className="text-white">Ver Evolución</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    {canUpdate && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              onClick={() => handleEdit(evolucion)}
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
                              onClick={() => handleDelete(evolucion)}
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
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modales */}
      <CreateEvolucionModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        pacienteId={pacienteId}
        onSubmit={handleCreate}
        isSubmitting={isSubmitting}
      />

      {selectedEvolucion && (
        <>
          <ViewEvolucionModal
            open={showViewModal}
            onOpenChange={setShowViewModal}
            evolucion={selectedEvolucion}
          />
          <EditEvolucionModal
            open={showEditModal}
            onOpenChange={setShowEditModal}
            evolucion={selectedEvolucion}
            onSubmit={handleUpdate}
            isSubmitting={isSubmitting}
          />
        </>
      )}

      <ConfirmDeleteModal
        open={showDeleteModal}
        onOpenChange={(open) => { setShowDeleteModal(open); if (!open) setEvolucionToDelete(null); }}
        title="Eliminar Evolución Clínica"
        description="¿Estás seguro de que deseas eliminar esta evolución clínica? Esta acción no se puede deshacer y se eliminará permanentemente."
        onConfirm={handleConfirmDelete}
        isLoading={isSubmitting}
      />
    </div>
  );
}