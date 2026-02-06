// Tipos para el sistema de consultorio médico

export type UserRole = 'administrador' | 'profesional' | 'secretaria';

export interface User {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  telefono?: string;
  rol: UserRole;
  activo: boolean;
  fecha_creacion?: string;
  fecha_actualizacion?: string;
}

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
    rol: UserRole;
  };
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: any;
}

// Tipos para pacientes
export interface Paciente {
  id: string;
  dni: string;
  nombre: string;
  apellido: string;
  fecha_nacimiento?: string;
  telefono?: string;
  email?: string;
  direccion?: string;
  obra_social?: string;
  numero_afiliado?: string;
  contacto_emergencia_nombre?: string;
  contacto_emergencia_telefono?: string;
  activo: boolean;
  fecha_creacion?: string;
  fecha_actualizacion?: string;
}

// Tipos para profesionales
export interface Profesional {
  id: string;
  usuario_id: string;
  matricula?: string;
  especialidad?: string;
  estado_pago: 'al_dia' | 'pendiente' | 'moroso';
  bloqueado: boolean;
  razon_bloqueo?: string;
  fecha_ultimo_pago?: string;
  fecha_inicio_contrato?: string;
  monto_mensual?: number;
  tipo_periodo_pago?: 'mensual' | 'quincenal' | 'semanal' | 'anual';
  observaciones?: string;
  fecha_creacion?: string;
  fecha_actualizacion?: string;
  // Datos del usuario asociado (vienen del JOIN en el backend)
  email?: string;
  nombre?: string;
  apellido?: string;
  telefono?: string;
  usuario_activo?: boolean; // activo del usuario
  activo?: boolean; // alias usado en listados
}

// Tipos para pagos
export interface Pago {
  id: string;
  profesional_id: string;
  periodo: string; // Date en formato ISO (inicio del período)
  monto: string; // Decimal como string
  fecha_pago?: string;
  estado: 'pendiente' | 'pagado' | 'vencido';
  metodo_pago?: string;
  comprobante_url?: string;
  observaciones?: string;
  fecha_creacion?: string;
  fecha_actualizacion?: string;
  // Datos relacionados
  profesional_nombre?: string;
  profesional_apellido?: string;
  profesional_email?: string;
  profesional_tipo_periodo_pago?: 'mensual' | 'quincenal' | 'semanal' | 'anual';
}

// Tipos para notificaciones
export interface Notificacion {
  id: string;
  destinatario_email: string;
  asunto: string;
  contenido: string;
  tipo?: string;
  estado: 'pendiente' | 'enviado' | 'fallido';
  error_mensaje?: string;
  relacionado_tipo?: string;
  relacionado_id?: string;
  fecha_envio?: string;
  fecha_creacion?: string;
  fecha_actualizacion?: string;
}

// Tipos para archivos de paciente
export interface Archivo {
  id: string;
  paciente_id: string;
  profesional_id?: string | null;
  nombre_archivo: string;
  tipo_archivo?: string;
  url_archivo: string;
  tamanio_bytes?: number;
  descripcion?: string;
  fecha_subida?: string;
  fecha_actualizacion?: string;
  // Datos relacionados
  paciente_nombre?: string;
  paciente_apellido?: string;
  profesional_nombre?: string;
  profesional_apellido?: string;
}

// Tipos para notas de paciente
export interface Nota {
  id: string;
  paciente_id: string;
  usuario_id: string;
  contenido: string;
  fecha_creacion?: string;
  fecha_actualizacion?: string;
  // Datos relacionados
  paciente_nombre?: string;
  paciente_apellido?: string;
  usuario_nombre?: string;
  usuario_apellido?: string;
  especialidad?: string; // Si el usuario es profesional
}

// Tipos para evoluciones clínicas
export interface Evolucion {
  id: string;
  paciente_id: string;
  profesional_id: string;
  turno_id?: string;
  fecha_consulta: string;
  motivo_consulta?: string;
  diagnostico?: string;
  tratamiento?: string;
  observaciones?: string;
  fecha_creacion?: string;
  fecha_actualizacion?: string;
  // Datos relacionados
  paciente_nombre?: string;
  paciente_apellido?: string;
  profesional_nombre?: string;
  profesional_apellido?: string;
  profesional_especialidad?: string;
}

// Tipos para turnos
export interface Turno {
  id: string;
  profesional_id: string;
  paciente_id: string;
  fecha_hora_inicio: string; // ISO datetime
  fecha_hora_fin: string; // ISO datetime
  estado: 'confirmado' | 'pendiente' | 'cancelado' | 'completado' | 'ausente';
  sobreturno?: boolean;
  motivo?: string;
  cancelado_por?: string;
  razon_cancelacion?: string;
  fecha_creacion?: string;
  fecha_actualizacion?: string;
  // Datos relacionados
  profesional_nombre?: string;
  profesional_apellido?: string;
  profesional_email?: string;
  paciente_nombre?: string;
  paciente_apellido?: string;
  paciente_dni?: string;
  paciente_telefono?: string;
  paciente_email?: string;
  profesional_especialidad?: string;
}

// Tipos para configuración de agenda
export interface ConfiguracionAgenda {
  id: string;
  profesional_id: string;
  dia_semana: number; // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
  hora_inicio: string; // TIME format (HH:mm:ss)
  hora_fin: string; // TIME format (HH:mm:ss)
  duracion_turno_minutos: number;
  activo: boolean;
  vigencia_desde?: string | null; // YYYY-MM-DD
  vigencia_hasta?: string | null; // YYYY-MM-DD, null = vigente
  fecha_creacion?: string;
  fecha_actualizacion?: string;
  // Datos relacionados
  profesional_nombre?: string;
  profesional_apellido?: string;
  profesional_matricula?: string;
  profesional_especialidad?: string;
}

// Tipos para bloques no disponibles
export interface BloqueNoDisponible {
  id: string;
  profesional_id: string;
  fecha_hora_inicio: string; // ISO datetime
  fecha_hora_fin: string; // ISO datetime
  motivo?: string;
  fecha_creacion?: string;
  fecha_actualizacion?: string;
  // Datos relacionados
  profesional_nombre?: string;
  profesional_apellido?: string;
}

// Tipos para notificaciones
export interface Notificacion {
  id: string;
  destinatario_email: string;
  asunto: string;
  contenido: string;
  tipo?: string;
  estado: 'pendiente' | 'enviado' | 'fallido';
  error_mensaje?: string;
  relacionado_tipo?: string;
  relacionado_id?: string;
  fecha_envio?: string;
  fecha_creacion?: string;
  fecha_actualizacion?: string;
}
