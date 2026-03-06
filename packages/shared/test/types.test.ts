import { describe, it, expect } from "bun:test"
import type {
  SerializedError,
  BetterBaseResponse,
  DBEvent,
  DBEventType,
  ProviderType,
  PaginationParams,
} from "../src/types"

describe("types", () => {
  describe("SerializedError", () => {
    it("should allow creating a serialized error object", () => {
      const error: SerializedError = {
        message: "Something went wrong",
        name: "Error",
        stack: "Error: Something went wrong\n    at test",
      }

      expect(error.message).toBe("Something went wrong")
      expect(error.name).toBe("Error")
      expect(error.stack).toBeDefined()
    })

    it("should allow optional properties", () => {
      const error: SerializedError = {
        message: "Error message",
      }

      expect(error.message).toBe("Error message")
      expect(error.name).toBeUndefined()
      expect(error.stack).toBeUndefined()
    })
  })

  describe("BetterBaseResponse", () => {
    it("should allow creating a response with data", () => {
      const response: BetterBaseResponse<string> = {
        data: "hello",
        error: null,
      }

      expect(response.data).toBe("hello")
      expect(response.error).toBeNull()
    })

    it("should allow creating a response with error", () => {
      const response: BetterBaseResponse<null> = {
        data: null,
        error: "Something went wrong",
      }

      expect(response.data).toBeNull()
      expect(response.error).toBe("Something went wrong")
    })

    it("should allow creating a response with serialized error", () => {
      const response: BetterBaseResponse<null> = {
        data: null,
        error: {
          message: "Validation failed",
          name: "ValidationError",
        },
      }

      expect(response.data).toBeNull()
      expect(typeof response.error).toBe("object")
      if (typeof response.error === "object") {
        expect((response.error as SerializedError).message).toBe("Validation failed")
      }
    })

    it("should allow adding count and pagination", () => {
      const response: BetterBaseResponse<string[]> = {
        data: ["a", "b", "c"],
        error: null,
        count: 3,
        pagination: {
          page: 1,
          pageSize: 10,
          total: 100,
        },
      }

      expect(response.count).toBe(3)
      expect(response.pagination).toBeDefined()
      expect(response.pagination?.page).toBe(1)
      expect(response.pagination?.pageSize).toBe(10)
      expect(response.pagination?.total).toBe(100)
    })
  })

  describe("DBEvent", () => {
    it("should allow creating an INSERT event", () => {
      const event: DBEvent = {
        table: "users",
        type: "INSERT",
        record: { id: 1, name: "John" },
        timestamp: "2024-01-01T00:00:00Z",
      }

      expect(event.table).toBe("users")
      expect(event.type).toBe("INSERT")
      expect(event.record).toEqual({ id: 1, name: "John" })
      expect(event.old_record).toBeUndefined()
    })

    it("should allow creating an UPDATE event with old_record", () => {
      const event: DBEvent = {
        table: "users",
        type: "UPDATE",
        record: { id: 1, name: "Jane" },
        old_record: { id: 1, name: "John" },
        timestamp: "2024-01-01T00:00:00Z",
      }

      expect(event.type).toBe("UPDATE")
      expect(event.old_record).toEqual({ id: 1, name: "John" })
    })

    it("should allow creating a DELETE event", () => {
      const event: DBEvent = {
        table: "users",
        type: "DELETE",
        record: { id: 1 },
        timestamp: "2024-01-01T00:00:00Z",
      }

      expect(event.type).toBe("DELETE")
    })
  })

  describe("DBEventType", () => {
    it("should allow INSERT as a valid DBEventType", () => {
      const type: DBEventType = "INSERT"
      expect(type).toBe("INSERT")
    })

    it("should allow UPDATE as a valid DBEventType", () => {
      const type: DBEventType = "UPDATE"
      expect(type).toBe("UPDATE")
    })

    it("should allow DELETE as a valid DBEventType", () => {
      const type: DBEventType = "DELETE"
      expect(type).toBe("DELETE")
    })
  })

  describe("ProviderType", () => {
    it("should allow neon as a valid provider", () => {
      const provider: ProviderType = "neon"
      expect(provider).toBe("neon")
    })

    it("should allow turso as a valid provider", () => {
      const provider: ProviderType = "turso"
      expect(provider).toBe("turso")
    })

    it("should allow planetscale as a valid provider", () => {
      const provider: ProviderType = "planetscale"
      expect(provider).toBe("planetscale")
    })

    it("should allow supabase as a valid provider", () => {
      const provider: ProviderType = "supabase"
      expect(provider).toBe("supabase")
    })

    it("should allow postgres as a valid provider", () => {
      const provider: ProviderType = "postgres"
      expect(provider).toBe("postgres")
    })

    it("should allow managed as a valid provider", () => {
      const provider: ProviderType = "managed"
      expect(provider).toBe("managed")
    })
  })

  describe("PaginationParams", () => {
    it("should allow creating pagination params with limit only", () => {
      const params: PaginationParams = {
        limit: 10,
      }

      expect(params.limit).toBe(10)
      expect(params.offset).toBeUndefined()
    })

    it("should allow creating pagination params with offset only", () => {
      const params: PaginationParams = {
        offset: 20,
      }

      expect(params.offset).toBe(20)
    })

    it("should allow creating pagination params with both limit and offset", () => {
      const params: PaginationParams = {
        limit: 10,
        offset: 20,
      }

      expect(params.limit).toBe(10)
      expect(params.offset).toBe(20)
    })

    it("should allow empty pagination params", () => {
      const params: PaginationParams = {}

      expect(params.limit).toBeUndefined()
      expect(params.offset).toBeUndefined()
    })
  })
})
