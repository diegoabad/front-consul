import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  User, Shield, Bell, Eye, EyeOff, Mail, Calendar, 
  Clock, Loader2, Key, Filter, AlertCircle
} from 'lucide-react';
import { toast as reactToastify } from 'react-toastify';
import { useAuth } from '@/contexts/AuthContext';
import { usuariosService } from '@/services/usuarios.service';
import { notificacionesService } from '@/services/notificaciones.service';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

function getEstadoBadge(estado: string) {
  switch (estado) {
    case 'enviado':
      return (
        <Badge className="bg-[#D1FAE5] text-[#065F46] border-[#6EE7B7] hover:bg-[#A7F3D0] rounded-full px-3 py-1 text-xs font-medium">
          Enviado
        </Badge>
      );
    case 'pendiente':
      return (
        <Badge className="bg-[#FEF3C7] text-[#92400E] border-[#FDE047] hover:bg-[#FDE68A] rounded-full px-3 py-1 text-xs font-medium">
          Pendiente
        </Badge>
      );
    case 'fallido':
      return (
        <Badge className="bg-[#FEE2E2] text-[#991B1B] border-[#FECACA] hover:bg-[#FCA5A5] rounded-full px-3 py-1 text-xs font-medium">
          Fallido
        </Badge>
      );
    default:
      return (
        <Badge className="bg-[#F3F4F6] text-[#4B5563] border-[#D1D5DB] rounded-full px-3 py-1 text-xs font-medium">
          -
        </Badge>
      );
  }
}

function getRolBadge(rol: string) {
  const roleColors: Record<string, string> = {
    administrador: 'bg-[#EDE9FE] text-[#7C3AED] border-[#DDD6FE]',
    profesional: 'bg-[#DBEAFE] text-[#1E40AF] border-[#BAE6FD]',
    secretaria: 'bg-[#FCE7F3] text-[#BE185D] border-[#FBCFE8]',
  };

  const roleLabels: Record<string, string> = {
    administrador: 'Administrador',
    profesional: 'Profesional',
    secretaria: 'Secretaria',
  };

  return (
    <Badge className={`${roleColors[rol] || 'bg-[#F3F4F6] text-[#6B7280] border-[#D1D5DB]'} hover:opacity-80 rounded-full px-3 py-1 text-xs font-medium`}>
      {roleLabels[rol] || rol}
    </Badge>
  );
}

export default function AdminPerfil() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('personal');
  
  // Estados para formularios
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // Filtros para notificaciones
  const [estadoFilter, setEstadoFilter] = useState<string>('todos');
  const [tipoFilter, setTipoFilter] = useState<string>('todos');

  // Queries
  const { data: notificaciones = [], isLoading: loadingNotificaciones } = useQuery({
    queryKey: ['notificaciones', estadoFilter, tipoFilter],
    queryFn: () => {
      const filters: any = {};
      if (estadoFilter !== 'todos') filters.estado = estadoFilter;
      if (tipoFilter !== 'todos') filters.tipo = tipoFilter;
      return notificacionesService.getAll(filters);
    },
  });

  // Mutations
  const updatePasswordMutation = useMutation({
    mutationFn: ({ id, newPassword }: { id: string; newPassword: string }) =>
      usuariosService.updatePassword(id, { new_password: newPassword }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      setShowPasswordModal(false);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      reactToastify.success('Contraseña actualizada correctamente', {
        position: 'top-right',
        autoClose: 3000,
      });
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.message || 'Error al actualizar contraseña';
      reactToastify.error(errorMessage, {
        position: 'top-right',
        autoClose: 3000,
      });
    },
  });

  const handleChangePassword = async () => {
    if (!passwordForm.newPassword || !passwordForm.confirmPassword) {
      reactToastify.error('Por favor complete todos los campos', {
        position: 'top-right',
        autoClose: 3000,
      });
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      reactToastify.error('Las contraseñas no coinciden', {
        position: 'top-right',
        autoClose: 3000,
      });
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      reactToastify.error('La contraseña debe tener al menos 8 caracteres', {
        position: 'top-right',
        autoClose: 3000,
      });
      return;
    }

    if (user) {
      setIsSubmitting(true);
      try {
        await updatePasswordMutation.mutateAsync({ id: user.id, newPassword: passwordForm.newPassword });
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const filteredNotificaciones = useMemo(() => {
    return notificaciones;
  }, [notificaciones]);

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-[32px] font-bold text-[#111827] font-['Poppins'] leading-tight tracking-[-0.02em] mb-0">
          Mi Perfil
        </h1>
        <p className="text-base text-[#6B7280] mt-2 font-['Inter']">
          Gestiona tu información personal y preferencias
        </p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        {/* TabsList */}
        <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-[12px] p-1.5 inline-flex">
          <TabsList className="bg-transparent p-0 h-auto gap-1">
            <TabsTrigger 
              value="personal"
              className="rounded-[10px] px-5 py-2.5 text-[14px] font-medium font-['Inter'] data-[state=active]:bg-white data-[state=active]:text-[#7C3AED] data-[state=active]:shadow-sm text-[#6B7280] hover:text-[#374151] transition-all duration-200"
            >
              <User className="h-4 w-4 mr-2 stroke-[2]" />
              Datos Personales
            </TabsTrigger>
            <TabsTrigger 
              value="seguridad"
              className="rounded-[10px] px-5 py-2.5 text-[14px] font-medium font-['Inter'] data-[state=active]:bg-white data-[state=active]:text-[#7C3AED] data-[state=active]:shadow-sm text-[#6B7280] hover:text-[#374151] transition-all duration-200"
            >
              <Shield className="h-4 w-4 mr-2 stroke-[2]" />
              Seguridad
            </TabsTrigger>
            <TabsTrigger 
              value="notificaciones"
              className="rounded-[10px] px-5 py-2.5 text-[14px] font-medium font-['Inter'] data-[state=active]:bg-white data-[state=active]:text-[#7C3AED] data-[state=active]:shadow-sm text-[#6B7280] hover:text-[#374151] transition-all duration-200"
            >
              <Bell className="h-4 w-4 mr-2 stroke-[2]" />
              Notificaciones
              {notificaciones.length > 0 && (
                <Badge className="ml-2 h-5 px-2 bg-[#EDE9FE] text-[#7C3AED] border-[#DDD6FE] rounded-full text-xs">
                  {notificaciones.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab: Datos Personales */}
        <TabsContent value="personal" className="mt-0 space-y-6">
          <Card className="border border-[#E5E7EB] rounded-[16px] shadow-sm overflow-hidden">
            <CardHeader className="bg-gradient-to-b from-white to-[#F9FAFB] border-b border-[#E5E7EB] px-8 py-6">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#6D28D9] flex items-center justify-center">
                  <User className="h-6 w-6 text-white stroke-[2]" />
                </div>
                <div>
                  <CardTitle className="text-[24px] font-bold text-[#111827] font-['Poppins'] mb-0">
                    Información Personal
                  </CardTitle>
                  <CardDescription className="text-base text-[#6B7280] font-['Inter'] mt-1">
                    Tu información básica de contacto
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label className="text-[15px] font-medium text-[#374151] font-['Inter']">
                    Nombre
                  </Label>
                  <Input 
                    value={user.nombre} 
                    disabled 
                    className="h-[52px] border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[16px] font-['Inter'] bg-[#F9FAFB]"
                  />
                </div>
                <div className="space-y-3">
                  <Label className="text-[15px] font-medium text-[#374151] font-['Inter']">
                    Apellido
                  </Label>
                  <Input 
                    value={user.apellido} 
                    disabled 
                    className="h-[52px] border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[16px] font-['Inter'] bg-[#F9FAFB]"
                  />
                </div>
                <div className="space-y-3">
                  <Label className="text-[15px] font-medium text-[#374151] font-['Inter'] flex items-center gap-2">
                    <Mail className="h-4 w-4 text-[#6B7280] stroke-[2]" />
                    Email
                  </Label>
                  <Input 
                    type="email" 
                    value={user.email} 
                    disabled 
                    className="h-[52px] border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[16px] font-['Inter'] bg-[#F9FAFB]"
                  />
                </div>
                <div className="space-y-3">
                  <Label className="text-[15px] font-medium text-[#374151] font-['Inter']">
                    Teléfono
                  </Label>
                  <Input 
                    value={user.telefono || 'No especificado'} 
                    disabled 
                    className="h-[52px] border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[16px] font-['Inter'] bg-[#F9FAFB]"
                  />
                </div>
                <div className="space-y-3">
                  <Label className="text-[15px] font-medium text-[#374151] font-['Inter']">
                    Rol del Sistema
                  </Label>
                  <div className="h-[52px] flex items-center">
                    {getRolBadge(user.rol)}
                  </div>
                </div>
              </div>
              
              <div className="mt-6 p-4 bg-[#EFF6FF] border border-[#DBEAFE] rounded-[12px]">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-[#3B82F6] stroke-[2] mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-[#1E40AF] font-['Inter']">
                    Para modificar esta información, contacta al administrador del sistema
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Seguridad */}
        <TabsContent value="seguridad" className="mt-0 space-y-6">
          <Card className="border border-[#E5E7EB] rounded-[16px] shadow-sm overflow-hidden">
            <CardHeader className="bg-gradient-to-b from-white to-[#F9FAFB] border-b border-[#E5E7EB] px-8 py-6">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-[#10B981] to-[#059669] flex items-center justify-center">
                  <Shield className="h-6 w-6 text-white stroke-[2]" />
                </div>
                <div>
                  <CardTitle className="text-[24px] font-bold text-[#111827] font-['Poppins'] mb-0">
                    Seguridad
                  </CardTitle>
                  <CardDescription className="text-base text-[#6B7280] font-['Inter'] mt-1">
                    Gestiona tu contraseña y acceso
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-8">
              <div className="flex items-center justify-between p-6 border-[1.5px] border-[#E5E7EB] rounded-[12px] bg-gradient-to-br from-white to-[#F9FAFB] hover:border-[#7C3AED] transition-all duration-200">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-[#7C3AED]/10 to-[#6D28D9]/10 flex items-center justify-center">
                    <Key className="h-6 w-6 text-[#7C3AED] stroke-[2]" />
                  </div>
                  <div>
                    <p className="font-semibold text-[#374151] font-['Inter'] text-[16px]">Contraseña</p>
                    <p className="text-sm text-[#6B7280] font-['Inter'] mt-1">••••••••••••</p>
                  </div>
                </div>
                <Button 
                  onClick={() => setShowPasswordModal(true)}
                  className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white shadow-md shadow-[#7C3AED]/20 hover:shadow-lg hover:shadow-[#7C3AED]/30 transition-all duration-200 rounded-[12px] px-6 h-12 font-medium"
                >
                  <Key className="h-4 w-4 mr-2 stroke-[2]" />
                  Cambiar Contraseña
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Notificaciones */}
        <TabsContent value="notificaciones" className="mt-0 space-y-6">
          {/* Filtros */}
          <Card className="border border-[#E5E7EB] rounded-[16px] shadow-sm">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <Select value={estadoFilter} onValueChange={setEstadoFilter}>
                  <SelectTrigger className="h-12 border-[#D1D5DB] rounded-[10px] font-['Inter'] text-[15px] focus:border-[#7C3AED] focus:ring-[#7C3AED]/20">
                    <div className="flex items-center gap-2">
                      <Filter className="h-4 w-4 text-[#6B7280] stroke-[2]" />
                      <SelectValue placeholder="Estado" />
                    </div>
                  </SelectTrigger>
                  <SelectContent className="rounded-[12px]">
                    <SelectItem value="todos" className="font-['Inter']">Todos los estados</SelectItem>
                    <SelectItem value="enviado" className="font-['Inter']">Enviado</SelectItem>
                    <SelectItem value="pendiente" className="font-['Inter']">Pendiente</SelectItem>
                    <SelectItem value="fallido" className="font-['Inter']">Fallido</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={tipoFilter} onValueChange={setTipoFilter}>
                  <SelectTrigger className="h-12 border-[#D1D5DB] rounded-[10px] font-['Inter'] text-[15px] focus:border-[#7C3AED] focus:ring-[#7C3AED]/20">
                    <div className="flex items-center gap-2">
                      <Bell className="h-4 w-4 text-[#6B7280] stroke-[2]" />
                      <SelectValue placeholder="Tipo" />
                    </div>
                  </SelectTrigger>
                  <SelectContent className="rounded-[12px]">
                    <SelectItem value="todos" className="font-['Inter']">Todos los tipos</SelectItem>
                    <SelectItem value="turno" className="font-['Inter']">Turno</SelectItem>
                    <SelectItem value="pago" className="font-['Inter']">Pago</SelectItem>
                    <SelectItem value="recordatorio" className="font-['Inter']">Recordatorio</SelectItem>
                    <SelectItem value="sistema" className="font-['Inter']">Sistema</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Tabla o Empty State */}
          {loadingNotificaciones ? (
            <Card className="border border-[#E5E7EB] rounded-[16px] shadow-sm">
              <CardContent className="p-16 text-center">
                <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-[#7C3AED]" />
                <p className="text-[#6B7280] font-['Inter'] text-base">Cargando notificaciones...</p>
              </CardContent>
            </Card>
          ) : filteredNotificaciones.length === 0 ? (
            <Card className="border border-[#E5E7EB] rounded-[16px] shadow-sm">
              <CardContent className="p-16 text-center">
                <div className="h-20 w-20 rounded-full bg-[#EDE9FE] flex items-center justify-center mx-auto mb-4">
                  <Bell className="h-10 w-10 text-[#7C3AED] stroke-[2]" />
                </div>
                <h3 className="text-lg font-semibold mb-2 text-[#374151] font-['Inter']">
                  No hay notificaciones
                </h3>
                <p className="text-[#6B7280] font-['Inter']">
                  No se encontraron notificaciones con los filtros seleccionados
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="border border-[#E5E7EB] rounded-[16px] shadow-sm overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#F9FAFB] border-b-2 border-[#E5E7EB] hover:bg-[#F9FAFB]">
                    <TableHead className="font-['Inter'] font-medium text-[14px] text-[#374151] py-4">
                      Destinatario
                    </TableHead>
                    <TableHead className="font-['Inter'] font-medium text-[14px] text-[#374151]">
                      Asunto
                    </TableHead>
                    <TableHead className="hidden md:table-cell font-['Inter'] font-medium text-[14px] text-[#374151]">
                      Tipo
                    </TableHead>
                    <TableHead className="font-['Inter'] font-medium text-[14px] text-[#374151]">
                      Estado
                    </TableHead>
                    <TableHead className="hidden lg:table-cell font-['Inter'] font-medium text-[14px] text-[#374151]">
                      Fecha
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredNotificaciones.map((notif) => (
                    <TableRow
                      key={notif.id}
                      className="border-b border-[#E5E7EB] hover:bg-[#F9FAFB] transition-colors duration-150"
                    >
                      <TableCell className="py-4">
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-[#6B7280] stroke-[2]" />
                          <span className="text-[#374151] font-['Inter'] text-[14px]">
                            {notif.destinatario_email}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium text-[#374151] font-['Inter'] text-[15px]">
                          {notif.asunto}
                        </span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className="text-[#6B7280] font-['Inter'] text-[14px]">
                          {notif.tipo || '-'}
                        </span>
                      </TableCell>
                      <TableCell>{getEstadoBadge(notif.estado)}</TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {notif.fecha_envio ? (
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-[#6B7280] stroke-[2]" />
                            <span className="text-[#374151] font-['Inter'] text-[14px]">
                              {format(new Date(notif.fecha_envio), 'dd/MM/yyyy HH:mm', { locale: es })}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-[#9CA3AF]">
                            <Clock className="h-4 w-4 stroke-[2]" />
                            <span className="font-['Inter'] text-[14px]">Pendiente</span>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Modal: Cambiar Contraseña */}
      <Dialog open={showPasswordModal} onOpenChange={setShowPasswordModal}>
        <DialogContent className="max-w-[600px] rounded-[20px] p-0 border border-[#E5E7EB] shadow-2xl">
          <DialogHeader className="px-8 pt-8 pb-6 border-b border-[#E5E7EB] bg-gradient-to-b from-white to-[#F9FAFB]">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-[#F59E0B] to-[#D97706] flex items-center justify-center shadow-lg shadow-[#F59E0B]/20">
                <Key className="h-6 w-6 text-white stroke-[2]" />
              </div>
              <div>
                <DialogTitle className="text-[28px] font-bold text-[#111827] font-['Poppins'] leading-tight mb-0">
                  Cambiar Contraseña
                </DialogTitle>
                <DialogDescription className="text-base text-[#6B7280] font-['Inter'] mt-1 mb-0">
                  Ingresa tu nueva contraseña. Debe tener al menos 8 caracteres
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="px-8 py-6 space-y-5">
            <div className="space-y-3">
              <Label htmlFor="newPassword" className="text-[15px] font-medium text-[#374151] font-['Inter']">
                Nueva Contraseña
                <span className="text-[#EF4444]">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNewPassword ? 'text' : 'password'}
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  placeholder="Mínimo 8 caracteres"
                  className="h-[52px] border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[16px] font-['Inter'] placeholder:text-[#9CA3AF] focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20 pr-12 transition-all duration-200"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 hover:bg-[#F3F4F6]"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4 stroke-[2]" /> : <Eye className="h-4 w-4 stroke-[2]" />}
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="confirmPassword" className="text-[15px] font-medium text-[#374151] font-['Inter']">
                Confirmar Contraseña
                <span className="text-[#EF4444]">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  placeholder="Repite la contraseña"
                  className="h-[52px] border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[16px] font-['Inter'] placeholder:text-[#9CA3AF] focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20 pr-12 transition-all duration-200"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 hover:bg-[#F3F4F6]"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4 stroke-[2]" /> : <Eye className="h-4 w-4 stroke-[2]" />}
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter className="px-8 py-5 border-t border-[#E5E7EB] bg-[#F9FAFB] flex flex-row justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setShowPasswordModal(false);
                setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
              }}
              className="h-[48px] px-6 rounded-[12px] border-[1.5px] border-[#D1D5DB] font-medium font-['Inter'] text-[15px] hover:bg-white hover:border-[#9CA3AF] transition-all duration-200"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleChangePassword}
              disabled={isSubmitting}
              className="h-[48px] px-8 rounded-[12px] bg-[#F59E0B] hover:bg-[#D97706] text-white shadow-lg shadow-[#F59E0B]/30 hover:shadow-xl hover:shadow-[#F59E0B]/40 hover:scale-[1.02] font-semibold font-['Inter'] text-[15px] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin stroke-[2.5]" />
                  Guardando...
                </>
              ) : (
                <>
                  <Key className="mr-2 h-5 w-5 stroke-[2]" />
                  Guardar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}