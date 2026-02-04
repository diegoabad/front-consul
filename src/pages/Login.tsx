import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast as reactToastify } from 'react-toastify';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { login, isLoading, user } = useAuth();
  const navigate = useNavigate();

  // Redirigir automáticamente cuando el usuario se autentica
  useEffect(() => {
    if (user && !isLoading) {
      // Mapear roles a rutas
      const redirectPath = '/dashboard';
      
      // Usar replace para evitar que el botón "atrás" vuelva al login
      navigate(redirectPath, { replace: true });
    }
  }, [user, isLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (!email || !password) {
      reactToastify.error('Por favor complete todos los campos', {
        position: 'top-right',
        autoClose: 3000,
      });
      return;
    }

    // El login ya maneja la actualización del estado y la redirección se hace automáticamente
    await login(email, password);
    // El error ya se muestra en AuthContext con react-toastify
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Capa 1: imagen de fondo en blanco y negro */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('/bg-login.png')",
          filter: 'grayscale(100%)',
        }}
      />
      {/* Capa 2: degradado azul con opacidad */}
      <div
        className="absolute inset-0 bg-gradient-to-br from-[#2563eb]/75 via-[#1d4ed8]/60 to-sky-600/70"
        aria-hidden
      />

      <div className="w-full max-w-md relative z-10">
        <div className="bg-white rounded-[20px] shadow-2xl border border-[#E5E7EB] p-10">
          {/* Logo */}
          <div className="flex flex-col items-center mb-6">
            <div className="h-[80px] max-h-[80px] overflow-hidden flex items-center justify-center w-full">
              <img
                src="/logo.png"
                alt="Cogniar"
                className="h-[168px] w-auto object-contain"
              />
            </div>
            <p className="text-[#6B7280] text-sm mt-0.5 text-center font-['Inter'] mb-0">
              Sistema de gestión clínica
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div className="space-y-2 mb-3">
              <Label htmlFor="email" className="text-[15px] font-medium text-[#374151] font-['Inter']">
                Correo electrónico
              </Label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#9CA3AF] stroke-[2]" />
                <Input
                  id="email"
                  type="email"
                  placeholder="usuario@ejemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-12 h-12 border-[#D1D5DB] rounded-[10px] text-[16px] font-['Inter'] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200"
                  disabled={isLoading}
                  required
                />
              </div>
            </div>

            <div className="space-y-2 mb-8">
              <Label htmlFor="password" className="text-[15px] font-medium text-[#374151] font-['Inter']">
                Contraseña
              </Label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#9CA3AF] stroke-[2]" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-12 pr-12 h-12 border-[#D1D5DB] rounded-[10px] text-[16px] font-['Inter'] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-200"
                  disabled={isLoading}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#374151] transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 stroke-[2]" />
                  ) : (
                    <Eye className="h-5 w-5 stroke-[2]" />
                  )}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-12 bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-lg shadow-[#2563eb]/30 hover:shadow-xl hover:shadow-[#2563eb]/40 transition-all duration-200 rounded-[12px] font-semibold font-['Inter'] text-[15px]"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin stroke-[2.5]" />
                  Ingresando...
                </>
              ) : (
                'Ingresar'
              )}
            </Button>
          </form>

          {/* Footer */}
          <p className="text-center text-xs text-[#9CA3AF] mt-6 mb-0 font-['Inter']">
            © {new Date().getFullYear()} Cogniar. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </div>
  );
}
