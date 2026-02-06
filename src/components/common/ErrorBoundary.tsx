import { Component, type ErrorInfo, type ReactNode } from 'react';
import { getToken, getUser } from '@/utils/storage';

const API_URL = import.meta.env.VITE_API_URL || '';

function sendErrorLog(error: Error, errorInfo: ErrorInfo | null) {
  try {
    const user = getUser<{ id?: number; rol?: string }>();
    const payload = {
      origen: 'front',
      usuario_id: user?.id ?? null,
      rol: user?.rol ?? null,
      pantalla: typeof window !== 'undefined' ? window.location.pathname : '',
      accion: 'render',
      mensaje: error?.message || 'Error sin mensaje',
      stack: errorInfo?.componentStack ?? error?.stack ?? null,
    };
    fetch(`${API_URL}/logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) },
      body: JSON.stringify(payload),
    }).catch(() => {});
  } catch (_) {}
}

interface Props {
  children: ReactNode;
  /** Si true, pantalla completa; si false, solo el bloque de contenido (mantiene barra y sidebar) */
  fullPage?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    sendErrorLog(error, errorInfo);
  }

  render(): ReactNode {
    if (!this.state.hasError || !this.state.error) {
      return this.props.children;
    }

    const content = (
      <div className="flex flex-col items-center justify-center text-center p-8 max-w-md mx-auto">
        <p className="text-[18px] font-semibold text-[#374151] font-['Inter'] mb-2">
          Ups, ha ocurrido un error
        </p>
        <p className="text-[15px] text-[#6B7280] font-['Inter'] mb-6">
          En caso de persistir, comunícate con el administrador.
        </p>
        <a
          href="/"
          className="inline-flex items-center justify-center h-12 px-6 rounded-[12px] bg-[#2563eb] text-white font-medium font-['Inter'] hover:bg-[#1d4ed8] transition-colors"
        >
          Volver al inicio
        </a>
      </div>
    );

    if (this.props.fullPage !== false) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB] p-4">
          {content}
        </div>
      );
    }

    return (
      <div className="min-h-[320px] flex items-center justify-center p-8">
        {content}
      </div>
    );
  }
}
