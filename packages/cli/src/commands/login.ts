import path from "node:path"
import fs from "node:fs/promises"
import { existsSync } from "node:fs"
import os from "node:os"
import { info, success, error as logError, warn } from "../utils/logger"

export interface Credentials {
  token: string
  email: string
  userId: string
  expiresAt: string
}

/* 
// ── bb login — STAGED FOR ACTIVATION ────────────────────────────────────────
// This code is complete and tested. Uncomment when app.betterbase.com is live.
// See: betterbase_backend_rebuild.md Part 3
// ────────────────────────────────────────────────────────────────────────────

const BETTERBASE_API = process.env.BETTERBASE_API_URL ?? "https://app.betterbase.com"
const CREDENTIALS_PATH = path.join(os.homedir(), ".betterbase", "credentials.json")
const POLL_INTERVAL_MS = 2000
const POLL_TIMEOUT_MS = 300000  // 5 minutes

// runLoginCommand
// Authenticates the CLI with app.betterbase.com via browser OAuth flow.
export async function runLoginCommand(): Promise<void> {
  // Check if already logged in
  const existing = await getCredentials()
  if (existing) {
    info(`Already logged in as ${existing.email}`)
    info("Run bb logout to sign out.")
    return
  }

  // Generate a one-time device code
  const code = generateDeviceCode()
  const authUrl = `${BETTERBASE_API}/cli/auth?code=${code}`

  info("Opening browser for authentication...")
  info(`Auth URL: ${authUrl}`)
  info("Waiting for authentication... (timeout: 5 minutes)")

  // Try to open the browser
  await openBrowser(authUrl)

  // Poll for authentication
  const credentials = await pollForAuth(code)

  if (!credentials) {
    logError("Authentication timed out. Run bb login to try again.")
    process.exit(1)
  }

  // Store credentials
  await saveCredentials(credentials)
  success(`Logged in as ${credentials.email}`)
}

// runLogoutCommand
// Removes stored credentials.
export async function runLogoutCommand(): Promise<void> {
  if (existsSync(CREDENTIALS_PATH)) {
    await fs.unlink(CREDENTIALS_PATH)
    success("Logged out successfully.")
  } else {
    warn("Not currently logged in.")
  }
}

// getCredentials
// Reads stored credentials from ~/.betterbase/credentials.json
// Returns null if not logged in or credentials expired.
export async function getCredentials(): Promise<Credentials | null> {
  if (!existsSync(CREDENTIALS_PATH)) return null
  try {
    const raw = await fs.readFile(CREDENTIALS_PATH, "utf-8")
    const creds = JSON.parse(raw) as Credentials
    if (new Date(creds.expiresAt) < new Date()) return null
    return creds
  } catch {
    return null
  }
}

// requireCredentials
// Used by commands that require authentication (like bb init in managed mode).
// Exits with a helpful message if not logged in.
export async function requireCredentials(): Promise<Credentials> {
  const creds = await getCredentials()
  if (!creds) {
    logError(
      "Not logged in. Run: bb login\n" +
      "This connects your CLI with app.betterbase.com so your project\n" +
      "can be registered and managed from the dashboard."
    )
    process.exit(1)
  }
  return creds
}

// Internal helpers

function generateDeviceCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  const part1 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("")
  const part2 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("")
  return `${part1}-${part2}`
}

async function openBrowser(url: string): Promise<void> {
  const { platform } = process
  try {
    if (platform === "darwin") {
      const { execSync } = await import("child_process")
      execSync(`open "${url}"`, { stdio: "ignore" })
    } else if (platform === "win32") {
      const { execSync } = await import("child_process")
      execSync(`start "" "${url}"`, { stdio: "ignore" })
    } else {
      const { execSync } = await import("child_process")
      execSync(`xdg-open "${url}"`, { stdio: "ignore" })
    }
  } catch {
    // Browser open failed — URL already printed, user can open manually
  }
}

async function pollForAuth(code: string): Promise<Credentials | null> {
  const startTime = Date.now()

  while (Date.now() - startTime < POLL_TIMEOUT_MS) {
    await sleep(POLL_INTERVAL_MS)

    try {
      const response = await fetch(
        `${BETTERBASE_API}/api/cli/auth/poll?code=${code}`
      )

      if (response.status === 200) {
        const data = await response.json() as {
          token: string
          email: string
          userId: string
          expiresAt: string
        }
        return data
      }
      // 202 = still pending, continue polling
      // Any other status = error, continue polling until timeout
    } catch {
      // Network error — continue polling
    }
  }

  return null
}

async function saveCredentials(creds: Credentials): Promise<void> {
  const dir = path.dirname(CREDENTIALS_PATH)
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(CREDENTIALS_PATH, JSON.stringify(creds, null, 2), "utf-8")
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

*/
