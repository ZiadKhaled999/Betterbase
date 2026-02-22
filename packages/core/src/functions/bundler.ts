import { existsSync, mkdirSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface BundleResult {
  outputPath: string;
  size: number;
  success: boolean;
  errors: string[];
}

export interface FunctionConfig {
  name: string;
  runtime: 'cloudflare-workers' | 'vercel-edge';
  env: string[];
}

/**
 * Bundle an edge function using Bun's build API.
 * Outputs a single JavaScript file compatible with Cloudflare Workers.
 */
export async function bundleFunction(
  name: string,
  projectRoot: string
): Promise<BundleResult> {
  const functionsDir = join(projectRoot, 'src', 'functions', name);
  const indexPath = join(functionsDir, 'index.ts');
  const outputDir = join(projectRoot, '.betterbase', 'functions');
  const outputPath = join(outputDir, `${name}.js`);

  const errors: string[] = [];

  // Check if function directory exists
  if (!existsSync(functionsDir)) {
    return {
      outputPath: '',
      size: 0,
      success: false,
      errors: [`Function directory not found: ${functionsDir}`],
    };
  }

  // Check if index.ts exists
  if (!existsSync(indexPath)) {
    return {
      outputPath: '',
      size: 0,
      success: false,
      errors: [`Function entry point not found: ${indexPath}`],
    };
  }

  // Ensure output directory exists
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  try {
    // Use Bun.build to bundle the function
    // We use 'browser' target which produces ES modules compatible with Cloudflare Workers
    const result = await Bun.build({
      entrypoints: [indexPath],
      outdir: outputDir,
      target: 'browser',
      format: 'esm',
      splitting: false,
      minify: false,
      sourcemap: 'none',
    });

    // Check for build errors
    if (!result.success) {
      for (const log of result.logs) {
        const logMessage = 'message' in log ? log.message : String(log);
        errors.push(`${logMessage}`);
      }
      return {
        outputPath,
        size: 0,
        success: false,
        errors,
      };
    }

    // Bun outputs index.js by default, rename to function name
    const defaultOutputPath = join(outputDir, 'index.js');
    if (existsSync(defaultOutputPath) && defaultOutputPath !== outputPath) {
      const { renameSync } = await import('node:fs');
      renameSync(defaultOutputPath, outputPath);
    }

    // Check if output file was created
    if (!existsSync(outputPath)) {
      return {
        outputPath,
        size: 0,
        success: false,
        errors: ['Build completed but output file was not created'],
      };
    }

    // Read the output file to get its size
    const outputContent = await readFile(outputPath, 'utf-8');
    const size = Buffer.byteLength(outputContent, 'utf-8');

    return {
      outputPath,
      size,
      success: true,
      errors: [],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      outputPath,
      size: 0,
      success: false,
      errors: [message],
    };
  }
}

/**
 * Read function configuration from config.ts
 */
export async function readFunctionConfig(
  name: string,
  projectRoot: string
): Promise<FunctionConfig | null> {
  const configPath = join(projectRoot, 'src', 'functions', name, 'config.ts');

  if (!existsSync(configPath)) {
    return null;
  }

  try {
    const configContent = await readFile(configPath, 'utf-8');

    // Parse the config using simple regex extraction
    const nameMatch = configContent.match(/name:\s*['"]([^'"]+)['"]/);
    const runtimeMatch = configContent.match(/runtime:\s*(['"])([^'"]+)\1/);
    const envMatch = configContent.match(/env:\s*\[([^\]]*)\]/);

    const runtime = runtimeMatch?.[2] as FunctionConfig['runtime'] | undefined;
    const env: string[] = [];

    if (envMatch) {
      const envStr = envMatch[1];
      const envItems = envStr.match(/['"]([^'"]+)['"]/g);
      if (envItems) {
        for (const item of envItems) {
          env.push(item.replace(/['"]/g, ''));
        }
      }
    }

    return {
      name: nameMatch?.[1] ?? name,
      runtime: runtime ?? 'cloudflare-workers',
      env,
    };
  } catch {
    return null;
  }
}

/**
 * List all functions in the project
 */
export interface FunctionInfo {
  name: string;
  path: string;
  runtime: 'cloudflare-workers' | 'vercel-edge';
  hasConfig: boolean;
}

export async function listFunctions(
  projectRoot: string
): Promise<FunctionInfo[]> {
  const functionsDir = join(projectRoot, 'src', 'functions');

  if (!existsSync(functionsDir)) {
    return [];
  }

  const { readdirSync, statSync } = await import('node:fs');
  const functions: FunctionInfo[] = [];

  try {
    const entries = readdirSync(functionsDir);

    for (const entry of entries) {
      const entryPath = join(functionsDir, entry);
      const stat = statSync(entryPath);

      if (stat.isDirectory()) {
        const config = await readFunctionConfig(entry, projectRoot);
        functions.push({
          name: entry,
          path: entryPath,
          runtime: config?.runtime ?? 'cloudflare-workers',
          hasConfig: config !== null,
        });
      }
    }
  } catch {
    // Directory might not exist, return empty
  }

  return functions;
}

/**
 * Check if a function has been built
 */
export async function isFunctionBuilt(
  name: string,
  projectRoot: string
): Promise<boolean> {
  const outputPath = join(projectRoot, '.betterbase', 'functions', `${name}.js`);
  return existsSync(outputPath);
}
