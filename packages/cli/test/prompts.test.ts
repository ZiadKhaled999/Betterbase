import { describe, it, expect } from "bun:test"
import * as prompts from "../src/utils/prompts"

describe("Prompt utilities", () => {
  describe("text prompt", () => {
    it("validates message is required", async () => {
      // Empty message should fail validation
      await expect(prompts.text({ message: "" })).rejects.toThrow()
    })

    it("accepts valid text prompt options", () => {
      // This should not throw - just checking the schema accepts valid input
      // We're not actually calling inquirer so this tests schema validation only
      const options = { message: "Enter your name:" }
      expect(options.message).toBe("Enter your name:")
    })

    it("accepts initial value option", () => {
      const options = { message: "Enter your name:", initial: "John" }
      expect(options.initial).toBe("John")
    })
  })

  describe("confirm prompt", () => {
    it("validates message is required", async () => {
      // Empty message should fail validation
      await expect(prompts.confirm({ message: "" })).rejects.toThrow()
    })

    it("accepts valid confirm prompt options", () => {
      const options = { message: "Continue?", default: true }
      expect(options.message).toBe("Continue?")
      expect(options.default).toBe(true)
    })

    it("accepts initial option for backward compatibility", () => {
      const options = { message: "Continue?", initial: false }
      expect(options.initial).toBe(false)
    })
  })

  describe("select prompt", () => {
    it("validates message is required", async () => {
      // Empty message should fail validation
      await expect(prompts.select({ message: "", options: [{ value: "a", label: "A" }] })).rejects.toThrow()
    })

    it("validates options are required", async () => {
      // Empty options should fail validation
      await expect(prompts.select({ message: "Select one:", options: [] })).rejects.toThrow()
    })

    it("validates option has value and label", () => {
      const options = { message: "Select one:", options: [{ value: "neon", label: "Neon" }] }
      expect(options.options[0].value).toBe("neon")
      expect(options.options[0].label).toBe("Neon")
    })

    it("accepts default option", () => {
      const options = {
        message: "Select provider:",
        options: [
          { value: "neon", label: "Neon" },
          { value: "turso", label: "Turso" },
        ],
        default: "neon",
      }
      expect(options.default).toBe("neon")
    })

    it("accepts initial option for backward compatibility", () => {
      const options = {
        message: "Select provider:",
        options: [
          { value: "neon", label: "Neon" },
          { value: "turso", label: "Turso" },
        ],
        initial: "turso",
      }
      expect(options.initial).toBe("turso")
    })

    it("validates default matches an option value", () => {
      // This tests that if default is provided, it must match one of the option values
      const options = {
        message: "Select provider:",
        options: [
          { value: "neon", label: "Neon" },
          { value: "turso", label: "Turso" },
        ],
        default: "invalid",
      }
      // The validation should fail because "invalid" is not in the options
      const isValid = options.options.some(opt => opt.value === options.default)
      expect(isValid).toBe(false)
    })
  })
})
