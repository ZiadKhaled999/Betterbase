import type { BetterBaseResponse, QueryOptions } from './types';
import { BetterBaseError, NetworkError } from './errors';

export class QueryBuilder<T = unknown> {
  private filters: Record<string, unknown> = {};
  private options: QueryOptions = {};
  private selectFields = '*';

  constructor(
    private url: string,
    private table: string,
    private headers: Record<string, string>,
    private fetchImpl: typeof fetch = fetch
  ) {}

  select(fields = '*'): this {
    this.selectFields = fields;
    return this;
  }

  eq(column: string, value: unknown): this {
    this.filters[column] = value;
    return this;
  }

  in(column: string, values: unknown[]): this {
    this.filters[`${column}_in`] = values;
    return this;
  }

  limit(count: number): this {
    this.options.limit = count;
    return this;
  }

  offset(count: number): this {
    this.options.offset = count;
    return this;
  }

  order(column: string, direction: 'asc' | 'desc' = 'asc'): this {
    this.options.orderBy = { column, direction };
    return this;
  }

  async execute(): Promise<BetterBaseResponse<T[]>> {
    const params = new URLSearchParams();
    params.append('select', this.selectFields);

    for (const [key, value] of Object.entries(this.filters)) {
      params.append(key, String(value));
    }

    if (this.options.limit !== undefined) params.append('limit', String(this.options.limit));
    if (this.options.offset !== undefined) params.append('offset', String(this.options.offset));
    if (this.options.orderBy) {
      params.append('sort', `${this.options.orderBy.column}:${this.options.orderBy.direction}`);
    }

    const endpoint = `${this.url}/api/${this.table}?${params.toString()}`;

    try {
      const response = await this.fetchImpl(endpoint, {
        method: 'GET',
        headers: this.headers,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        return {
          data: null,
          error: new BetterBaseError(
            error.error || `Request failed with status ${response.status}`,
            'REQUEST_FAILED',
            error,
            response.status
          ),
        };
      }

      const result = await response.json();
      return {
        data: result[this.table] || result.data || [],
        error: null,
        count: result.count,
        pagination: result.pagination,
      };
    } catch (error) {
      return {
        data: null,
        error: new NetworkError(error instanceof Error ? error.message : 'Network request failed', error),
      };
    }
  }

  async single(id: string): Promise<BetterBaseResponse<T>> {
    const endpoint = `${this.url}/api/${this.table}/${id}`;
    try {
      const response = await this.fetchImpl(endpoint, { method: 'GET', headers: this.headers });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Not found' }));
        return {
          data: null,
          error: new BetterBaseError(error.error || 'Resource not found', 'NOT_FOUND', error, response.status),
        };
      }
      const result = await response.json();
      const singularKey = this.table.endsWith('s') ? this.table.slice(0, -1) : this.table;
      return { data: result[singularKey] || result.data || null, error: null };
    } catch (error) {
      return {
        data: null,
        error: new NetworkError(error instanceof Error ? error.message : 'Network request failed', error),
      };
    }
  }

  async insert(data: Partial<T>): Promise<BetterBaseResponse<T>> {
    const endpoint = `${this.url}/api/${this.table}`;
    try {
      const response = await this.fetchImpl(endpoint, {
        method: 'POST',
        headers: { ...this.headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Insert failed' }));
        return {
          data: null,
          error: new BetterBaseError(error.error || 'Failed to insert record', 'INSERT_FAILED', error, response.status),
        };
      }
      const result = await response.json();
      const singularKey = this.table.endsWith('s') ? this.table.slice(0, -1) : this.table;
      return { data: result[singularKey] || result.data || null, error: null };
    } catch (error) {
      return {
        data: null,
        error: new NetworkError(error instanceof Error ? error.message : 'Network request failed', error),
      };
    }
  }

  async update(id: string, data: Partial<T>): Promise<BetterBaseResponse<T>> {
    const endpoint = `${this.url}/api/${this.table}/${id}`;
    try {
      const response = await this.fetchImpl(endpoint, {
        method: 'PATCH',
        headers: { ...this.headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Update failed' }));
        return {
          data: null,
          error: new BetterBaseError(error.error || 'Failed to update record', 'UPDATE_FAILED', error, response.status),
        };
      }
      const result = await response.json();
      const singularKey = this.table.endsWith('s') ? this.table.slice(0, -1) : this.table;
      return { data: result[singularKey] || result.data || null, error: null };
    } catch (error) {
      return {
        data: null,
        error: new NetworkError(error instanceof Error ? error.message : 'Network request failed', error),
      };
    }
  }

  async delete(id: string): Promise<BetterBaseResponse<T>> {
    const endpoint = `${this.url}/api/${this.table}/${id}`;
    try {
      const response = await this.fetchImpl(endpoint, { method: 'DELETE', headers: this.headers });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Delete failed' }));
        return {
          data: null,
          error: new BetterBaseError(error.error || 'Failed to delete record', 'DELETE_FAILED', error, response.status),
        };
      }
      const result = await response.json();
      const singularKey = this.table.endsWith('s') ? this.table.slice(0, -1) : this.table;
      return { data: result[singularKey] || result.data || null, error: null };
    } catch (error) {
      return {
        data: null,
        error: new NetworkError(error instanceof Error ? error.message : 'Network request failed', error),
      };
    }
  }
}
