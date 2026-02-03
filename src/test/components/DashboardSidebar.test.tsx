import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { DashboardSidebar } from '@/components/layout/DashboardSidebar';
import type { UserRole } from '@/types';

describe('DashboardSidebar', () => {
  const defaultProps = {
    role: 'administrador' as UserRole,
    collapsed: false,
    onToggle: vi.fn(),
  };

  it('debe renderizar el logo y título cuando no está colapsado', () => {
    render(
      <BrowserRouter>
        <DashboardSidebar {...defaultProps} />
      </BrowserRouter>
    );

    expect(screen.getByText('Consultorio')).toBeInTheDocument();
    expect(screen.getByText('Médico')).toBeInTheDocument();
  });

  it('debe mostrar solo el logo cuando está colapsado', () => {
    render(
      <BrowserRouter>
        <DashboardSidebar {...defaultProps} collapsed={true} />
      </BrowserRouter>
    );

    // No debe mostrar el texto completo
    expect(screen.queryByText('Consultorio')).not.toBeInTheDocument();
  });

  it('debe mostrar los items del menú para administrador', () => {
    render(
      <BrowserRouter>
        <DashboardSidebar {...defaultProps} />
      </BrowserRouter>
    );

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Pacientes')).toBeInTheDocument();
    expect(screen.getByText('Usuarios')).toBeInTheDocument();
    expect(screen.getByText('Pagos')).toBeInTheDocument();
  });

  it('debe mostrar los items del menú para profesional', () => {
    render(
      <BrowserRouter>
        <DashboardSidebar {...defaultProps} role="profesional" />
      </BrowserRouter>
    );

    expect(screen.getByText('Mi Agenda')).toBeInTheDocument();
    expect(screen.getByText('Pacientes')).toBeInTheDocument();
  });

  it('debe mostrar los items del menú para secretaria', () => {
    render(
      <BrowserRouter>
        <DashboardSidebar {...defaultProps} role="secretaria" />
      </BrowserRouter>
    );

    expect(screen.getByText('Crear Agendas')).toBeInTheDocument();
    expect(screen.getByText('Pacientes')).toBeInTheDocument();
  });

  it('debe llamar onToggle cuando se hace clic en el botón de colapsar', () => {
    const onToggle = vi.fn();
    render(
      <BrowserRouter>
        <DashboardSidebar {...defaultProps} onToggle={onToggle} />
      </BrowserRouter>
    );

    const toggleButton = screen.getByText('Colapsar');
    toggleButton.click();

    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
