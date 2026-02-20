import { ApiUsageChart } from '@/components/charts/api-usage-chart';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, Code, Database, Users } from 'lucide-react';

export default function DashboardPage() {
  const stats = [
    { name: 'Total Tables', value: '12', icon: Database, change: '+2 this week' },
    { name: 'API Calls', value: '45.2K', icon: Code, change: '+12% from last week' },
    { name: 'Active Users', value: '2,547', icon: Users, change: '+234 this week' },
    { name: 'Uptime', value: '99.9%', icon: Activity, change: '30 days' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-zinc-600 dark:text-zinc-400">Welcome back! Here&apos;s an overview of your project.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.name}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.name}</CardTitle>
              <stat.icon className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">{stat.change}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>API Usage</CardTitle>
            <CardDescription>Requests over the last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <ApiUsageChart />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks and shortcuts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {['Create new table', 'Test API endpoint', 'View logs'].map((action) => (
                <button
                  key={action}
                  className="w-full rounded-lg border border-zinc-200 p-3 text-left text-sm hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                >
                  {action}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
