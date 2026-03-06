# Document 3: Test Suite Guide
**File:** `03_test_suite.md`

**Runtime: `bun:test` only. Never jest, never vitest.**

**Critical Bun 1.3.9 rules (learned the hard way — do not skip these):**
- `fs/promises access()` resolves to `null`, not `undefined` — use `existsSync()` for file checks
- `mock.module()` does NOT work for built-in Node modules
- `SchemaScanner` and `RouteScanner` take FILE PATHS, not content strings
- `ContextGenerator.generate(projectRoot)` is async, takes a directory path
- Use `port: 0` for integration tests (OS assigns a free port)
- Always pass `skipInstall: true` and `skipGit: true` to init command in tests

**Test file structure:**
```
packages/cli/test/
  smoke.test.ts           ← command registration only
  scanner.test.ts         ← SchemaScanner unit tests
  route-scanner.test.ts   ← RouteScanner unit tests
  context-generator.test.ts ← ContextGenerator unit tests
  dev.test.ts             ← NEW: bb dev hot reload tests
  error-messages.test.ts  ← NEW: error message content tests
Template for every new feature test file:
typescriptimport { describe, it, expect, beforeAll, afterAll } from "bun:test"
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs"
import { existsSync, rmSync } from "node:fs"
import os from "node:os"
import path from "node:path"

// Always use a real temp directory, never mock the filesystem
// This catches path resolution bugs that mocks hide
let tmpDir: string

beforeAll(() => {
  tmpDir = mkdtempSync(path.join(os.tmpdir(), "betterbase-test-"))
})

afterAll(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

describe("FeatureName", () => {
  it("does the thing it should do", async () => {
    // Arrange: set up files in tmpDir
    // Act: call the function
    // Assert: check the result
  })
})
Tests for bb dev hot reload (dev.test.ts):
typescriptimport { describe, it, expect } from "bun:test"
import { existsSync, mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs"
import os from "node:os"
import path from "node:path"

describe("runDevCommand", () => {
  it("returns a cleanup function", async () => {
    const { runDevCommand } = await import("../src/commands/dev")
    const tmpDir = mkdtempSync(path.join(os.tmpdir(), "bb-dev-test-"))

    // Create minimal project structure
    mkdirSync(path.join(tmpDir, "src/db"), { recursive: true })
    mkdirSync(path.join(tmpDir, "src/routes"), { recursive: true })
    writeFileSync(path.join(tmpDir, "src/index.ts"), `
      import { Hono } from "hono"
      const app = new Hono()
      export default { port: 0, fetch: app.fetch }
    `)
    writeFileSync(path.join(tmpDir, "src/db/schema.ts"), "export const schema = {}")

    const cleanup = await runDevCommand(tmpDir)
    expect(typeof cleanup).toBe("function")

    // Cleanup immediately — we don't want a real server running during tests
    cleanup()

    rmSync(tmpDir, { recursive: true, force: true })
  })

  it("logs an error and exits when src/index.ts is missing", async () => {
    const tmpDir = mkdtempSync(path.join(os.tmpdir(), "bb-dev-missing-"))
    // Don't create src/index.ts
    // The command should call process.exit(1)
    // Test this by checking the error logger was called
    // (mock logger.error before calling runDevCommand)
    rmSync(tmpDir, { recursive: true, force: true })
  })
})
Tests for error messages (error-messages.test.ts):
typescriptimport { describe, it, expect } from "bun:test"

describe("Error message quality", () => {
  it("migrate error includes backup path and restore command", () => {
    // Import the error formatting function directly and assert on string content
    const message = buildMigrateErrorMessage("/tmp/backup.db", "/myapp/local.db", "column not found")
    expect(message).toContain("backup")
    expect(message).toContain("/tmp/backup.db")
    expect(message).toContain("cp ")
  })

  it("generate crud error lists available tables when table not found", () => {
    const message = buildTableNotFoundMessage("typo_table", ["users", "posts", "comments"])
    expect(message).toContain("users, posts, comments")
    expect(message).toContain("typo_table")
  })
})
Rule for new features: every new feature gets a test file before it ships.
The test file must cover:

The happy path (feature works correctly)
The main failure mode (what happens when input is wrong)
The cleanup path (no side effects left behind after the test)

How to run tests:
bash# All packages
bun test

# Single package
cd packages/cli && bun test

# Single file
cd packages/cli && bun test test/dev.test.ts

# With coverage
cd packages/cli && bun test --coverage
The 119 passing tests must never drop. If a new feature breaks existing tests, fix the tests or fix the feature — do not skip or comment out tests.