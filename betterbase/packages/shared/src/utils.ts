/**
 * Validates if a string is a valid project name (slug-safe)
 * Only allows lowercase letters, numbers, and hyphens
 * Must start with a letter and end with a letter or number
 */
export function isValidProjectName(name: string): boolean {
  if (!name || name.length === 0) {
    return false
  }
  // Must start with a letter, contain only lowercase letters, numbers, and hyphens
  // Must end with a letter or number
  const slugPattern = /^[a-z][a-z0-9-]*[a-z0-9]$|^[a-z]$/
  return slugPattern.test(name)
}

/**
 * Converts a snake_case string to camelCase
 */
export function toCamelCase(str: string): string {
  if (!str) return str
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
}

/**
 * Converts a camelCase string to snake_case
 */
export function toSnakeCase(str: string): string {
  if (!str) return str
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)
}

/**
 * Safely parses JSON without throwing
 * Returns null if parsing fails
 */
export function safeJsonParse<T>(str: string): T | null {
  try {
    return JSON.parse(str) as T
  } catch {
    return null
  }
}

/**
 * Formats bytes to human readable string
 * Uses binary units (KiB, MiB, GiB, etc.)
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'

  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  const index = Math.min(i, units.length - 1)

  return `${parseFloat((bytes / Math.pow(k, index)).toFixed(2))} ${units[index]}`
}
