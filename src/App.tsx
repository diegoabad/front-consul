import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import { ToastContainer } from 'react-toastify';
import { Loader2 } from 'lucide-react';
import 'react-toastify/dist/ReactToastify.css';

import ProtectedRoute from './components/common/ProtectedRoute';
import DefaultRedirect from './components/common/DefaultRedirect';
import { DashboardLayout } from './components/layout/DashboardLayout';

// Páginas: lazy para code-splitting (chunks por ruta)
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const PacientesList = lazy(() => import('./pages/Pacientes/List'));
const PacienteDetail = lazy(() => import('./pages/Pacientes/Detail'));
const PagosList = lazy(() => import('./pages/Pagos/List'));
const UsuariosList = lazy(() => import('./pages/Usuarios/List'));
const PerfilList = lazy(() => import('./pages/Perfil/List'));
const AgendasList = lazy(() => import('./pages/Agendas/List'));
const TurnosList = lazy(() => import('./pages/Turnos/List'));
const EspecialidadesList = lazy(() => import('./pages/Especialidades/List'));
const ObrasSocialesList = lazy(() => import('./pages/ObrasSociales/List'));
const LogsList = lazy(() => import('./pages/Logs/List'));

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
          <Suspense
            fallback={
              <div className="min-h-screen flex items-center justify-center bg-white">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-10 w-10 animate-spin text-[#2563eb]" />
                  <p className="text-[#6B7280] font-['Inter'] text-sm">Cargando...</p>
                </div>
              </div>
            }
          >
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
          </Suspense>
        </BrowserRouter>
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
