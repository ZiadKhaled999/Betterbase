import type { SchemaDiff, SchemaDiffChange } from "../schema-diff";
import type { SerializedColumn } from "../schema-serializer";

function colTypeToSQL(type: string): string {
  if (type === "number")  return "REAL";
  if (type === "int64")   return "BIGINT";
  if (type === "boolean") return "BOOLEAN";
  if (type === "date")    return "TIMESTAMPTZ";
  if (type.startsWith("array:") || type === "object") return "JSONB";
  return "TEXT";  // default: string, id:*, literal:*, union:*
}

function changeToSQL(change: SchemaDiffChange): string[] {
  switch (change.type) {
    case "ADD_TABLE": {
      const t = change.after as { columns: SerializedColumn[] };
      const cols = t.columns.map((c) => {
        let line = `  "${c.name}" ${colTypeToSQL(c.type)}`;
        if (c.name === "_id")         line += " PRIMARY KEY";
        else if (!c.optional)         line += " NOT NULL";
        if (c.name === "_createdAt")  line += " DEFAULT NOW()";
        if (c.name === "_updatedAt")   line += " DEFAULT NOW()";
        return line;
      });
      return [`CREATE TABLE IF NOT EXISTS "${change.table}" (\n${cols.join(",\n")}\n);`];
    }

    case "DROP_TABLE":
      return [`DROP TABLE IF EXISTS "${change.table}";`];

    case "ADD_COLUMN": {
      const col = change.after as SerializedColumn;
      const nullable = col.optional ? "" : " NOT NULL";
      return [`ALTER TABLE "${change.table}" ADD COLUMN "${col.name}" ${colTypeToSQL(col.type)}${nullable};`];
    }

    case "DROP_COLUMN":
      return [`ALTER TABLE "${change.table}" DROP COLUMN "${change.column}";`];

    case "ALTER_COLUMN": {
      const after = change.after as SerializedColumn;
      return [
        `ALTER TABLE "${change.table}" ALTER COLUMN "${change.column}" TYPE ${colTypeToSQL(after.type)} USING "${change.column}"::${colTypeToSQL(after.type)};`,
      ];
    }

    case "ADD_INDEX": {
      return [`CREATE INDEX IF NOT EXISTS "${change.table}_${change.index}" ON "${change.table}" ("${change.index}");`];
    }

    case "DROP_INDEX":
      return [`DROP INDEX IF EXISTS "${change.table}_${change.index}";`];
  }
}

export interface GeneratedMigration {
  filename: string;
  sql:      string;
}

export function generateMigration(
  diff:    SchemaDiff,
  seq:     number,   // next migration sequence number (e.g. 5)
  label:   string    // short label for filename
): GeneratedMigration {
  const filename = String(seq).padStart(4, "0") + `_${label.replace(/\s+/g, "_").toLowerCase()}.sql`;

  const up: string[] = [
    `-- BetterBase IaC Auto-Migration`,
    `-- Generated: ${new Date().toISOString()}`,
    ``,
  ];

  for (const change of diff.changes) {
    up.push(...changeToSQL(change));
    up.push("");
  }

  return { filename, sql: up.join("\n") };
}
