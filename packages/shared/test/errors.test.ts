import { describe, it, expect } from "bun:test"
import {
  BetterBaseError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
} from "../src/errors"

describe("errors", () => {
  describe("BetterBaseError", () => {
    it("should create an error with message, code, and default status code", () => {
      const error = new BetterBaseError("Something went wrong", "ERROR_CODE")

      expect(error.message).toBe("Something went wrong")
      expect(error.code).toBe("ERROR_CODE")
      expect(error.statusCode).toBe(500)
      expect(error.name).toBe("BetterBaseError")
    })

    it("should create an error with custom status code", () => {
      const error = new BetterBaseError("Bad request", "BAD_REQUEST", 400)

      expect(error.message).toBe("Bad request")
      expect(error.code).toBe("BAD_REQUEST")
      expect(error.statusCode).toBe(400)
    })

    it("should be an instance of Error", () => {
      const error = new BetterBaseError("Error", "ERROR")
      expect(error).toBeInstanceOf(Error)
    })

    it("should have stack trace", () => {
      const error = new BetterBaseError("Error", "ERROR")
      expect(error.stack).toBeDefined()
    })
  })

  describe("ValidationError", () => {
    it("should create a validation error with correct defaults", () => {
      const error = new ValidationError("Invalid email")

      expect(error.message).toBe("Invalid email")
      expect(error.code).toBe("VALIDATION_ERROR")
      expect(error.statusCode).toBe(400)
      expect(error.name).toBe("ValidationError")
    })

    it("should be an instance of BetterBaseError", () => {
      const error = new ValidationError("Invalid input")
      expect(error).toBeInstanceOf(BetterBaseError)
    })

    it("should be an instance of Error", () => {
      const error = new ValidationError("Invalid input")
      expect(error).toBeInstanceOf(Error)
    })
  })

  describe("NotFoundError", () => {
    it("should create a not found error with formatted message", () => {
      const error = new NotFoundError("User")

      expect(error.message).toBe("User not found")
      expect(error.code).toBe("NOT_FOUND")
      expect(error.statusCode).toBe(404)
      expect(error.name).toBe("NotFoundError")
    })

    it("should create error for different resources", () => {
      const error = new NotFoundError("Project")

      expect(error.message).toBe("Project not found")
    })

    it("should be an instance of BetterBaseError", () => {
      const error = new NotFoundError("Resource")
      expect(error).toBeInstanceOf(BetterBaseError)
    })

    it("should be an instance of Error", () => {
      const error = new NotFoundError("Resource")
      expect(error).toBeInstanceOf(Error)
    })
  })

  describe("UnauthorizedError", () => {
    it("should create an unauthorized error with default message", () => {
      const error = new UnauthorizedError()

      expect(error.message).toBe("Unauthorized")
      expect(error.code).toBe("UNAUTHORIZED")
      expect(error.statusCode).toBe(401)
      expect(error.name).toBe("UnauthorizedError")
    })

    it("should create an unauthorized error with custom message", () => {
      const error = new UnauthorizedError("Token expired")

      expect(error.message).toBe("Token expired")
      expect(error.code).toBe("UNAUTHORIZED")
      expect(error.statusCode).toBe(401)
    })

    it("should be an instance of BetterBaseError", () => {
      const error = new UnauthorizedError()
      expect(error).toBeInstanceOf(BetterBaseError)
    })

    it("should be an instance of Error", () => {
      const error = new UnauthorizedError()
      expect(error).toBeInstanceOf(Error)
    })
  })
})
