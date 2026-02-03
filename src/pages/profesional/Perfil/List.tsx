import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
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
import { FilterSelect } from '@/components/shared/FilterSelect';
import { 
  User, Shield, Bell, Eye, EyeOff, Calendar, 
  Clock, Loader2 
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usuariosService } from '@/services/usuarios.service';
import { notificacionesService } from '@/services/notificaciones.service';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

function getEstadoBadge(estado: string) {
  switch (estado) {
    case 'enviado':
      return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300">Enviado</Badge>;
    case 'pendiente':
      return <Badge className="bg-violet-100 text-violet-800 border-violet-300">Pendiente</Badge>;
    case 'fallido':
      return <Badge className="bg-red-100 text-red-800 border-red-300">Fallido</Badge>;
    default:
      return <Badge variant="outline">-</Badge>;
  }
}

export default function ProfesionalPerfil() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('personal');
  
  // Estados para formularios
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    newPassword: '',
    confirmPassword: '',
  });

  // Filtros para notificaciones
  const [estadoFilter, setEstadoFilter] = useState<string>('todos');

  // Queries - Solo notificaciones del usuario actual
  const { data: notificaciones = [], isLoading: loadingNotificaciones } = useQuery({
    queryKey: ['notificaciones', user?.email, estadoFilter],
    queryFn: () => {
      if (!user?.email) return [];
      const filters: any = { destinatario_email: user.email };
      if (estadoFilter !== 'todos') filters.estado = estadoFilter;
      return notificacionesService.getAll(filters);
    },
    enabled: !!user?.email,
  });

  // Mutations
  const updatePasswordMutation = useMutation({
    mutationFn: ({ id, newPassword }: { id: string; newPassword: string }) =>
      usuariosService.updatePassword(id, { new_password: newPassword }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      setShowPasswordModal(false);
      setPasswordForm({ newPassword: '', confirmPassword: '' });
      toast({
        title: 'Éxito',
        description: 'Contraseña actualizada exitosamente',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error?.response?.data?.message || 'Error al actualizar contraseña',
        variant: 'destructive',
      });
    },
  });

  const handleChangePassword = () => {
    if (!passwordForm.newPassword || !passwordForm.confirmPassword) {
      toast({
        title: 'Error',
        description: 'Por favor complete todos los campos',
        variant: 'destructive',
      });
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({
        title: 'Error',
        description: 'Las contraseñas no coinciden',
        variant: 'destructive',
      });
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      toast({
        title: 'Error',
        description: 'La contraseña debe tener al menos 8 caracteres',
        variant: 'destructive',
      });
      return;
    }

    if (user) {
      updatePasswordMutation.mutate({ id: user.id, newPassword: passwordForm.newPassword });
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mi Perfil"
        subtitle="Gestiona tu información personal y preferencias"
        breadcrumbs={[
          { label: 'Dashboard', href: '/agenda' },
          { label: 'Mi Perfil' },
        ]}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="personal">
            <User className="h-4 w-4 mr-2" />
            Datos Personales
          </TabsTrigger>
          <TabsTrigger value="seguridad">
            <Shield className="h-4 w-4 mr-2" />
            Seguridad
          </TabsTrigger>
          <TabsTrigger value="notificaciones">
            <Bell className="h-4 w-4 mr-2" />
            Mis Notificaciones ({notificaciones.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab: Datos Personales */}
        <TabsContent value="personal" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Información Personal</CardTitle>
              <CardDescription>Tu información básica de contacto</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nombre</Label>
                  <Input value={user.nombre} disabled />
                </div>
                <div className="space-y-2">
                  <Label>Apellido</Label>
                  <Input value={user.apellido} disabled />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={user.email} disabled />
                </div>
                <div className="space-y-2">
                  <Label>Teléfono</Label>
                  <Input value={user.telefono || ''} disabled />
                </div>
                <div className="space-y-2">
                  <Label>Rol</Label>
                  <Input value={user.rol} disabled />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                * Para modificar esta información, contacta al administrador del sistema
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Seguridad */}
        <TabsContent value="seguridad" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Seguridad</CardTitle>
              <CardDescription>Gestiona tu contraseña y acceso</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Contraseña</p>
                  <p className="text-sm text-muted-foreground">••••••••</p>
                </div>
                <Button variant="outline" onClick={() => setShowPasswordModal(true)}>
                  Cambiar Contraseña
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Notificaciones */}
        <TabsContent value="notificaciones" className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <FilterSelect
              value={estadoFilter}
              onValueChange={setEstadoFilter}
              options={[
                { value: 'todos', label: 'Todos los estados' },
                { value: 'enviado', label: 'Enviado' },
                { value: 'pendiente', label: 'Pendiente' },
                { value: 'fallido', label: 'Fallido' },
              ]}
              placeholder="Filtrar por estado"
            />
          </div>

          {loadingNotificaciones ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </CardContent>
            </Card>
          ) : notificaciones.length === 0 ? (
            <EmptyState
              icon={Bell}
              title="No hay notificaciones"
              description="No has recibido notificaciones aún"
            />
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Asunto</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Fecha</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {notificaciones.map((notif) => (
                    <TableRow key={notif.id}>
                      <TableCell className="font-medium">{notif.asunto}</TableCell>
                      <TableCell>{notif.tipo || '-'}</TableCell>
                      <TableCell>{getEstadoBadge(notif.estado)}</TableCell>
                      <TableCell>
                        {notif.fecha_envio ? (
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            {format(new Date(notif.fecha_envio), 'dd/MM/yyyy HH:mm', { locale: es })}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            Pendiente
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cambiar Contraseña</DialogTitle>
            <DialogDescription>
              Ingresa tu nueva contraseña. Debe tener al menos 8 caracteres.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">Nueva Contraseña *</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNewPassword ? 'text' : 'password'}
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  placeholder="Mínimo 8 caracteres"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Contraseña *</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  placeholder="Repite la contraseña"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowPasswordModal(false);
              setPasswordForm({ newPassword: '', confirmPassword: '' });
            }}>
              Cancelar
            </Button>
            <Button
              onClick={handleChangePassword}
              disabled={updatePasswordMutation.isPending}
            >
              {updatePasswordMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
