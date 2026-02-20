import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const tables = [
  { name: 'users', rows: '2,547', updated: '2 min ago' },
  { name: 'projects', rows: '128', updated: '1 hour ago' },
  { name: 'api_keys', rows: '64', updated: 'Yesterday' },
];

export function TableBrowser() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Table Browser</CardTitle>
        <CardDescription>Browse your BetterBase tables and recent row counts.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {tables.map((table) => (
          <div key={table.name} className="flex items-center justify-between rounded-md border p-3 text-sm">
            <div>
              <p className="font-medium">{table.name}</p>
              <p className="text-zinc-500">{table.rows} rows</p>
            </div>
            <p className="text-xs text-zinc-500">{table.updated}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
