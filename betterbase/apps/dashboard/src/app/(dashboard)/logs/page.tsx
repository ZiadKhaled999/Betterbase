'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertCircle,
  Bug,
  Calendar,
  ChevronDown,
  Download,
  Info,
  RefreshCw,
  Search,
  X,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Types
type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  message: string;
  source: string;
  metadata?: Record<string, unknown>;
  stackTrace?: string;
}

interface LogFilters {
  level: LogLevel | 'all';
  search: string;
  source: string | 'all';
  dateFrom: string;
  dateTo: string;
}

// Mock log data generator (replace with actual API call)
const generateMockLogs = (): LogEntry[] => {
  const sources = ['api', 'auth', 'database', 'functions', 'realtime', 'storage'];
  const levels: LogLevel[] = ['info', 'warn', 'error', 'debug'];
  
  const messages: Record<LogLevel, string[]> = {
    info: [
      'Request completed successfully',
      'User authenticated',
      'Database query executed',
      'Cache invalidated',
      'Session refreshed',
      'API endpoint called',
      'File uploaded successfully',
    ],
    warn: [
      'Rate limit approaching',
      'Deprecated API endpoint used',
      'Large query detected',
      'Session expiring soon',
      'Memory usage high',
      'Connection pool near capacity',
    ],
    error: [
      'Authentication failed',
      'Database connection lost',
      'Invalid request payload',
      'File upload failed',
      'Timeout exceeded',
      'Permission denied',
    ],
    debug: [
      'Processing request',
      'Parsing request body',
      'Validating credentials',
      'Executing query',
      'Building response',
    ],
  };

  const logs: LogEntry[] = [];
  const now = new Date();

  for (let i = 0; i < 100; i++) {
    const level = levels[Math.floor(Math.random() * levels.length)];
    const source = sources[Math.floor(Math.random() * sources.length)];
    const timestamp = new Date(now.getTime() - Math.random() * 24 * 60 * 60 * 1000);
    
    const metadata: Record<string, unknown> = {};
    if (Math.random() > 0.7) {
      metadata.requestId = `req_${Math.random().toString(36).substring(7)}`;
      metadata.duration = Math.floor(Math.random() * 1000);
    }
    if (Math.random() > 0.8) {
      metadata.userId = `user_${Math.floor(Math.random() * 1000)}`;
    }
    if (Math.random() > 0.9) {
      metadata.ip = `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
    }

    const entry: LogEntry = {
      id: `log_${i}_${Date.now()}`,
      timestamp: timestamp.toISOString(),
      level,
      message: messages[level][Math.floor(Math.random() * messages[level].length)],
      source,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    };

    if (level === 'error' && Math.random() > 0.5) {
      entry.stackTrace = `Error: ${entry.message}\n    at Function.call (index.js:42)\n    at Module._compile (internal/modules/cjs/loader.js:1136)\n    at Object.<anonymous> (/app/src/index.ts:15)`;
    }

    logs.push(entry);
  }

  return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
};

// Fetch logs function (simulated)
const fetchLogs = async (): Promise<LogEntry[]> => {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 500));
  return generateMockLogs();
};

// Log level colors
const levelColors: Record<LogLevel, string> = {
  info: 'text-blue-500 bg-blue-50 dark:bg-blue-950',
  warn: 'text-yellow-500 bg-yellow-50 dark:bg-yellow-950',
  error: 'text-red-500 bg-red-50 dark:bg-red-950',
  debug: 'text-gray-500 bg-gray-50 dark:bg-gray-950',
};

const levelIcons: Record<LogLevel, typeof Info> = {
  info: Info,
  warn: AlertCircle,
  error: XCircle,
  debug: Bug,
};

export default function LogsPage() {
  // Filter state
  const [filters, setFilters] = useState<LogFilters>({
    level: 'all',
    search: '',
    source: 'all',
    dateFrom: '',
    dateTo: '',
  });

  // Selected log for detail view
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);

  // Modal ref for focus management
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Handle escape key and focus management for modal
  useEffect(() => {
    if (selectedLog) {
      // Store the currently focused element
      previousActiveElement.current = document.activeElement as HTMLElement;
      // Focus the modal panel
      modalRef.current?.focus();
    }
  }, [selectedLog]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedLog) {
        setSelectedLog(null);
      }
    };

    if (selectedLog) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedLog]);

  // Restore focus when modal closes
  useEffect(() => {
    if (!selectedLog && previousActiveElement.current) {
      previousActiveElement.current.focus();
      previousActiveElement.current = null;
    }
  }, [selectedLog]);

  // Auto-refresh state
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(30);

  // Fetch logs using React Query
  const { data: logs = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['logs'],
    queryFn: fetchLogs,
    refetchInterval: autoRefresh ? refreshInterval * 1000 : false,
  });

  // Filtered logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Level filter
      if (filters.level !== 'all' && log.level !== filters.level) {
        return false;
      }

      // Source filter
      if (filters.source !== 'all' && log.source !== filters.source) {
        return false;
      }

      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesMessage = log.message.toLowerCase().includes(searchLower);
        const matchesSource = log.source.toLowerCase().includes(searchLower);
        if (!matchesMessage && !matchesSource) {
          return false;
        }
      }

      // Date range filter
      if (filters.dateFrom) {
        const logDate = new Date(log.timestamp);
        const fromDate = new Date(filters.dateFrom);
        fromDate.setUTCHours(0, 0, 0, 0);
        if (logDate < fromDate) {
          return false;
        }
      }

      if (filters.dateTo) {
        const logDate = new Date(log.timestamp);
        const toDate = new Date(filters.dateTo);
        toDate.setUTCHours(23, 59, 59, 999);
        if (logDate > toDate) {
          return false;
        }
      }

      return true;
    });
  }, [logs, filters]);

  // Get unique sources from logs
  const sources = useMemo(() => {
    const uniqueSources = new Set(logs.map((log) => log.source));
    return Array.from(uniqueSources).sort();
  }, [logs]);

  // Export functions
  const exportToJson = useCallback(() => {
    const dataStr = JSON.stringify(filteredLogs, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `logs_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [filteredLogs]);

  const exportToCsv = useCallback(() => {
    const headers = ['Timestamp', 'Level', 'Source', 'Message'];
    const rows = filteredLogs.map((log) => [
      log.timestamp,
      log.level,
      log.source,
      `"${log.message.replace(/"/g, '""')}"`,
    ]);
    
    const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `logs_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [filteredLogs]);

  // Clear filters
  const clearFilters = useCallback(() => {
    setFilters({
      level: 'all',
      search: '',
      source: 'all',
      dateFrom: '',
      dateTo: '',
    });
  }, []);

  // Format timestamp
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  // Check if any filters are active
  const hasActiveFilters = filters.level !== 'all' || filters.search || filters.source !== 'all' || filters.dateFrom || filters.dateTo;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Logs</h2>
        <p className="text-zinc-600 dark:text-zinc-400">
          Track and analyze application logs in real-time.
        </p>
      </div>

      {/* Filters Card */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Filters</CardTitle>
            <div className="flex items-center gap-2">
              {/* Auto-refresh toggle */}
              <Button
                variant={autoRefresh ? 'default' : 'outline'}
                size="sm"
                onClick={() => setAutoRefresh(!autoRefresh)}
              >
                <RefreshCw className={cn('h-4 w-4', autoRefresh && 'animate-spin')} />
                <span className="ml-2">Auto-refresh</span>
              </Button>
              
              {autoRefresh && (
                <select
                  value={refreshInterval}
                  onChange={(e) => setRefreshInterval(Number(e.target.value))}
                  className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                >
                  <option value={10}>10s</option>
                  <option value={30}>30s</option>
                  <option value={60}>60s</option>
                </select>
              )}

              {/* Export dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4" />
                    <span className="ml-2">Export</span>
                    <ChevronDown className="ml-1 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={exportToJson}>
                    Export as JSON
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportToCsv}>
                    Export as CSV
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Search logs..."
                value={filters.search}
                onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {filters.search && (
                <button
                  onClick={() => setFilters((prev) => ({ ...prev, search: '' }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Level filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-[140px]">
                  {filters.level === 'all' ? 'All Levels' : filters.level.toUpperCase()}
                  <ChevronDown className="ml-auto h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => setFilters((prev) => ({ ...prev, level: 'all' }))}>
                  All Levels
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setFilters((prev) => ({ ...prev, level: 'info' }))}>
                  <span className="mr-2">●</span> Info
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilters((prev) => ({ ...prev, level: 'warn' }))}>
                  <span className="mr-2 text-yellow-500">●</span> Warn
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilters((prev) => ({ ...prev, level: 'error' }))}>
                  <span className="mr-2 text-red-500">●</span> Error
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilters((prev) => ({ ...prev, level: 'debug' }))}>
                  <span className="mr-2 text-gray-500">●</span> Debug
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Source filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-[140px]">
                  {filters.source === 'all' ? 'All Sources' : filters.source}
                  <ChevronDown className="ml-auto h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => setFilters((prev) => ({ ...prev, source: 'all' }))}>
                  All Sources
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {sources.map((source) => (
                  <DropdownMenuItem
                    key={source}
                    onClick={() => setFilters((prev) => ({ ...prev, source }))}
                  >
                    {source}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Date from */}
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-zinc-400" />
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters((prev) => ({ ...prev, dateFrom: e.target.value }))}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Date to */}
            <div className="flex items-center gap-2">
              <span className="text-zinc-400">to</span>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters((prev) => ({ ...prev, dateTo: e.target.value }))}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Clear filters */}
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Logs List */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              Log Entries
              <span className="ml-2 text-sm font-normal text-zinc-500">
                ({filteredLogs.length} {filteredLogs.length === 1 ? 'entry' : 'entries'}
                {hasActiveFilters && ` of ${logs.length} total`})
              </span>
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading || isRefetching}
            >
              <RefreshCw className={cn('h-4 w-4', isRefetching && 'animate-spin')} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-zinc-400" />
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
              <Info className="h-12 w-12 mb-4" />
              <p>No logs found</p>
              {hasActiveFilters && (
                <Button variant="ghost" onClick={clearFilters} className="mt-2 h-auto p-0 text-primary underline">
                  Clear filters
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {filteredLogs.map((log) => {
                const LevelIcon = levelIcons[log.level];
                return (
                  <div
                    key={log.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedLog(log)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedLog(log);
                      }
                    }}
                    aria-label={`View details for log: ${log.message}`}
                    className={cn(
                      'flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-ring',
                      levelColors[log.level]
                    )}
                  >
                    <LevelIcon className="h-5 w-5 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-zinc-500">
                          {formatTimestamp(log.timestamp)}
                        </span>
                        <span className="text-xs uppercase font-medium px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800">
                          {log.source}
                        </span>
                      </div>
                      <p className="mt-1 text-sm">{log.message}</p>
                      {log.metadata && (
                        <p className="mt-1 text-xs text-zinc-500">
                          +{Object.keys(log.metadata).length} metadata fields
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Log Detail Modal/Drawer */}
      {selectedLog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setSelectedLog(null)}
          role="presentation"
        >
          <div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="logDetailsTitle"
            className="w-full max-w-2xl max-h-[80vh] overflow-hidden rounded-xl bg-background shadow-xl"
            onClick={(e) => e.stopPropagation()}
            tabIndex={-1}
          >
            <div className="flex items-center justify-between border-b p-4">
              <div className="flex items-center gap-3">
                {(() => {
                  const LevelIcon = levelIcons[selectedLog.level];
                  return <LevelIcon className={cn('h-5 w-5', levelColors[selectedLog.level].split(' ')[0])} />;
                })()}
                <h3 id="logDetailsTitle" className="text-lg font-semibold">Log Details</h3>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSelectedLog(null)} aria-label="Close log details">
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="overflow-y-auto p-4 space-y-4 max-h-[calc(80vh-80px)]">
              {/* Basic info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-zinc-500 uppercase">Timestamp</label>
                  <p className="text-sm font-mono">{selectedLog.timestamp}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-500 uppercase">Level</label>
                  <p className="text-sm uppercase font-medium">{selectedLog.level}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-500 uppercase">Source</label>
                  <p className="text-sm">{selectedLog.source}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-500 uppercase">Log ID</label>
                  <p className="text-sm font-mono text-xs">{selectedLog.id}</p>
                </div>
              </div>

              {/* Message */}
              <div>
                <label className="text-xs font-medium text-zinc-500 uppercase">Message</label>
                <p className="mt-1 text-sm">{selectedLog.message}</p>
              </div>

              {/* Metadata */}
              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                <div>
                  <label className="text-xs font-medium text-zinc-500 uppercase">Metadata</label>
                  <pre className="mt-1 overflow-x-auto rounded-lg bg-zinc-100 dark:bg-zinc-900 p-3 text-xs">
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              )}

              {/* Stack trace */}
              {selectedLog.stackTrace && (
                <div>
                  <label className="text-xs font-medium text-red-500 uppercase">Stack Trace</label>
                  <pre className="mt-1 overflow-x-auto rounded-lg bg-red-50 dark:bg-red-950 p-3 text-xs font-mono text-red-700 dark:text-red-300">
                    {selectedLog.stackTrace}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
