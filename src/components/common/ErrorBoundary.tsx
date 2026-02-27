import { Component, type ErrorInfo, type ReactNode } from 'react';
import { getToken, getUser } from '@/utils/storage';

const API_URL = import.meta.env.VITE_API_URL || 'https://consul-mm.onrender.com/api';

/** Construye el detalle completo del error para guardar en stack (visible en pestaña Detalle del modal de logs) */
function buildErrorDetail(error: Error | null, errorInfo: ErrorInfo | null): string {
  const parts: string[] = [];
  const err = error ?? new Error('Error sin instancia');
  const name = err?.name || 'Error';
  const message = err?.message || String(err) || 'Sin mensaje';
  parts.push(`${name}: ${message}`);

  // Stack trace del error (crítico para depurar)
  const stack = err?.stack;
  if (stack && typeof stack === 'string') {
    parts.push('\n--- Stack trace ---\n' + stack);
  } else {
    parts.push('\n--- Stack trace ---\n(no disponible - el error no incluyó stack)');
  }

  // React component stack (indica qué componente causó el error)
  if (errorInfo?.componentStack?.trim()) {
    parts.push('\n--- React component stack ---\n' + errorInfo.componentStack.trim());
  }

  return parts.join('\n').trim() || 'Sin detalles del error';
}

function sendErrorLog(error: Error, errorInfo: ErrorInfo | null) {
  try {
    const stackDetail = buildErrorDetail(error, errorInfo);
    let user: { id?: number; rol?: string } | null = null;
    try {
      user = getUser<{ id?: number; rol?: string }>();
    } catch (_) {}
    const payload = {
      origen: 'front',
      usuario_id: user?.id ?? null,
      rol: user?.rol ?? null,
      pantalla: typeof window !== 'undefined' ? window.location.pathname : '',
      accion: 'render',
      mensaje: error?.message || 'Error sin mensaje',
      stack: stackDetail,
    };
    let authHeader: Record<string, string> = {};
    try {
      const token = getToken();
      if (token) authHeader = { Authorization: `Bearer ${token}` };
    } catch (_) {}
    fetch(`${API_URL}/logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader },
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
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    sendErrorLog(error, errorInfo);
    this.setState({ errorInfo });
  }

  render(): ReactNode {
    if (!this.state.hasError || !this.state.error) {
      return this.props.children;
    }

    const errorDetail = buildErrorDetail(this.state.error, this.state.errorInfo);

    const content = (
      <div className="flex flex-col items-center justify-center text-center p-8 max-w-2xl mx-auto">
        <p className="text-[18px] font-semibold text-[#374151] font-['Inter'] mb-2">
          Ups, ha ocurrido un error
        </p>
        <p className="text-[15px] text-[#6B7280] font-['Inter'] mb-4">
          En caso de persistir, comunícate con el administrador.
        </p>
        <div className="w-full mb-6 text-left">
          <p className="text-[13px] font-medium text-[#374151] font-['Inter'] mb-2">Detalle del error (se guarda en logs):</p>
          <pre className="m-0 p-4 border border-[#E5E7EB] rounded-[10px] bg-[#FEF2F2] overflow-x-auto text-[12px] whitespace-pre-wrap break-words font-mono text-[#374151] max-h-[200px] overflow-y-auto">
            {errorDetail}
          </pre>
        </div>
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
