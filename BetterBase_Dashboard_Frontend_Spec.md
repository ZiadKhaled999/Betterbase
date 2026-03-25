# BetterBase Dashboard Frontend — Orchestrator Specification

> **For Kilo Code Orchestrator**
> Implement after `BetterBase_Dashboard_Backend_Spec.md` is complete and server is verified running.
> All task IDs use prefix **FE-** (Frontend).
> Execute tasks in strict order. Do not begin a task until all listed dependencies are marked complete.
> All file paths are relative to the dashboard repo root (separate repo from the monorepo).

---

## Overview

This spec builds the complete BetterBase self-hosted dashboard — a React single-page application that consumes every API endpoint defined in the backend spec.

**Tech stack (locked, do not substitute):**
- **React Router v7** — routing with loaders/actions
- **TanStack Query v5** — all server state
- **Tailwind CSS v4** — styling
- **shadcn/ui** — component primitives (Radix-based, code-owned)
- **Motion (framer-motion v11)** — micro-interactions, surgically applied
- **TanStack Table v8** — all data tables
- **React Hook Form v7 + Zod** — all forms
- **Recharts** — all charts
- **Lucide React** — all icons

**Design principles:**
- Dark theme first (light available via toggle, persisted to localStorage)
- Every list view has an empty state — no blank pages
- Loading states use skeletons, not spinners
- Every destructive action has a confirmation dialog requiring the resource name to be typed
- Error boundaries on every module — one broken section doesn't kill the page
- Command palette (⌘K) available globally
- No AI-generated color palettes — use a deliberate design token system

---

## Phase 1 — Project Bootstrap

### Task FE-01 — Initialize React Router v7 Project

**Depends on:** nothing

**Create the project:**

```bash
npx create-react-router@latest betterbase-dashboard --template spa
cd betterbase-dashboard
```

This gives a Vite + React Router v7 SPA. If `create-react-router` is unavailable, use:

```bash
npm create vite@latest betterbase-dashboard -- --template react-ts
cd betterbase-dashboard
npm install react-router@7
```

**Install all dependencies:**

```bash
npm install \
  react-router@7 \
  @tanstack/react-query@5 \
  @tanstack/react-table@8 \
  react-hook-form@7 \
  zod@3 \
  @hookform/resolvers@3 \
  recharts@2 \
  motion@11 \
  lucide-react \
  clsx \
  tailwind-merge \
  class-variance-authority \
  @radix-ui/react-dialog \
  @radix-ui/react-dropdown-menu \
  @radix-ui/react-select \
  @radix-ui/react-tabs \
  @radix-ui/react-tooltip \
  @radix-ui/react-popover \
  @radix-ui/react-alert-dialog \
  @radix-ui/react-switch \
  @radix-ui/react-badge \
  @radix-ui/react-separator \
  @radix-ui/react-avatar \
  @radix-ui/react-progress \
  @radix-ui/react-scroll-area \
  @radix-ui/react-collapsible \
  cmdk \
  sonner \
  date-fns
```

**Install dev dependencies:**

```bash
npm install -D \
  tailwindcss@4 \
  @tailwindcss/vite \
  typescript \
  @types/react \
  @types/react-dom \
  vite \
  @vitejs/plugin-react \
  @tanstack/react-query-devtools
```

**Acceptance criteria:**
- `npm run dev` starts without errors
- TypeScript compiles without errors

---

### Task FE-02 — Configure Tailwind v4 + Design Tokens

**Depends on:** FE-01

**Replace file:** `src/index.css`

```css
@import "tailwindcss";

@theme {
  /* ─── Color Palette ─────────────────────────────────────────────── */
  --color-background:        #0a0a0f;
  --color-surface:           #111118;
  --color-surface-elevated:  #16161f;
  --color-surface-overlay:   #1c1c27;
  --color-border:            #1e1e2e;
  --color-border-subtle:     #151520;

  /* Brand */
  --color-brand:             #6366f1;
  --color-brand-hover:       #818cf8;
  --color-brand-muted:       rgba(99,102,241,0.12);

  /* Text */
  --color-text-primary:      #e8e8f0;
  --color-text-secondary:    #8b8ba8;
  --color-text-muted:        #4b4b6a;
  --color-text-inverted:     #0a0a0f;

  /* Semantic */
  --color-success:           #22c55e;
  --color-success-muted:     rgba(34,197,94,0.12);
  --color-warning:           #f59e0b;
  --color-warning-muted:     rgba(245,158,11,0.12);
  --color-danger:            #ef4444;
  --color-danger-muted:      rgba(239,68,68,0.12);
  --color-info:              #3b82f6;
  --color-info-muted:        rgba(59,130,246,0.12);

  /* ─── Typography ────────────────────────────────────────────────── */
  --font-sans: "Inter", system-ui, -apple-system, sans-serif;
  --font-mono: "JetBrains Mono", "Fira Code", monospace;

  /* ─── Radii ─────────────────────────────────────────────────────── */
  --radius-sm:  4px;
  --radius-md:  8px;
  --radius-lg:  12px;
  --radius-xl:  16px;

  /* ─── Shadows ───────────────────────────────────────────────────── */
  --shadow-card: 0 1px 3px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.03);
  --shadow-elevated: 0 4px 16px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05);
}

/* Light theme override */
[data-theme="light"] {
  --color-background:        #fafafa;
  --color-surface:           #ffffff;
  --color-surface-elevated:  #f5f5f7;
  --color-surface-overlay:   #ebebf0;
  --color-border:            #e2e2ec;
  --color-border-subtle:     #f0f0f5;
  --color-text-primary:      #0f0f1a;
  --color-text-secondary:    #5c5c78;
  --color-text-muted:        #9999b5;
}

* { box-sizing: border-box; }

body {
  background: var(--color-background);
  color: var(--color-text-primary);
  font-family: var(--font-sans);
  font-size: 14px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}

/* Scrollbar */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--color-border); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: var(--color-text-muted); }
```

**Replace file:** `vite.config.ts`

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  define: {
    "import.meta.env.VITE_API_URL": JSON.stringify(process.env.VITE_API_URL ?? "http://localhost:3001"),
  },
});
```

**Replace file:** `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "strict": true,
    "skipLibCheck": true,
    "jsx": "react-jsx",
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src"]
}
```

**Acceptance criteria:**
- CSS variables resolve correctly in browser
- `@` alias works for all imports
- Dark theme visible by default

---

### Task FE-03 — Core Utilities and API Client

**Depends on:** FE-02

**Create file:** `src/lib/utils.ts`

```typescript
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date, opts?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
    ...opts,
  }).format(new Date(date));
}

export function formatRelative(date: string | Date): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
}

export function truncate(str: string, n: number): string {
  return str.length > n ? `${str.slice(0, n)}...` : str;
}

export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}
```

**Create file:** `src/lib/api.ts`

```typescript
const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

function getToken(): string | null {
  return localStorage.getItem("bb_token");
}

export function setToken(token: string): void {
  localStorage.setItem("bb_token", token);
}

export function clearToken(): void {
  localStorage.removeItem("bb_token");
  localStorage.removeItem("bb_admin");
}

export function getStoredAdmin(): { id: string; email: string } | null {
  const raw = localStorage.getItem("bb_admin");
  return raw ? JSON.parse(raw) : null;
}

export function setStoredAdmin(admin: { id: string; email: string }): void {
  localStorage.setItem("bb_admin", JSON.stringify(admin));
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  skipAuth = false
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> ?? {}),
  };
  if (token && !skipAuth) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    clearToken();
    window.location.href = "/login";
    throw new ApiError(401, "Unauthorized");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Request failed" })) as { error?: string };
    throw new ApiError(res.status, body.error ?? `HTTP ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  get:    <T>(path: string) => request<T>(path),
  post:   <T>(path: string, body?: unknown) => request<T>(path, { method: "POST",   body: body !== undefined ? JSON.stringify(body) : undefined }),
  put:    <T>(path: string, body?: unknown) => request<T>(path, { method: "PUT",    body: JSON.stringify(body) }),
  patch:  <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH",  body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),

  // Public (no auth header)
  postPublic: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body !== undefined ? JSON.stringify(body) : undefined }, true),

  // File download (returns blob)
  download: async (path: string): Promise<Blob> => {
    const token = getToken();
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (!res.ok) throw new ApiError(res.status, "Download failed");
    return res.blob();
  },
};
```

**Create file:** `src/lib/query-keys.ts`

```typescript
// Centralized query key factory — prevents key typos and enables targeted invalidation
export const QK = {
  // Instance
  health:             () => ["health"] as const,
  instance:           () => ["instance"] as const,
  smtp:               () => ["smtp"] as const,
  notifications:      () => ["notifications"] as const,
  // Metrics
  metrics:            () => ["metrics"] as const,
  metricsOverview:    () => ["metrics", "overview"] as const,
  metricsTimeseries:  (metric: string, period: string) => ["metrics", "timeseries", metric, period] as const,
  metricsLatency:     (period: string) => ["metrics", "latency", period] as const,
  metricsTopEndpoints:(period: string) => ["metrics", "top-endpoints", period] as const,
  // Auth
  adminMe:            () => ["admin", "me"] as const,
  // Admin users
  adminUsers:         () => ["admin-users"] as const,
  // RBAC
  roles:              () => ["roles"] as const,
  roleAssignments:    () => ["role-assignments"] as const,
  // API keys
  apiKeys:            () => ["api-keys"] as const,
  cliSessions:        () => ["cli-sessions"] as const,
  // Projects
  projects:           () => ["projects"] as const,
  project:            (id: string) => ["projects", id] as const,
  // Per-project
  projectUsers:       (id: string, params: Record<string, string>) => ["projects", id, "users", params] as const,
  projectUser:        (id: string, userId: string) => ["projects", id, "users", userId] as const,
  projectUserStats:   (id: string) => ["projects", id, "users", "stats"] as const,
  projectAuthConfig:  (id: string) => ["projects", id, "auth-config"] as const,
  projectDatabase:    (id: string) => ["projects", id, "database"] as const,
  projectTables:      (id: string) => ["projects", id, "database", "tables"] as const,
  projectColumns:     (id: string, table: string) => ["projects", id, "database", "tables", table] as const,
  projectRealtime:    (id: string) => ["projects", id, "realtime"] as const,
  projectEnv:         (id: string) => ["projects", id, "env"] as const,
  projectWebhooks:    (id: string) => ["projects", id, "webhooks"] as const,
  projectDeliveries:  (id: string, webhookId: string) => ["projects", id, "webhooks", webhookId, "deliveries"] as const,
  projectFunctions:   (id: string) => ["projects", id, "functions"] as const,
  projectInvocations: (id: string, fnId: string) => ["projects", id, "functions", fnId, "invocations"] as const,
  projectFnStats:     (id: string, fnId: string, period: string) => ["projects", id, "functions", fnId, "stats", period] as const,
  // Logs
  logs:               (params: Record<string, string>) => ["logs", params] as const,
  audit:              (params: Record<string, string>) => ["audit", params] as const,
  auditActions:       () => ["audit", "actions"] as const,
  // Storage
  storageBuckets:     () => ["storage", "buckets"] as const,
  storageObjects:     (bucket: string) => ["storage", "buckets", bucket, "objects"] as const,
  // Webhooks (global)
  webhooks:           () => ["webhooks"] as const,
  // Functions (global)
  functions:          () => ["functions"] as const,
};
```

**Acceptance criteria:**
- `api.get/post/put/patch/delete` all functional
- 401 responses redirect to `/login` and clear stored token
- Query key factory covers every API endpoint

---

### Task FE-04 — App Shell + Router + Query Provider

**Depends on:** FE-03

**Create file:** `src/main.tsx`

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider, createBrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { Toaster } from "sonner";
import { routes } from "./routes";
import "./index.css";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,        // 30 seconds
      gcTime: 5 * 60 * 1000,    // 5 minutes
      retry: (failureCount, error: any) => {
        if (error?.status === 401 || error?.status === 404) return false;
        return failureCount < 2;
      },
    },
  },
});

const router = createBrowserRouter(routes);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: "var(--color-surface-elevated)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text-primary)",
          },
        }}
      />
      {import.meta.env.DEV && <ReactQueryDevtools />}
    </QueryClientProvider>
  </React.StrictMode>
);
```

**Create file:** `src/routes.tsx`

```tsx
import { type RouteObject } from "react-router-dom";
import { AppLayout } from "@/layouts/AppLayout";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { SetupGuard } from "@/components/auth/SetupGuard";

// Lazy imports for code splitting
import { lazy, Suspense } from "react";
import { PageSkeleton } from "@/components/ui/PageSkeleton";

const wrap = (Component: React.LazyExoticComponent<any>) => (
  <Suspense fallback={<PageSkeleton />}><Component /></Suspense>
);

// Pages
const SetupPage          = lazy(() => import("@/pages/SetupPage"));
const LoginPage          = lazy(() => import("@/pages/LoginPage"));
const OverviewPage       = lazy(() => import("@/pages/OverviewPage"));
const ProjectsPage       = lazy(() => import("@/pages/projects/ProjectsPage"));
const ProjectDetailPage  = lazy(() => import("@/pages/projects/ProjectDetailPage"));
const ProjectUsersPage   = lazy(() => import("@/pages/projects/users/ProjectUsersPage"));
const ProjectUserPage    = lazy(() => import("@/pages/projects/users/ProjectUserPage"));
const ProjectAuthPage    = lazy(() => import("@/pages/projects/ProjectAuthPage"));
const ProjectDatabasePage= lazy(() => import("@/pages/projects/ProjectDatabasePage"));
const ProjectRealtimePage= lazy(() => import("@/pages/projects/ProjectRealtimePage"));
const ProjectEnvPage     = lazy(() => import("@/pages/projects/ProjectEnvPage"));
const ProjectWebhooksPage= lazy(() => import("@/pages/projects/ProjectWebhooksPage"));
const ProjectFunctionsPage= lazy(() => import("@/pages/projects/ProjectFunctionsPage"));
const StoragePage        = lazy(() => import("@/pages/StoragePage"));
const StorageBucketPage  = lazy(() => import("@/pages/StorageBucketPage"));
const LogsPage           = lazy(() => import("@/pages/LogsPage"));
const AuditPage          = lazy(() => import("@/pages/AuditPage"));
const TeamPage           = lazy(() => import("@/pages/TeamPage"));
const SettingsPage       = lazy(() => import("@/pages/SettingsPage"));
const SmtpPage           = lazy(() => import("@/pages/SmtpPage"));
const NotificationsPage  = lazy(() => import("@/pages/NotificationsPage"));
const ApiKeysPage        = lazy(() => import("@/pages/ApiKeysPage"));
const NotFoundPage       = lazy(() => import("@/pages/NotFoundPage"));

export const routes: RouteObject[] = [
  // Setup — only accessible before any admin exists
  { path: "/setup", element: <SetupGuard>{wrap(SetupPage)}</SetupGuard> },

  // Auth
  { path: "/login", element: wrap(LoginPage) },

  // App — all routes behind auth guard
  {
    element: <AuthGuard><AppLayout /></AuthGuard>,
    children: [
      { index: true,                               element: wrap(OverviewPage) },
      { path: "projects",                          element: wrap(ProjectsPage) },
      { path: "projects/:projectId",               element: wrap(ProjectDetailPage) },
      { path: "projects/:projectId/users",         element: wrap(ProjectUsersPage) },
      { path: "projects/:projectId/users/:userId", element: wrap(ProjectUserPage) },
      { path: "projects/:projectId/auth",          element: wrap(ProjectAuthPage) },
      { path: "projects/:projectId/database",      element: wrap(ProjectDatabasePage) },
      { path: "projects/:projectId/realtime",      element: wrap(ProjectRealtimePage) },
      { path: "projects/:projectId/env",           element: wrap(ProjectEnvPage) },
      { path: "projects/:projectId/webhooks",      element: wrap(ProjectWebhooksPage) },
      { path: "projects/:projectId/functions",     element: wrap(ProjectFunctionsPage) },
      { path: "storage",                           element: wrap(StoragePage) },
      { path: "storage/:bucketName",               element: wrap(StorageBucketPage) },
      { path: "logs",                              element: wrap(LogsPage) },
      { path: "audit",                             element: wrap(AuditPage) },
      { path: "team",                              element: wrap(TeamPage) },
      { path: "settings",                          element: wrap(SettingsPage) },
      { path: "settings/smtp",                     element: wrap(SmtpPage) },
      { path: "settings/notifications",            element: wrap(NotificationsPage) },
      { path: "settings/api-keys",                 element: wrap(ApiKeysPage) },
    ],
  },
  { path: "*", element: wrap(NotFoundPage) },
];
```

**Acceptance criteria:**
- All routes registered — none return 404 in dev
- Auth guard redirects to /login when no token in localStorage
- Setup guard redirects to /login if admin already exists (API check)
- Code splitting works — each page is its own chunk

---

## Phase 2 — Layout and Auth Components

### Task FE-05 — App Layout (Sidebar + Header)

**Depends on:** FE-04

**Create file:** `src/layouts/AppLayout.tsx`

```tsx
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  LayoutDashboard, FolderOpen, HardDrive, Webhook, Zap,
  ScrollText, Shield, Settings, Users, LogOut, Command,
  ChevronDown, ChevronRight, Bell, Sun, Moon, Database,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { clearToken, getStoredAdmin } from "@/lib/api";
import { CommandPalette } from "@/components/CommandPalette";
import { useTheme } from "@/hooks/useTheme";
import { Avatar } from "@/components/ui/Avatar";

const nav = [
  { label: "Overview",   href: "/",         icon: LayoutDashboard },
  { label: "Projects",   href: "/projects",  icon: FolderOpen },
  { label: "Storage",    href: "/storage",   icon: HardDrive },
  { label: "Logs",       href: "/logs",      icon: ScrollText },
  { label: "Audit Log",  href: "/audit",     icon: Shield },
  { label: "Team",       href: "/team",      icon: Users },
  {
    label: "Settings", href: "/settings", icon: Settings,
    children: [
      { label: "General",       href: "/settings" },
      { label: "SMTP",          href: "/settings/smtp" },
      { label: "Notifications", href: "/settings/notifications" },
      { label: "API Keys",      href: "/settings/api-keys" },
    ],
  },
];

export function AppLayout() {
  const [cmdOpen, setCmdOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const admin = getStoredAdmin();

  function handleLogout() {
    clearToken();
    navigate("/login");
  }

  // Global ⌘K
  if (typeof window !== "undefined") {
    window.onkeydown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setCmdOpen(true); }
    };
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--color-background)" }}>
      {/* Sidebar */}
      <aside
        className="flex flex-col w-60 border-r shrink-0"
        style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 h-14 border-b" style={{ borderColor: "var(--color-border)" }}>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold"
            style={{ background: "var(--color-brand)" }}>B</div>
          <span className="font-semibold text-sm" style={{ color: "var(--color-text-primary)" }}>Betterbase</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
          {nav.map((item) => {
            if (item.children) {
              return (
                <div key={item.label}>
                  <button
                    onClick={() => setSettingsOpen((o) => !o)}
                    className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm transition-colors"
                    style={{ color: "var(--color-text-secondary)" }}
                  >
                    <item.icon size={15} />
                    <span className="flex-1 text-left">{item.label}</span>
                    {settingsOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  </button>
                  <AnimatePresence>
                    {settingsOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }}
                        className="overflow-hidden pl-5"
                      >
                        {item.children.map((child) => (
                          <NavLink key={child.href} to={child.href} end={child.href === "/settings"}
                            className={({ isActive }) => cn(
                              "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors",
                              isActive
                                ? "font-medium"
                                : "opacity-70 hover:opacity-100"
                            )}
                            style={({ isActive }) => ({ color: isActive ? "var(--color-brand)" : "var(--color-text-secondary)" })}
                          >
                            {child.label}
                          </NavLink>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            }

            return (
              <NavLink key={item.href} to={item.href} end={item.href === "/"}
                className={({ isActive }) => cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors",
                  isActive ? "font-medium" : "hover:opacity-80"
                )}
                style={({ isActive }) => ({
                  background: isActive ? "var(--color-brand-muted)" : "transparent",
                  color: isActive ? "var(--color-brand)" : "var(--color-text-secondary)",
                })}
              >
                <item.icon size={15} />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        {/* Bottom bar */}
        <div className="px-3 py-3 border-t space-y-1" style={{ borderColor: "var(--color-border)" }}>
          {/* ⌘K button */}
          <button
            onClick={() => setCmdOpen(true)}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm transition-colors hover:opacity-80"
            style={{ color: "var(--color-text-muted)" }}
          >
            <Command size={13} />
            <span className="flex-1 text-left">Command</span>
            <kbd className="text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--color-surface-overlay)", color: "var(--color-text-muted)" }}>⌘K</kbd>
          </button>

          {/* Theme toggle */}
          <button
            onClick={toggle}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm transition-colors hover:opacity-80"
            style={{ color: "var(--color-text-muted)" }}
          >
            {theme === "dark" ? <Sun size={13} /> : <Moon size={13} />}
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>

          {/* Admin info */}
          <div className="flex items-center gap-2 px-3 py-2">
            <Avatar email={admin?.email ?? ""} size={24} />
            <span className="text-xs flex-1 truncate" style={{ color: "var(--color-text-secondary)" }}>{admin?.email}</span>
            <button onClick={handleLogout} className="hover:opacity-80 transition-opacity">
              <LogOut size={13} style={{ color: "var(--color-text-muted)" }} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>

      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
    </div>
  );
}
```

**Acceptance criteria:**
- NavLinks show active state with brand color + background
- Settings section expands/collapses with animation
- ⌘K globally opens command palette
- Logout clears token and redirects to /login

---

### Task FE-06 — Auth Guard + Setup Guard

**Depends on:** FE-05

**Create file:** `src/components/auth/AuthGuard.tsx`

```tsx
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getToken } from "@/lib/api";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!getToken()) {
      navigate("/login", { replace: true });
    }
  }, [navigate]);

  if (!getToken()) return null;
  return <>{children}</>;
}
```

**Create file:** `src/components/auth/SetupGuard.tsx`

```tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export function SetupGuard({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Try hitting /admin/auth/me without a token.
    // If setup is complete, login page is appropriate.
    // If setup is not done, /admin/auth/setup returns 201, not 410.
    // We check by calling /admin/auth/setup with empty body and seeing if we get 410.
    fetch(`${import.meta.env.VITE_API_URL ?? "http://localhost:3001"}/admin/auth/setup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ _check: true }), // Will fail validation but we only care about 410
    }).then((res) => {
      if (res.status === 410) {
        // Setup complete — redirect to login
        navigate("/login", { replace: true });
      }
      setChecking(false);
    }).catch(() => setChecking(false));
  }, [navigate]);

  if (checking) return null;
  return <>{children}</>;
}
```

**Acceptance criteria:**
- AuthGuard blocks unauthenticated access and redirects to /login
- SetupGuard redirects to /login if setup is already done (410 response)

---

## Phase 3 — Reusable UI Components

### Task FE-07 — Core UI Component Library

**Depends on:** FE-06

Install shadcn/ui CLI and initialize:

```bash
npx shadcn@latest init
```

Select: TypeScript, Tailwind, `src/components/ui` as path, no CSS variables (we use our own).

Then add these components via CLI (run one command):

```bash
npx shadcn@latest add button input label textarea badge card table dialog alert-dialog select tabs separator scroll-area tooltip dropdown-menu popover switch skeleton avatar progress sheet
```

After installation, **modify `src/components/ui/button.tsx`** to use design tokens instead of default colors — change the `default` variant background to `var(--color-brand)`.

**Create file:** `src/components/ui/PageSkeleton.tsx`

```tsx
export function PageSkeleton() {
  return (
    <div className="p-8 space-y-6 animate-pulse">
      <div className="h-8 w-64 rounded-lg" style={{ background: "var(--color-surface-elevated)" }} />
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 rounded-xl" style={{ background: "var(--color-surface-elevated)" }} />
        ))}
      </div>
      <div className="h-64 rounded-xl" style={{ background: "var(--color-surface-elevated)" }} />
    </div>
  );
}
```

**Create file:** `src/components/ui/PageHeader.tsx`

```tsx
interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between px-8 pt-8 pb-6">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: "var(--color-text-primary)" }}>{title}</h1>
        {description && <p className="mt-1 text-sm" style={{ color: "var(--color-text-secondary)" }}>{description}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
```

**Create file:** `src/components/ui/StatCard.tsx`

```tsx
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  trend?: { value: number; period: string };
  color?: "default" | "success" | "warning" | "danger" | "brand";
}

const colorMap = {
  default: { icon: "var(--color-text-muted)", bg: "var(--color-surface-overlay)" },
  brand:   { icon: "var(--color-brand)",      bg: "var(--color-brand-muted)" },
  success: { icon: "var(--color-success)",    bg: "var(--color-success-muted)" },
  warning: { icon: "var(--color-warning)",    bg: "var(--color-warning-muted)" },
  danger:  { icon: "var(--color-danger)",     bg: "var(--color-danger-muted)" },
};

export function StatCard({ label, value, icon: Icon, trend, color = "default" }: StatCardProps) {
  const colors = colorMap[color];
  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-3"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm" style={{ color: "var(--color-text-secondary)" }}>{label}</span>
        {Icon && (
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: colors.bg }}>
            <Icon size={14} style={{ color: colors.icon }} />
          </div>
        )}
      </div>
      <div className="text-2xl font-semibold" style={{ color: "var(--color-text-primary)" }}>{value}</div>
      {trend && (
        <div className="text-xs" style={{ color: trend.value >= 0 ? "var(--color-success)" : "var(--color-danger)" }}>
          {trend.value >= 0 ? "+" : ""}{trend.value}% vs {trend.period}
        </div>
      )}
    </div>
  );
}
```

**Create file:** `src/components/ui/EmptyState.tsx`

```tsx
import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
        style={{ background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)" }}>
        <Icon size={24} style={{ color: "var(--color-text-muted)" }} />
      </div>
      <div className="text-center">
        <p className="font-medium mb-1" style={{ color: "var(--color-text-primary)" }}>{title}</p>
        <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>{description}</p>
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
```

**Create file:** `src/components/ui/ConfirmDialog.tsx`

```tsx
import { useState } from "react";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
         AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  confirmValue?: string;   // If set, user must type this exact string
  variant?: "danger" | "warning";
  onConfirm: () => void;
  loading?: boolean;
}

export function ConfirmDialog({
  open, onOpenChange, title, description,
  confirmLabel = "Confirm", confirmValue,
  variant = "danger", onConfirm, loading,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState("");
  const canConfirm = confirmValue ? typed === confirmValue : true;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
        <AlertDialogHeader>
          <AlertDialogTitle style={{ color: "var(--color-text-primary)" }}>{title}</AlertDialogTitle>
          <AlertDialogDescription style={{ color: "var(--color-text-secondary)" }}>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {confirmValue && (
          <div className="py-2">
            <p className="text-sm mb-2" style={{ color: "var(--color-text-secondary)" }}>
              Type <strong style={{ color: "var(--color-text-primary)" }}>{confirmValue}</strong> to confirm:
            </p>
            <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={confirmValue} />
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button
            onClick={onConfirm}
            disabled={!canConfirm || loading}
            style={{ background: variant === "danger" ? "var(--color-danger)" : "var(--color-warning)" }}
          >
            {loading ? "..." : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

**Create file:** `src/components/ui/Avatar.tsx`

```tsx
interface AvatarProps { email: string; size?: number; }

export function Avatar({ email, size = 32 }: AvatarProps) {
  const initials = email.slice(0, 2).toUpperCase();
  const hue = Array.from(email).reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <div
      className="rounded-full flex items-center justify-center font-medium text-white shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.35, background: `hsl(${hue}, 55%, 45%)` }}
    >
      {initials}
    </div>
  );
}
```

**Create file:** `src/hooks/useTheme.ts`

```typescript
import { useState, useEffect } from "react";

type Theme = "dark" | "light";

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem("bb_theme") as Theme) ?? "dark";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("bb_theme", theme);
  }, [theme]);

  return { theme, toggle: () => setTheme((t) => t === "dark" ? "light" : "dark") };
}
```

**Acceptance criteria:**
- All shadcn components installed and importable
- Design tokens used throughout — no hardcoded hex values in components
- ConfirmDialog requires typed confirmation for destructive actions

---

### Task FE-08 — Command Palette

**Depends on:** FE-07

**Create file:** `src/components/CommandPalette.tsx`

```tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Command } from "cmdk";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { QK } from "@/lib/query-keys";
import { LayoutDashboard, FolderOpen, Users, Settings, ScrollText, Shield, HardDrive } from "lucide-react";

interface CommandPaletteProps { open: boolean; onClose: () => void; }

const staticCommands = [
  { label: "Overview",         href: "/",                 icon: LayoutDashboard },
  { label: "Projects",         href: "/projects",         icon: FolderOpen },
  { label: "Storage",          href: "/storage",          icon: HardDrive },
  { label: "Logs",             href: "/logs",             icon: ScrollText },
  { label: "Audit Log",        href: "/audit",            icon: Shield },
  { label: "Team",             href: "/team",             icon: Users },
  { label: "Settings",         href: "/settings",         icon: Settings },
  { label: "SMTP Settings",    href: "/settings/smtp",    icon: Settings },
  { label: "API Keys",         href: "/settings/api-keys",icon: Settings },
];

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const { data: projectsData } = useQuery({
    queryKey: QK.projects(),
    queryFn: () => api.get<{ projects: { id: string; name: string }[] }>("/admin/projects"),
    enabled: open,
  });

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  if (!open) return null;

  function go(href: string) { navigate(href); onClose(); }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24"
      style={{ background: "rgba(0,0,0,0.7)" }} onClick={onClose}>
      <div className="w-[560px] rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        onClick={(e) => e.stopPropagation()}>
        <Command>
          <div className="px-4 py-3 border-b" style={{ borderColor: "var(--color-border)" }}>
            <Command.Input
              value={query} onValueChange={setQuery}
              placeholder="Search pages, projects..."
              className="w-full bg-transparent outline-none text-sm"
              style={{ color: "var(--color-text-primary)" }}
              autoFocus
            />
          </div>
          <Command.List className="max-h-80 overflow-y-auto p-2">
            <Command.Empty className="py-8 text-center text-sm" style={{ color: "var(--color-text-muted)" }}>
              No results found.
            </Command.Empty>

            <Command.Group heading="Navigation">
              {staticCommands.map((cmd) => (
                <Command.Item key={cmd.href} value={cmd.label} onSelect={() => go(cmd.href)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer text-sm"
                  style={{ color: "var(--color-text-secondary)" }}>
                  <cmd.icon size={14} />
                  {cmd.label}
                </Command.Item>
              ))}
            </Command.Group>

            {(projectsData?.projects?.length ?? 0) > 0 && (
              <Command.Group heading="Projects">
                {projectsData!.projects.map((p) => (
                  <Command.Item key={p.id} value={p.name} onSelect={() => go(`/projects/${p.id}`)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer text-sm"
                    style={{ color: "var(--color-text-secondary)" }}>
                    <FolderOpen size={14} />
                    {p.name}
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
```

**Acceptance criteria:**
- Opens on ⌘K from anywhere in the app
- Shows static nav items + dynamic project list
- Keyboard navigable (cmdk handles this)
- Closes on Escape or backdrop click

---

## Phase 4 — Auth Pages

### Task FE-09 — Setup Page + Login Page

**Depends on:** FE-08

**Create file:** `src/pages/SetupPage.tsx`

```tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, setToken, setStoredAdmin } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const schema = z.object({
  email:    z.string().email(),
  password: z.string().min(8, "Minimum 8 characters"),
});
type FormData = z.infer<typeof schema>;

export default function SetupPage() {
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) });

  const mutation = useMutation({
    mutationFn: (data: FormData) => api.postPublic<{ token: string; admin: { id: string; email: string } }>(
      "/admin/auth/setup", data
    ),
    onSuccess: ({ token, admin }) => {
      setToken(token);
      setStoredAdmin(admin);
      toast.success("Admin account created. Welcome to Betterbase.");
      navigate("/", { replace: true });
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--color-background)" }}>
      <div className="w-full max-w-sm space-y-6">
        <div>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold mb-6"
            style={{ background: "var(--color-brand)" }}>B</div>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--color-text-primary)" }}>Setup Betterbase</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--color-text-secondary)" }}>Create the first admin account to get started.</p>
        </div>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input {...register("email")} type="email" placeholder="admin@example.com" />
            {errors.email && <p className="text-xs" style={{ color: "var(--color-danger)" }}>{errors.email.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Password</Label>
            <Input {...register("password")} type="password" placeholder="Min. 8 characters" />
            {errors.password && <p className="text-xs" style={{ color: "var(--color-danger)" }}>{errors.password.message}</p>}
          </div>
          <Button type="submit" className="w-full" disabled={mutation.isPending}>
            {mutation.isPending ? "Creating..." : "Create admin account"}
          </Button>
        </form>
      </div>
    </div>
  );
}
```

**Create file:** `src/pages/LoginPage.tsx`

```tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, setToken, setStoredAdmin } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const schema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
});
type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) });

  const mutation = useMutation({
    mutationFn: (data: FormData) => api.postPublic<{ token: string; admin: { id: string; email: string } }>(
      "/admin/auth/login", data
    ),
    onSuccess: ({ token, admin }) => {
      setToken(token);
      setStoredAdmin(admin);
      navigate("/", { replace: true });
    },
    onError: () => toast.error("Invalid credentials"),
  });

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--color-background)" }}>
      <div className="w-full max-w-sm space-y-6">
        <div>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold mb-6"
            style={{ background: "var(--color-brand)" }}>B</div>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--color-text-primary)" }}>Sign in</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--color-text-secondary)" }}>Access your Betterbase instance.</p>
        </div>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input {...register("email")} type="email" placeholder="admin@example.com" autoFocus />
            {errors.email && <p className="text-xs" style={{ color: "var(--color-danger)" }}>{errors.email.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Password</Label>
            <Input {...register("password")} type="password" placeholder="••••••••" />
          </div>
          <Button type="submit" className="w-full" disabled={mutation.isPending}>
            {mutation.isPending ? "Signing in..." : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  );
}
```

**Acceptance criteria:**
- SetupPage only accessible before admin exists (SetupGuard handles this)
- LoginPage stores token + admin on success
- Both pages match the minimal, high-contrast design aesthetic

---

## Phase 5 — Dashboard Pages (All Modules)

### Task FE-10 — Overview Page

**Depends on:** FE-09

**Create file:** `src/pages/OverviewPage.tsx`

This page shows: metric stat cards, request volume chart (24h), status code breakdown chart, top endpoints table, recent activity feed.

```tsx
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { QK } from "@/lib/query-keys";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { FolderOpen, Users, Zap, Webhook, AlertTriangle, Clock } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { formatRelative } from "@/lib/utils";
import type { AuditLog } from "@/types";

export default function OverviewPage() {
  const { data: metrics, isLoading } = useQuery({
    queryKey: QK.metricsOverview(),
    queryFn: () => api.get<{ metrics: any }>("/admin/metrics/overview"),
    refetchInterval: 30_000,
  });

  const { data: ts } = useQuery({
    queryKey: QK.metricsTimeseries("requests", "24h"),
    queryFn: () => api.get<{ series: any[] }>("/admin/metrics/timeseries?metric=requests&period=24h"),
    refetchInterval: 60_000,
  });

  const { data: latency } = useQuery({
    queryKey: QK.metricsLatency("24h"),
    queryFn: () => api.get<{ latency: any }>("/admin/metrics/latency?period=24h"),
    refetchInterval: 60_000,
  });

  const { data: topEndpoints } = useQuery({
    queryKey: QK.metricsTopEndpoints("24h"),
    queryFn: () => api.get<{ endpoints: any[] }>("/admin/metrics/top-endpoints?period=24h"),
    refetchInterval: 60_000,
  });

  const { data: auditData } = useQuery({
    queryKey: QK.audit({ limit: "8" }),
    queryFn: () => api.get<{ logs: AuditLog[] }>("/admin/audit?limit=8"),
    refetchInterval: 30_000,
  });

  if (isLoading) return <PageSkeleton />;
  const m = metrics?.metrics;

  return (
    <div>
      <PageHeader title="Overview" description="Your Betterbase instance at a glance" />

      <div className="px-8 pb-8 space-y-6">
        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Projects"     value={m?.projects ?? 0}          icon={FolderOpen}     color="brand" />
          <StatCard label="Total Users"  value={m?.total_end_users ?? 0}   icon={Users}          color="default" />
          <StatCard label="Active Fns"   value={m?.active_functions ?? 0}  icon={Zap}            color="success" />
          <StatCard label="Errors (1h)"  value={m?.recent_errors_1h ?? 0}  icon={AlertTriangle}  color={m?.recent_errors_1h > 0 ? "danger" : "default"} />
        </div>

        {/* Latency pills */}
        {latency?.latency && (
          <div className="flex gap-3 flex-wrap">
            {[
              { label: "P50", value: `${latency.latency.p50}ms` },
              { label: "P95", value: `${latency.latency.p95}ms` },
              { label: "P99", value: `${latency.latency.p99}ms` },
              { label: "Avg", value: `${latency.latency.avg}ms` },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs"
                style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-text-secondary)" }}>
                <Clock size={11} />
                <span style={{ color: "var(--color-text-muted)" }}>{label}</span>
                <span style={{ color: "var(--color-text-primary)" }}>{value}</span>
              </div>
            ))}
          </div>
        )}

        {/* Request volume chart */}
        <div className="rounded-xl p-5" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
          <h2 className="text-sm font-medium mb-4" style={{ color: "var(--color-text-primary)" }}>Request Volume — 24h</h2>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={ts?.series ?? []}>
              <defs>
                <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-brand)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--color-brand)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="ts" tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} tickFormatter={(v) => new Date(v).getHours() + "h"} />
              <YAxis tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} />
              <Tooltip contentStyle={{ background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
              <Area type="monotone" dataKey="total" stroke="var(--color-brand)" fill="url(#grad)" strokeWidth={2} name="Requests" />
              <Area type="monotone" dataKey="errors" stroke="var(--color-danger)" fill="none" strokeWidth={1.5} strokeDasharray="4 2" name="Errors" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Bottom grid: top endpoints + recent audit */}
        <div className="grid grid-cols-2 gap-6">
          {/* Top endpoints */}
          <div className="rounded-xl p-5" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
            <h2 className="text-sm font-medium mb-4" style={{ color: "var(--color-text-primary)" }}>Top Endpoints</h2>
            <div className="space-y-2">
              {(topEndpoints?.endpoints ?? []).slice(0, 8).map((ep, i) => (
                <div key={i} className="flex items-center gap-3 text-xs">
                  <code className="flex-1 truncate" style={{ color: "var(--color-text-secondary)", fontFamily: "var(--font-mono)" }}>{ep.path}</code>
                  <span style={{ color: "var(--color-text-muted)" }}>{ep.avg_ms}ms</span>
                  <span style={{ color: "var(--color-text-primary)" }}>{ep.requests.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent audit activity */}
          <div className="rounded-xl p-5" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
            <h2 className="text-sm font-medium mb-4" style={{ color: "var(--color-text-primary)" }}>Recent Activity</h2>
            <div className="space-y-3">
              {(auditData?.logs ?? []).map((log) => (
                <div key={log.id} className="flex items-start gap-2.5 text-xs">
                  <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: "var(--color-brand)" }} />
                  <div className="flex-1 min-w-0">
                    <span style={{ color: "var(--color-text-secondary)" }}>{log.actor_email ?? "system"}</span>
                    {" "}<span style={{ color: "var(--color-text-muted)" }}>{log.action}</span>
                    {log.resource_name && <>{" "}<span style={{ color: "var(--color-text-primary)" }}>{log.resource_name}</span></>}
                  </div>
                  <span className="shrink-0" style={{ color: "var(--color-text-muted)" }}>{formatRelative(log.created_at)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Acceptance criteria:**
- All 4 stat cards, charts, latency pills, top endpoints, recent audit visible
- Charts use design token colors only
- Auto-refreshes every 30–60s

---

### Task FE-11 — Projects Page + Project Detail Page

**Depends on:** FE-10

**Create file:** `src/pages/projects/ProjectsPage.tsx`

Features: project cards list, create project dialog (captures name + slug), empty state. The create dialog must show the admin key in a one-time reveal modal.

Key implementation details:
- Query: `GET /admin/projects`
- Mutation: `POST /admin/projects` — response includes `admin_key` (plaintext, one-time)
- After mutation success: open a "Save your admin key" modal with the key in a code block + copy button + close button labeled "I've saved this key"
- Each project card shows: name, slug, created date, user count (from metrics overview `user_counts_by_project`)
- Links to `/projects/:id`

**Create file:** `src/pages/projects/ProjectDetailPage.tsx`

Project detail is a page with internal tab navigation (tabs rendered below the header, not in the sidebar):
- **Overview tab** — name, slug, status badge (active/suspended), created date, admin key (rotate button only — key not shown), danger zone (suspend, delete)
- **Users tab** — link to `/projects/:id/users`
- **Auth tab** — link to `/projects/:id/auth`
- **Database tab** — link to `/projects/:id/database`
- **Environment tab** — link to `/projects/:id/env`
- **Webhooks tab** — link to `/projects/:id/webhooks`
- **Functions tab** — link to `/projects/:id/functions`
- **Realtime tab** — link to `/projects/:id/realtime`

Use `<Tabs>` from shadcn. The tabs change the URL (`/projects/:id` default = overview, or use URL params).

Query: `GET /admin/projects/:id`

Danger zone actions:
- Suspend/Unsuspend: `PATCH /admin/projects/:id` with `{ status: "suspended" | "active" }` (add this to backend if not yet present — note in your implementation)
- Delete: `DELETE /admin/projects/:id` — ConfirmDialog requiring project slug to be typed

**Acceptance criteria:**
- Admin key one-time reveal modal appears only after successful project creation
- Rotate key button calls `POST /admin/projects/:id/rotate-key` (add to backend)
- Delete requires typing the slug

---

### Task FE-12 — Per-Project Users Pages

**Depends on:** FE-11

**Create file:** `src/pages/projects/users/ProjectUsersPage.tsx`

This is the most complex page in the dashboard. Features:

**Header section:**
- Total users count, banned count, user stat cards
- Line chart: daily signups last 30 days (from `GET /admin/projects/:id/users/stats/overview`)
- Provider breakdown: small bar chart

**Filters bar:**
- Search input (debounced 300ms)
- Filter dropdown: All / Banned / Not banned
- Filter dropdown: Provider (populated from stats)
- Date range picker: From / To
- Export CSV button

**Users table (TanStack Table):**
- Columns: Avatar+Name+Email, Providers (badge per provider), Created, Last sign-in, Status (Active/Banned badge), Actions
- Pagination controls
- Row click → navigate to user detail
- Bulk select → bulk ban/delete actions

**Implementation pattern:**
```typescript
// URL-synced filter state
const [searchParams, setSearchParams] = useSearchParams();
const search   = searchParams.get("search") ?? "";
const banned   = searchParams.get("banned") ?? "";
const offset   = parseInt(searchParams.get("offset") ?? "0");
const limit    = 50;

const { data } = useQuery({
  queryKey: QK.projectUsers(projectId, { search, banned, offset: String(offset) }),
  queryFn: () => api.get(`/admin/projects/${projectId}/users?limit=${limit}&offset=${offset}&search=${search}&banned=${banned}`),
});
```

**Create file:** `src/pages/projects/users/ProjectUserPage.tsx`

User detail page shows:
- Header: avatar, name, email, status badge, created date
- Action buttons: Ban/Unban, Force logout, Delete
- Sessions table: device, IP, created, expires
- Auth providers list
- Audit trail for this user (filtered from audit log)

**Acceptance criteria:**
- Search is debounced (no query per keystroke)
- Pagination synced to URL params
- Export triggers file download using `api.download()`
- Ban confirmation dialog captures reason + optional expiry

---

### Task FE-13 — Auth Config Page

**Depends on:** FE-12

**Create file:** `src/pages/projects/ProjectAuthPage.tsx`

This page is organized into accordion sections:

**Email/Password section:**
- Enable/disable toggle → `PUT /admin/projects/:id/auth-config/email_password_enabled`
- Min password length input
- Require email verification toggle

**Magic Link section:**
- Enable/disable toggle

**OTP section:**
- Enable/disable toggle

**OAuth Providers section — one card per provider (Google, GitHub, Discord, Apple, Microsoft, Twitter, Facebook):**
- Each card: provider name + logo icon, enable/disable toggle, Client ID input (revealed), Client Secret input (masked, reveal on click)
- Saving: `PUT /admin/projects/:id/auth-config/provider_{name}` with `{ enabled, clientId, clientSecret }`

**Phone/SMS section:**
- Enable/disable toggle
- Twilio Account SID, Auth Token, Phone Number inputs

**Session Config section:**
- Session expiry (select: 1h, 6h, 24h, 7d, 30d, custom)
- Refresh token expiry
- Max sessions per user

**Security section:**
- Allowed email domains (tag input — comma-separated)
- Blocked email domains (tag input)

All saves use optimistic updates (toggle switches update UI immediately, revert on error).

**Acceptance criteria:**
- Secrets always masked unless user clicks reveal
- Toggling enable/disable is instant (optimistic)
- Form fields save on blur with success toast

---

### Task FE-14 — Database Page

**Depends on:** FE-13

**Create file:** `src/pages/projects/ProjectDatabasePage.tsx`

Sections:
- **Status bar** — schema size, active connections (from `GET /admin/projects/:id/database/status`)
- **Tables list** — name, estimated row count, size; click to expand columns
- **Column detail** (expandable per table) — column name, data type, nullable, default
- **Migration history** — table of applied migrations with filename and timestamp

No query editor in v1. Tables and columns are read-only display.

**Acceptance criteria:**
- Tables list collapsible per row to show columns
- Status bar auto-refreshes every 30s

---

### Task FE-15 — Storage Page + Bucket Browser

**Depends on:** FE-14

**Create file:** `src/pages/StoragePage.tsx`

Bucket list page:
- Stat: total buckets, total objects (sum), total size
- Bucket cards: name, object count, size, public/private badge
- Create bucket dialog: name, public toggle
- Delete bucket: ConfirmDialog with bucket name typed

**Create file:** `src/pages/StorageBucketPage.tsx`

Object browser:
- Breadcrumb: `Storage > {bucket}`
- Object list table: name, size, content type, last modified, actions
- Upload button → file input dialog
- Delete single object, multi-select delete
- Copy public URL button (copies to clipboard with toast)
- Preview: images open in a lightbox dialog; other types show metadata

**Acceptance criteria:**
- Upload via `<input type="file">` → `POST /storage/{bucket}/{filename}` using FormData (this hits MinIO directly via nginx, not the admin API — note the different base URL pattern)
- Delete calls `DELETE /admin/storage/buckets/:name/objects` — note: implement this endpoint if missing (it's not in the DB spec — add a stub `DELETE /admin/storage/objects` that calls S3 DeleteObject)

---

### Task FE-16 — Webhooks Page

**Depends on:** FE-15

**Create file:** `src/pages/projects/ProjectWebhooksPage.tsx`

Features:
- Webhook list with health summary (success rate badge, last delivery timestamp)
- Create webhook dialog: name, table name, events (multi-select: INSERT/UPDATE/DELETE), URL, secret
- Enable/disable toggle per webhook (inline, optimistic)
- Delete webhook

**Webhook detail panel (slide-out sheet):**
- Click a webhook row to open side sheet
- Shows: config details, delivery success rate chart (7d), delivery log table
- Delivery log table: timestamp, event, status badge, response code, duration
- Click delivery row → modal showing payload + response body
- Retry button per delivery
- Test button (sends synthetic payload)

**Acceptance criteria:**
- Sheet slides in from right (Motion animation)
- Delivery log paginates within the sheet
- Retry shows loading state, updates delivery list on completion

---

### Task FE-17 — Functions Page

**Depends on:** FE-16

**Create file:** `src/pages/projects/ProjectFunctionsPage.tsx`

Features:
- Function list: name, runtime badge, status badge (active/inactive/error), deploy target, last deployed, invocation count
- Register function dialog: name (slug format), runtime (bun), deploy target (cloudflare/vercel/none)
- Delete function

**Function detail panel (side sheet):**
- Stats: invocations (24h), error rate, avg duration
- Invocation count chart (24h area chart)
- Error rate bar chart
- Invocation log table: trigger type, status badge, duration, timestamp
- Click row → detail modal showing error message (if error)

**Acceptance criteria:**
- Status badge uses semantic colors: active=success, error=danger, inactive=muted
- Stats auto-refresh on sheet open

---

### Task FE-18 — Logs Page

**Depends on:** FE-17

**Create file:** `src/pages/LogsPage.tsx`

Features:

**Filter bar:**
- Method filter (All, GET, POST, PATCH, DELETE)
- Status filter (All, 2xx, 3xx, 4xx, 5xx)
- Path prefix input
- Time range (1h, 6h, 24h, 7d, custom)
- Export CSV button

**Summary row:**
- Total requests, error count, avg duration

**Log table (TanStack Table):**
- Columns: method badge, path, status badge (color-coded), duration, timestamp
- Virtualized rows if >500 items
- Click row → detail modal showing full log entry

**Pagination controls:**
- Prev/Next + page info

All filters sync to URL params.

**Acceptance criteria:**
- Method badges colored (GET=blue, POST=green, DELETE=red, PATCH=orange)
- Status badges: 2xx=green, 3xx=blue, 4xx=orange, 5xx=red
- Export triggers CSV download

---

### Task FE-19 — Audit Log Page

**Depends on:** FE-18

**Create file:** `src/pages/AuditPage.tsx`

Features:
- Filter bar: actor email search, action type select (populated from `GET /admin/audit/actions`), resource type, date range
- Audit log table: actor, action, resource type+name, IP, timestamp
- Click row → detail modal showing before/after JSON diff (use a simple two-column JSON viewer)
- Export CSV (download the filtered result set)

**JSON diff viewer component (`src/components/ui/JsonDiff.tsx`):**
- Left column: before_data (red background for removed values)
- Right column: after_data (green background for new/changed values)
- Formatted with indentation, uses monospace font

**Acceptance criteria:**
- Before/after diff clearly shows what changed
- Empty before_data = create event; empty after_data = delete event
- Action filter dropdown populated from API

---

### Task FE-20 — Team Page

**Depends on:** FE-19

**Create file:** `src/pages/TeamPage.tsx`

Features:

**Admin users section:**
- Table: avatar, email, created, last login, MFA status (show badge if MFA data available), active sessions count, role assignments
- Invite button → dialog with email + password fields → `POST /admin/users`
- Delete admin: ConfirmDialog (blocked if last admin — show disabled state)

**Role assignments section:**
- Table: admin email, role name, scope (global or project name), created
- Assign role dialog: select admin, select role, optionally scope to project
- Revoke button per assignment

**Roles section:**
- Accordion: one row per role, expand to see permission grid
- Permission grid: domains as rows, actions as columns, checkmarks showing what the role has

**Acceptance criteria:**
- Cannot delete last admin — button disabled + tooltip explaining why
- Role assignment shows project scope when applicable
- Permission grid is read-only for system roles

---

### Task FE-21 — Settings Pages

**Depends on:** FE-20

**Create file:** `src/pages/SettingsPage.tsx` — General instance settings

Sections:
- **Instance info**: name, public URL, contact email — editable form, saves on submit → `PATCH /admin/instance`
- **Health status**: database connection status + latency, server uptime — from `GET /admin/instance/health`, auto-refresh 30s
- **Security**: log retention days, max sessions per user, IP allowlist (tag input), CORS origins (tag input)
- **Danger zone**: Factory reset button (behind ConfirmDialog requiring instance name to be typed) — note: implement `POST /admin/instance/reset` as a stub that returns 501 Not Implemented in v1

**Create file:** `src/pages/SmtpPage.tsx` — SMTP configuration

Sections:
- SMTP config form: host, port, username, password (masked), from email, from name, TLS toggle, enabled toggle
- Save → `PUT /admin/smtp`
- Test email section: email input + "Send test" button → `POST /admin/smtp/test`
- Status indicator: enabled/disabled badge

**Create file:** `src/pages/NotificationsPage.tsx` — Notification rules

Features:
- Rules table: name, metric, threshold, channel, target, enabled toggle, delete
- Create rule dialog: name, metric (select), threshold (number), channel (email/webhook), target
- Enable/disable toggle per rule

**Create file:** `src/pages/ApiKeysPage.tsx` — API Keys + CLI sessions

Sections:
- **API Keys**: list with name, prefix, scopes, last used, expires; create button → dialog (name, optional expiry, optional scopes); created key shown in one-time reveal modal; revoke button
- **CLI Sessions**: pending authorizations list + active API keys (duplicates ApiKeys section context)

**Acceptance criteria:**
- SMTP test shows success/error inline below the button
- API key one-time reveal identical UX to project admin key reveal
- All settings forms show last-saved timestamp

---

### Task FE-22 — Remaining Feature Pages

**Depends on:** FE-21

**Create file:** `src/pages/projects/ProjectRealtimePage.tsx`

Simple stats page:
- Connected clients count, active channels count
- Channel list table (if any): name, subscriber count
- Auto-refresh every 10s
- Empty state if no channels active

**Create file:** `src/pages/projects/ProjectEnvPage.tsx`

Environment variables page:
- Table: key, value (masked if secret, reveal button), secret badge, updated
- Add variable dialog: key (uppercase validation), value, secret toggle
- Edit: inline click-to-edit for value
- Delete per variable

**Create file:** `src/pages/NotFoundPage.tsx`

Simple 404 page with back-to-home button.

**Acceptance criteria:**
- Env var keys displayed in monospace
- Secret values revealed only on explicit click (eye icon)
- Realtime page shows "no active channels" empty state correctly

---

## Phase 6 — Types and Final Wiring

### Task FE-23 — TypeScript Types

**Depends on:** FE-22

**Create file:** `src/types/index.ts`

```typescript
export interface Project {
  id: string; name: string; slug: string;
  created_at: string; updated_at: string;
}

export interface AdminUser {
  id: string; email: string; created_at: string;
}

export interface EndUser {
  id: string; name: string; email: string; email_verified: boolean;
  image?: string; created_at: string; updated_at: string;
  banned: boolean; ban_reason?: string; ban_expires?: string;
  providers?: string[];
  last_sign_in?: string;
}

export interface Session {
  id: string; expires_at: string; ip_address?: string;
  user_agent?: string; created_at: string;
}

export interface AuditLog {
  id: number; actor_id?: string; actor_email?: string;
  action: string; resource_type?: string; resource_id?: string; resource_name?: string;
  before_data?: unknown; after_data?: unknown;
  ip_address?: string; created_at: string;
}

export interface RequestLog {
  id: number; method: string; path: string; status: number;
  duration_ms?: number; created_at: string;
}

export interface Webhook {
  id: string; name: string; table_name: string; events: string[];
  url: string; secret?: string; enabled: boolean; created_at: string;
  total_deliveries?: number; successful_deliveries?: number; last_delivery_at?: string;
}

export interface WebhookDelivery {
  id: number; webhook_id: string; event_type: string; payload: unknown;
  status: string; response_code?: number; response_body?: string;
  duration_ms?: number; attempt_count: number; created_at: string; delivered_at?: string;
}

export interface Function_ {
  id: string; name: string; runtime: string; status: string;
  deploy_target?: string; created_at: string;
}

export interface StorageBucket {
  Name: string; CreationDate?: string;
}

export interface StorageObject {
  Key: string; Size?: number; LastModified?: string; ContentType?: string;
}

export interface Role {
  id: string; name: string; description: string; is_system: boolean;
  permissions: { id: string; domain: string; action: string }[];
}

export interface ApiKey {
  id: string; name: string; key_prefix: string; scopes: string[];
  last_used_at?: string; expires_at?: string; created_at: string;
}

export interface Metrics {
  projects: number; admin_users: number; total_end_users: number;
  active_webhooks: number; active_functions: number; recent_errors_1h: number;
  uptime_seconds: number; timestamp: string;
}

export interface SmtpConfig {
  host: string; port: number; username: string; password: string;
  from_email: string; from_name: string; use_tls: boolean; enabled: boolean;
}
```

**Acceptance criteria:**
- All API response shapes covered
- Types imported throughout pages — no `any` except where explicitly unavoidable

---

### Task FE-24 — Error Boundaries

**Depends on:** FE-23

**Create file:** `src/components/ErrorBoundary.tsx`

```tsx
import { Component, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props { children: ReactNode; fallback?: ReactNode; }
interface State { error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error: Error) { return { error }; }

  render() {
    if (this.state.error) {
      return this.props.fallback ?? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <AlertTriangle size={32} style={{ color: "var(--color-warning)" }} />
          <div className="text-center">
            <p className="font-medium mb-1" style={{ color: "var(--color-text-primary)" }}>Something went wrong</p>
            <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>{this.state.error.message}</p>
          </div>
          <Button variant="outline" onClick={() => this.setState({ error: null })}>Try again</Button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

**Wrap every page's export with ErrorBoundary in `AppLayout.tsx`:**

```tsx
// In AppLayout, wrap <Outlet /> with:
<ErrorBoundary>
  <Outlet />
</ErrorBoundary>
```

**Acceptance criteria:**
- Any page-level error shows friendly UI instead of white screen
- "Try again" button resets the boundary

---

### Task FE-25 — Production Build Config

**Depends on:** FE-24

**Create file:** `.env.example`

```bash
VITE_API_URL=http://localhost:3001
```

**Create file:** `public/_redirects` (for Netlify / Vercel SPA routing)

```
/* /index.html 200
```

**Update `package.json` scripts:**

```json
{
  "scripts": {
    "dev":     "vite",
    "build":   "tsc --noEmit && vite build",
    "preview": "vite preview",
    "lint":    "tsc --noEmit"
  }
}
```

**Create file:** `apps/dashboard/Dockerfile` (in monorepo, referenced by docker-compose.self-hosted.yml)

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_API_URL=http://localhost:3001
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
RUN printf 'server { \n  listen 80; \n  root /usr/share/nginx/html; \n  index index.html; \n  location / { try_files $uri $uri/ /index.html; } \n}' > /etc/nginx/conf.d/default.conf
EXPOSE 80
```

**Acceptance criteria:**
- `npm run build` completes with zero TypeScript errors
- Built output is a single `dist/` folder with no server requirement
- Docker build produces a working nginx + static files image

---

## Complete File Structure

After all tasks are complete, the dashboard repository contains:

```
betterbase-dashboard/
├── public/
│   └── _redirects
├── src/
│   ├── main.tsx
│   ├── routes.tsx
│   ├── index.css
│   ├── types/
│   │   └── index.ts
│   ├── lib/
│   │   ├── api.ts
│   │   ├── query-keys.ts
│   │   └── utils.ts
│   ├── hooks/
│   │   └── useTheme.ts
│   ├── layouts/
│   │   └── AppLayout.tsx
│   ├── components/
│   │   ├── CommandPalette.tsx
│   │   ├── ErrorBoundary.tsx
│   │   ├── auth/
│   │   │   ├── AuthGuard.tsx
│   │   │   └── SetupGuard.tsx
│   │   └── ui/
│   │       ├── [shadcn components]
│   │       ├── Avatar.tsx
│   │       ├── ConfirmDialog.tsx
│   │       ├── EmptyState.tsx
│   │       ├── JsonDiff.tsx
│   │       ├── PageHeader.tsx
│   │       ├── PageSkeleton.tsx
│   │       └── StatCard.tsx
│   └── pages/
│       ├── SetupPage.tsx
│       ├── LoginPage.tsx
│       ├── OverviewPage.tsx
│       ├── StoragePage.tsx
│       ├── StorageBucketPage.tsx
│       ├── LogsPage.tsx
│       ├── AuditPage.tsx
│       ├── TeamPage.tsx
│       ├── NotFoundPage.tsx
│       ├── settings/
│       │   ├── SettingsPage.tsx
│       │   ├── SmtpPage.tsx
│       │   ├── NotificationsPage.tsx
│       │   └── ApiKeysPage.tsx
│       └── projects/
│           ├── ProjectsPage.tsx
│           ├── ProjectDetailPage.tsx
│           ├── ProjectAuthPage.tsx
│           ├── ProjectDatabasePage.tsx
│           ├── ProjectEnvPage.tsx
│           ├── ProjectRealtimePage.tsx
│           ├── ProjectWebhooksPage.tsx
│           ├── ProjectFunctionsPage.tsx
│           └── users/
│               ├── ProjectUsersPage.tsx
│               └── ProjectUserPage.tsx
├── .env.example
├── package.json
├── tsconfig.json
├── vite.config.ts
└── Dockerfile
```

---

## Execution Order

```
Phase 1 — Bootstrap
  FE-01  Init project + install deps
  FE-02  Tailwind v4 + design tokens
  FE-03  API client + query keys + utils
  FE-04  App shell + router + query provider

Phase 2 — Layout
  FE-05  AppLayout (sidebar + header)
  FE-06  AuthGuard + SetupGuard

Phase 3 — UI Components
  FE-07  Core UI components (shadcn install + custom)
  FE-08  Command palette

Phase 4 — Auth
  FE-09  SetupPage + LoginPage

Phase 5 — Dashboard Pages
  FE-10  OverviewPage
  FE-11  ProjectsPage + ProjectDetailPage
  FE-12  ProjectUsersPage + ProjectUserPage
  FE-13  ProjectAuthPage
  FE-14  ProjectDatabasePage
  FE-15  StoragePage + StorageBucketPage
  FE-16  ProjectWebhooksPage
  FE-17  ProjectFunctionsPage
  FE-18  LogsPage
  FE-19  AuditPage
  FE-20  TeamPage
  FE-21  SettingsPage + SmtpPage + NotificationsPage + ApiKeysPage
  FE-22  ProjectRealtimePage + ProjectEnvPage + NotFoundPage

Phase 6 — Polish
  FE-23  TypeScript types
  FE-24  Error boundaries
  FE-25  Production build + Dockerfile
```

**Total: 25 tasks across 6 phases.**

---

## Verification Checklist

Before marking complete, verify:

- [ ] `/setup` redirects to `/login` if admin already exists
- [ ] `/login` stores token and redirects to `/` on success
- [ ] Sidebar active states work for all routes
- [ ] ⌘K opens command palette from any page
- [ ] Projects list shows user counts
- [ ] Creating a project shows admin key one-time reveal
- [ ] User search is debounced
- [ ] Ban/unban shows confirmation dialog
- [ ] Export CSV triggers file download
- [ ] Webhook delivery log opens in side sheet
- [ ] Chart colors use CSS variables (not hardcoded hex)
- [ ] Dark mode toggle persists across page reload
- [ ] `npm run build` exits with code 0

*End of frontend specification. Do not begin implementation until backend spec is verified passing.*
