'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, Code, Database, Settings, Table as TableIcon, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

export const navigation = [
  { name: 'Tables', href: '/tables', icon: TableIcon },
  { name: 'API', href: '/api', icon: Code },
  { name: 'Auth', href: '/auth', icon: Users },
  { name: 'Logs', href: '/logs', icon: Activity },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();

  return (
    <div
      className={cn(
        'flex h-full w-64 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900',
        mobile ? 'w-full border-r-0' : 'hidden md:flex'
      )}
    >
      <div className="flex h-16 items-center border-b border-zinc-200 px-6 dark:border-zinc-800">
        <Database className="mr-2 h-6 w-6 text-blue-600" />
        <span className="text-lg font-semibold">BetterBase</span>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400'
                  : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
              )}
            >
              <item.icon className="mr-3 h-5 w-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-zinc-200 p-4 dark:border-zinc-800">
        <div className="text-xs text-zinc-500">
          v0.1.0 •{' '}
          <Link href="/docs" className="hover:underline">
            Docs
          </Link>
        </div>
      </div>
    </div>
  );
}
