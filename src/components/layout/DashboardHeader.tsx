import { LogOut, Menu, User, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UserAvatar } from '@/components/dashboard/UserAvatar';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { cn, formatDisplayText } from '@/lib/utils';

interface DashboardHeaderProps {
  sidebarCollapsed: boolean;
  onSidebarToggle: () => void;
  onMobileMenuToggle: () => void;
  mobileMenuOpen?: boolean;
}

export function DashboardHeader({
  sidebarCollapsed,
  onSidebarToggle,
  onMobileMenuToggle,
  mobileMenuOpen = false,
}: DashboardHeaderProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getRoleLabel = (rol: string) => {
    const labels: Record<string, string> = {
      administrador: 'Administrador',
      profesional: 'Profesional',
      secretaria: 'Secretaria',
      jefe_secretaria: 'Jefe de Secretaría',
    };
    return labels[rol] || rol;
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-white border-b border-[#E5E7EB] flex items-center shadow-sm overflow-hidden">
      {/* Zona izquierda: hamburguesa fijo (pl-4); cuando colapsado la zona crece para que el logo quepa a tamaño completo */}
      <div
        className={cn(
          'hidden lg:flex items-center flex-shrink-0 transition-all duration-300 pl-4',
          sidebarCollapsed ? 'w-[100px]' : 'w-[224px]'
        )}
      >
        <Button
          variant="ghost"
          size="icon"
          className="text-[#6B7280] hover:text-[#374151] hover:bg-[#F3F4F6] rounded-[10px] transition-all duration-200 h-10 w-10 flex-shrink-0"
          onClick={onSidebarToggle}
          aria-label={sidebarCollapsed ? 'Expandir menú' : 'Colapsar menú'}
        >
          <Menu className="h-5 w-5 stroke-[2]" />
        </Button>
        <img
          src="/logo.png"
          alt="Cogniar"
          className="h-[98px] w-auto min-w-[341px] object-contain flex-shrink-0 object-left"
        />
      </div>

      {/* Mobile: hamburguesa a la izquierda, logo centrado en la barra, usuario a la derecha */}
      <div className="flex lg:hidden items-center flex-1 min-w-0">
        <Button
          variant="ghost"
          size="icon"
          className="text-[#6B7280] hover:text-[#374151] hover:bg-[#F3F4F6] rounded-[10px] transition-all duration-200 h-10 w-10 flex-shrink-0 ml-1"
          onClick={onMobileMenuToggle}
          aria-label={mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
        >
          <Menu className="h-5 w-5 stroke-[2]" />
        </Button>
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center w-[55%] max-w-[240px] h-28 overflow-hidden">
          <img
            src="/logo.png"
            alt="Cogniar"
            className="h-28 w-auto max-w-full object-contain object-center"
          />
        </div>
      </div>

      {/* Espacio flexible + zona derecha */}
      <div className="flex-1 flex items-center justify-end min-w-0 gap-3">
        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex items-center gap-2.5 px-3 py-2 h-auto text-[#374151] rounded-[10px] transition-all duration-200 border border-transparent"
            >
              <UserAvatar
                nombre={formatDisplayText(user?.nombre) || 'Usuario'}
                apellido={formatDisplayText(user?.apellido)}
                size="sm"
              />
              <div className="hidden md:flex flex-col items-start">
                <span className="text-[13px] font-medium text-[#374151] font-['Inter'] leading-tight">
                  {formatDisplayText(user?.nombre)} {formatDisplayText(user?.apellido)}
                </span>
                <span className="text-[11px] text-[#6B7280] font-['Inter'] leading-tight">
                  {user?.rol ? getRoleLabel(user.rol) : 'Usuario'}
                </span>
              </div>
              <ChevronDown className="hidden md:block h-3.5 w-3.5 text-[#6B7280] stroke-[2] transition-transform duration-200 group-data-[state=open]:rotate-180" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
            align="end" 
            className="w-56 rounded-[12px] border border-[#E5E7EB] shadow-lg bg-white p-2"
          >
            <DropdownMenuLabel className="px-3 py-2 text-sm font-medium text-[#374151] font-['Inter']">
              Mi cuenta
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-[#E5E7EB] my-1" />
            <DropdownMenuItem
              onClick={() => {
                if (!user?.rol) return;
                const route = '/perfil';
                navigate(route);
              }}
              className="rounded-[8px] px-3 py-2 cursor-pointer transition-all duration-150 hover:bg-[#F3F4F6] focus:bg-[#F3F4F6] text-[#374151] text-sm font-['Inter']"
            >
              <User className="mr-3 h-4 w-4 stroke-[2] text-[#6B7280]" />
              Mi perfil
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-[#E5E7EB] my-1" />
            <DropdownMenuItem 
              onClick={handleLogout} 
              className="rounded-[8px] px-3 py-2 cursor-pointer transition-all duration-150 hover:bg-[#FEE2E2] focus:bg-[#FEE2E2] text-[#EF4444] hover:text-[#DC2626] text-sm font-medium font-['Inter']"
            >
              <LogOut className="mr-3 h-4 w-4 stroke-[2]" />
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}