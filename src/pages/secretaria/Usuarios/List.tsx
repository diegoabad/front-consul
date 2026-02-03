import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function SecretariaUsuarios() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Usuarios</h1>
        <p className="text-muted-foreground">Lista de usuarios</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Usuarios</CardTitle>
          <CardDescription>Aquí se mostrarán los usuarios</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Página en construcción...</p>
        </CardContent>
      </Card>
    </div>
  );
}
