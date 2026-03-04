import { describe, it, expect, beforeAll, afterAll, mock, afterEach } from "bun:test"
import { AuthClient } from "../src/auth"
import { AuthError, NetworkError } from "../src/errors"

// Mock storage adapter for testing
class MockStorage {
  private store: Map<string, string> = new Map()
  
  getItem(key: string): string | null {
    return this.store.get(key) ?? null
  }
  
  setItem(key: string, value: string): void {
    this.store.set(key, value)
  }
  
  removeItem(key: string): void {
    this.store.delete(key)
  }
}

// Mock the better-auth/client module
const mockSignUp = mock(async (params: { email: string; password: string; name: string }) => {
  return {
    data: {
      user: {
        id: "user-123",
        name: params.name,
        email: params.email,
        emailVerified: false,
        image: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      token: `mock-session-token-${params.email}`,
    },
    error: null,
  }
})

const mockSignIn = mock(async (params: { email: string; password: string }) => {
  return {
    data: {
      user: {
        id: "user-456",
        name: "Signed In User",
        email: params.email,
        emailVerified: true,
        image: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      token: `signed-in-token-${params.email}`,
    },
    error: null,
  }
})

const mockSignOut = mock(async () => {
  return { data: null, error: null }
})

const mockGetSession = mock(async () => {
  return {
    data: {
      user: {
        id: "user-789",
        name: "Session User",
        email: "session@example.com",
        emailVerified: true,
        image: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      session: {
        id: "session-123",
        expiresAt: new Date(Date.now() + 3600000),
        token: "valid-session-token",
        createdAt: new Date(),
        updatedAt: new Date(),
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0",
        userId: "user-789",
      },
    },
    error: null,
  }
})

// Mock module for better-auth/client
mock.module("better-auth/client", () => ({
  createAuthClient: mock(() => ({
    signUp: {
      email: mockSignUp,
    },
    signIn: {
      email: mockSignIn,
    },
    signOut: mockSignOut,
    getSession: mockGetSession,
  })),
}))

describe("AuthClient", () => {
  let mockStorage: MockStorage
  let authStateChanges: (string | null)[]
  
  beforeAll(() => {
    mockStorage = new MockStorage()
    authStateChanges = []
  })
  
  afterEach(() => {
    mock.restore()
  })
  
  describe("constructor", () => {
    it("creates AuthClient with default storage when no storage provided", () => {
      const client = new AuthClient(
        "http://localhost:3000",
        { "Content-Type": "application/json" }
      )
      expect(client).toBeDefined()
    })
    
    it("creates AuthClient with custom storage", () => {
      const client = new AuthClient(
        "http://localhost:3000",
        { "Content-Type": "application/json" },
        undefined,
        fetch,
        mockStorage
      )
      expect(client).toBeDefined()
    })
    
    it("creates AuthClient with auth state change callback", () => {
      const client = new AuthClient(
        "http://localhost:3000",
        { "Content-Type": "application/json" },
        (token) => authStateChanges.push(token),
        fetch,
        mockStorage
      )
      expect(client).toBeDefined()
    })
  })
  
  describe("signUp", () => {
    it("returns success with user and session on successful signup", async () => {
      const client = new AuthClient(
        "http://localhost:3000",
        { "Content-Type": "application/json" },
        (token) => authStateChanges.push(token),
        fetch,
        mockStorage
      )
      
      const result = await client.signUp("test@example.com", "password123", "Test User")
      
      expect(result.error).toBeNull()
      expect(result.data).toBeDefined()
      expect(result.data?.user.email).toBe("test@example.com")
      expect(result.data?.user.name).toBe("Test User")
      expect(result.data?.session.token).toBe("mock-session-token-test@example.com")
    })
    
    it("stores session token in storage on successful signup", async () => {
      const client = new AuthClient(
        "http://localhost:3000",
        { "Content-Type": "application/json" },
        (token) => authStateChanges.push(token),
        fetch,
        mockStorage
      )
      
      await client.signUp("test@test.com", "password", "Test")
      
      expect(mockStorage.getItem("betterbase_session")).toBe("mock-session-token-test@test.com")
    })
    
    it("calls auth state change callback on successful signup", async () => {
      const client = new AuthClient(
        "http://localhost:3000",
        { "Content-Type": "application/json" },
        (token) => authStateChanges.push(token),
        fetch,
        mockStorage
      )
      
      await client.signUp("test@test.com", "password", "Test")
      
      expect(authStateChanges).toContain("mock-session-token-test@test.com")
    })
    
    it("returns AuthError when signup fails with error response", async () => {
      // Override the mock to return an error
      mockSignUp.mockImplementationOnce(async () => {
        return {
          data: null,
          error: { message: "Email already exists", code: "EMAIL_EXISTS" },
        }
      })
      
      const client = new AuthClient(
        "http://localhost:3000",
        { "Content-Type": "application/json" },
        undefined,
        fetch,
        mockStorage
      )
      
      const result = await client.signUp("test@example.com", "password123", "Test User")
      
      expect(result.error).toBeInstanceOf(AuthError)
      expect(result.error?.message).toBe("Email already exists")
      expect(result.data).toBeNull()
    })
    
    it("returns NetworkError when network request fails", async () => {
      // Override the mock to throw
      mockSignUp.mockImplementationOnce(async () => {
        throw new Error("Network unavailable")
      })
      
      const client = new AuthClient(
        "http://localhost:3000",
        { "Content-Type": "application/json" },
        undefined,
        fetch,
        mockStorage
      )
      
      const result = await client.signUp("test@example.com", "password123", "Test User")
      
      expect(result.error).toBeInstanceOf(NetworkError)
      expect(result.data).toBeNull()
    })
  })
  
  describe("signIn", () => {
    it("returns success with user and session on successful signin", async () => {
      const client = new AuthClient(
        "http://localhost:3000",
        { "Content-Type": "application/json" },
        (token) => authStateChanges.push(token),
        fetch,
        mockStorage
      )
      
      const result = await client.signIn("signedin@example.com", "password123")
      
      expect(result.error).toBeNull()
      expect(result.data).toBeDefined()
      expect(result.data?.user.email).toBe("signedin@example.com")
      expect(result.data?.session.token).toBe("signed-in-token-signedin@example.com")
    })
    
    it("stores session token in storage on successful signin", async () => {
      const client = new AuthClient(
        "http://localhost:3000",
        { "Content-Type": "application/json" },
        undefined,
        fetch,
        mockStorage
      )
      
      await client.signIn("test@test.com", "password")
      
      expect(mockStorage.getItem("betterbase_session")).toBe("signed-in-token-test@test.com")
    })
    
    it("returns AuthError when signin fails with invalid credentials", async () => {
      // Override the mock to return an error
      mockSignIn.mockImplementationOnce(async () => {
        return {
          data: null,
          error: { message: "Invalid email or password", code: "INVALID_CREDENTIALS" },
        }
      })
      
      const client = new AuthClient(
        "http://localhost:3000",
        { "Content-Type": "application/json" },
        undefined,
        fetch,
        mockStorage
      )
      
      const result = await client.signIn("wrong@example.com", "wrongpassword")
      
      expect(result.error).toBeInstanceOf(AuthError)
      expect(result.error?.message).toBe("Invalid email or password")
      expect(result.data).toBeNull()
    })
    
    it("returns NetworkError when network request fails", async () => {
      // Override the mock to throw
      mockSignIn.mockImplementationOnce(async () => {
        throw new Error("Connection refused")
      })
      
      const client = new AuthClient(
        "http://localhost:3000",
        { "Content-Type": "application/json" },
        undefined,
        fetch,
        mockStorage
      )
      
      const result = await client.signIn("test@example.com", "password123")
      
      expect(result.error).toBeInstanceOf(NetworkError)
      expect(result.data).toBeNull()
    })
  })
  
  describe("signOut", () => {
    it("returns success on successful signout", async () => {
      // Pre-set a token
      mockStorage.setItem("betterbase_session", "existing-token")
      
      const client = new AuthClient(
        "http://localhost:3000",
        { "Content-Type": "application/json" },
        (token) => authStateChanges.push(token),
        fetch,
        mockStorage
      )
      
      const result = await client.signOut()
      
      expect(result.error).toBeNull()
      expect(result.data).toBeNull()
    })
    
    it("removes session token from storage on signout", async () => {
      mockStorage.setItem("betterbase_session", "existing-token")
      
      const client = new AuthClient(
        "http://localhost:3000",
        { "Content-Type": "application/json" },
        undefined,
        fetch,
        mockStorage
      )
      
      await client.signOut()
      
      expect(mockStorage.getItem("betterbase_session")).toBeNull()
    })
    
    it("calls auth state change callback with null on signout", async () => {
      mockStorage.setItem("betterbase_session", "existing-token")
      
      const client = new AuthClient(
        "http://localhost:3000",
        { "Content-Type": "application/json" },
        (token) => authStateChanges.push(token),
        fetch,
        mockStorage
      )
      
      await client.signOut()
      
      expect(authStateChanges).toContain(null)
    })
    
    it("returns AuthError when signout fails", async () => {
      mockSignOut.mockImplementationOnce(async () => {
        return {
          data: null,
          error: { message: "Sign out failed" },
        }
      })
      
      const client = new AuthClient(
        "http://localhost:3000",
        { "Content-Type": "application/json" },
        undefined,
        fetch,
        mockStorage
      )
      
      const result = await client.signOut()
      
      // Even on error, token should be removed from storage
      expect(mockStorage.getItem("betterbase_session")).toBeNull()
    })
    
    it("handles network error during signout gracefully", async () => {
      mockStorage.setItem("betterbase_session", "existing-token")
      
      mockSignOut.mockImplementationOnce(async () => {
        throw new Error("Network error")
      })
      
      const client = new AuthClient(
        "http://localhost:3000",
        { "Content-Type": "application/json" },
        undefined,
        fetch,
        mockStorage
      )
      
      const result = await client.signOut()
      
      // Should still remove token even on network error
      expect(mockStorage.getItem("betterbase_session")).toBeNull()
    })
  })
  
  describe("getSession", () => {
    it("returns success with user and session when session exists", async () => {
      const client = new AuthClient(
        "http://localhost:3000",
        { "Content-Type": "application/json" },
        undefined,
        fetch,
        mockStorage
      )
      
      const result = await client.getSession()
      
      expect(result.error).toBeNull()
      expect(result.data).toBeDefined()
      expect(result.data?.user.email).toBe("session@example.com")
      expect(result.data?.session.token).toBe("valid-session-token")
    })
    
    it("returns null data without error when no session exists", async () => {
      mockGetSession.mockImplementationOnce(async () => {
        return { data: null, error: null }
      })
      
      const client = new AuthClient(
        "http://localhost:3000",
        { "Content-Type": "application/json" },
        undefined,
        fetch,
        mockStorage
      )
      
      const result = await client.getSession()
      
      expect(result.error).toBeNull()
      expect(result.data).toBeNull()
    })
    
    it("returns AuthError when session retrieval fails", async () => {
      mockGetSession.mockImplementationOnce(async () => {
        return {
          data: null,
          error: { message: "Session expired" },
        }
      })
      
      const client = new AuthClient(
        "http://localhost:3000",
        { "Content-Type": "application/json" },
        undefined,
        fetch,
        mockStorage
      )
      
      const result = await client.getSession()
      
      expect(result.error).toBeInstanceOf(AuthError)
      expect(result.error?.message).toBe("Session expired")
      expect(result.data).toBeNull()
    })
    
    it("returns NetworkError when network request fails", async () => {
      mockGetSession.mockImplementationOnce(async () => {
        throw new Error("Network unavailable")
      })
      
      const client = new AuthClient(
        "http://localhost:3000",
        { "Content-Type": "application/json" },
        undefined,
        fetch,
        mockStorage
      )
      
      const result = await client.getSession()
      
      expect(result.error).toBeInstanceOf(NetworkError)
      expect(result.data).toBeNull()
    })
  })
  
  describe("getToken", () => {
    let testStorage: MockStorage
    
    it("returns token from storage when present", () => {
      testStorage = new MockStorage()
      testStorage.setItem("betterbase_session", "stored-token")
      
      const client = new AuthClient(
        "http://localhost:3000",
        { "Content-Type": "application/json" },
        undefined,
        fetch,
        testStorage
      )
      
      expect(client.getToken()).toBe("stored-token")
    })
    
    it("returns null when no token in storage", () => {
      const freshStorage = new MockStorage()
      const client = new AuthClient(
        "http://localhost:3000",
        { "Content-Type": "application/json" },
        undefined,
        fetch,
        freshStorage
      )
      
      expect(client.getToken()).toBeNull()
    })
  })
  
  describe("setToken", () => {
    it("stores token in storage when token is provided", () => {
      const client = new AuthClient(
        "http://localhost:3000",
        { "Content-Type": "application/json" },
        (token) => authStateChanges.push(token),
        fetch,
        mockStorage
      )
      
      client.setToken("new-token")
      
      expect(mockStorage.getItem("betterbase_session")).toBe("new-token")
    })
    
    it("calls auth state change callback when token is set", () => {
      const client = new AuthClient(
        "http://localhost:3000",
        { "Content-Type": "application/json" },
        (token) => authStateChanges.push(token),
        fetch,
        mockStorage
      )
      
      client.setToken("callback-token")
      
      expect(authStateChanges).toContain("callback-token")
    })
    
    it("removes token from storage when null is provided", () => {
      mockStorage.setItem("betterbase_session", "old-token")
      
      const client = new AuthClient(
        "http://localhost:3000",
        { "Content-Type": "application/json" },
        (token) => authStateChanges.push(token),
        fetch,
        mockStorage
      )
      
      client.setToken(null)
      
      expect(mockStorage.getItem("betterbase_session")).toBeNull()
    })
    
    it("calls auth state change callback with null when token is cleared", () => {
      mockStorage.setItem("betterbase_session", "existing-token")
      
      const client = new AuthClient(
        "http://localhost:3000",
        { "Content-Type": "application/json" },
        (token) => authStateChanges.push(token),
        fetch,
        mockStorage
      )
      
      client.setToken(null)
      
      expect(authStateChanges).toContain(null)
    })
  })
})
