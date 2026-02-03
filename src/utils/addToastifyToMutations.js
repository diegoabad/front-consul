/**
 * Script helper para agregar react-toastify a todas las mutaciones
 * 
 * Este archivo documenta el patrón a seguir para actualizar todas las páginas
 */

// PATRÓN A APLICAR EN CADA MUTACIÓN:

// 1. Agregar import al inicio del archivo:
// import { toast as reactToastify } from 'react-toastify';

// 2. En cada onSuccess, agregar ANTES del toast de Shadcn:
// reactToastify.success('Mensaje de éxito', {
//   position: 'top-right',
//   autoClose: 3000,
// });

// 3. En cada onError, agregar ANTES del toast de Shadcn:
// const errorMessage = error.response?.data?.message || 'Mensaje de error por defecto';
// reactToastify.error(errorMessage, {
//   position: 'top-right',
//   autoClose: 3000,
// });

// EJEMPLO COMPLETO:
/*
const createMutation = useMutation({
  mutationFn: (data) => service.create(data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['key'] });
    reactToastify.success('Registro creado correctamente', {
      position: 'top-right',
      autoClose: 3000,
    });
    toast({
      title: 'Éxito',
      description: 'Registro creado correctamente',
    });
    // ... resto del código
  },
  onError: (error: any) => {
    const errorMessage = error.response?.data?.message || 'Error al crear registro';
    reactToastify.error(errorMessage, {
      position: 'top-right',
      autoClose: 3000,
    });
    toast({
      variant: 'destructive',
      title: 'Error',
      description: errorMessage,
    });
  },
});
*/
