import { readFileSync } from 'node:fs';
import * as ts from 'typescript';
import { z } from 'zod';

export const ColumnTypeSchema = z.enum(['text', 'integer', 'number', 'boolean', 'datetime', 'json', 'blob', 'unknown']);

export const ColumnInfoSchema = z.object({
  name: z.string(),
  type: ColumnTypeSchema,
  nullable: z.boolean(),
  unique: z.boolean(),
  primaryKey: z.boolean(),
  defaultValue: z.string().optional(),
  references: z.string().optional(),
});

export const TableInfoSchema = z.object({
  name: z.string(),
  columns: z.record(z.string(), ColumnInfoSchema),
  relations: z.array(z.string()),
  indexes: z.array(z.string()),
});

export const TablesRecordSchema = z.record(z.string(), TableInfoSchema);

export type ColumnInfo = z.infer<typeof ColumnInfoSchema>;
export type TableInfo = z.infer<typeof TableInfoSchema>;

function unwrapExpression(expression: ts.Expression): ts.Expression {
  let current = expression;

  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isTypeAssertionExpression(current) ||
    ts.isSatisfiesExpression(current)
  ) {
    current = (current as ts.ParenthesizedExpression | ts.AsExpression | ts.TypeAssertion | ts.SatisfiesExpression).expression;
  }

  return current;
}

function getCallName(call: ts.CallExpression): string {
  if (ts.isIdentifier(call.expression)) {
    return call.expression.text;
  }

  if (ts.isPropertyAccessExpression(call.expression)) {
    return call.expression.name.text;
  }

  return '';
}

function getExpressionText(sourceFile: ts.SourceFile, node: ts.Node | undefined): string {
  if (!node) {
    return '';
  }

  return node.getText(sourceFile);
}

export class SchemaScanner {
  private readonly sourceFile: ts.SourceFile;

  constructor(schemaPath: string) {
    let sourceCode: string;

    try {
      sourceCode = readFileSync(schemaPath, 'utf-8');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to read schema file at ${schemaPath}: ${message}`);
    }

    this.sourceFile = ts.createSourceFile(schemaPath, sourceCode, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  }

  scan(): Record<string, TableInfo> {
    const tables: Record<string, TableInfo> = {};

    const visit = (node: ts.Node): void => {
      if (ts.isVariableStatement(node)) {
        for (const declaration of node.declarationList.declarations) {
          if (!ts.isIdentifier(declaration.name) || !declaration.initializer) {
            continue;
          }

          const initializer = unwrapExpression(declaration.initializer);
          if (!ts.isCallExpression(initializer)) {
            continue;
          }

          const functionName = getCallName(initializer);
          if (functionName === 'sqliteTable' || functionName === 'pgTable' || functionName === 'mysqlTable') {
            const tableObj = this.parseTable(initializer);
            const tableKey = tableObj.name || declaration.name.text;
            tables[tableKey] = tableObj;
          }
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(this.sourceFile);

    const validated = TablesRecordSchema.safeParse(tables);
    if (!validated.success) {
      throw new Error(`Schema scanner produced invalid output: ${JSON.stringify(validated.error.format())}`);
    }

    return validated.data;
  }

  private parseTable(callExpression: ts.CallExpression): TableInfo {
    const [nameArg, columnsArg, indexesArg] = callExpression.arguments;
    const tableName = ts.isStringLiteral(nameArg) ? nameArg.text : getExpressionText(this.sourceFile, nameArg);

    const columns: Record<string, ColumnInfo> = {};
    const relations: string[] = [];

    if (columnsArg && ts.isObjectLiteralExpression(columnsArg)) {
      for (const property of columnsArg.properties) {
        if (!ts.isPropertyAssignment(property)) {
          continue;
        }

        const columnName = ts.isIdentifier(property.name)
          ? property.name.text
          : ts.isStringLiteral(property.name)
            ? property.name.text
            : property.name.getText(this.sourceFile);

        const columnInfo = this.parseColumn(columnName, property.initializer);
        columns[columnName] = columnInfo;

        if (columnInfo.references) {
          relations.push(columnInfo.references);
        }
      }
    }

    const indexes = this.parseIndexes(indexesArg);

    return {
      name: tableName,
      columns,
      relations,
      indexes,
    };
  }

  private parseIndexes(indexesArg: ts.Expression | undefined): string[] {
    if (!indexesArg) {
      return [];
    }

    const indexes: string[] = [];
    const indexRoot = unwrapExpression(indexesArg);

    const collectFromObject = (obj: ts.ObjectLiteralExpression): void => {
      for (const property of obj.properties) {
        if (!ts.isPropertyAssignment(property)) {
          continue;
        }

        let value = unwrapExpression(property.initializer);
        while (ts.isCallExpression(value)) {
          const callName = getCallName(value);
          if (callName === 'index' || callName === 'uniqueIndex') {
            const key = ts.isIdentifier(property.name)
              ? property.name.text
              : ts.isStringLiteral(property.name)
                ? property.name.text
                : property.name.getText(this.sourceFile);
            indexes.push(key);
            break;
          }

          if (ts.isPropertyAccessExpression(value.expression)) {
            value = unwrapExpression(value.expression.expression);
            continue;
          }

          break;
        }
      }
    };

    if (ts.isArrowFunction(indexRoot) || ts.isFunctionExpression(indexRoot)) {
      const body = indexRoot.body;
      if (ts.isObjectLiteralExpression(body)) {
        collectFromObject(body);
      }

      if (ts.isBlock(body)) {
        for (const statement of body.statements) {
          if (!ts.isReturnStatement(statement) || !statement.expression) {
            continue;
          }

          const expression = unwrapExpression(statement.expression);
          if (ts.isObjectLiteralExpression(expression)) {
            collectFromObject(expression);
          }
        }
      }
    }

    return indexes;
  }

  private parseColumn(columnName: string, expression: ts.Expression): ColumnInfo {
    let type: ColumnInfo['type'] = 'unknown';
    let nullable = true;
    let unique = false;
    let primaryKey = false;
    let defaultValue: string | undefined;
    let references: string | undefined;

    let current = unwrapExpression(expression);

    while (ts.isCallExpression(current)) {
      const methodName = getCallName(current);

      if (methodName === 'text' || methodName === 'varchar' || methodName === 'char') {
        type = 'text';
      } else if (methodName === 'integer' || methodName === 'int' || methodName === 'bigint' || methodName === 'serial') {
        type = 'integer';
      } else if (methodName === 'real' || methodName === 'numeric' || methodName === 'decimal' || methodName === 'doublePrecision') {
        type = 'number';
      } else if (methodName === 'boolean') {
        type = 'boolean';
      } else if (methodName === 'timestamp' || methodName === 'datetime') {
        type = 'datetime';
      } else if (methodName === 'json' || methodName === 'jsonb') {
        type = 'json';
      } else if (methodName === 'blob') {
        type = 'blob';
      } else if (methodName === 'notNull') {
        nullable = false;
      } else if (methodName === 'unique') {
        unique = true;
      } else if (methodName === 'primaryKey') {
        primaryKey = true;
        nullable = false;
      } else if (methodName.startsWith('default')) {
        defaultValue = getExpressionText(this.sourceFile, current.arguments[0]);
      } else if (methodName === 'references') {
        references = getExpressionText(this.sourceFile, current.arguments[0]);
      }

      if (ts.isPropertyAccessExpression(current.expression)) {
        current = unwrapExpression(current.expression.expression);
        continue;
      }

      break;
    }

    return {
      name: columnName,
      type,
      nullable,
      unique,
      primaryKey,
      defaultValue,
      references,
    };
  }
}
