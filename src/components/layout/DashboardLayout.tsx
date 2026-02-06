import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Outlet, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardSidebar } from './DashboardSidebar';
import { DashboardHeader } from './DashboardHeader';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { cn } from '@/lib/utils';
import type { UserRole } from '@/types';

// Rutas permitidas por rol (deben coincidir con el sidebar). Incluye /perfil para todos.
const RUTAS_POR_ROL: Record<UserRole, string[]> = {
  administrador: ['/dashboard', '/contrato', '/turnos', '/pacientes', '/agendas', '/usuarios', '/especialidades', '/obras-sociales', '/logs', '/perfil'],
  profesional: ['/turnos', '/pacientes', '/contrato', '/perfil'],
  secretaria: ['/turnos', '/contrato', '/pacientes', '/agendas', '/usuarios', '/especialidades', '/obras-sociales', '/perfil'],
};

const REDIRECT_POR_ROL: Record<UserRole, string> = {
  administrador: '/dashboard',
  profesional: '/turnos',
  secretaria: '/turnos',
};

function rutaPermitida(pathname: string, rol: UserRole): boolean {
  const bases = RUTAS_POR_ROL[rol];
  return bases.some((base) => pathname === base || pathname.startsWith(base + '/'));
}

export function DashboardLayout() {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const rutaNoPermitida = useMemo(() => {
    if (!user) return false;
    return !rutaPermitida(location.pathname, user.rol);
  }, [user, location.pathname]);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  // Cerrar menú móvil al cambiar de ruta (al hacer clic en un enlace del sidebar)
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  if (!isAuthenticated || !user) {
    return null;
  }

  if (rutaNoPermitida) {
    return <Navigate to={REDIRECT_POR_ROL[user.rol]} replace />;
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <DashboardSidebar role={user.rol} user={user} collapsed={sidebarCollapsed} />
      </div>

      {/* Mobile Sidebar: overlay DEBAJO del header (z-40) para que la barra con hamburguesa + logo siga visible y se pueda cerrar desde ahí */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 pt-16 lg:hidden" aria-modal="true" role="dialog">
          <div
            className="absolute inset-0 bg-black/50"
            role="button"
            tabIndex={-1}
            aria-label="Cerrar menú"
            onClick={() => setMobileMenuOpen(false)}
            onPointerDown={(e) => {
              if (e.target === e.currentTarget) setMobileMenuOpen(false);
            }}
          />
          <div className="absolute left-0 top-16 bottom-0 w-[280px] max-w-[85vw] bg-white border-r border-[#E5E7EB] overflow-hidden shadow-xl">
            <DashboardSidebar role={user.rol} user={user} onNavigate={() => setMobileMenuOpen(false)} mobileDrawer />
          </div>
        </div>
      )}

      {/* Header: en móvil siempre visible (z-50) con hamburguesa + logo; la hamburguesa hace toggle del menú */}
      <DashboardHeader
        sidebarCollapsed={sidebarCollapsed}
        onSidebarToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        onMobileMenuToggle={() => setMobileMenuOpen((prev) => !prev)}
        mobileMenuOpen={mobileMenuOpen}
      />

      {/* Main Content */}
      <main
        className={cn(
          'pt-16 min-h-screen bg-white transition-all duration-300',
          sidebarCollapsed ? 'lg:pl-[72px]' : 'lg:pl-[280px]'
        )}
      >
        <div className="p-4 md:p-6 lg:p-8 text-[#374151]">
          <ErrorBoundary fullPage={false}>
            <Outlet />
          </ErrorBoundary>
        </div>
      </main>
    </div>
  );
}
