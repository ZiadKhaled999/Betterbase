import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function ApiPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>API Explorer</CardTitle>
        <CardDescription>Inspect generated endpoints and test requests.</CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-zinc-600 dark:text-zinc-400">API explorer ships in Phase 9.3.</CardContent>
    </Card>
  );
}
