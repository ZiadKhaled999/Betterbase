import type { BetterBaseConfig } from './types';
import { QueryBuilder } from './query-builder';
import { AuthClient } from './auth';
import { RealtimeClient } from './realtime';

export class BetterBaseClient {
  private headers: Record<string, string>;
  private fetchImpl: typeof fetch;
  private url: string;
  public auth: AuthClient;
  public realtime: RealtimeClient;

  constructor(config: BetterBaseConfig) {
    this.url = config.url.replace(/\/$/, '');
    this.headers = {
      'Content-Type': 'application/json',
      ...(config.key ? { 'X-BetterBase-Key': config.key } : {}),
    };
    this.fetchImpl = config.fetch ?? fetch;

    this.auth = new AuthClient(
      this.url,
      this.headers,
      (token) => {
        if (token) {
          this.headers.Authorization = `Bearer ${token}`;
        } else {
          delete this.headers.Authorization;
        }
      },
      this.fetchImpl
    );

    this.realtime = new RealtimeClient(this.url);

    const token = this.auth.getToken();
    if (token) {
      this.headers.Authorization = `Bearer ${token}`;
    }
  }

  from<T = unknown>(table: string): QueryBuilder<T> {
    return new QueryBuilder<T>(this.url, table, this.headers, this.fetchImpl);
  }
}

export function createClient(config: BetterBaseConfig): BetterBaseClient {
  return new BetterBaseClient(config);
}
