import { existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { RouteScanner, type RouteInfo } from './route-scanner';
import { SchemaScanner, type TableInfo } from './schema-scanner';
import * as logger from './logger';

export interface BetterBaseContext {
  version: string;
  generated_at: string;
  tables: Record<string, TableInfo>;
  routes: Record<string, RouteInfo[]>;
  ai_prompt: string;
}

export class ContextGenerator {
  async generate(projectRoot: string): Promise<BetterBaseContext> {
    const schemaPath = path.join(projectRoot, 'src/db/schema.ts');
    const routesPath = path.join(projectRoot, 'src/routes');

    let tables: Record<string, TableInfo> = {};
    let routes: Record<string, RouteInfo[]> = {};

    if (existsSync(schemaPath)) {
      const schemaScanner = new SchemaScanner(schemaPath);
      tables = schemaScanner.scan();
    } else {
      logger.warn(`Schema file not found; continuing with empty tables: ${schemaPath}`);
    }

    if (existsSync(routesPath)) {
      const routeScanner = new RouteScanner();
      routes = routeScanner.scan(routesPath);
    } else {
      logger.warn(`Routes directory not found; continuing with empty routes: ${routesPath}`);
    }

    const context: BetterBaseContext = {
      version: '1.0.0',
      generated_at: new Date().toISOString(),
      tables,
      routes,
      ai_prompt: this.generateAIPrompt(tables, routes),
    };

    const outputPath = path.join(projectRoot, '.betterbase-context.json');
    writeFileSync(outputPath, `${JSON.stringify(context, null, 2)}\n`);
    console.log(`✅ Generated ${outputPath}`);

    return context;
  }

  private generateAIPrompt(tables: Record<string, TableInfo>, routes: Record<string, RouteInfo[]>): string {
    const tableNames = Object.keys(tables);
    const routeCount = Object.values(routes).reduce((count, methods) => count + methods.length, 0);

    let prompt = `This is a BetterBase backend project with ${tableNames.length} tables and ${routeCount} API endpoints.\n\n`;

    prompt += 'DATABASE SCHEMA:\n';
    for (const tableName of tableNames) {
      const table = tables[tableName];
      const columns = Object.keys(table.columns ?? {}).join(', ');
      prompt += `- ${tableName}: ${columns}\n`;
      if (table.relations.length > 0) {
        prompt += `  Relations: ${table.relations.join(', ')}\n`;
      }
    }

    prompt += '\nAPI ENDPOINTS:\n';
    for (const [routePath, methods] of Object.entries(routes)) {
      for (const route of methods) {
        const auth = route.requiresAuth ? ' [AUTH REQUIRED]' : '';
        prompt += `- ${route.method} ${routePath}${auth}\n`;
      }
    }

    prompt += '\nWhen writing code for this project:\n';
    prompt += "1. Always import tables from './src/db/schema'\n";
    prompt += '2. Use Drizzle ORM for database queries\n';
    prompt += '3. Validate inputs with Zod\n';
    prompt += '4. Return JSON responses with proper status codes\n';

    return prompt;
  }
}
