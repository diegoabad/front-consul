import { useState, useEffect } from 'react';
import { useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardSidebar } from './DashboardSidebar';
import { DashboardHeader } from './DashboardHeader';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function DashboardLayout() {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  if (!isAuthenticated || !user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <DashboardSidebar role={user.rol} collapsed={sidebarCollapsed} />
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-[280px] bg-white border-r border-[#E5E7EB] overflow-hidden">
            <div className="relative z-10 flex items-center justify-end p-2 border-b border-[#E5E7EB] bg-white">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileMenuOpen(false)}
                className="text-[#6B7280] hover:text-[#374151]"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <DashboardSidebar role={user.rol} />
          </div>
        </div>
      )}

      {/* Header (por encima del sidebar) */}
      <DashboardHeader
        sidebarCollapsed={sidebarCollapsed}
        onSidebarToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        onMobileMenuToggle={() => setMobileMenuOpen(true)}
      />

      {/* Main Content */}
      <main
        className={cn(
          'pt-16 min-h-screen bg-white transition-all duration-300',
          sidebarCollapsed ? 'lg:pl-[72px]' : 'lg:pl-[280px]'
        )}
      >
        <div className="p-4 md:p-6 lg:p-8 text-[#374151]">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
