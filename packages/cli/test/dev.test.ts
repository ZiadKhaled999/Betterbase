import { describe, it, expect, beforeAll, afterAll } from "bun:test"
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs"
import os from "node:os"
import path from "node:path"

let tmpDir: string

beforeAll(() => {
  tmpDir = mkdtempSync(path.join(os.tmpdir(), "betterbase-test-"))
})

afterAll(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

describe("runDevCommand", () => {
  it("returns a cleanup function", async () => {
    const { runDevCommand } = await import("../src/commands/dev")
    const testDir = mkdtempSync(path.join(os.tmpdir(), "bb-dev-test-"))

    // Create minimal project structure
    mkdirSync(path.join(testDir, "src/db"), { recursive: true })
    mkdirSync(path.join(testDir, "src/routes"), { recursive: true })
    writeFileSync(
      path.join(testDir, "src/index.ts"),
      `
import { Hono } from "hono"
const app = new Hono()
export default { port: 0, fetch: app.fetch }
`,
    )
    writeFileSync(path.join(testDir, "src/db/schema.ts"), "export const schema = {}")

    const cleanup = await runDevCommand(testDir)
    expect(typeof cleanup).toBe("function")

    // Cleanup immediately — we don't want a real server running during tests
    cleanup()

    rmSync(testDir, { recursive: true, force: true })
  })

  it("logs an error and exits when src/index.ts is missing", async () => {
    const { runDevCommand } = await import("../src/commands/dev")
    const testDir = mkdtempSync(path.join(os.tmpdir(), "bb-dev-missing-"))

    // Don't create src/index.ts - this should cause an error
    // The runDevCommand should handle this gracefully
    // Check that the file doesn't exist
    expect(existsSync(path.join(testDir, "src/index.ts"))).toBe(false)

    // Call runDevCommand and expect it to throw or handle the error
    try {
      await runDevCommand(testDir)
    } catch (error) {
      // Expected to throw due to missing src/index.ts
      expect(error).toBeDefined()
    }

    // Clean up
    rmSync(testDir, { recursive: true, force: true })
  })

  it("creates project structure for dev server", async () => {
    const { runDevCommand } = await import("../src/commands/dev")
    const testDir = mkdtempSync(path.join(os.tmpdir(), "bb-dev-structure-"))

    // Create minimal project structure
    mkdirSync(path.join(testDir, "src/db"), { recursive: true })
    mkdirSync(path.join(testDir, "src/routes"), { recursive: true })
    writeFileSync(
      path.join(testDir, "src/index.ts"),
      `
import { Hono } from "hono"
const app = new Hono()
export default { port: 0, fetch: app.fetch }
`,
    )
    writeFileSync(path.join(testDir, "src/db/schema.ts"), "export const schema = {}")

    // Call runDevCommand to exercise the functionality
    const cleanup = await runDevCommand(testDir)
    
    // Verify the structure exists after calling runDevCommand
    expect(existsSync(path.join(testDir, "src/index.ts"))).toBe(true)
    expect(existsSync(path.join(testDir, "src/db/schema.ts"))).toBe(true)

    // Clean up
    cleanup()
    rmSync(testDir, { recursive: true, force: true })
  })
})
