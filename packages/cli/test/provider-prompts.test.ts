import { describe, it, expect } from "bun:test"
import * as providerPrompts from "../src/utils/provider-prompts"
import type { ProviderType } from "@betterbase/shared"

describe("Provider prompts", () => {
  describe("promptForProvider", () => {
    it("is a function that can be imported", () => {
      expect(typeof providerPrompts.promptForProvider).toBe("function")
    })
  })

  describe("generateEnvContent", () => {
    it("generates env content for neon provider", () => {
      const content = providerPrompts.generateEnvContent("neon", {
        DATABASE_URL: "postgresql://user:pass@host.neon.tech/db",
      })

      expect(content).toContain("NODE_ENV=development")
      expect(content).toContain("PORT=3000")
      expect(content).toContain("Database Provider: Neon")
      expect(content).toContain("DATABASE_URL=postgresql://user:pass@host.neon.tech/db")
    })

    it("generates env content for turso provider", () => {
      const content = providerPrompts.generateEnvContent("turso", {
        TURSO_URL: "libsql://my-db.turso.io",
        TURSO_AUTH_TOKEN: "my-token",
      })

      expect(content).toContain("Database Provider: Turso")
      expect(content).toContain("TURSO_URL=libsql://my-db.turso.io")
      expect(content).toContain("TURSO_AUTH_TOKEN=my-token")
    })

    it("generates env content for planetscale provider", () => {
      const content = providerPrompts.generateEnvContent("planetscale", {
        DATABASE_URL: "mysql://user:pass@host.planetscale.com/db",
      })

      expect(content).toContain("Database Provider: PlanetScale")
      expect(content).toContain("DATABASE_URL=mysql://user:pass@host.planetscale.com/db")
    })

    it("generates env content for supabase provider", () => {
      const content = providerPrompts.generateEnvContent("supabase", {
        DATABASE_URL: "postgresql://user:pass@db.supabase.co/db",
      })

      expect(content).toContain("Database Provider: Supabase")
      expect(content).toContain("DATABASE_URL=postgresql://user:pass@db.supabase.co/db")
    })

    it("generates env content for postgres provider", () => {
      const content = providerPrompts.generateEnvContent("postgres", {
        DATABASE_URL: "postgresql://localhost:5432/mydb",
      })

      expect(content).toContain("Database Provider: PostgreSQL")
      expect(content).toContain("DATABASE_URL=postgresql://localhost:5432/mydb")
    })

    it("handles empty env vars", () => {
      const content = providerPrompts.generateEnvContent("neon", {})

      expect(content).toContain("DATABASE_URL=")
    })
  })

  describe("generateEnvExampleContent", () => {
    it("generates env example for neon provider", () => {
      const content = providerPrompts.generateEnvExampleContent("neon")

      expect(content).toContain("NODE_ENV=development")
      expect(content).toContain("DATABASE_URL=")
    })

    it("generates env example for turso provider", () => {
      const content = providerPrompts.generateEnvExampleContent("turso")

      expect(content).toContain("TURSO_URL=")
      expect(content).toContain("TURSO_AUTH_TOKEN=")
    })

    it("generates env example for all provider types", () => {
      const providers: ProviderType[] = ["neon", "turso", "planetscale", "supabase", "postgres", "managed"]

      for (const provider of providers) {
        const content = providerPrompts.generateEnvExampleContent(provider)
        expect(content).toContain("NODE_ENV=development")
        expect(content).toContain("PORT=3000")
      }
    })
  })

  describe("promptForStorage", () => {
    it("is a function that can be imported", () => {
      expect(typeof providerPrompts.promptForStorage).toBe("function")
    })
  })

  describe("ProviderPromptResult interface", () => {
    it("defines providerType and envVars properties", () => {
      const result: providerPrompts.ProviderPromptResult = {
        providerType: "neon",
        envVars: { DATABASE_URL: "test-url" },
      }

      expect(result.providerType).toBe("neon")
      expect(result.envVars).toHaveProperty("DATABASE_URL")
    })
  })
})
