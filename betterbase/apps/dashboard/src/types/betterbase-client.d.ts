declare module '@betterbase/client' {
  export interface SerializedError {
    message: string;
    name?: string;
    stack?: string;
  }

  export interface QueryBuilderOptions {
    singularKey?: string;
  }

  export interface BetterBaseResponse<T> {
    data: T | null;
    error: string | SerializedError | null;
    count?: number;
    pagination?: {
      page: number;
      pageSize: number;
      total: number;
    };
  }

  export interface QueryBuilder<T> {
    select(fields?: string): this;
    eq(column: string, value: unknown): this;
    in(column: string, values: unknown[]): this;
    limit(count: number): this;
    offset(count: number): this;
    order(column: string, direction?: 'asc' | 'desc'): this;
    execute(): Promise<BetterBaseResponse<T[]>>;
    single(id: string): Promise<BetterBaseResponse<T>>;
    insert(data: Partial<T>): Promise<BetterBaseResponse<T>>;
    update(id: string, data: Partial<T>): Promise<BetterBaseResponse<T>>;
    delete(id: string): Promise<BetterBaseResponse<T>>;
  }

  export interface BetterBaseClient {
    auth: {
      getUser: () => Promise<{ data: unknown; error: { message: string } | null }>;
    };
    from<T = unknown>(table: string, options?: QueryBuilderOptions): QueryBuilder<T>;
  }

  export function createClient(config: {
    url: string;
    key?: string;
    schema?: string;
    fetch?: typeof fetch;
    storage?: {
      getItem: (key: string) => string | null;
      setItem: (key: string, value: string) => void;
      removeItem: (key: string) => void;
    };
  }): BetterBaseClient;
}
