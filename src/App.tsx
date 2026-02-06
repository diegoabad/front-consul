import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import { Toaster } from './components/ui/toaster';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Pages
import Login from './pages/Login';
import ProtectedRoute from './components/common/ProtectedRoute';
import DefaultRedirect from './components/common/DefaultRedirect';
import { DashboardLayout } from './components/layout/DashboardLayout';

// Páginas unificadas (lógica por rol dentro de cada componente)
import Dashboard from './pages/Dashboard';
import PacientesList from './pages/Pacientes/List';
import PacienteDetail from './pages/Pacientes/Detail';
import PagosList from './pages/Pagos/List';
import UsuariosList from './pages/Usuarios/List';
import PerfilList from './pages/Perfil/List';
import AgendasList from './pages/Agendas/List';
import TurnosList from './pages/Turnos/List';
import EspecialidadesList from './pages/Especialidades/List';
import ObrasSocialesList from './pages/ObrasSociales/List';
import LogsList from './pages/Logs/List';

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
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/contrato" element={<PagosList />} />
                <Route path="/agendas" element={<AgendasList />} />
                <Route path="/turnos" element={<TurnosList />} />
                <Route path="/pacientes" element={<PacientesList />} />
                <Route path="/pacientes/:id" element={<PacienteDetail />} />
                <Route path="/usuarios" element={<UsuariosList />} />
                <Route path="/especialidades" element={<EspecialidadesList />} />
                <Route path="/obras-sociales" element={<ObrasSocialesList />} />
                <Route path="/logs" element={<LogsList />} />
                <Route path="/perfil" element={<PerfilList />} />
              </Route>

              <Route path="/" element={<DefaultRedirect />} />
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
