'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { betterbase } from '@/lib/betterbase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Shield,
  Users,
  Key,
  Settings,
  CheckCircle,
  XCircle,
  Clock,
  Monitor,
  Trash2,
  RefreshCw,
  Mail,
  Github,
  Chrome,
  AlertCircle,
  Copy,
  Terminal,
} from 'lucide-react';
import { useState } from 'react';

// Types for auth data
interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
  lastSignIn: string | null;
  emailVerified: boolean;
}

interface AuthSession {
  id: string;
  userId: string;
  userEmail: string;
  ipAddress: string | null;
  userAgent: string | null;
  expiresAt: string;
  createdAt: string;
  isActive: boolean;
}

interface AuthConfig {
  configured: boolean;
  providers: {
    email: boolean;
    google: boolean;
    github: boolean;
  };
  features: {
    emailVerification: boolean;
    twoFactor: boolean;
    passwordReset: boolean;
  };
}

// Mock data for demonstration (in production, this would come from the API)
const mockUsers: AuthUser[] = [
  {
    id: '1',
    email: 'admin@example.com',
    name: 'Admin User',
    role: 'admin',
    createdAt: '2024-01-15T10:30:00Z',
    lastSignIn: '2024-02-20T14:22:00Z',
    emailVerified: true,
  },
  {
    id: '2',
    email: 'developer@example.com',
    name: 'Developer',
    role: 'member',
    createdAt: '2024-02-01T09:00:00Z',
    lastSignIn: '2024-02-19T16:45:00Z',
    emailVerified: true,
  },
  {
    id: '3',
    email: 'viewer@example.com',
    name: null,
    role: 'viewer',
    createdAt: '2024-02-10T11:20:00Z',
    lastSignIn: null,
    emailVerified: false,
  },
];

const mockSessions: AuthSession[] = [
  {
    id: 'sess_1',
    userId: '1',
    userEmail: 'admin@example.com',
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    expiresAt: '2024-03-22T14:22:00Z',
    createdAt: '2024-02-20T14:22:00Z',
    isActive: true,
  },
  {
    id: 'sess_2',
    userId: '1',
    userEmail: 'admin@example.com',
    ipAddress: '10.0.0.50',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)',
    expiresAt: '2024-03-21T09:15:00Z',
    createdAt: '2024-02-19T09:15:00Z',
    isActive: true,
  },
  {
    id: 'sess_3',
    userId: '2',
    userEmail: 'developer@example.com',
    ipAddress: '172.16.0.25',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    expiresAt: '2024-03-19T16:45:00Z',
    createdAt: '2024-02-19T16:45:00Z',
    isActive: true,
  },
];

const mockAuthConfig: AuthConfig = {
  configured: true,
  providers: {
    email: true,
    google: false,
    github: true,
  },
  features: {
    emailVerification: true,
    twoFactor: false,
    passwordReset: true,
  },
};

// Setup instructions component
function SetupInstructions() {
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const codeSnippets = {
    install: `bun add betterbase`,
    schema: `// src/db/schema.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text('email').notNull().unique(),
  name: text('name'),
  passwordHash: text('password_hash'),
  role: text('role').default('member').notNull(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
});`,
    authRoute: `// src/routes/auth.ts
import { Hono } from 'hono';
import { authRoute } from '../auth';

const app = new Hono();
app.route('/auth', authRoute);`,
    envVars: `# .env
BETTERBASE_URL=http://localhost:3000
BETTERBASE_SECRET=your-secret-key-here`,
  };

  return (
    <div className="space-y-6">
      <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            <CardTitle className="text-amber-800 dark:text-amber-200">Authentication Not Configured</CardTitle>
          </div>
          <CardDescription className="text-amber-700 dark:text-amber-300">
            Set up authentication to manage users, sessions, and secure your application.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Terminal className="h-5 w-5" />
            Quick Setup Guide
          </CardTitle>
          <CardDescription>Follow these steps to enable authentication in your BetterBase project.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Step 1 */}
          <div className="space-y-2">
            <h4 className="font-medium">1. Install Dependencies</h4>
            <div className="relative">
              <pre className="overflow-x-auto rounded-lg bg-zinc-900 p-4 text-sm text-zinc-100">
                <code>{codeSnippets.install}</code>
              </pre>
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-2 top-2"
                onClick={() => copyToClipboard(codeSnippets.install, 'install')}
              >
                {copied === 'install' ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Step 2 */}
          <div className="space-y-2">
            <h4 className="font-medium">2. Create Auth Schema</h4>
            <div className="relative">
              <pre className="max-h-64 overflow-auto rounded-lg bg-zinc-900 p-4 text-sm text-zinc-100">
                <code>{codeSnippets.schema}</code>
              </pre>
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-2 top-2"
                onClick={() => copyToClipboard(codeSnippets.schema, 'schema')}
              >
                {copied === 'schema' ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Step 3 */}
          <div className="space-y-2">
            <h4 className="font-medium">3. Add Auth Routes</h4>
            <div className="relative">
              <pre className="overflow-x-auto rounded-lg bg-zinc-900 p-4 text-sm text-zinc-100">
                <code>{codeSnippets.authRoute}</code>
              </pre>
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-2 top-2"
                onClick={() => copyToClipboard(codeSnippets.authRoute, 'authRoute')}
              >
                {copied === 'authRoute' ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Step 4 */}
          <div className="space-y-2">
            <h4 className="font-medium">4. Configure Environment Variables</h4>
            <div className="relative">
              <pre className="overflow-x-auto rounded-lg bg-zinc-900 p-4 text-sm text-zinc-100">
                <code>{codeSnippets.envVars}</code>
              </pre>
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-2 top-2"
                onClick={() => copyToClipboard(codeSnippets.envVars, 'envVars')}
              >
                {copied === 'envVars' ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/20">
            <Terminal className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Run <code className="rounded bg-blue-100 px-1 py-0.5 dark:bg-blue-900">bb auth init</code> to automatically
              set up authentication with sensible defaults.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Auth status card
function AuthStatusCard({ config }: { config: AuthConfig }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Auth Status</CardTitle>
        <Shield className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          {config.configured ? (
            <>
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="text-lg font-semibold">Configured</span>
            </>
          ) : (
            <>
              <XCircle className="h-5 w-5 text-red-500" />
              <span className="text-lg font-semibold">Not Configured</span>
            </>
          )}
        </div>
        <p className="text-xs text-zinc-600 dark:text-zinc-400">
          {config.configured ? 'Authentication is active and ready' : 'Set up authentication to secure your app'}
        </p>
      </CardContent>
    </Card>
  );
}

// Stats cards
function StatsCards({ users, sessions }: { users: AuthUser[]; sessions: AuthSession[] }) {
  const activeSessions = sessions.filter((s) => s.isActive).length;
  const verifiedUsers = users.filter((u) => u.emailVerified).length;

  const stats = [
    {
      name: 'Total Users',
      value: users.length.toString(),
      icon: Users,
      description: `${verifiedUsers} verified`,
    },
    {
      name: 'Active Sessions',
      value: activeSessions.toString(),
      icon: Key,
      description: `of ${sessions.length} total`,
    },
    {
      name: 'Admin Users',
      value: users.filter((u) => u.role === 'admin').length.toString(),
      icon: Shield,
      description: 'with full access',
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {stats.map((stat) => (
        <Card key={stat.name}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{stat.name}</CardTitle>
            <stat.icon className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stat.value}</div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">{stat.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Users table
function UsersTable({
  users,
  onRoleChange,
}: {
  users: AuthUser[];
  onRoleChange: (userId: string, newRole: string) => void;
}) {
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Users</CardTitle>
            <CardDescription>Manage user accounts and permissions</CardDescription>
          </div>
          <Button variant="outline" size="sm">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800">
                <th className="px-4 py-3 text-left font-medium">User</th>
                <th className="px-4 py-3 text-left font-medium">Role</th>
                <th className="px-4 py-3 text-left font-medium">Created</th>
                <th className="px-4 py-3 text-left font-medium">Last Sign In</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-zinc-100 dark:border-zinc-800/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-700">
                        <span className="text-xs font-medium">
                          {(user.name || user.email).charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <div className="font-medium">{user.name || 'No name'}</div>
                        <div className="text-xs text-zinc-600 dark:text-zinc-400">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={user.role}
                      onChange={(e) => onRoleChange(user.id, e.target.value)}
                      className="rounded-md border border-zinc-200 bg-transparent px-2 py-1 text-sm dark:border-zinc-700"
                    >
                      <option value="admin">Admin</option>
                      <option value="member">Member</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{formatDate(user.createdAt)}</td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{formatDate(user.lastSignIn)}</td>
                  <td className="px-4 py-3">
                    {user.emailVerified ? (
                      <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        Verified
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                        Pending
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <Settings className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// Sessions table
function SessionsTable({
  sessions,
  onRevoke,
}: {
  sessions: AuthSession[];
  onRevoke: (sessionId: string) => void;
}) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getDeviceIcon = (userAgent: string | null) => {
    if (!userAgent) return <Monitor className="h-4 w-4" />;
    if (userAgent.includes('iPhone') || userAgent.includes('Android')) {
      return <Monitor className="h-4 w-4 text-blue-500" />;
    }
    return <Monitor className="h-4 w-4" />;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Active Sessions</CardTitle>
            <CardDescription>Monitor and manage user sessions</CardDescription>
          </div>
          <Button variant="outline" size="sm">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800">
                <th className="px-4 py-3 text-left font-medium">Device</th>
                <th className="px-4 py-3 text-left font-medium">User</th>
                <th className="px-4 py-3 text-left font-medium">IP Address</th>
                <th className="px-4 py-3 text-left font-medium">Created</th>
                <th className="px-4 py-3 text-left font-medium">Expires</th>
                <th className="px-4 py-3 text-left font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => (
                <tr key={session.id} className="border-b border-zinc-100 dark:border-zinc-800/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {getDeviceIcon(session.userAgent)}
                      <span className="max-w-[200px] truncate text-zinc-600 dark:text-zinc-400">
                        {session.userAgent?.split(')')[0]?.split('(')[1] || 'Unknown device'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium">{session.userEmail}</span>
                  </td>
                  <td className="px-4 py-3">
                    <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-800">
                      {session.ipAddress || 'Unknown'}
                    </code>
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDate(session.createdAt)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{formatDate(session.expiresAt)}</td>
                  <td className="px-4 py-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950"
                      onClick={() => onRevoke(session.id)}
                    >
                      <Trash2 className="mr-1 h-4 w-4" />
                      Revoke
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// Auth providers card
function AuthProvidersCard({ config }: { config: AuthConfig }) {
  const providers = [
    { id: 'email', name: 'Email/Password', icon: Mail, enabled: config.providers.email },
    { id: 'google', name: 'Google OAuth', icon: Chrome, enabled: config.providers.google },
    { id: 'github', name: 'GitHub OAuth', icon: Github, enabled: config.providers.github },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Auth Providers</CardTitle>
        <CardDescription>Configure authentication providers for your application</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {providers.map((provider) => (
            <div
              key={provider.id}
              className="flex items-center justify-between rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
            >
              <div className="flex items-center gap-3">
                <provider.icon className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
                <span className="font-medium">{provider.name}</span>
              </div>
              <button
                type="button"
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  provider.enabled ? 'bg-green-500' : 'bg-zinc-300 dark:bg-zinc-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    provider.enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Auth features card
function AuthFeaturesCard({ config }: { config: AuthConfig }) {
  const features = [
    { id: 'emailVerification', name: 'Email Verification', description: 'Require email verification for new users', enabled: config.features.emailVerification },
    { id: 'twoFactor', name: 'Two-Factor Auth', description: 'Enable 2FA for enhanced security', enabled: config.features.twoFactor },
    { id: 'passwordReset', name: 'Password Reset', description: 'Allow users to reset their password', enabled: config.features.passwordReset },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Auth Features</CardTitle>
        <CardDescription>Toggle authentication features for your application</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {features.map((feature) => (
            <div key={feature.id} className="flex items-center justify-between">
              <div>
                <div className="font-medium">{feature.name}</div>
                <div className="text-xs text-zinc-600 dark:text-zinc-400">{feature.description}</div>
              </div>
              <button
                type="button"
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  feature.enabled ? 'bg-green-500' : 'bg-zinc-300 dark:bg-zinc-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    feature.enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function AuthPage() {
  const queryClient = useQueryClient();

  // Check if auth is configured
  const { data: authStatus, isLoading } = useQuery({
    queryKey: ['auth-status'],
    queryFn: async () => {
      try {
        // In production, this would check the actual auth configuration
        // For now, we'll use mock data
        const result = await betterbase.auth.getUser();
        return {
          configured: !result.error,
          user: result.data,
        };
      } catch {
        return { configured: false, user: null };
      }
    },
    retry: false,
  });

  // Fetch users
  const { data: users = mockUsers } = useQuery({
    queryKey: ['auth-users'],
    queryFn: async () => {
      // In production, this would fetch from the API
      // const result = await betterbase.from('users').select().execute();
      // return result.data || [];
      return mockUsers;
    },
    enabled: authStatus?.configured,
  });

  // Fetch sessions
  const { data: sessions = mockSessions } = useQuery({
    queryKey: ['auth-sessions'],
    queryFn: async () => {
      // In production, this would fetch from the API
      // const result = await betterbase.from('sessions').select().execute();
      // return result.data || [];
      return mockSessions;
    },
    enabled: authStatus?.configured,
  });

  // Role change mutation
  const roleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      // In production, this would update via API
      // await betterbase.from('users').update(userId, { role });
      return { userId, role };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth-users'] });
    },
  });

  // Revoke session mutation
  const revokeSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      // In production, this would delete via API
      // await betterbase.from('sessions').delete(sessionId);
      return sessionId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth-sessions'] });
    },
  });

  const handleRoleChange = (userId: string, newRole: string) => {
    roleMutation.mutate({ userId, role: newRole });
  };

  const handleRevokeSession = (sessionId: string) => {
    if (confirm('Are you sure you want to revoke this session?')) {
      revokeSessionMutation.mutate(sessionId);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  // Show setup instructions if auth is not configured
  if (!authStatus?.configured) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Authentication</h2>
          <p className="text-zinc-600 dark:text-zinc-400">Manage users, sessions, and auth providers.</p>
        </div>
        <SetupInstructions />
      </div>
    );
  }

  // Auth config (in production, this would come from API)
  const authConfig = mockAuthConfig;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Authentication</h2>
        <p className="text-zinc-600 dark:text-zinc-400">Manage users, sessions, and auth providers.</p>
      </div>

      {/* Status and Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AuthStatusCard config={authConfig} />
        <StatsCards users={users} sessions={sessions} />
      </div>

      {/* Users Table */}
      <UsersTable users={users} onRoleChange={handleRoleChange} />

      {/* Sessions Table */}
      <SessionsTable sessions={sessions} onRevoke={handleRevokeSession} />

      {/* Auth Settings */}
      <div className="grid gap-4 lg:grid-cols-2">
        <AuthProvidersCard config={authConfig} />
        <AuthFeaturesCard config={authConfig} />
      </div>
    </div>
  );
}
