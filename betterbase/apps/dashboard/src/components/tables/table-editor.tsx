import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function TableEditor({ tableName }: { tableName: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{tableName} editor</CardTitle>
        <CardDescription>Inline editing is part of the next phase. This is the data preview scaffold.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border border-dashed p-6 text-sm text-zinc-500">
          Row editing UI will appear here in Phase 9.2.
        </div>
      </CardContent>
    </Card>
  );
}
