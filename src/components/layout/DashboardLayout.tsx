import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, Outlet, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardSidebar } from './DashboardSidebar';
import { DashboardHeader } from './DashboardHeader';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { cn } from '@/lib/utils';
import { hasPermission } from '@/utils/permissions';
import type { UserRole } from '@/types';

// Rutas permitidas por rol (deben coincidir con el sidebar). Incluye /perfil para todos.
const RUTAS_POR_ROL: Record<UserRole, string[]> = {
  administrador: ['/dashboard', '/contrato', '/turnos', '/pacientes', '/agendas', '/usuarios', '/especialidades', '/obras-sociales', '/foro', '/logs', '/recordatorios', '/perfil'],
  profesional: ['/turnos', '/pacientes', '/contrato', '/foro', '/perfil'],
  secretaria: ['/turnos', '/contrato', '/pacientes', '/agendas', '/usuarios', '/especialidades', '/obras-sociales', '/foro', '/perfil'],
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
  /** Ruta anterior (para Turnos: al volver desde Agendas/Pacientes, ir al día de hoy). */
  const prevPathnameRef = useRef<string | null>(null);

  const rutaNoPermitida = useMemo(() => {
    if (!user) return false;
    return !rutaPermitida(location.pathname, user.rol);
  }, [user, location.pathname]);

  const intentaAccederForoSinPermiso = useMemo(() => {
    if (!user) return false;
    const esRutaForo = location.pathname === '/foro' || location.pathname.startsWith('/foro/');
    return esRutaForo && !hasPermission(user, 'foro.leer');
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

  // Guardar ruta previa en sessionStorage (Turnos lee si volvió desde otra pantalla)
  useEffect(() => {
    const prev = prevPathnameRef.current;
    prevPathnameRef.current = location.pathname;
    try {
      sessionStorage.setItem('consul_prev_route', prev ?? '');
    } catch {
      /* ignore */
    }
  }, [location.pathname]);

  if (!isAuthenticated || !user) {
    return null;
  }

  if (rutaNoPermitida) {
    return <Navigate to={REDIRECT_POR_ROL[user.rol]} replace />;
  }

  if (intentaAccederForoSinPermiso) {
    return (
      <div className="h-screen overflow-hidden flex flex-col bg-white">
        <div className="hidden lg:block">
          <DashboardSidebar role={user.rol} user={user} collapsed={sidebarCollapsed} />
        </div>
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 pt-16 lg:hidden" aria-modal="true" role="dialog">
            <div className="absolute inset-0 bg-black/50" role="button" tabIndex={-1} aria-label="Cerrar menú" onClick={() => setMobileMenuOpen(false)} onPointerDown={(e) => { if (e.target === e.currentTarget) setMobileMenuOpen(false); }} />
            <div className="absolute left-0 top-16 bottom-0 w-[224px] max-w-[85vw] bg-white border-r border-[#E5E7EB] overflow-hidden shadow-xl">
              <DashboardSidebar role={user.rol} user={user} onNavigate={() => setMobileMenuOpen(false)} mobileDrawer />
            </div>
          </div>
        )}
        <DashboardHeader sidebarCollapsed={sidebarCollapsed} onSidebarToggle={() => setSidebarCollapsed(!sidebarCollapsed)} onMobileMenuToggle={() => setMobileMenuOpen((prev) => !prev)} mobileMenuOpen={mobileMenuOpen} />
        <main className={cn('flex-1 min-h-0 overflow-y-auto overflow-x-hidden bg-white transition-all duration-300 pt-16', sidebarCollapsed ? 'lg:pl-[72px]' : 'lg:pl-[224px]')}>
          <div className="p-4 md:p-6 lg:p-8 flex flex-col items-center justify-center min-h-[60vh]">
            <div className="max-w-md text-center">
              <div className="h-16 w-16 rounded-full bg-[#FEF2F2] flex items-center justify-center mx-auto mb-4">
                <svg className="h-8 w-8 text-[#EF4444]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              </div>
              <h2 className="text-[22px] font-bold text-[#111827] font-['Poppins'] mb-2">No tenés acceso al foro</h2>
              <p className="text-[15px] text-[#6B7280] font-['Inter'] mb-0">El administrador no te ha habilitado para ver el foro profesional. Si creés que es un error, contactalo.</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-white">
      {/* Desktop Sidebar (fixed, no scroll) */}
      <div className="hidden lg:block">
        <DashboardSidebar role={user.rol} user={user} collapsed={sidebarCollapsed} />
      </div>

      {/* Mobile Sidebar: overlay por encima del contenido y FABs (z-50) pero el header está después en DOM así que sigue visible para cerrar */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 pt-16 lg:hidden" aria-modal="true" role="dialog">
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
          <div className="absolute left-0 top-16 bottom-0 w-[224px] max-w-[85vw] bg-white border-r border-[#E5E7EB] overflow-hidden shadow-xl">
            <DashboardSidebar role={user.rol} user={user} onNavigate={() => setMobileMenuOpen(false)} mobileDrawer />
          </div>
        </div>
      )}

      {/* Header: fijo arriba, no hace scroll con el contenido */}
      <DashboardHeader
        sidebarCollapsed={sidebarCollapsed}
        onSidebarToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        onMobileMenuToggle={() => setMobileMenuOpen((prev) => !prev)}
        mobileMenuOpen={mobileMenuOpen}
      />

      {/* Main Content: único área con scroll vertical en desktop */}
      <main
        className={cn(
          'flex flex-1 min-h-0 flex-col overflow-y-auto overflow-x-hidden bg-white transition-all duration-300 pt-16',
          sidebarCollapsed ? 'lg:pl-[72px]' : 'lg:pl-[224px]'
        )}
      >
        <div className="p-4 md:p-6 lg:p-8 text-[#374151] flex flex-col flex-1 min-h-0 w-full">
          <ErrorBoundary fullPage={false}>
            <Outlet />
          </ErrorBoundary>
        </div>
      </main>
    </div>
  );
}
