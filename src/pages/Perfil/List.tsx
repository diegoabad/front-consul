import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
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
import { Key, Eye, EyeOff, Loader2 } from 'lucide-react';
import { toast as reactToastify } from 'react-toastify';
import { useAuth } from '@/contexts/AuthContext';
import { authService } from '@/services/auth.service';
import { formatDisplayText } from '@/lib/utils';

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
        <p className="text-base text-[#6B7280] mt-2 mb-0 font-['Inter']">
          Tu información personal y seguridad
        </p>
        <button
          type="button"
          onClick={openEditModal}
          className="font-['Inter'] text-[#2563eb] hover:text-[#1d4ed8] hover:underline text-base font-medium mt-2"
        >
          Editar perfil
        </button>
      </div>

      <Card className="border border-[#E5E7EB] rounded-[16px] shadow-sm overflow-hidden">
        <CardContent className="p-8 space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <Label className="text-[15px] font-medium text-[#374151] font-['Inter']">Nombre</Label>
              <Input
                value={formatDisplayText(user.nombre)}
                disabled
                className="h-10 border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[15px] font-['Inter'] bg-[#F9FAFB]"
              />
            </div>
            <div className="space-y-3">
              <Label className="text-[15px] font-medium text-[#374151] font-['Inter']">Apellido</Label>
              <Input
                value={formatDisplayText(user.apellido)}
                disabled
                className="h-10 border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[15px] font-['Inter'] bg-[#F9FAFB]"
              />
            </div>
            <div className="space-y-3">
              <Label className="text-[15px] font-medium text-[#374151] font-['Inter']">
                Email
              </Label>
              <Input
                type="email"
                value={user.email}
                disabled
                className="h-10 border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[15px] font-['Inter'] bg-[#F9FAFB]"
              />
            </div>
            <div className="space-y-3">
              <Label className="text-[15px] font-medium text-[#374151] font-['Inter']">Teléfono</Label>
              <Input
                value={user.telefono || 'No especificado'}
                disabled
                className="h-10 border-[1.5px] border-[#D1D5DB] rounded-[10px] text-[15px] font-['Inter'] bg-[#F9FAFB]"
              />
            </div>
            <div className="space-y-0">
              <Label className="text-[15px] font-medium text-[#374151] font-['Inter'] mb-1.5 block">Rol del sistema</Label>
              <div className="h-10 flex items-center">
                {getRolBadge(user.rol)}
              </div>
            </div>
          </div>

          {/* Contraseña */}
          <div className="pt-6 border-t border-[#E5E7EB]">
            <div className="flex items-center justify-between flex-wrap gap-3 p-6 border-[1.5px] border-[#E5E7EB] rounded-[12px] bg-gradient-to-br from-white to-[#F9FAFB] hover:border-[#2563eb] transition-all duration-200">
              <div className="flex items-center gap-4">
                <div className="hidden lg:flex h-12 w-12 rounded-full bg-gradient-to-br from-[#2563eb]/10 to-[#1d4ed8]/10 items-center justify-center">
                  <Key className="h-6 w-6 text-[#2563eb] stroke-[2]" />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-[#374151] font-['Inter'] text-[16px] mb-0">Contraseña</p>
                  <p className="text-sm text-[#6B7280] font-['Inter'] mb-0">••••••••••••</p>
                  <button
                    type="button"
                    onClick={() => setShowPasswordModal(true)}
                    className="font-['Inter'] text-[#2563eb] hover:text-[#1d4ed8] hover:underline text-base font-medium"
                  >
                    Cambiar contraseña
                  </button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modal: Editar información */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-[500px] max-h-[90vh] rounded-[20px] border border-[#E5E7EB] shadow-2xl p-0 flex flex-col overflow-hidden">
          <DialogHeader className="flex-shrink-0 px-8 pt-6 pb-2 border-b border-[#E5E7EB] mb-0">
            <DialogTitle className="text-[22px] font-bold text-[#111827] font-['Poppins'] mb-0">
              Editar información
            </DialogTitle>
            <DialogDescription className="text-[15px] text-[#6B7280] font-['Inter'] mt-1 mb-0">
              Modificá nombre, apellido, email y teléfono
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto px-8 pt-3 pb-3 space-y-4">
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
          <DialogFooter className="flex-shrink-0 flex flex-col sm:flex-row justify-end gap-2 px-8 py-3 border-t border-[#E5E7EB] mt-0">
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
          <DialogHeader className="px-8 pt-6 pb-2 border-b border-[#E5E7EB] mb-0">
            <DialogTitle className="text-[22px] font-bold text-[#111827] font-['Poppins'] mb-0">
              Cambiar contraseña
            </DialogTitle>
            <DialogDescription className="text-[15px] text-[#6B7280] font-['Inter'] mt-1 mb-0">
              La contraseña debe tener al menos 8 caracteres
            </DialogDescription>
          </DialogHeader>
          <div className="px-8 pt-3 pb-3 space-y-4">
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
          <DialogFooter className="flex flex-row gap-2 px-8 py-3 border-t border-[#E5E7EB] mt-0">
            <Button
              variant="outline"
              onClick={() => {
                setShowPasswordModal(false);
                setPasswordForm({ newPassword: '', confirmPassword: '' });
              }}
              className="rounded-[10px] flex-1 min-w-0"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleChangePassword}
              disabled={isSubmittingPassword}
              className="rounded-[10px] bg-[#2563eb] hover:bg-[#1d4ed8] flex-1 min-w-0"
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
