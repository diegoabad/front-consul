# Tests del Frontend

Este directorio contiene todos los tests del frontend usando Vitest y React Testing Library.

## Estructura

```
test/
├── setup.ts                    # Configuración global de tests
├── mocks/                      # Mocks y handlers para MSW
│   ├── handlers.ts             # Handlers de MSW para mockear API
│   └── server.ts              # Servidor MSW para tests
├── services/                   # Tests de servicios
│   └── auth.service.test.ts   # Tests del servicio de autenticación
├── contexts/                   # Tests de contextos
│   └── AuthContext.test.tsx   # Tests del contexto de autenticación
├── pages/                      # Tests de páginas
│   └── Login.test.tsx         # Tests de la página de login
└── integration/                # Tests de integración con backend real
    └── auth.integration.test.ts # Tests de integración de autenticación
```

## Ejecutar Tests

### Todos los tests
```bash
npm run test
```

### Tests en modo watch
```bash
npm run test
# Presiona 'a' para ejecutar todos los tests
```

### Tests con UI
```bash
npm run test:ui
```

### Tests una sola vez (CI)
```bash
npm run test:run
```

### Tests con coverage
```bash
npm run test:coverage
```

### Tests de integración (requiere backend corriendo)
```bash
# En una terminal, iniciar el backend:
cd ../api && npm start

# En otra terminal, ejecutar tests de integración:
npm run test -- integration
```

## Tests de Integración

Los tests de integración (`integration/`) verifican la conexión real con el backend. 

**IMPORTANTE**: Estos tests requieren que el backend esté corriendo en `http://localhost:5000`.

Para ejecutar solo los tests de integración:
```bash
npm run test -- auth.integration.test.ts
```

## Escribir Nuevos Tests

### Test de Componente
```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MyComponent from '@/components/MyComponent';

describe('MyComponent', () => {
  it('debería renderizar correctamente', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

### Test de Servicio
```typescript
import { describe, it, expect, vi } from 'vitest';
import { myService } from '@/services/my.service';
import api from '@/services/api';

vi.mock('@/services/api');

describe('myService', () => {
  it('debería hacer una petición correcta', async () => {
    (api.get as any).mockResolvedValue({ data: { success: true, data: {} } });
    const result = await myService.getData();
    expect(result).toBeDefined();
  });
});
```

## Mocking

### Mock de API
Usamos MSW (Mock Service Worker) para mockear las peticiones HTTP en los tests.

### Mock de Hooks
```typescript
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: '1', email: 'test@example.com' },
    isAuthenticated: true,
  }),
}));
```

## Coverage

Para ver el coverage de los tests:
```bash
npm run test:coverage
```

El reporte se generará en `coverage/`.
