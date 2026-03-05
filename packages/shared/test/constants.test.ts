import { describe, it, expect } from "bun:test"
import {
  BETTERBASE_VERSION,
  DEFAULT_PORT,
  DEFAULT_DB_PATH,
  CONTEXT_FILE_NAME,
  CONFIG_FILE_NAME,
  MIGRATIONS_DIR,
  FUNCTIONS_DIR,
  POLICIES_DIR,
} from "../src/constants"

describe("constants", () => {
  describe("BETTERBASE_VERSION", () => {
    it("should export the correct version string", () => {
      expect(BETTERBASE_VERSION).toBe("0.1.0")
    })

    it("should be a non-empty string", () => {
      expect(typeof BETTERBASE_VERSION).toBe("string")
      expect(BETTERBASE_VERSION.length).toBeGreaterThan(0)
    })
  })

  describe("DEFAULT_PORT", () => {
    it("should export the correct default port", () => {
      expect(DEFAULT_PORT).toBe(3000)
    })

    it("should be a valid HTTP port number", () => {
      expect(DEFAULT_PORT).toBeGreaterThan(0)
      expect(DEFAULT_PORT).toBeLessThan(65536)
    })
  })

  describe("DEFAULT_DB_PATH", () => {
    it("should export the correct default database path", () => {
      expect(DEFAULT_DB_PATH).toBe("local.db")
    })

    it("should be a non-empty string", () => {
      expect(typeof DEFAULT_DB_PATH).toBe("string")
      expect(DEFAULT_DB_PATH.length).toBeGreaterThan(0)
    })
  })

  describe("CONTEXT_FILE_NAME", () => {
    it("should export the correct context file name", () => {
      expect(CONTEXT_FILE_NAME).toBe(".betterbase-context.json")
    })

    it("should be a valid file name with json extension", () => {
      expect(CONTEXT_FILE_NAME).toMatch(/\.json$/)
    })
  })

  describe("CONFIG_FILE_NAME", () => {
    it("should export the correct config file name", () => {
      expect(CONFIG_FILE_NAME).toBe("betterbase.config.ts")
    })

    it("should be a TypeScript file", () => {
      expect(CONFIG_FILE_NAME).toEndWith(".ts")
    })
  })

  describe("MIGRATIONS_DIR", () => {
    it("should export the correct migrations directory name", () => {
      expect(MIGRATIONS_DIR).toBe("drizzle")
    })

    it("should be a non-empty string", () => {
      expect(typeof MIGRATIONS_DIR).toBe("string")
      expect(MIGRATIONS_DIR.length).toBeGreaterThan(0)
    })
  })

  describe("FUNCTIONS_DIR", () => {
    it("should export the correct functions directory path", () => {
      expect(FUNCTIONS_DIR).toBe("src/functions")
    })

    it("should be a valid directory path", () => {
      expect(FUNCTIONS_DIR).toMatch(/^[^/]+\/[^/]+$/)
    })
  })

  describe("POLICIES_DIR", () => {
    it("should export the correct policies directory path", () => {
      expect(POLICIES_DIR).toBe("src/db/policies")
    })

    it("should be a valid directory path", () => {
      expect(POLICIES_DIR).toMatch(/^[^/]+\/[^/]+$/)
    })
  })
})
