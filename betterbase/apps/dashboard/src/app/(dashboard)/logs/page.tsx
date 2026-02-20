import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function LogsPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Logs Viewer</CardTitle>
        <CardDescription>Track database, auth, and function logs in real-time.</CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-zinc-600 dark:text-zinc-400">Logs viewer ships in Phase 9.5.</CardContent>
    </Card>
  );
}
