Document 2: Better Error Messages
File: 02_better_error_messages.md
The goal: every error in the CLI tells the developer what went wrong AND what to do next. No raw stack traces, no generic "something failed" messages.
The pattern to follow everywhere:
typescript// BAD — raw error, no guidance
logger.error(error.message)

// GOOD — what failed + what to do
logger.error(
  `Database connection failed.\n` +
  `Check your DATABASE_URL in .env\n` +
  `Current value: ${process.env.DATABASE_URL ?? "(not set)"}`
)
Errors to fix by command:
bb init — when dependency installation fails:
typescriptlogger.error(
  `Failed to install dependencies.\n` +
  `Try running manually: cd ${projectName} && bun install\n` +
  `Error: ${message}`
)
bb migrate — when no schema file found:
typescriptlogger.error(
  `Schema file not found: src/db/schema.ts\n` +
  `Run bb migrate from your project root.\n` +
  `Current directory: ${process.cwd()}`
)
bb migrate — when migration fails:
typescriptlogger.error(
  `Migration failed.\n` +
  `A backup was saved to: ${backupPath}\n` +
  `To restore: cp ${backupPath} ${dbPath}\n` +
  `Error: ${message}`
)
bb generate crud — when table not found in schema:
typescriptlogger.error(
  `Table "${tableName}" not found in src/db/schema.ts\n` +
  `Available tables: ${availableTables.join(", ")}\n` +
  `Check the table name and try again.`
)
bb auth setup — when BetterAuth not installed:
typescriptlogger.error(
  `better-auth is not installed.\n` +
  `Run: bun add better-auth\n` +
  `Then run bb auth setup again.`
)
bb login — when poll times out:
typescriptlogger.error(
  `Authentication timed out after 5 minutes.\n` +
  `Run bb login to try again.\n` +
  `If the browser did not open, visit:\n  ${authUrl}`
)
bb dev — when port is already in use (detect from server crash output):
typescriptlogger.error(
  `Port 3000 is already in use.\n` +
  `Stop the other process or change PORT in your .env file.`
)
```

**The rule: every `logger.error()` call in every command file must have three parts:**
1. What failed (specific, not generic)
2. Why it probably failed (most common cause)
3. What to do next (exact command or action)

**Files to audit and update:**
- `packages/cli/src/commands/init.ts`
- `packages/cli/src/commands/migrate.ts`
- `packages/cli/src/commands/generate.ts`
- `packages/cli/src/commands/auth.ts`
- `packages/cli/src/commands/dev.ts`
- `packages/cli/src/commands/login.ts`

---