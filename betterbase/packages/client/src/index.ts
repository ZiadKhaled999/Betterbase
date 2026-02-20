export { createClient, BetterBaseClient } from './client';
export { QueryBuilder } from './query-builder';
export { AuthClient } from './auth';
export { RealtimeClient } from './realtime';
export { BetterBaseError, NetworkError, AuthError, ValidationError } from './errors';

export type {
  BetterBaseConfig,
  BetterBaseResponse,
  QueryOptions,
  RealtimeCallback,
  RealtimeSubscription,
} from './types';

export type { User, Session, AuthCredentials } from './auth';
