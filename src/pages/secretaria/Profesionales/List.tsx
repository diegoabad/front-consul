import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function SecretariaProfesionales() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Profesionales</h1>
        <p className="text-muted-foreground">Lista de profesionales</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Profesionales</CardTitle>
          <CardDescription>Aquí se mostrarán los profesionales</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Página en construcción...</p>
        </CardContent>
      </Card>
    </div>
  );
}
