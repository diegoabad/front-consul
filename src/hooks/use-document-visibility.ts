import { useState, useEffect } from 'react';

/**
 * `true` cuando la pestaña del documento está visible (`visibilityState === 'visible'`).
 * Útil para pausar polling cuando la pestaña está en segundo plano.
 */
export function useDocumentVisibility(): boolean {
  const [visible, setVisible] = useState(() =>
    typeof document !== 'undefined' ? document.visibilityState === 'visible' : true
  );

  useEffect(() => {
    const onChange = () => setVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);

  return visible;
}
