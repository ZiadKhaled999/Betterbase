# Functions Module

Serverless function bundling, local runtime, and deployment utilities.

## Table of Contents
- [Overview](#overview)
- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [API Reference](#api-reference)
  - [Bundler](#bundler)
  - [Deployer](#deployer)
  - [Local Runtime](#local-runtime)
  - [Types](#types)
- [Function Structure](#function-structure)
- [Deployment Targets](#deployment-targets)
- [Best Practices](#best-practices)
- [Examples](#examples)

## Overview

The Functions module provides tools for bundling, deploying, and running serverless functions in BetterBase applications. It supports multiple deployment targets and provides a consistent local development experience.

Key capabilities:
- **Function Bundling**: Package functions with dependencies using esbuild
- **Multi-Target Deployment**: Deploy to various serverless platforms
- **Local Runtime**: Test functions locally with simulated environment
- **Automatic Dependency Inclusion**: Bundle only required dependencies
- **Environment Variable Injection**: Configure runtime environment
- **Wrapper Generation**: Create platform-specific handlers
- **Watch Mode**: Automatic rebundling during development

## Features

### Bundling
- **esbuild-based**: Fast, efficient bundling
- **Tree Shaking**: Eliminate unused code
- **Minification**: Reduce bundle size for production
- **Format Support**: ESM, CommonJS, IIFE formats
- **Externalization**: Mark dependencies as external when needed
- **Banner/Footer**: Add custom code to bundles

### Deployment Targets
- **AWS Lambda**: Standard Node.js runtime
- **Cloudflare Workers**: Service Worker format
- **Vercel Serverless**: Vercel-specific format
- **Netlify Functions**: Netlify-specific format
- **Deno Deploy**: Deno-compatible bundle
- **Bun.sh**: Bun runtime target
- **Custom**: Generic bundle for any platform

### Local Runtime
- **Environment Simulation**: Mock context and event objects
- **Hot Reloading**: Automatic restart on file changes
- **Logging Capture**: View function logs in real-time
- **Error Reporting**: Detailed stack traces and error formatting
- **Timeout Simulation**: Test function timeout behavior

### Developer Experience
- **Zero Config**: Sensible defaults for common use cases
- **TypeScript Support**: Full type checking during bundling
- **Source Maps**: Debug bundled code with original sources
- **Watch Mode**: `bunx betterbase function watch` for development
- **CLI Integration**: `betterbase function` commands

## Installation

The Functions module is part of `@betterbase/core`:
```bash
bun add @betterbase/core
```

## Usage

### Basic Function Structure
```typescript
// src/functions/hello/index.ts
export default async function handler(event) {
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Hello World!' })
  };
}
```

### Bundling Functions
```bash
# Bundle a single function
bunx betterbase function build src/functions/hello/index.ts

# Bundle all functions in directory
bunx betterbase function build src/functions/

# Bundle with specific target
bunx betterbase function build src/functions/hello/index.ts --target aws-lambda
```

### Local Development
```bash
# Run function locally with mock event
bunx betterbase function run src/functions/hello/index.ts --event '{"name": "John"}'

# Watch mode for development
bunx betterbase function watch src/functions/
```

### Programmatic Usage
```typescript
import { 
  bundleFunction,
  deployFunction,
  createLocalRuntime
} from '@betterbase/core/functions';

// Bundle function
const bundle = await bundleFunction(
  'src/functions/hello/index.ts',
  { target: 'aws-lambda', minify: true }
);

// Deploy to provider
const deployment = await deployFunction(bundle, {
  provider: 'aws',
  functionName: 'hello-world',
  region: 'us-east-1'
});

// Test locally
const runtime = createLocalRuntime(bundle);
const result = await runtime.execute({
  name: 'John'
});
```

## API Reference

### Bundler
Function bundling utilities.

#### bundleFunction
```typescript
export async function bundleFunction(
  entryPoint: string,
  options: BundleOptions = {}
): Promise<FunctionBundle>
```

#### BundleOptions
```typescript
export interface BundleOptions {
  /** Build target (default: 'node') */
  target?: 'node' | 'browser' | 'aws-lambda' | 'cloudflare-workers' | 
          'vercel' | 'netlify' | 'deno' | 'bun' | 'custom';
  
  /** Output format (default: 'esm') */
  format?: 'esm' | 'cjs' | 'iife';
  
  /** Enable minification (default: false for dev, true for prod) */
  minify?: boolean;
  
  /** Generate source maps (default: true) */
  sourcemap?: boolean;
  
  /** Externalize dependencies (don't bundle) */
  external?: string[];
  
  /** Inject global variables */
  globals?: Record<string, string>;
  
  /** Add banner/footer to bundle */
  banner?: string;
  footer?: string;
  
  /** Define constants (like esbuild's define) */
  define?: Record<string, string>;
  
  /** Watch mode for rebundling */
  watch?: boolean;
  
  /** Outdir for bundle output */
  outdir?: string;
}
```

#### FunctionBundle
```typescript
export interface FunctionBundle {
  /** Bundle contents as string */
  code: string;
  
  /** Source map (if generated) */
  map?: string | null;
  
  /** Detected handler function name */
  handler: string;
  
  /** Bundle format */
  format: 'esm' | 'cjs' | 'iife';
  
  /** Target platform */
  target: string;
  
  /** Size in bytes */
  size: number;
  
  /** List of externalized dependencies */
  external: string[];
  
  /** Entry point used */
  entryPoint: string;
}
```

### Deployer
Function deployment utilities.

#### deployFunction
```typescript
export async function deployFunction(
  bundle: FunctionBundle,
  options: DeployOptions
): Promise<DeploymentResult>
```

#### DeployOptions
```typescript
export interface DeployOptions {
  /** Deployment provider */
  provider: 'aws' | 'cloudflare' | 'vercel' | 'netlify' | 'custom';
  
  /** Provider-specific configuration */
  config: Record<string, unknown>;
  
  /** Function name in target platform */
  functionName: string;
  
  /** Optional description */
  description?: string;
  
  /** Tags/labels for the function */
  tags?: Record<string, string>;
  
  /** Memory allocation (provider-dependent) */
  memory?: number;
  
  /** Timeout in seconds */
  timeout?: number;
  
  /** Environment variables */
  environment?: Record<string, string>;
  
  /** VPC/network configuration */
  network?: Record<string, unknown>;
  
  /** IAM/role configuration */
  role?: Record<string, unknown>;
}
```

#### DeploymentResult
```typescript
export interface DeploymentResult {
  /** Success status */
  success: boolean;
  
  /** Deployment ID/ARN/etc */
  id: string;
  
  /** Function URL or invoke address */
  url?: string;
  
  /** Provider-specific metadata */
  providerData: Record<string, unknown>;
  
  /** Any warnings during deployment */
  warnings: string[];
  
  /** Error details if failed */
  error?: string;
}
```

### Local Runtime
Local function execution and testing.

#### createLocalRuntime
```typescript
export function createLocalRuntime(
  bundle: FunctionBundle,
  options: RuntimeOptions = {}
): LocalFunctionRuntime
```

#### RuntimeOptions
```typescript
export interface RuntimeOptions {
  /** Environment variables for runtime */
  environment?: Record<string, string>;
  
  /** Function timeout in milliseconds */
  timeoutMs?: number;
  
  /** Memory limit in MB */
  memoryLimitMb?: number;
  
  /** Whether to capture console output */
  captureLogs?: boolean;
  
  /** Mock context object */
  context?: Record<string, unknown>;
}
```

#### LocalFunctionRuntime
```typescript
export interface LocalFunctionRuntime {
  /** Execute function with event */
  execute(event: unknown): Promise<unknown>;
  
  /** Set environment variables */
  setEnvironment(env: Record<string, string>): void;
  
  /** Get captured logs */
  getLogs(): string[];
  
  /** Reset runtime state */
  reset(): void;
  
  /** Destroy runtime and cleanup */
  destroy(): void;
}
```

### Types
Exported TypeScript types.

```typescript
export type FunctionHandler = (event: unknown, context?: unknown) => Promise<unknown>;

export interface FunctionMetadata {
  name: string;
  description?: string;
  version?: string;
  author?: string;
  license?: string;
  topics?: string[];
}
```

## Function Structure

### Standard Format
Functions should export a default async handler:

```typescript
// src/functions/my-function/index.ts
import type { BetterBaseResponse } from '@betterbase/shared';

export default async function handler(
  event: Record<string, unknown>, 
  context?: Record<string, unknown>
): Promise<BetterBaseResponse<unknown>> {
  try {
    // Process event
    const result = await processData(event);
    
    return {
      data: result,
      error: null
    };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
```

### Event Formats
Different platforms provide different event structures:
- **AWS Lambda**: API Gateway, S3, DynamoDB events, etc.
- **Cloudflare Workers**: FetchEvent with request
- **Vercel**: Next.js API route request/response
- **Netlify**: Similar to AWS Lambda format

### Context Object
The context parameter provides runtime information:
- `functionName`: Name of the function
- `functionVersion`: Version or alias
- `invokedFunctionArn`: ARN (AWS-specific)
- `awsRequestId`: Request ID (AWS-specific)
- `getRemainingTimeInMillis()`: Time before timeout
- `logGroupName`, `logStreamName`: Logging info (AWS-specific)

### Return Format
BetterBase functions should return a `BetterBaseResponse`:
```typescript
interface BetterBaseResponse<T> {
  data: T | null;
  error: string | SerializedError | null;
  count?: number;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
  };
}
```

## Deployment Targets

### AWS Lambda
```bash
bunx betterbase function build src/functions/hello/index.ts \
  --target aws-lambda \
  --outdir dist/functions/hello
```
Then deploy using AWS CLI, CDK, SAM, or similar tools.

### Cloudflare Workers
```bash
bunx betterbase function build src/functions/hello/index.ts \
  --target cloudflare-workers \
  --format iife
```
Upload to Cloudflare dashboard or use wrangler CLI.

### Vercel Serverless
```bash
bunx betterbase function build src/functions/hello/index.ts \
  --target vercel \
  --outdir api/hello
```
Place in `api/` directory for automatic detection.

### Netlify Functions
```bash
bunx betterbase function build src/functions/hello/index.ts \
  --target netlify \
  --outdir netlify/functions/hello
```
Configure in `netlify.toml` if needed.

### Deno Deploy
```bash
bunx betterbase function build src/functions/hello/index.ts \
  --target deno \
  --format esm
```
Upload to Deno Deploy with appropriate permissions.

### Bun.sh
```bash
bunx betterbase function build src/functions/hello/index.ts \
  --target bun
```
Deploy to Bun.sh hosting or Edge runtime.

## Best Practices

### Function Design
1. **Single Responsibility**: Each function should do one thing well
2. **Stateless**: Don't rely on local filesystem persistence
3. **Idempotent**: Safe to retry with same input
4. **Fast Initialization**: Minimize cold start time
5. **Proper Error Handling**: Return structured error responses

### Bundling Optimization
1. **Externalize Heavy Dependentials**: Mark AWS SDK, database clients as external when available in runtime
2. **Use Tree Shaking**: Import only what you need
3. **Minify for Production**: Enable minification in production builds
4. **Source Maps for Dev**: Keep source maps for debugging during development
5. **Watch Files**: Exclude node_modules and build outputs from watch

### Security
1. **Validate Inputs**: Always validate and sanitize event data
2. **Use Environment Secrets**: Never hardcode API keys or tokens
3. **Principle of Least Privilege**: Grant minimal required permissions
4. **Sanitize Outputs**: Prevent injection in responses
5. **Consider Timeouts**: Handle function timeout gracefully

### Testing
1. **Unit Test Handlers**: Test function logic in isolation
2. **Integration Tests**: Test with actual services when possible
3. **Mock Context**: Simulate different context scenarios
4. **Test Edge Cases**: Empty events, malformed data, timeouts
5. **Load Testing**: Verify performance under expected load

### Monitoring & Logging
1. **Structured Logging**: Use consistent log format
2. **Correlation IDs**: Trace requests across functions
3. **Error Alerting**: Set up alerts for function errors
4. **Performance Monitoring**: Track duration and memory usage
5. **Log Retention**: Configure appropriate log retention policies

### Versioning
1. **Semantic Versioning**: Use semantic version for function releases
2. **Aliases**: Use aliases for blue/green deployments
3. **Gradual Rollout**: Deploy to percentage of traffic first
4. **Rollback Plan**: Have procedure to revert to previous version
5. **Change Log**: Maintain history of function changes

## Examples

### Hello World Function
```typescript
// src/functions/hello/index.ts
export default async function handler(event) {
  const name = event?.name || 'World';
  
  return {
    data: { message: `Hello, ${name}!` },
    error: null
  };
}
```

### Database Function
```typescript
// src/functions/user-profile/index.ts
import { drizzle } from 'drizzle-orm/neon';
import { eq } from 'drizzle-orm';
import { users } from '@/db/schema';

export default async function handler(event) {
  const userId = event?.pathParameters?.userId;
  
  if (!userId) {
    return {
      data: null,
      error: 'Missing userId parameter'
    };
  }
  
  try {
    const db = drizzle(process.env.DATABASE_URL);
    const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    
    if (user.length === 0) {
      return {
        data: null,
        error: 'User not found'
      };
    }
    
    return {
      data: user[0],
      error: null
    };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Database error'
    };
  }
}
```

### Webhook Handler
```typescript
// src/functions/webhook-handler/index.ts
import type { BetterBaseResponse } from '@betterbase/shared';

export default async function handler(event): Promise<BetterBaseResponse<unknown>> {
  // Verify webhook signature
  const signature = event.headers?.['x-signature'];
  const secret = process.env.WEBHOOK_SECRET;
  
  if (!verifySignature(event.body, signature, secret)) {
    return {
      data: null,
      error: 'Invalid signature'
    };
  }
  
  try {
    const payload = JSON.parse(event.body);
    
    // Process webhook payload
    await processWebhookEvent(payload);
    
    return {
      data: { received: true },
      error: null
    };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Invalid payload'
    };
  }
}
```

### Scheduled Function
```typescript
// src/functions/daily-report/index.ts
export default async function handler(event) {
  const { scheduleTime } = event;
  
  try {
    // Generate report for previous day
    const report = await generateDailyReport(new Date(scheduleTime));
    
    // Send report via email or store in database
    await deliverReport(report);
    
    return {
      data: { reportId: report.id, generatedAt: new Date().toISOString() },
      error: null
    };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Report generation failed'
    };
  }
}
```

## CLI Commands

The BetterBase CLI provides function-related commands:

```bash
# Build functions
bunx betterbase function build <entry-point> [options]

# Run function locally
bunx betterbase function run <entry-point> [options]

# Watch functions for development
bunx betterbase function watch <directory> [options]

# Deploy functions
bunx betterbase function deploy <entry-point> [options]

# List available targets
bunx betterbase function targets
```

### Build Options
```bash
bunx betterbase function build src/functions/hello/index.ts \
  --target aws-lambda \
  --minify \
  --sourcemap \
  --outdir dist/hello
```

### Run Options
```bash
bunx betterbase function run src/functions/hello/index.ts \
  --event '{"name": "Alice"}' \
  --timeout 5000 \
  --environment NODE_ENV=development
```

### Watch Options
```bash
bunx betterbase function watch src/functions/ \
  --interval 1000 \
  --on-change "echo 'Functions rebuilt'"
```

## Limitations & Considerations

### Bundle Size Limits
Different platforms have different bundle size limits:
- **AWS Lambda**: 50 MB zipped, 250 MB unzipped
- **Cloudflare Workers**: 10 MB total
- **Vercel**: 50 MB for Serverless Functions
- **Netlify**: 50 MB zipped
- **Deno Deploy**: No strict limit but consider performance
- **Bun.sh**: Similar to AWS Lambda limits

### Cold Start Optimization
1. **Keep Functions Small**: Smaller bundles load faster
2. **Minimize Dependencies**: Only include what's needed
3. **Prefer Native Modules**: Avoid native dependencies when possible
4. **Consider Provisioned Concurrency**: For consistent performance (AWS)
5. **Use Edge Runtimes**: Cloudflare Workers, Vercel Edge for near-zero cold start

### Runtime Compatibility
1. **Node.js Version**: Ensure compatibility with target runtime
2. **API Availability**: Some Node.js APIs not available in all runtimes
3. **Global Objects**: Differences in global object availability
4. **File System Access**: Limited or different in serverless environments
5. **Network Restrictions**: Some platforms restrict outbound connections

### Execution Limits
1. **Timeout**: Maximum execution time (varies by platform)
2. **Memory**: Available memory affects cost and performance
3. **Concurrency**: Limits on simultaneous executions
4. **Request/Response Size**: Limits on payload sizes
5. **File System**: Often read-only or limited write access

### Vendor Lock-in Considerations
1. **Abstract Platform Differences**: Use adapters for platform-specific features
2. **Standardize Event Formats**: Create common event interface
3. **Consider Multi-Platform**: Design for deployment to multiple targets
4. **Use Standard Libraries**: Prefer web standards over platform-specific APIs
5. **Have Escape Hatch**: Ability to deploy to VM/container if needed

## Related Modules
- [Configuration](./config.md): For defining function-related configuration
- [Logger](./logger.md): For function logging integration
- [Auto-REST](./auto-rest.md): For generating API endpoints that could replace some functions
- [Webhooks](./webhooks.md): For webhook delivery as alternative to functions
- [Realtime](./realtime.md): For real-time updates as alternative to polling functions
- [Storage](./storage.md): For storing function artifacts or assets