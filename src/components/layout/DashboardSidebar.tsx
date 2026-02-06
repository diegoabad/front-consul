import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  UserCog,
  CreditCard,
  Calendar,
  GraduationCap,
  Building2,
  FileText,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { UserRole, User } from '@/types';

interface MenuItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
}

const SIDEBAR_WIDTH_EXPANDED = 280;
const SIDEBAR_WIDTH_COLLAPSED = 72;

interface DashboardSidebarProps {
  role: UserRole;
  user?: User | null;
  collapsed?: boolean;
  /** Llamado al hacer clic en un enlace (ej. para cerrar menú móvil) */
  onNavigate?: () => void;
  /** true cuando se usa dentro del drawer móvil (sin fixed, sin espacio superior) */
  mobileDrawer?: boolean;
}

interface SidebarMenuConfig {
  beforeSeparator: MenuItem[];
  afterSeparator: MenuItem[];
}

const menuConfig: Record<UserRole, SidebarMenuConfig> = {
  administrador: {
    beforeSeparator: [
      { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
      { title: 'Contratos', url: '/contrato', icon: CreditCard },
      { title: 'Turnos', url: '/turnos', icon: Calendar },
      { title: 'Pacientes', url: '/pacientes', icon: Users },
    ],
    afterSeparator: [
      { title: 'Agendas', url: '/agendas', icon: Calendar },
      { title: 'Usuarios', url: '/usuarios', icon: UserCog },
      { title: 'Especialidades', url: '/especialidades', icon: GraduationCap },
      { title: 'Obras Sociales', url: '/obras-sociales', icon: Building2 },
      { title: 'Logs', url: '/logs', icon: FileText },
    ],
  },
  profesional: {
    beforeSeparator: [
      { title: 'Turnos', url: '/turnos', icon: Calendar },
      { title: 'Pacientes', url: '/pacientes', icon: Users },
      { title: 'Contratos', url: '/contrato', icon: CreditCard },
    ],
    afterSeparator: [],
  },
  secretaria: {
    beforeSeparator: [
      { title: 'Turnos', url: '/turnos', icon: Calendar },
      { title: 'Contratos', url: '/contrato', icon: CreditCard },
      { title: 'Pacientes', url: '/pacientes', icon: Users },
    ],
    afterSeparator: [
      { title: 'Agendas', url: '/agendas', icon: Calendar },
      { title: 'Usuarios', url: '/usuarios', icon: UserCog },
      { title: 'Especialidades', url: '/especialidades', icon: GraduationCap },
      { title: 'Obras Sociales', url: '/obras-sociales', icon: Building2 },
    ],
  },
};

function renderNavItem(
  item: MenuItem,
  location: ReturnType<typeof useLocation>,
  collapsed: boolean,
  onNavigate?: () => void
) {
  const isActive = location.pathname === item.url || location.pathname.startsWith(item.url + '/');
  const Icon = item.icon;

  const linkContent = (
    <NavLink
      key={item.url}
      to={item.url}
      onClick={onNavigate}
      className={cn(
        'flex items-center rounded-[10px] transition-all duration-200 text-[15px] font-medium relative group',
        collapsed ? 'justify-center px-0 py-3 w-full' : 'gap-3 px-4 py-3',
        isActive
          ? 'bg-[#dbeafe] text-[#2563eb] shadow-sm'
          : 'text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#374151]'
      )}
    >
      {isActive && !collapsed && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-[#2563eb] rounded-r-full" />
      )}
      <Icon
        className={cn('h-5 w-5 shrink-0 stroke-[2] transition-transform duration-200', collapsed ? 'mx-auto' : '', !isActive && 'group-hover:scale-110')}
      />
      {!collapsed && <span className="truncate">{item.title}</span>}
    </NavLink>
  );

  if (collapsed) {
    return (
      <Tooltip key={item.url}>
        <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={12} className="bg-[#111827] text-white border-[#111827] [&>p]:text-white">
          <p>{item.title}</p>
        </TooltipContent>
      </Tooltip>
    );
  }
  return linkContent;
}

export function DashboardSidebar({ role, user: _user, collapsed = false, onNavigate, mobileDrawer = false }: DashboardSidebarProps) {
  const location = useLocation();

  const config = menuConfig[role] || { beforeSeparator: [], afterSeparator: [] };
  const { beforeSeparator, afterSeparator } = config;
  const isDrawer = mobileDrawer;
  return (
    <aside
      className={cn(
        'bg-white transition-all duration-300 flex flex-col overflow-hidden',
        isDrawer ? 'w-full h-full' : 'fixed left-0 top-0 z-40 h-screen border-r border-[#E5E7EB] shadow-sm',
        !isDrawer && (collapsed ? 'w-[72px]' : 'w-[280px]')
      )}
    >
      {!isDrawer && (
        /* Espacio para que el menú no quede bajo la barra superior (solo desktop) */
        <div className="h-16 flex-shrink-0" aria-hidden />
      )}

      {/* Menu Items */}
      <nav
        className={cn(
          'flex-1 py-6 space-y-1 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-[#E5E7EB] scrollbar-track-transparent',
          collapsed ? 'px-2' : 'px-3'
        )}
      >
        <TooltipProvider delayDuration={300} skipDelayDuration={0}>
          <div className="space-y-1">
            {beforeSeparator.map((item) => renderNavItem(item, location, collapsed, onNavigate))}
          </div>
          {afterSeparator.length > 0 && (
            <>
              <div className={cn('border-t border-[#E5E7EB] my-3', collapsed ? 'mx-0' : 'mx-1')} aria-hidden />
              <div className="space-y-1">
                {afterSeparator.map((item) => renderNavItem(item, location, collapsed, onNavigate))}
              </div>
            </>
          )}
        </TooltipProvider>
      </nav>
    </aside>
  );
}

export { SIDEBAR_WIDTH_EXPANDED, SIDEBAR_WIDTH_COLLAPSED };
