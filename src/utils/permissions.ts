import type { User, UserRole } from '@/types';

// Permisos por rol (debe coincidir con el backend)
const PERMISOS_POR_ROL: Record<UserRole, string[]> = {
  administrador: [
    // Todos los permisos
    'usuarios.crear',
    'usuarios.leer',
    'usuarios.actualizar',
    'usuarios.eliminar',
    'pacientes.crear',
    'pacientes.leer',
    'pacientes.actualizar',
    'pacientes.eliminar',
    'profesionales.crear',
    'profesionales.leer',
    'profesionales.actualizar',
    'profesionales.eliminar',
    'pagos.crear',
    'pagos.leer',
    'pagos.actualizar',
    'pagos.marcar_pagado',
    'agenda.crear',
    'agenda.leer',
    'agenda.actualizar',
    'agenda.eliminar',
    'notificaciones.crear',
    'notificaciones.leer',
    'notificaciones.enviar',
    // ... todos los demás
  ],
  profesional: [
    'pacientes.crear',
    'pacientes.leer',
    'pacientes.actualizar',
    'pacientes.buscar',
    'turnos.crear',
    'turnos.leer',
    'turnos.actualizar',
    'agenda.leer',
    'agenda.crear',
    'agenda.actualizar',
    'agenda.bloques.crear',
    'agenda.bloques.eliminar',
    'evoluciones.crear',
    'evoluciones.leer',
    'evoluciones.actualizar',
    'archivos.subir',
    'archivos.leer',
    'archivos.descargar',
    'archivos.eliminar',
    'notas.crear',
    'notas.leer',
    'notas.actualizar',
    'notas.eliminar',
    'pagos.leer',
  ],
  secretaria: [
    'usuarios.crear',
    'usuarios.leer',
    'usuarios.actualizar',
    'usuarios.eliminar',
    'pacientes.crear',
    'pacientes.leer',
    'pacientes.actualizar',
    'pacientes.buscar',
    'profesionales.crear',
    'profesionales.leer',
    'profesionales.actualizar',
    'profesionales.eliminar',
    'turnos.crear',
    'turnos.leer',
    'turnos.actualizar',
    'turnos.cancelar',
    'turnos.confirmar',
    'turnos.eliminar',
    'agenda.crear',
    'agenda.leer',
    'agenda.actualizar',
    'agenda.eliminar',
    'agenda.excepciones.crear',
    'agenda.excepciones.actualizar',
    'agenda.excepciones.eliminar',
    'archivos.subir',
    'archivos.leer',
    'archivos.descargar',
    'archivos.eliminar',
    'notas.crear',
    'notas.leer',
    'notas.actualizar',
    'pagos.crear',
    'pagos.leer',
    'pagos.actualizar',
    'pagos.marcar_pagado',
  ],
};

export function hasPermission(user: User | null, permission: string): boolean {
  if (!user) return false;
  if (user.rol === 'administrador') return true; // Admin tiene todos los permisos
  
  const permisosRol = PERMISOS_POR_ROL[user.rol] || [];
  return permisosRol.includes(permission);
}

export function canAccess(user: User | null, permission: string): boolean {
  return hasPermission(user, permission);
}
