import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { User, Mail, Key, Eye, EyeOff, Loader2, Pencil } from 'lucide-react';
import { toast as reactToastify } from 'react-toastify';
import { useAuth } from '@/contexts/AuthContext';
import { authService } from '@/services/auth.service';

function getRolBadge(rol: string) {
  const roleColors: Record<string, string> = {
    administrador: 'bg-[#EDE9FE] text-[#5B21B6] border-[#C4B5FD]',
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
  const { user, refreshUser } = useAuth();

  const [showEditModal, setShowEditModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmittingProfile, setIsSubmittingProfile] = useState(false);
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);

  const [editForm, setEditForm] = useState({
    nombre: '',
    apellido: '',
    email: '',
    telefono: '',
  });

  const [passwordForm, setPasswordForm] = useState({
    newPassword: '',
    confirmPassword: '',
  });

  const openEditModal = () => {
    if (user) {
      setEditForm({
        nombre: user.nombre || '',
        apellido: user.apellido || '',
        email: user.email || '',
        telefono: user.telefono || '',
      });
      setShowEditModal(true);
    }
  };

  const handleSaveProfile = async () => {
    setIsSubmittingProfile(true);
    try {
      await authService.updateProfile({
        nombre: editForm.nombre,
        apellido: editForm.apellido,
        email: editForm.email,
        telefono: editForm.telefono || null,
      });
      await refreshUser();
      setShowEditModal(false);
      reactToastify.success('Información actualizada correctamente', {
        position: 'top-right',
        autoClose: 3000,
      });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Error al actualizar';
      reactToastify.error(msg, { position: 'top-right', autoClose: 3000 });
    } finally {
      setIsSubmittingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!passwordForm.newPassword || !passwordForm.confirmPassword) {
      reactToastify.error('Completá todos los campos', { position: 'top-right', autoClose: 3000 });
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      reactToastify.error('Las contraseñas no coinciden', { position: 'top-right', autoClose: 3000 });
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      reactToastify.error('La contraseña debe tener al menos 8 caracteres', { position: 'top-right', autoClose: 3000 });
      return;
    }
    setIsSubmittingPassword(true);
    try {
      await authService.updateMyPassword(passwordForm.newPassword, passwordForm.confirmPassword);
      setShowPasswordModal(false);
      setPasswordForm({ newPassword: '', confirmPassword: '' });
      reactToastify.success('Contraseña actualizada correctamente', {
        position: 'top-right',
        autoClose: 3000,
      });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Error al actualizar contraseña';
      reactToastify.error(msg, { position: 'top-right', autoClose: 3000 });
    } finally {
      setIsSubmittingPassword(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-[32px] font-bold text-[#111827] font-['Poppins'] leading-tight tracking-[-0.02em] mb-0">
          Mi Perfil
        </h1>
        <p className="text-base text-[#6B7280] mt-2 font-['Inter']">
          Tu información personal y seguridad
        </p>
      </div>

      <Card className="border border-[#E5E7EB] rounded-[16px] shadow-sm overflow-hidden">
        <CardHeader className="bg-gradient-to-b from-white to-[#F9FAFB] border-b border-[#E5E7EB] px-8 py-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] flex items-center justify-center">
                <User className="h-6 w-6 text-white stroke-[2]" />
              </div>
              <div>
                <CardTitle className="text-[24px] font-bold text-[#111827] font-['Poppins'] mb-0">
                  Información personal
                </CardTitle>
                <CardDescription className="text-base text-[#6B7280] font-['Inter'] mt-1">
                  Nombre, apellido, email y teléfono
                </CardDescription>
              </div>
            </div>
            <Button
              onClick={openEditModal}
              className="rounded-[10px] font-['Inter'] bg-[#2563eb] hover:bg-[#1d4ed8] text-white h-11 px-5"
            >
              <Pencil className="h-4 w-4 mr-2 stroke-[2]" />
              Editar información
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-8 space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <Label className="text-[15px] font-medium text-[#374151] font-['Inter']">Nombre</Label>
              <Input
                value={user.nombre}
                disabled
                className="h-[52px] border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[16px] font-['Inter'] bg-[#F9FAFB]"
              />
            </div>
            <div className="space-y-3">
              <Label className="text-[15px] font-medium text-[#374151] font-['Inter']">Apellido</Label>
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
              <Label className="text-[15px] font-medium text-[#374151] font-['Inter']">Teléfono</Label>
              <Input
                value={user.telefono || 'No especificado'}
                disabled
                className="h-[52px] border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[16px] font-['Inter'] bg-[#F9FAFB]"
              />
            </div>
            <div className="space-y-3">
              <Label className="text-[15px] font-medium text-[#374151] font-['Inter']">Rol del sistema</Label>
              <div className="h-[52px] flex items-center">
                {getRolBadge(user.rol)}
              </div>
            </div>
          </div>

          {/* Contraseña */}
          <div className="pt-6 border-t border-[#E5E7EB]">
            <div className="flex items-center justify-between p-6 border-[1.5px] border-[#E5E7EB] rounded-[12px] bg-gradient-to-br from-white to-[#F9FAFB] hover:border-[#2563eb] transition-all duration-200">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-[#2563eb]/10 to-[#1d4ed8]/10 flex items-center justify-center">
                  <Key className="h-6 w-6 text-[#2563eb] stroke-[2]" />
                </div>
                <div>
                  <p className="font-semibold text-[#374151] font-['Inter'] text-[16px]">Contraseña</p>
                  <p className="text-sm text-[#6B7280] font-['Inter'] mt-1">••••••••••••</p>
                </div>
              </div>
              <Button
                onClick={() => setShowPasswordModal(true)}
                className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-md rounded-[12px] px-6 h-12 font-medium"
              >
                <Key className="h-4 w-4 mr-2 stroke-[2]" />
                Cambiar contraseña
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modal: Editar información */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-[500px] rounded-[20px] border border-[#E5E7EB] shadow-2xl p-0">
          <DialogHeader className="px-8 pt-8 pb-4 border-b border-[#E5E7EB] mb-0">
            <DialogTitle className="text-[22px] font-bold text-[#111827] font-['Poppins'] mb-0">
              Editar información
            </DialogTitle>
            <DialogDescription className="text-[15px] text-[#6B7280] font-['Inter'] mt-1 mb-0">
              Modificá nombre, apellido, email y teléfono
            </DialogDescription>
          </DialogHeader>
          <div className="px-8 py-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-[14px] font-medium text-[#374151]">Nombre</Label>
              <Input
                value={editForm.nombre}
                onChange={(e) => setEditForm((p) => ({ ...p, nombre: e.target.value }))}
                className="h-11 border-[#D1D5DB] rounded-[10px]"
                placeholder="Nombre"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[14px] font-medium text-[#374151]">Apellido</Label>
              <Input
                value={editForm.apellido}
                onChange={(e) => setEditForm((p) => ({ ...p, apellido: e.target.value }))}
                className="h-11 border-[#D1D5DB] rounded-[10px]"
                placeholder="Apellido"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[14px] font-medium text-[#374151]">Email</Label>
              <Input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
                className="h-11 border-[#D1D5DB] rounded-[10px]"
                placeholder="email@ejemplo.com"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[14px] font-medium text-[#374151]">Teléfono</Label>
              <Input
                value={editForm.telefono}
                onChange={(e) => setEditForm((p) => ({ ...p, telefono: e.target.value }))}
                className="h-11 border-[#D1D5DB] rounded-[10px]"
                placeholder="Opcional"
              />
            </div>
          </div>
          <DialogFooter className="px-8 py-4 border-t border-[#E5E7EB] gap-2 mt-0">
            <Button
              variant="outline"
              onClick={() => setShowEditModal(false)}
              className="rounded-[10px]"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveProfile}
              disabled={isSubmittingProfile}
              className="rounded-[10px] bg-[#2563eb] hover:bg-[#1d4ed8]"
            >
              {isSubmittingProfile ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Cambiar contraseña */}
      <Dialog open={showPasswordModal} onOpenChange={setShowPasswordModal}>
        <DialogContent className="max-w-[500px] rounded-[20px] border border-[#E5E7EB] shadow-2xl p-0">
          <DialogHeader className="px-8 pt-8 pb-4 border-b border-[#E5E7EB] mb-0">
            <DialogTitle className="text-[22px] font-bold text-[#111827] font-['Poppins'] mb-0">
              Cambiar contraseña
            </DialogTitle>
            <DialogDescription className="text-[15px] text-[#6B7280] font-['Inter'] mt-1 mb-0">
              La contraseña debe tener al menos 8 caracteres
            </DialogDescription>
          </DialogHeader>
          <div className="px-8 py-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-[14px] font-medium text-[#374151]">Nueva contraseña</Label>
              <div className="relative">
                <Input
                  type={showNewPassword ? 'text' : 'password'}
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm((p) => ({ ...p, newPassword: e.target.value }))}
                  placeholder="Mínimo 8 caracteres"
                  className="h-11 border-[#D1D5DB] rounded-[10px] pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[14px] font-medium text-[#374151]">Confirmar contraseña</Label>
              <div className="relative">
                <Input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm((p) => ({ ...p, confirmPassword: e.target.value }))}
                  placeholder="Repetir contraseña"
                  className="h-11 border-[#D1D5DB] rounded-[10px] pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter className="px-8 py-4 border-t border-[#E5E7EB] gap-2 mt-0">
            <Button
              variant="outline"
              onClick={() => {
                setShowPasswordModal(false);
                setPasswordForm({ newPassword: '', confirmPassword: '' });
              }}
              className="rounded-[10px]"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleChangePassword}
              disabled={isSubmittingPassword}
              className="rounded-[10px] bg-[#2563eb] hover:bg-[#1d4ed8]"
            >
              {isSubmittingPassword ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
