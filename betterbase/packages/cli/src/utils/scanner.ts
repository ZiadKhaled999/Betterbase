import { readFileSync } from 'node:fs';
import * as ts from 'typescript';

export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  unique: boolean;
  primaryKey: boolean;
  defaultValue?: string;
  references?: string;
}

export interface TableInfo {
  name: string;
  columns: Record<string, ColumnInfo>;
  relations: string[];
  indexes: string[];
}

function unwrapExpression(expression: ts.Expression): ts.Expression {
  let current = expression;

  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isTypeAssertionExpression(current) ||
    ts.isSatisfiesExpression(current)
  ) {
    if (ts.isParenthesizedExpression(current)) {
      current = current.expression;
      continue;
    }

    if (ts.isAsExpression(current) || ts.isTypeAssertionExpression(current) || ts.isSatisfiesExpression(current)) {
      current = current.expression;
      continue;
    }
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
    const sourceCode = readFileSync(schemaPath, 'utf-8');
    this.sourceFile = ts.createSourceFile('schema.ts', sourceCode, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
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
            tables[declaration.name.text] = this.parseTable(initializer);
          }
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(this.sourceFile);
    return tables;
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

        const value = unwrapExpression(property.initializer);
        if (!ts.isCallExpression(value)) {
          continue;
        }

        const callName = getCallName(value);
        if (callName === 'index' || callName === 'uniqueIndex') {
          const key = ts.isIdentifier(property.name)
            ? property.name.text
            : ts.isStringLiteral(property.name)
              ? property.name.text
              : property.name.getText(this.sourceFile);
          indexes.push(key);
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
    let type = 'unknown';
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
