import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function ProfesionalPagos() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Mis Pagos</h1>
        <p className="text-muted-foreground">Historial de mis pagos</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Pagos</CardTitle>
          <CardDescription>Aquí se mostrarán tus pagos</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Página en construcción...</p>
        </CardContent>
      </Card>
    </div>
  );
}
