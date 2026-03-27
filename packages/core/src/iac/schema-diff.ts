import type { SerializedSchema, SerializedTable, SerializedColumn, SerializedIndex } from "./schema-serializer";

export type DiffChangeType =
  | "ADD_TABLE"
  | "DROP_TABLE"
  | "ADD_COLUMN"
  | "DROP_COLUMN"
  | "ALTER_COLUMN"
  | "ADD_INDEX"
  | "DROP_INDEX";

export interface SchemaDiffChange {
  type:       DiffChangeType;
  table:      string;
  column?:    string;
  index?:     string;
  before?:    unknown;
  after?:     unknown;
  destructive: boolean;
}

export interface SchemaDiff {
  changes:        SchemaDiffChange[];
  hasDestructive: boolean;
  isEmpty:        boolean;
}

export function diffSchemas(
  from: SerializedSchema | null,
  to:   SerializedSchema
): SchemaDiff {
  const changes: SchemaDiffChange[] = [];

  const fromTables = new Map<string, SerializedTable>(
    (from?.tables ?? []).map((t) => [t.name, t])
  );
  const toTables = new Map<string, SerializedTable>(
    to.tables.map((t) => [t.name, t])
  );

  // Added tables
  for (const [name, table] of toTables) {
    if (!fromTables.has(name)) {
      changes.push({ type: "ADD_TABLE", table: name, after: table, destructive: false });
      continue;
    }
    // Diff columns within existing table
    const fromTable = fromTables.get(name)!;
    const fromCols  = new Map(fromTable.columns.map((c) => [c.name, c]));
    const toCols    = new Map(table.columns.map((c) => [c.name, c]));

    for (const [col, def] of toCols) {
      if (!fromCols.has(col)) {
        changes.push({ type: "ADD_COLUMN", table: name, column: col, after: def, destructive: false });
      } else {
        const before = fromCols.get(col)!;
        if (before.type !== def.type || before.optional !== def.optional) {
          changes.push({
            type: "ALTER_COLUMN", table: name, column: col,
            before, after: def,
            // Changing type or making required = destructive
            destructive: before.type !== def.type || (before.optional && !def.optional),
          });
        }
      }
    }

    for (const [col, def] of fromCols) {
      if (!toCols.has(col) && !def.system) {
        changes.push({ type: "DROP_COLUMN", table: name, column: col, before: def, destructive: true });
      }
    }

    // Diff indexes
    const fromIdx = new Map(fromTable.indexes.map((i) => [i.name, i]));
    const toIdx   = new Map(table.indexes.map((i) => [i.name, i]));

    for (const [idx] of toIdx) {
      if (!fromIdx.has(idx)) changes.push({ type: "ADD_INDEX", table: name, index: idx, destructive: false });
    }
    for (const [idx] of fromIdx) {
      if (!toIdx.has(idx)) changes.push({ type: "DROP_INDEX", table: name, index: idx, destructive: false });
    }
  }

  // Dropped tables
  for (const [name] of fromTables) {
    if (!toTables.has(name)) {
      changes.push({ type: "DROP_TABLE", table: name, before: fromTables.get(name), destructive: true });
    }
  }

  const hasDestructive = changes.some((c) => c.destructive);
  return { changes, hasDestructive, isEmpty: changes.length === 0 };
}

/** Human-readable summary of a diff */
export function formatDiff(diff: SchemaDiff): string {
  if (diff.isEmpty) return "  No schema changes detected.";

  return diff.changes.map((c) => {
    const prefix = c.destructive ? "⚠ " : "+ ";
    switch (c.type) {
      case "ADD_TABLE":    return `${prefix}ADD TABLE ${c.table}`;
      case "DROP_TABLE":   return `${prefix}DROP TABLE ${c.table}`;
      case "ADD_COLUMN":   return `${prefix}ADD COLUMN ${c.table}.${c.column}`;
      case "DROP_COLUMN":  return `${prefix}DROP COLUMN ${c.table}.${c.column}`;
      case "ALTER_COLUMN": return `${prefix}ALTER COLUMN ${c.table}.${c.column}`;
      case "ADD_INDEX":    return `${prefix}ADD INDEX ${c.table}.${c.index}`;
      case "DROP_INDEX":   return `${prefix}DROP INDEX ${c.table}.${c.index}`;
    }
  }).join("\n");
}
