import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function AuthManagerPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Authentication Manager</CardTitle>
        <CardDescription>Manage users, sessions, and auth providers.</CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-zinc-600 dark:text-zinc-400">Authentication manager ships in Phase 9.4.</CardContent>
    </Card>
  );
}
