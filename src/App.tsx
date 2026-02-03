import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import { Toaster } from './components/ui/toaster';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Pages
import Login from './pages/Login';
import ProtectedRoute from './components/common/ProtectedRoute';
import { DashboardLayout } from './components/layout/DashboardLayout';

// Unificado: usamos los componentes de admin para todas las rutas (luego lógica por rol)
import AdminDashboard from './pages/admin/Dashboard';
import AdminPacientes from './pages/admin/Pacientes/List';
import PacienteDetail from './pages/admin/Pacientes/Detail';
import AdminPagos from './pages/admin/Pagos/List';
import AdminUsuarios from './pages/admin/Usuarios/List';
import AdminPerfil from './pages/admin/Perfil/List';
import AdminAgendas from './pages/admin/Agendas/List';
import AdminTurnos from './pages/admin/Turnos/List';
import AdminEspecialidades from './pages/admin/Especialidades/List';
import AdminObrasSociales from './pages/admin/ObrasSociales/List';

// Profesional: agenda propia y config (vista específica)
import ProfesionalAgenda from './pages/profesional/Agenda/List';
import ProfesionalAgendaConfig from './pages/profesional/Agenda/Config';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Rutas públicas */}
            <Route path="/login" element={<Login />} />

            {/* Rutas protegidas: un solo layout, rutas unificadas */}
            <Route element={<ProtectedRoute />}>
              <Route element={<DashboardLayout />}>
                <Route path="/dashboard" element={<AdminDashboard />} />
                <Route path="/contrato" element={<AdminPagos />} />
                <Route path="/agendas" element={<AdminAgendas />} />
                <Route path="/agenda" element={<ProfesionalAgenda />} />
                <Route path="/agenda/config" element={<ProfesionalAgendaConfig />} />
                <Route path="/turnos" element={<AdminTurnos />} />
                <Route path="/pacientes" element={<AdminPacientes />} />
                <Route path="/pacientes/:id" element={<PacienteDetail />} />
                <Route path="/usuarios" element={<AdminUsuarios />} />
                <Route path="/especialidades" element={<AdminEspecialidades />} />
                <Route path="/obras-sociales" element={<AdminObrasSociales />} />
                <Route path="/perfil" element={<AdminPerfil />} />
              </Route>

              <Route path="/" element={<Navigate to="/dashboard" replace />} />
            </Route>

            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster />
        <ToastContainer
          position="top-right"
          autoClose={4000}
          hideProgressBar={false}
          newestOnTop={true}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="light"
          className="!top-6 !right-6 !max-w-[420px]"
          toastClassName="!bg-white !rounded-xl !shadow-[0_10px_40px_rgba(0,0,0,0.15),0_4px_8px_rgba(0,0,0,0.1)] !border-l-4 !p-4 !min-h-[60px] !mb-3"
        />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
