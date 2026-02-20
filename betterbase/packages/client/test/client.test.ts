import { describe, expect, test } from 'bun:test';
import { createClient } from '../src';

describe('@betterbase/client', () => {
  test('creates client with config', () => {
    const client = createClient({
      url: 'http://localhost:3000',
      key: 'test-key',
    });

    expect(client).toBeDefined();
    expect(client.auth).toBeDefined();
    expect(client.realtime).toBeDefined();
  });

  test('from creates query builder', () => {
    const client = createClient({ url: 'http://localhost:3000' });
    const query = client.from('users');

    expect(query).toBeDefined();
    expect(query.select).toBeDefined();
    expect(query.eq).toBeDefined();
  });
});
