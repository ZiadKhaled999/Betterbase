import type { BetterBaseResponse } from './types';
import { AuthError, NetworkError } from './errors';

export interface AuthCredentials {
  email: string;
  password: string;
  name?: string;
}

export interface User {
  id: string;
  email: string;
  name: string | null;
}

export interface Session {
  token: string;
  user: User;
}

function getStorage(): Storage | null {
  if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis) {
    return globalThis.localStorage;
  }
  return null;
}

export class AuthClient {
  constructor(
    private url: string,
    private headers: Record<string, string>,
    private onAuthStateChange?: (token: string | null) => void,
    private fetchImpl: typeof fetch = fetch
  ) {}

  async signUp(credentials: AuthCredentials): Promise<BetterBaseResponse<Session>> {
    const endpoint = `${this.url}/auth/signup`;
    try {
      const response = await this.fetchImpl(endpoint, {
        method: 'POST',
        headers: { ...this.headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Signup failed' }));
        return { data: null, error: new AuthError(error.error || 'Failed to sign up', error) };
      }
      const session = (await response.json()) as Session;
      getStorage()?.setItem('betterbase_token', session.token);
      this.onAuthStateChange?.(session.token);
      return { data: session, error: null };
    } catch (error) {
      return {
        data: null,
        error: new NetworkError(error instanceof Error ? error.message : 'Network request failed', error),
      };
    }
  }

  async signIn(credentials: Omit<AuthCredentials, 'name'>): Promise<BetterBaseResponse<Session>> {
    const endpoint = `${this.url}/auth/login`;
    try {
      const response = await this.fetchImpl(endpoint, {
        method: 'POST',
        headers: { ...this.headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Login failed' }));
        return { data: null, error: new AuthError(error.error || 'Invalid credentials', error) };
      }
      const session = (await response.json()) as Session;
      getStorage()?.setItem('betterbase_token', session.token);
      this.onAuthStateChange?.(session.token);
      return { data: session, error: null };
    } catch (error) {
      return {
        data: null,
        error: new NetworkError(error instanceof Error ? error.message : 'Network request failed', error),
      };
    }
  }

  async signOut(): Promise<BetterBaseResponse<null>> {
    const endpoint = `${this.url}/auth/logout`;
    const token = getStorage()?.getItem('betterbase_token') ?? null;
    try {
      const response = await this.fetchImpl(endpoint, {
        method: 'POST',
        headers: {
          ...this.headers,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      getStorage()?.removeItem('betterbase_token');
      this.onAuthStateChange?.(null);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Logout failed' }));
        return { data: null, error: new AuthError(error.error || 'Failed to sign out', error) };
      }

      return { data: null, error: null };
    } catch (error) {
      getStorage()?.removeItem('betterbase_token');
      this.onAuthStateChange?.(null);
      return {
        data: null,
        error: new NetworkError(error instanceof Error ? error.message : 'Network request failed', error),
      };
    }
  }

  async getUser(): Promise<BetterBaseResponse<User>> {
    const endpoint = `${this.url}/auth/me`;
    const token = getStorage()?.getItem('betterbase_token') ?? null;

    if (!token) {
      return { data: null, error: new AuthError('Not authenticated') };
    }

    try {
      const response = await this.fetchImpl(endpoint, {
        method: 'GET',
        headers: { ...this.headers, Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to get user' }));
        return { data: null, error: new AuthError(error.error || 'Failed to get user', error) };
      }
      const result = await response.json();
      return { data: result.user, error: null };
    } catch (error) {
      return {
        data: null,
        error: new NetworkError(error instanceof Error ? error.message : 'Network request failed', error),
      };
    }
  }

  getToken(): string | null {
    return getStorage()?.getItem('betterbase_token') ?? null;
  }

  setToken(token: string | null): void {
    const storage = getStorage();
    if (token) {
      storage?.setItem('betterbase_token', token);
    } else {
      storage?.removeItem('betterbase_token');
    }
    this.onAuthStateChange?.(token);
  }
}
