import { createAuthClient, type AuthClient as BetterAuthClient } from "better-auth/client"
import type { BetterBaseConfig, BetterBaseResponse } from "./types"
import { AuthError, NetworkError } from "./errors"

export interface BetterBaseClientConfig extends BetterBaseConfig {}

export interface User {
  id: string
  name: string
  email: string
  emailVerified: boolean
  image: string | null
  createdAt: Date
  updatedAt: Date
}

export interface Session {
  id: string
  expiresAt: Date
  token: string
  createdAt: Date
  updatedAt: Date
  ipAddress: string | null
  userAgent: string | null
  userId: string
}

interface StorageAdapter {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

function getStorage(): Storage | null {
  try {
    if (typeof globalThis === "undefined") {
      return null
    }
    const storage = globalThis.localStorage
    return storage ?? null
  } catch {
    return null
  }
}

export class AuthClient {
  private authClient: BetterAuthClient
  private storage: StorageAdapter | null
  private onAuthStateChange?: (token: string | null) => void
  private fetchImpl: typeof fetch

  constructor(
    private url: string,
    private headers: Record<string, string>,
    onAuthStateChange?: (token: string | null) => void,
    fetchImpl: typeof fetch = fetch,
    storage?: StorageAdapter | null
  ) {
    this.fetchImpl = fetchImpl
    this.storage = storage ?? getStorage()
    this.onAuthStateChange = onAuthStateChange

    this.authClient = createAuthClient({
      baseURL: this.url,
      fetch: fetchImpl,
    })
  }

  async signUp(
    email: string,
    password: string,
    name: string
  ): Promise<BetterBaseResponse<{ user: User; session: Session }>> {
    try {
      const result = await this.authClient.signUp.email({
        email,
        password,
        name,
      })

      if (result.error) {
        return {
          data: null,
          error: new AuthError(result.error.message, result.error),
        }
      }

      if (result.data) {
        const sessionToken = result.data.session?.token
        if (sessionToken) {
          this.storage?.setItem("betterbase_session", sessionToken)
          this.onAuthStateChange?.(sessionToken)
        }
      }

      return {
        data: result.data as { user: User; session: Session },
        error: null,
      }
    } catch (error) {
      return {
        data: null,
        error: new NetworkError(
          error instanceof Error ? error.message : "Network request failed",
          error
        ),
      }
    }
  }

  async signIn(
    email: string,
    password: string
  ): Promise<BetterBaseResponse<{ user: User; session: Session }>> {
    try {
      const result = await this.authClient.signIn.email({
        email,
        password,
      })

      if (result.error) {
        return {
          data: null,
          error: new AuthError(result.error.message, result.error),
        }
      }

      if (result.data) {
        const sessionToken = result.data.session?.token
        if (sessionToken) {
          this.storage?.setItem("betterbase_session", sessionToken)
          this.onAuthStateChange?.(sessionToken)
        }
      }

      return {
        data: result.data as { user: User; session: Session },
        error: null,
      }
    } catch (error) {
      return {
        data: null,
        error: new NetworkError(
          error instanceof Error ? error.message : "Network request failed",
          error
        ),
      }
    }
  }

  async signOut(): Promise<BetterBaseResponse<null>> {
    try {
      const result = await this.authClient.signOut()

      this.storage?.removeItem("betterbase_session")
      this.onAuthStateChange?.(null)

      if (result.error) {
        return {
          data: null,
          error: new AuthError(result.error.message, result.error),
        }
      }

      return { data: null, error: null }
    } catch (error) {
      this.storage?.removeItem("betterbase_session")
      this.onAuthStateChange?.(null)
      return {
        data: null,
        error: new NetworkError(
          error instanceof Error ? error.message : "Network request failed",
          error
        ),
      }
    }
  }

  async getSession(): Promise<BetterBaseResponse<{ user: User; session: Session }>> {
    try {
      const result = await this.authClient.getSession()

      if (result.error) {
        return {
          data: null,
          error: new AuthError(result.error.message, result.error),
        }
      }

      if (!result.data) {
        return { data: null, error: null }
      }

      return {
        data: result.data as { user: User; session: Session },
        error: null,
      }
    } catch (error) {
      return {
        data: null,
        error: new NetworkError(
          error instanceof Error ? error.message : "Network request failed",
          error
        ),
      }
    }
  }

  getToken(): string | null {
    return this.storage?.getItem("betterbase_session") ?? null
  }

  setToken(token: string | null): void {
    if (token) {
      this.storage?.setItem("betterbase_session", token)
    } else {
      this.storage?.removeItem("betterbase_session")
    }
    this.onAuthStateChange?.(token)
  }
}

export function createAuthClientInstance(config: BetterBaseClientConfig): BetterAuthClient {
  return createAuthClient({
    baseURL: config.url,
    fetch: config.fetch,
  })
}

export const authClient = {
  signUp: async (
    url: string,
    email: string,
    password: string,
    name: string
  ): Promise<BetterBaseResponse<{ user: User; session: Session }>> => {
    const client = createAuthClient({ baseURL: url })
    const result = await client.signUp.email({ email, password, name })
    return result as { user: User; session: Session } | null as any
  },

  signIn: async (
    url: string,
    email: string,
    password: string
  ): Promise<BetterBaseResponse<{ user: User; session: Session }>> => {
    const client = createAuthClient({ baseURL: url })
    const result = await client.signIn.email({ email, password })
    return result as { user: User; session: Session } | null as any
  },

  signOut: async (url: string): Promise<BetterBaseResponse<null>> => {
    const client = createAuthClient({ baseURL: url })
    const result = await client.signOut()
    return result as any
  },

  getSession: async (
    url: string
  ): Promise<BetterBaseResponse<{ user: User; session: Session }>> => {
    const client = createAuthClient({ baseURL: url })
    const result = await client.getSession()
    return result as { user: User; session: Session } | null as any
  },
}
