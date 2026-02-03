import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { toast as reactToastify } from 'react-toastify';
import { authService } from '@/services/auth.service';
import type { User, LoginResponse } from '@/types';
import { 
  getToken, 
  setToken, 
  getUser, 
  setUser, 
  clearAuth,
  hasActiveSession 
} from '@/utils/storage';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Cargar usuario del localStorage al iniciar
  useEffect(() => {
    const loadUser = async () => {
      try {
        if (hasActiveSession()) {
          const storedUser = getUser<User>();
          const token = getToken();
          
          if (storedUser && token) {
            setUserState(storedUser);
            
            // Verificar que el token sigue siendo válido obteniendo el perfil
            try {
              const profile = await authService.getProfile();
              setUserState(profile);
              setUser(profile); // Actualizar también en localStorage con perfil completo
            } catch (error) {
              // Token inválido, limpiar sesión
              console.error('Token inválido:', error);
              clearAuth();
              setUserState(null);
            }
          }
        }
      } catch (error) {
        console.error('Error al cargar usuario:', error);
        clearAuth();
        setUserState(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadUser();
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      const response: LoginResponse = await authService.login(email, password);
      
      // Guardar token y usuario inicial
      setToken(response.token);
      setUser(response.user);
      
      // Obtener perfil completo del backend
      const profile = await authService.getProfile();
      
      // Actualizar estado y localStorage con perfil completo
      setUserState(profile);
      setUser(profile);
      
      setIsLoading(false);
      
      // Mostrar toast de éxito
      reactToastify.success('¡Inicio de sesión exitoso!', {
        position: 'top-right',
        autoClose: 3000,
      });
      
      return true;
    } catch (error: any) {
      setIsLoading(false);
      
      // Limpiar datos en caso de error
      clearAuth();
      setUserState(null);
      
      // Mostrar toast de error con mensaje amigable
      // El backend ya envía mensajes amigables, pero si no hay mensaje, usar uno por defecto
      const backendMessage = error.response?.data?.message;
      const friendlyMessage = backendMessage || 'Tu email o contraseña están incorrectos. Por favor, verifica tus credenciales e intenta nuevamente.';
      
      reactToastify.error(friendlyMessage, {
        position: 'top-right',
        autoClose: 4000,
      });
      
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    clearAuth();
    setUserState(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user: user,
        isAuthenticated: !!user && hasActiveSession(),
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
