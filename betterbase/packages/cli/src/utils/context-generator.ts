import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { RouteScanner } from './route-scanner';
import { SchemaScanner } from './schema-scanner';

export interface BetterBaseContext {
  version: string;
  generated_at: string;
  tables: Record<string, unknown>;
  routes: Record<string, unknown>;
  ai_prompt: string;
}

export class ContextGenerator {
  async generate(projectRoot: string): Promise<BetterBaseContext> {
    const schemaScanner = new SchemaScanner(path.join(projectRoot, 'src/db/schema.ts'));
    const tables = schemaScanner.scan();

    const routeScanner = new RouteScanner();
    const routes = await routeScanner.scan(path.join(projectRoot, 'src/routes'));

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

  private generateAIPrompt(tables: Record<string, any>, routes: Record<string, any>): string {
    const tableNames = Object.keys(tables);
    const routeCount = Object.values(routes).reduce((count, methods) => count + (Array.isArray(methods) ? methods.length : 0), 0);

    let prompt = `This is a BetterBase backend project with ${tableNames.length} tables and ${routeCount} API endpoints.\n\n`;

    prompt += 'DATABASE SCHEMA:\n';
    for (const tableName of tableNames) {
      const table = tables[tableName];
      const columns = Object.keys(table.columns ?? {}).join(', ');
      prompt += `- ${tableName}: ${columns}\n`;
      if (Array.isArray(table.relations) && table.relations.length > 0) {
        prompt += `  Relations: ${table.relations.join(', ')}\n`;
      }
    }

    prompt += '\nAPI ENDPOINTS:\n';
    for (const [routePath, methods] of Object.entries(routes)) {
      for (const route of methods as Array<{ method: string; requiresAuth: boolean }>) {
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
