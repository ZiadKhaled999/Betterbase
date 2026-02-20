import { z } from 'zod';
import type { BetterBaseResponse } from './types';
import { AuthError, NetworkError, ValidationError } from './errors';

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

interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

function getStorage(): Storage | null {
  try {
    if (typeof globalThis === 'undefined') {
      return null;
    }

    const storage = globalThis.localStorage;
    return storage ?? null;
  } catch {
    return null;
  }
}

export class AuthClient {
  constructor(
    private url: string,
    private headers: Record<string, string>,
    private onAuthStateChange?: (token: string | null) => void,
    private fetchImpl: typeof fetch = fetch,
    private storage: StorageAdapter | null = getStorage()
  ) {}

  async signUp(credentials: AuthCredentials): Promise<BetterBaseResponse<Session>> {
    const parsed = credentialsSchema.safeParse(credentials);
    if (!parsed.success) {
      return { data: null, error: new ValidationError('Invalid sign up credentials', parsed.error.format()) };
    }

    const endpoint = `${this.url}/auth/signup`;
    try {
      const response = await this.fetchImpl(endpoint, {
        method: 'POST',
        headers: { ...this.headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...credentials, ...parsed.data }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Signup failed' }));
        return { data: null, error: new AuthError(error.error || 'Failed to sign up', error) };
      }
      const session = (await response.json()) as Session;
      this.storage?.setItem('betterbase_token', session.token);
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
    const parsed = credentialsSchema.safeParse(credentials);
    if (!parsed.success) {
      return { data: null, error: new ValidationError('Invalid sign in credentials', parsed.error.format()) };
    }

    const endpoint = `${this.url}/auth/login`;
    try {
      const response = await this.fetchImpl(endpoint, {
        method: 'POST',
        headers: { ...this.headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Login failed' }));
        return { data: null, error: new AuthError(error.error || 'Invalid credentials', error) };
      }
      const session = (await response.json()) as Session;
      this.storage?.setItem('betterbase_token', session.token);
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
    const token = this.storage?.getItem('betterbase_token') ?? null;
    try {
      const response = await this.fetchImpl(endpoint, {
        method: 'POST',
        headers: {
          ...this.headers,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      this.storage?.removeItem('betterbase_token');
      this.onAuthStateChange?.(null);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Logout failed' }));
        return { data: null, error: new AuthError(error.error || 'Failed to sign out', error) };
      }

      return { data: null, error: null };
    } catch (error) {
      this.storage?.removeItem('betterbase_token');
      this.onAuthStateChange?.(null);
      return {
        data: null,
        error: new NetworkError(error instanceof Error ? error.message : 'Network request failed', error),
      };
    }
  }

  async getUser(): Promise<BetterBaseResponse<User>> {
    const endpoint = `${this.url}/auth/me`;
    const token = this.storage?.getItem('betterbase_token') ?? null;

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
    return this.storage?.getItem('betterbase_token') ?? null;
  }

  setToken(token: string | null): void {
    if (token) {
      this.storage?.setItem('betterbase_token', token);
    } else {
      this.storage?.removeItem('betterbase_token');
    }
    this.onAuthStateChange?.(token);
  }
}
