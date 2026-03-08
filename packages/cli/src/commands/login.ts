import path from "node:path"
import fs from "node:fs/promises"
import { existsSync } from "node:fs"
import os from "node:os"
import { info, success, error as logError, warn } from "../utils/logger"
import { randomBytes } from "node:crypto"

export interface Credentials {
  token: string
  email: string
  userId: string
  expiresAt: string
}

const BETTERBASE_API = process.env.BETTERBASE_API_URL ?? "https://gzmqjmgomlkpwntbivox.supabase.co/functions/v1"
const AUTH_PAGE_URL = process.env.BETTERBASE_AUTH_PAGE_URL ?? "https://betterbaseauthpage.vercel.app"
const CREDENTIALS_PATH = path.join(os.homedir(), ".betterbase", "credentials.json")
const POLL_INTERVAL_MS = 2000
const POLL_TIMEOUT_MS = 300000

export async function runLoginCommand(): Promise<void> {
  const existing = await getCredentials()
  if (existing) {
    info(`Already logged in as ${existing.email}`)
    info("Run bb logout to sign out.")
    return
  }

  const code = generateDeviceCode()

  // Register device code in DB before opening browser
  try {
    const res = await fetch(`${BETTERBASE_API}/cli-auth-device`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code })
    })
    if (!res.ok) {
      logError("Failed to register device code. Check your connection and try again.")
      process.exit(1)
    }
  } catch {
    logError("Could not reach BetterBase API. Check your connection and try again.")
    process.exit(1)
  }

  const authUrl = `${AUTH_PAGE_URL}?code=${code}`
  info("Opening browser for authentication...")
  info(`Auth URL: ${authUrl}`)
  info("Waiting for authentication... (timeout: 5 minutes)")

  await openBrowser(authUrl)

  const credentials = await pollForAuth(code)

  if (!credentials) {
    logError("Authentication timed out. Run bb login to try again.")
    process.exit(1)
  }

  await saveCredentials(credentials)
  success(`Logged in as ${credentials.email}`)
}

export async function runLogoutCommand(): Promise<void> {
  if (existsSync(CREDENTIALS_PATH)) {
    await fs.unlink(CREDENTIALS_PATH)
    success("Logged out successfully.")
  } else {
    warn("Not currently logged in.")
  }
}

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

export async function isAuthenticated(): Promise<boolean> {
  const creds = await getCredentials()
  return creds !== null
}

export async function requireCredentials(): Promise<Credentials> {
  const creds = await getCredentials()
  if (!creds) {
    logError(
      "Not logged in. Run: bb login\n" +
      "This connects your CLI with BetterBase so your project\n" +
      "can be registered and managed from the dashboard."
    )
    process.exit(1)
  }
  return creds
}

function generateDeviceCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  const part1 = Array.from({ length: 4 }, () => chars[randomBytes(1)[0] % chars.length]).join("")
  const part2 = Array.from({ length: 4 }, () => chars[randomBytes(1)[0] % chars.length]).join("")
  return `${part1}-${part2}`
}

async function openBrowser(url: string): Promise<void> {
  try {
    if (process.platform === "darwin") {
      await Bun.spawn(["open", url])
    } else if (process.platform === "win32") {
      await Bun.spawn(["cmd", "/c", "start", "", url])
    } else {
      await Bun.spawn(["xdg-open", url])
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
      const response = await fetch(`${BETTERBASE_API}/cli-auth-poll?code=${code}`)
      if (response.status === 200) {
        return await response.json() as Credentials
      }
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