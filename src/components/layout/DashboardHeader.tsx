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
import { cn } from '@/lib/utils';

interface DashboardHeaderProps {
  sidebarCollapsed: boolean;
  onMobileMenuToggle: () => void;
}

export function DashboardHeader({
  sidebarCollapsed,
  onMobileMenuToggle,
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
    <header
      className={cn(
        'fixed top-0 right-0 z-30 h-16 bg-white border-b border-[#E5E7EB] flex items-center justify-between px-6 transition-all duration-300 shadow-sm',
        sidebarCollapsed ? 'left-16' : 'left-[280px]',
        'max-lg:left-0'
      )}
    >
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden text-[#6B7280] hover:text-[#374151] hover:bg-[#F3F4F6] rounded-[10px] transition-all duration-200"
        onClick={onMobileMenuToggle}
      >
        <Menu className="h-5 w-5 stroke-[2]" />
      </Button>

      {/* Spacer for desktop */}
      <div className="hidden lg:block" />

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex items-center gap-3 px-3 py-2 h-auto hover:bg-[#F3F4F6] text-[#374151] rounded-[10px] transition-all duration-200 border border-transparent hover:border-[#E5E7EB]"
            >
              <UserAvatar
                nombre={user?.nombre || 'Usuario'}
                apellido={user?.apellido}
                size="sm"
              />
              <div className="hidden md:flex flex-col items-start">
                <span className="text-sm font-medium text-[#374151] font-['Inter']">
                  {user?.nombre} {user?.apellido}
                </span>
                <span className="text-xs text-[#6B7280] font-['Inter']">
                  {user?.rol ? getRoleLabel(user.rol) : 'Usuario'}
                </span>
              </div>
              <ChevronDown className="h-4 w-4 text-[#6B7280] stroke-[2] transition-transform duration-200 group-data-[state=open]:rotate-180" />
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