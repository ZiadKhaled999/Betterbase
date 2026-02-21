import { z } from 'zod';
import type { BetterBaseConfig } from './types';
import { QueryBuilder, type QueryBuilderOptions } from './query-builder';
import { AuthClient } from './auth';
import { RealtimeClient } from './realtime';

const BetterBaseConfigSchema = z.object({
  url: z.string().url(),
  key: z.string().min(1).optional(),
  schema: z.string().optional(),
  fetch: z.function().optional(),
  storage: z.object({
    getItem: z.function().args(z.string()).returns(z.string().nullable()),
    setItem: z.function().args(z.string(), z.string()),
    removeItem: z.function().args(z.string()),
  }).optional(),
});

export class BetterBaseClient {
  private headers: Record<string, string>;
  private fetchImpl: typeof fetch;
  private url: string;
  public auth: AuthClient;
  public realtime: RealtimeClient;

  constructor(config: BetterBaseConfig) {
    const parsed = BetterBaseConfigSchema.parse(config);
    this.url = parsed.url.replace(/\/$/, '');
    this.headers = {
      'Content-Type': 'application/json',
      ...(parsed.key ? { 'X-BetterBase-Key': parsed.key } : {}),
    };
    this.fetchImpl = (parsed.fetch ?? fetch) as typeof fetch;

    this.auth = new AuthClient(
      this.url,
      this.headers,
      (token) => {
        if (token) {
          this.headers.Authorization = `Bearer ${token}`;
        } else {
          delete this.headers.Authorization;
        }
        this.realtime.setToken(token);
      },
      this.fetchImpl,
      parsed.storage ?? undefined
    );

    this.realtime = new RealtimeClient(this.url, this.auth.getToken());

    const token = this.auth.getToken();
    if (token) {
      this.headers.Authorization = `Bearer ${token}`;
    }
  }

  from<T = unknown>(table: string, options?: QueryBuilderOptions): QueryBuilder<T> {
    return new QueryBuilder<T>(this.url, table, this.headers, this.fetchImpl, options);
  }
}

export function createClient(config: BetterBaseConfig): BetterBaseClient {
  return new BetterBaseClient(config);
}
