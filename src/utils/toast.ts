/**
 * TOAST.UTILS.TS - Utilidades para mostrar notificaciones
 * 
 * Unifica el uso de react-toastify y Shadcn toast
 */

import { toast as reactToastify } from 'react-toastify';
import { toast as shadcnToast } from '@/hooks/use-toast';

/**
 * Mostrar toast de éxito
 */
export const showSuccess = (message: string, title?: string) => {
  // React Toastify
  reactToastify.success(message, {
    position: 'top-right',
    autoClose: 3000,
  });
  
  // Shadcn Toast (opcional, para mantener consistencia)
  if (title) {
    shadcnToast({
      title,
      description: message,
    });
  }
};

/**
 * Mostrar toast de error
 */
export const showError = (message: string, title: string = 'Error') => {
  // React Toastify
  reactToastify.error(message, {
    position: 'top-right',
    autoClose: 3000,
  });
  
  // Shadcn Toast
  shadcnToast({
    variant: 'destructive',
    title,
    description: message,
  });
};

/**
 * Mostrar toast de información
 */
export const showInfo = (message: string, title?: string) => {
  reactToastify.info(message, {
    position: 'top-right',
    autoClose: 3000,
  });
  
  if (title) {
    shadcnToast({
      title,
      description: message,
    });
  }
};

/**
 * Mostrar toast de advertencia
 */
export const showWarning = (message: string, title?: string) => {
  reactToastify.warning(message, {
    position: 'top-right',
    autoClose: 3000,
  });
  
  if (title) {
    shadcnToast({
      title,
      description: message,
      variant: 'default',
    });
  }
};
