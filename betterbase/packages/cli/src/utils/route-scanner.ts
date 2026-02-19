import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import * as ts from 'typescript';

export interface RouteInfo {
  method: string;
  path: string;
  requiresAuth: boolean;
  inputSchema?: string;
  outputSchema?: string;
}

function getStringLiteral(node: ts.Node | undefined): string {
  if (!node) return '';
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  return node.getText();
}

function collectTsFiles(dir: string): string[] {
  const files: string[] = [];

  const walk = (current: string): void => {
    let entries: ReturnType<typeof readdirSync>;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }

      if (entry.isFile() && entry.name.endsWith('.ts')) {
        files.push(fullPath);
      }
    }
  };

  walk(dir);
  return files;
}

export class RouteScanner {
  async scan(routesDir: string): Promise<Record<string, RouteInfo[]>> {
    const files = collectTsFiles(routesDir);
    const routes: Record<string, RouteInfo[]> = {};

    for (const file of files) {
      const fileRoutes = this.scanFile(file);
      for (const [routePath, entries] of Object.entries(fileRoutes)) {
        routes[routePath] = [...(routes[routePath] ?? []), ...entries];
      }
    }

    return routes;
  }

  private scanFile(filePath: string): Record<string, RouteInfo[]> {
    const sourceCode = readFileSync(filePath, 'utf-8');
    const sourceFile = ts.createSourceFile(filePath, sourceCode, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

    const routes: Record<string, RouteInfo[]> = {};
    const authIdentifiers = new Set<string>();

    const isAuthMiddlewareExpression = (expr: ts.Expression): boolean => {
      if (ts.isIdentifier(expr)) {
        return authIdentifiers.has(expr.text) || /auth/i.test(expr.text);
      }

      if (ts.isPropertyAccessExpression(expr)) {
        const text = expr.getText(sourceFile);
        return /auth/i.test(text);
      }

      return false;
    };

    const collectAuthIdentifiers = (node: ts.Node): void => {
      if (!ts.isVariableStatement(node)) return;

      for (const declaration of node.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name) || !declaration.initializer) continue;
        const initializer = declaration.initializer;
        if (ts.isCallExpression(initializer) && ts.isIdentifier(initializer.expression)) {
          if (initializer.expression.text === 'createMiddleware' || initializer.expression.text === 'requireAuth') {
            authIdentifiers.add(declaration.name.text);
          }
        }

        if (/auth/i.test(declaration.name.text)) {
          authIdentifiers.add(declaration.name.text);
        }
      }
    };

    ts.forEachChild(sourceFile, collectAuthIdentifiers);

    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const method = node.expression.name.text.toLowerCase();
        const httpMethods = new Set(['get', 'post', 'put', 'patch', 'delete', 'options', 'head']);

        if (httpMethods.has(method)) {
          const [pathArg, ...handlerArgs] = node.arguments;
          const routePath = getStringLiteral(pathArg);

          let requiresAuth = false;
          for (const arg of handlerArgs) {
            if (isAuthMiddlewareExpression(arg)) {
              requiresAuth = true;
              break;
            }
          }

          const route: RouteInfo = {
            method: method.toUpperCase(),
            path: routePath,
            requiresAuth,
            inputSchema: this.findSchemaUsage(sourceFile, handlerArgs, 'input'),
            outputSchema: this.findSchemaUsage(sourceFile, handlerArgs, 'output'),
          };

          if (!routes[routePath]) {
            routes[routePath] = [];
          }

          routes[routePath].push(route);
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return routes;
  }

  private findSchemaUsage(sourceFile: ts.SourceFile, args: ts.NodeArray<ts.Expression>, mode: 'input' | 'output'): string | undefined {
    const text = args.map((arg) => arg.getText(sourceFile)).join('\n');

    if (mode === 'input') {
      const parseMatch = text.match(/([A-Za-z0-9_]+Schema)\.(safeParse|parse)\(/);
      if (parseMatch) return parseMatch[1];
      const middlewareMatch = text.match(/parseBody\(([^,]+),/);
      if (middlewareMatch) return middlewareMatch[1].trim();
    }

    if (mode === 'output') {
      const outputMatch = text.match(/([A-Za-z0-9_]+Schema)\.(parse|safeParse)\([^)]*c\.json/);
      if (outputMatch) return outputMatch[1];
    }

    return undefined;
  }
}
