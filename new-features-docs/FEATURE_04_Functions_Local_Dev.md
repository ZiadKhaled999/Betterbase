# Feature 4: Edge Functions Local Dev Server

**Priority**: Medium (Week 10)  
**Complexity**: Medium  
**Dependencies**: Structured Logging  
**Estimated Effort**: 1 week

---

## Problem Statement

Developers must deploy functions to test them (`bb function deploy`). This is:
- **Slow**: Deploy takes 30-60 seconds
- **Expensive**: Burns cloud credits during development
- **Frustrating**: Breaks fast feedback loop

---

## Solution

Run functions locally with hot reload:
- Functions accessible at `http://localhost:3000/functions/:name`
- File changes trigger automatic reload
- Environment variables injected from `.env`
- Same port as main app (no CORS issues)

---

## Implementation

### Step 1: Create Local Runtime

**File**: `packages/core/src/functions/local-runtime.ts` (NEW FILE)

```typescript
import type { Context } from 'hono';
import { watch } from 'fs';
import path from 'path';

export type FunctionContext = {
  request: Request;
  env: Record<string, string>;
};

export type FunctionHandler = (ctx: FunctionContext) => Promise<Response> | Response;

type LoadedFunction = {
  name: string;
  handler: FunctionHandler;
  lastModified: number;
};

export class LocalFunctionsRuntime {
  private functions = new Map<string, LoadedFunction>();
  private functionsDir: string;
  private envVars: Record<string, string>;

  constructor(functionsDir: string, envVars: Record<string, string> = {}) {
    this.functionsDir = functionsDir;
    this.envVars = envVars;
  }

  async loadFunction(name: string): Promise<LoadedFunction> {
    const functionPath = path.join(this.functionsDir, name, 'index.ts');
    const stat = await Bun.file(functionPath).stat();
    
    if (!stat) {
      throw new Error(`Function not found: ${name}`);
    }

    // Clear cache for hot reload
    delete require.cache[functionPath];

    const module = await import(functionPath);
    
    if (!module.default || typeof module.default !== 'function') {
      throw new Error(`Function ${name} must export default function`);
    }

    const loaded: LoadedFunction = {
      name,
      handler: module.default,
      lastModified: stat.mtime.getTime(),
    };

    this.functions.set(name, loaded);
    return loaded;
  }

  async executeFunction(name: string, request: Request): Promise<Response> {
    let func = this.functions.get(name);
    
    if (!func) {
      func = await this.loadFunction(name);
    } else {
      // Check if modified (hot reload)
      const functionPath = path.join(this.functionsDir, name, 'index.ts');
      const stat = await Bun.file(functionPath).stat();
      
      if (stat && stat.mtime.getTime() > func.lastModified) {
        console.log(`[Functions] Hot reloading: ${name}`);
        func = await this.loadFunction(name);
      }
    }

    const ctx: FunctionContext = {
      request,
      env: this.envVars,
    };

    try {
      return await func.handler(ctx);
    } catch (error) {
      console.error(`[Functions] Error: ${name}`, error);
      return new Response(
        JSON.stringify({ error: 'Internal Server Error' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  startWatcher(): void {
    watch(this.functionsDir, { recursive: true }, (event, filename) => {
      if (filename && filename.endsWith('.ts')) {
        const functionName = filename.split('/')[0];
        console.log(`[Functions] File changed: ${filename}`);
        this.functions.delete(functionName);
      }
    });
    
    console.log(`[Functions] Watching ${this.functionsDir}`);
  }
}

export function createFunctionsMiddleware(runtime: LocalFunctionsRuntime) {
  return async (c: Context) => {
    const functionName = c.req.param('name');
    
    if (!functionName) {
      return c.json({ error: 'Function name required' }, 400);
    }

    try {
      const response = await runtime.executeFunction(functionName, c.req.raw);
      return response;
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        return c.json({ error: `Function not found: ${functionName}` }, 404);
      }
      throw error;
    }
  };
}
```

---

### Step 2: Integrate with Dev Command

**File**: `packages/cli/src/commands/dev.ts`

**MODIFY**:

```typescript
import { LocalFunctionsRuntime, createFunctionsMiddleware } from '@betterbase/core/functions/local-runtime';

export async function runDevCommand(
  projectRoot: string,
  options: { port?: number; functions?: boolean } = {}
): Promise<() => void> {
  const { port = 3000, functions = true } = options;
  
  logger.info('Starting development server...');

  // Load env vars
  const envVars = loadEnvVars(projectRoot);

  // Start functions runtime
  let functionsRuntime: LocalFunctionsRuntime | null = null;
  if (functions) {
    const functionsDir = path.join(projectRoot, 'src', 'functions');
    try {
      await fs.access(functionsDir);
      functionsRuntime = new LocalFunctionsRuntime(functionsDir, envVars);
      functionsRuntime.startWatcher();
      logger.success('✅ Functions runtime started');
    } catch {
      logger.warn('No src/functions directory');
    }
  }

  // Add functions routes
  if (functionsRuntime) {
    app.all('/functions/:name', createFunctionsMiddleware(functionsRuntime));
  }

  // ... rest of dev server setup
}
```

---

## Acceptance Criteria

- [ ] Local functions runtime created
- [ ] `bb dev` starts functions runtime
- [ ] Functions at `http://localhost:3000/functions/:name`
- [ ] Hot reload on file save
- [ ] Env vars from `.env` injected
- [ ] Errors return 500, don't crash server
- [ ] Test: Create function, call locally, modify, call again
