import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function SecretariaNotificaciones() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Notificaciones</h1>
        <p className="text-muted-foreground">Mis notificaciones</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Notificaciones</CardTitle>
          <CardDescription>Aquí se mostrarán tus notificaciones</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Página en construcción...</p>
        </CardContent>
      </Card>
    </div>
  );
}
