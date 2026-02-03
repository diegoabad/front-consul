/**
 * TOASTHELPER.TS - Helper para agregar react-toastify a mutaciones existentes
 * 
 * Este helper facilita agregar toasts de react-toastify a las mutaciones
 * sin tener que modificar mucho código.
 */

import { toast as reactToastify } from 'react-toastify';

/**
 * Wrapper para onSuccess que muestra toast de éxito
 */
export const onSuccessToast = (message: string) => {
  return () => {
    reactToastify.success(message, {
      position: 'top-right',
      autoClose: 3000,
    });
  };
};

/**
 * Wrapper para onError que muestra toast de error
 */
export const onErrorToast = (defaultMessage: string = 'Error en la operación') => {
  return (error: any) => {
    const errorMessage = error.response?.data?.message || defaultMessage;
    reactToastify.error(errorMessage, {
      position: 'top-right',
      autoClose: 3000,
    });
  };
};
