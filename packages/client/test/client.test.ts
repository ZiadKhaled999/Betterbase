import { afterEach, describe, expect, mock, test } from 'bun:test';
import { createClient } from '../src';

afterEach(() => {
  mock.restore();
});

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

  test('execute sends chained query with key header', async () => {
    const fetchMock = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toContain('/api/users?');
      expect(String(input)).toContain('select=id%2Cemail');
      expect(String(input)).toContain('email=test%40example.com');
      expect(init?.method).toBe('GET');
      expect((init?.headers as Record<string, string>)['X-BetterBase-Key']).toBe('test-key');
      return new Response(JSON.stringify({ users: [] }), { status: 200 });
    });

    const client = createClient({ url: 'http://localhost:3000', key: 'test-key', fetch: fetchMock as typeof fetch });
    const res = await client.from('users').select('id,email').eq('email', 'test@example.com').execute();

    expect(res.error).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('execute sends simple request', async () => {
    const fetchMock = mock(async (input: RequestInfo | URL) => {
      expect(String(input)).toBe('http://localhost:3000/api/users?select=*');
      return new Response(JSON.stringify({ users: [{ id: '1' }] }), { status: 200 });
    });

    const client = createClient({ url: 'http://localhost:3000', fetch: fetchMock as typeof fetch });
    const res = await client.from<{ id: string }>('users').execute();

    expect(res.error).toBeNull();
    expect(res.data).toEqual([{ id: '1' }]);
  });
});
