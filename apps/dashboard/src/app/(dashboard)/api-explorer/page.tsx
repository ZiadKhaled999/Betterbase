'use client';

import { useState, useEffect, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Code,
  Play,
  Copy,
  Check,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Trash2,
  History,
  Terminal,
  FileCode,
} from 'lucide-react';

// Types
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface ApiRequest {
  method: HttpMethod;
  path: string;
  body: string;
  queryParams: { key: string; value: string }[];
}

interface ApiResponse {
  status: number;
  statusText: string;
  data: unknown;
  time: number;
  headers: Record<string, string>;
}

interface HistoryItem extends ApiRequest {
  id: string;
  timestamp: number;
  response?: {
    status: number;
    statusText: string;
    data: unknown;
    time: number;
  };
}

// Available endpoints for the browser
const ENDPOINT_CATEGORIES = [
  {
    name: 'Tables',
    icon: 'Database',
    endpoints: [
      { method: 'GET' as HttpMethod, path: '/rest/v1/users', description: 'List all users' },
      { method: 'GET' as HttpMethod, path: '/rest/v1/posts', description: 'List all posts' },
      { method: 'POST' as HttpMethod, path: '/rest/v1/users', description: 'Create a user' },
      { method: 'POST' as HttpMethod, path: '/rest/v1/posts', description: 'Create a post' },
    ],
  },
  {
    name: 'Auth',
    icon: 'Lock',
    endpoints: [
      { method: 'POST' as HttpMethod, path: '/auth/v1/signup', description: 'Sign up a new user' },
      { method: 'POST' as HttpMethod, path: '/auth/v1/login', description: 'Login a user' },
      { method: 'GET' as HttpMethod, path: '/auth/v1/user', description: 'Get current user' },
      { method: 'POST' as HttpMethod, path: '/auth/v1/logout', description: 'Logout current user' },
    ],
  },
  {
    name: 'Functions',
    icon: 'Code',
    endpoints: [
      { method: 'POST' as HttpMethod, path: '/functions/v1/hello', description: 'Hello world function' },
      { method: 'POST' as HttpMethod, path: '/functions/v1/send-email', description: 'Send email function' },
    ],
  },
  {
    name: 'Storage',
    icon: 'Folder',
    endpoints: [
      { method: 'GET' as HttpMethod, path: '/storage/v1/buckets', description: 'List buckets' },
      { method: 'POST' as HttpMethod, path: '/storage/v1/buckets', description: 'Create a bucket' },
    ],
  },
];

const HTTP_METHOD_COLORS: Record<HttpMethod, string> = {
  GET: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  POST: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  PUT: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  PATCH: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  DELETE: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

const HISTORY_KEY = 'betterbase-api-explorer-history';
const MAX_HISTORY_ITEMS = 20;

export default function ApiExplorerPage() {
  // Request state
  const [method, setMethod] = useState<HttpMethod>('GET');
  const [path, setPath] = useState('/rest/v1/users');
  const [body, setBody] = useState('{\n  \n}');
  const [queryParams, setQueryParams] = useState<{ key: string; value: string }[]>([]);
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [copied, setCopied] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['Tables']);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [activeTab, setActiveTab] = useState<'response' | 'curl' | 'js' | 'ts'>('response');

  // Load history from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(HISTORY_KEY);
      if (stored) {
        setHistory(JSON.parse(stored) as HistoryItem[]);
      }
    } catch {
      // Ignore parsing errors
    }
  }, []);

  // Save history to localStorage
  const saveHistory = useCallback((newHistory: HistoryItem[]) => {
    setHistory(newHistory);
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
    } catch {
      // Ignore storage errors
    }
  }, []);

  // API call mutation
  const { mutate: executeRequest, isPending } = useMutation({
    mutationFn: async () => {
      const startTime = performance.now();
      const baseUrl = process.env.NEXT_PUBLIC_BETTERBASE_URL || 'http://localhost:3000';

      // Build URL with query params
      const url = new URL(`${baseUrl}${path}`);
      queryParams.forEach(({ key, value }) => {
        if (key.trim()) {
          url.searchParams.append(key, value);
        }
      });

      // Parse body for non-GET requests
      let bodyData: string | undefined;
      if (method !== 'GET' && body.trim()) {
        bodyData = body;
      }

      // Get token from localStorage
      const token = typeof window !== 'undefined' ? localStorage.getItem('betterbase_token') : null;

      const response = await fetch(url.toString(), {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: bodyData,
      });

      const endTime = performance.now();
      const responseData = await response.json().catch(() => null);

      // Extract headers
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });

      return {
        status: response.status,
        statusText: response.statusText,
        data: responseData,
        time: Math.round(endTime - startTime),
        headers,
      };
    },
    onSuccess: (data) => {
      setResponse(data);
      setError(null);

      // Add to history using functional updater to avoid stale closure
      const historyItem: HistoryItem = {
        id: crypto.randomUUID(),
        method,
        path,
        body,
        queryParams,
        timestamp: Date.now(),
        response: {
          status: data.status,
          statusText: data.statusText,
          data: data.data,
          time: data.time,
        },
      };

      // Use functional updater to get latest history state
      setHistory((currentHistory) => {
        const newHistory = [historyItem, ...currentHistory].slice(0, MAX_HISTORY_ITEMS);
        saveHistory(newHistory);
        return newHistory;
      });
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Request failed');
      setResponse(null);
    },
  });

  // Add query parameter
  const addQueryParam = () => {
    setQueryParams([...queryParams, { key: '', value: '' }]);
  };

  // Update query parameter
  const updateQueryParam = (index: number, field: 'key' | 'value', value: string) => {
    const updated = [...queryParams];
    updated[index][field] = value;
    setQueryParams(updated);
  };

  // Remove query parameter
  const removeQueryParam = (index: number) => {
    setQueryParams(queryParams.filter((_, i) => i !== index));
  };

  // Toggle category expansion
  const toggleCategory = (name: string) => {
    setExpandedCategories((prev) =>
      prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name]
    );
  };

  // Select endpoint from browser
  const selectEndpoint = (endpointMethod: HttpMethod, endpointPath: string) => {
    setMethod(endpointMethod);
    setPath(endpointPath);
    setBody(endpointMethod === 'GET' ? '{\n  \n}' : '{\n  "data": {}\n}');
    setQueryParams([]);
    setResponse(null);
    setError(null);
  };

  // Load from history
  const loadFromHistory = (item: HistoryItem) => {
    setMethod(item.method);
    setPath(item.path);
    setBody(item.body);
    setQueryParams(item.queryParams);
    if (item.response) {
      setResponse({
        status: item.response.status,
        statusText: item.response.statusText,
        data: item.response.data,
        time: item.response.time,
        headers: {},
      });
    }
    setError(null);
    setShowHistory(false);
  };

  // Clear history
  const clearHistory = () => {
    saveHistory([]);
  };

  // Copy to clipboard
  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Generate code snippets
  const generateCurl = () => {
    const baseUrl = process.env.NEXT_PUBLIC_BETTERBASE_URL || 'http://localhost:3000';
    const queryString = queryParams
      .filter((p) => p.key.trim())
      .map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`)
      .join('&');
    const fullUrl = `${baseUrl}${path}${queryString ? `?${queryString}` : ''}`;

    let curl = `curl -X ${method} "${fullUrl}" \\
  -H "Content-Type: application/json"`;

    if (method !== 'GET' && body.trim()) {
      const escapedBody = body.replace(/'/g, "'\\''");
      curl += ` \\
  -d '${escapedBody}'`;
    }

    return curl;
  };

  const generateJs = () => {
    const baseUrl = process.env.NEXT_PUBLIC_BETTERBASE_URL || 'http://localhost:3000';
    const queryString = queryParams
      .filter((p) => p.key.trim())
      .map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`)
      .join('&');
    const fullUrl = `${baseUrl}${path}${queryString ? `?${queryString}` : ''}`;

    return `const response = await fetch("${fullUrl}", {
  method: "${method}",
  headers: {
    "Content-Type": "application/json",
  },${method !== 'GET' && body.trim() ? `\n  body: JSON.stringify(${body}),` : ''}
});

const data = await response.json();
console.log(data);`;
  };

  const generateTs = () => {
    const baseUrl = process.env.NEXT_PUBLIC_BETTERBASE_URL || 'http://localhost:3000';
    const queryString = queryParams
      .filter((p) => p.key.trim())
      .map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`)
      .join('&');
    const fullUrl = `${baseUrl}${path}${queryString ? `?${queryString}` : ''}`;

    const tableName = path.replace('/rest/v1/', '');

    // Generate appropriate QueryBuilder method based on HTTP verb
    let queryMethod: string;
    switch (method) {
      case 'GET':
        queryMethod = `.from("${tableName}").select().execute()`;
        break;
      case 'POST':
        queryMethod = `.from("${tableName}").insert(${body})`;
        break;
      case 'PUT':
      case 'PATCH':
        queryMethod = `.from("${tableName}").update("id", ${body})`;
        break;
      case 'DELETE':
        queryMethod = `.from("${tableName}").delete("id")`;
        break;
      default:
        queryMethod = '';
    }

    return `import { createClient } from '@betterbase/client';

const client = createClient({
  url: "${baseUrl}",
});

// Using the client
${path.startsWith('/rest/v1/')
  ? `const { data, error } = await client
  .from("${tableName}")
  ${queryMethod};

if (error) {
  console.error('Error:', error);
} else {
  console.log('Data:', data);
}`
  : `// Direct fetch for ${path}
const response = await fetch("${fullUrl}", {
  method: "${method}",
  headers: {
    "Content-Type": "application/json",
  },${method !== 'GET' && body.trim() ? `\n  body: JSON.stringify(${body}),` : ''}
});

const data = await response.json();`}`;
  };

  const getCodeSnippet = () => {
    switch (activeTab) {
      case 'curl':
        return generateCurl();
      case 'js':
        return generateJs();
      case 'ts':
        return generateTs();
      default:
        return '';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">API Explorer</h2>
          <p className="text-zinc-600 dark:text-zinc-400">
            Explore and test your BetterBase API endpoints.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => setShowHistory(!showHistory)}
          className="gap-2"
        >
          <History className="h-4 w-4" />
          History ({history.length})
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Endpoint Browser */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Endpoints</CardTitle>
            <CardDescription>Browse available API endpoints</CardDescription>
          </CardHeader>
          <CardContent className="max-h-[600px] overflow-y-auto">
            <div className="space-y-2">
              {ENDPOINT_CATEGORIES.map((category) => (
                <div key={category.name}>
                  <button
                    type="button"
                    onClick={() => toggleCategory(category.name)}
                    className="flex w-full items-center justify-between rounded-lg p-2 text-left text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    <span>{category.name}</span>
                    {expandedCategories.includes(category.name) ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </button>
                  {expandedCategories.includes(category.name) && (
                    <div className="ml-2 mt-1 space-y-1">
                      {category.endpoints.map((endpoint) => (
                        <button
                          type="button"
                          key={`${endpoint.method}-${endpoint.path}`}
                          onClick={() => selectEndpoint(endpoint.method, endpoint.path)}
                          className="flex w-full items-center gap-2 rounded-lg p-2 text-left text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        >
                          <span
                            className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold ${HTTP_METHOD_COLORS[endpoint.method]}`}
                          >
                            {endpoint.method}
                          </span>
                          <span className="flex-1 truncate">{endpoint.path}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Request Builder & Response */}
        <div className="space-y-6 lg:col-span-3">
          {/* Request Builder */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Request Builder</CardTitle>
              <CardDescription>Build and execute API requests</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Method and Path */}
              <div className="flex gap-2">
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value as HttpMethod)}
                  className="rounded-lg border border-zinc-200 bg-background px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary dark:border-zinc-800"
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="DELETE">DELETE</option>
                </select>
                <input
                  type="text"
                  value={path}
                  onChange={(e) => setPath(e.target.value)}
                  placeholder="/rest/v1/users"
                  className="flex-1 rounded-lg border border-zinc-200 bg-background px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary dark:border-zinc-800"
                />
                <Button
                  onClick={() => executeRequest()}
                  disabled={isPending}
                  className="gap-2"
                >
                  <Play className="h-4 w-4" />
                  {isPending ? 'Sending...' : 'Send'}
                </Button>
              </div>

              {/* Query Parameters */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Query Parameters</label>
                  <Button variant="ghost" size="sm" onClick={addQueryParam} className="h-7 text-xs">
                    + Add Parameter
                  </Button>
                </div>
                {queryParams.length > 0 && (
                  <div className="space-y-2">
                    {queryParams.map((param, index) => (
                      <div key={index} className="flex gap-2">
                        <input
                          type="text"
                          value={param.key}
                          onChange={(e) => updateQueryParam(index, 'key', e.target.value)}
                          placeholder="Key"
                          className="flex-1 rounded-lg border border-zinc-200 bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary dark:border-zinc-800"
                        />
                        <input
                          type="text"
                          value={param.value}
                          onChange={(e) => updateQueryParam(index, 'value', e.target.value)}
                          placeholder="Value"
                          className="flex-1 rounded-lg border border-zinc-200 bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary dark:border-zinc-800"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeQueryParam(index)}
                          className="h-8 w-8 text-zinc-500 hover:text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Request Body */}
              {method !== 'GET' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Request Body (JSON)</label>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={6}
                    className="w-full rounded-lg border border-zinc-200 bg-background p-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary dark:border-zinc-800"
                    placeholder='{"key": "value"}'
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Response Viewer */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Response</CardTitle>
                  <CardDescription>API response details</CardDescription>
                </div>
                {response && (
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-4 w-4 text-zinc-500" />
                      <span>{response.time}ms</span>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        response.status >= 200 && response.status < 300
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                          : response.status >= 400
                          ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                          : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                      }`}
                    >
                      {response.status} {response.statusText}
                    </span>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {/* Tabs */}
              <div className="mb-4 flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
                {[
                  { id: 'response', label: 'Response', icon: Code },
                  { id: 'curl', label: 'cURL', icon: Terminal },
                  { id: 'js', label: 'JavaScript', icon: FileCode },
                  { id: 'ts', label: 'TypeScript', icon: FileCode },
                ].map((tab) => (
                  <button
                    type="button"
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as typeof activeTab)}
                    className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                      activeTab === tab.id
                        ? 'border-primary text-primary'
                        : 'border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700 dark:hover:text-zinc-300'
                    }`}
                  >
                    <tab.icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Content */}
              <div className="relative">
                {activeTab === 'response' ? (
                  <>
                    {error && (
                      <div className="flex items-center gap-2 rounded-lg bg-red-50 p-4 text-red-800 dark:bg-red-900/20 dark:text-red-400">
                        <AlertCircle className="h-5 w-5" />
                        <span>{error}</span>
                      </div>
                    )}
                    {response ? (
                      <div className="relative">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(JSON.stringify(response.data, null, 2))}
                          className="absolute right-2 top-2 gap-1"
                        >
                          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          {copied ? 'Copied!' : 'Copy'}
                        </Button>
                        <pre className="max-h-[400px] overflow-auto rounded-lg bg-zinc-100 p-4 font-mono text-sm dark:bg-zinc-900">
                          {JSON.stringify(response.data, null, 2)}
                        </pre>
                      </div>
                    ) : (
                      <div className="flex h-[200px] items-center justify-center text-zinc-500">
                        <p>Send a request to see the response</p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="relative">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(getCodeSnippet())}
                      className="absolute right-2 top-2 gap-1"
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      {copied ? 'Copied!' : 'Copy'}
                    </Button>
                    <pre className="max-h-[400px] overflow-auto rounded-lg bg-zinc-100 p-4 font-mono text-sm dark:bg-zinc-900">
                      {getCodeSnippet()}
                    </pre>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* History Panel */}
      {showHistory && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Request History</CardTitle>
                <CardDescription>Recent API calls</CardDescription>
              </div>
              {history.length > 0 && (
                <Button variant="ghost" size="sm" onClick={clearHistory} className="gap-1 text-red-500">
                  <Trash2 className="h-4 w-4" />
                  Clear
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {history.length > 0 ? (
              <div className="max-h-[300px] space-y-2 overflow-y-auto">
                {history.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => loadFromHistory(item)}
                    className="flex w-full items-center gap-3 rounded-lg border border-zinc-200 p-3 text-left hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                  >
                    <span
                      className={`rounded px-1.5 py-0.5 font-mono text-xs font-semibold ${HTTP_METHOD_COLORS[item.method]}`}
                    >
                      {item.method}
                    </span>
                    <span className="flex-1 truncate font-mono text-sm">{item.path}</span>
                    {item.response && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          item.response.status >= 200 && item.response.status < 300
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                        }`}
                      >
                        {item.response.status}
                      </span>
                    )}
                    <span className="text-xs text-zinc-500">
                      {new Date(item.timestamp).toLocaleTimeString()}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex h-[100px] items-center justify-center text-zinc-500">
                <p>No history yet. Send some requests!</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

