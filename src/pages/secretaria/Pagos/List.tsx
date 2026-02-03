import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function SecretariaPagos() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Pagos</h1>
        <p className="text-muted-foreground">Visualización de pagos</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Pagos</CardTitle>
          <CardDescription>Aquí se mostrarán los pagos</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Página en construcción...</p>
        </CardContent>
      </Card>
    </div>
  );
}
