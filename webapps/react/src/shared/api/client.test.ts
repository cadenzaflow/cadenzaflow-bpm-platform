import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, adminUrl, engineUrl, request } from './client';

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    ...init,
  });
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
  document.cookie = 'XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
});

describe('request', () => {
  it('sends the CSRF token from the cookie on modifying requests only', async () => {
    document.cookie = 'XSRF-TOKEN=cookie-token';
    fetchMock.mockImplementation(async () => jsonResponse({}));

    await request('/api/x');
    await request('/api/x', { method: 'POST', json: { a: 1 } });

    expect(fetchMock.mock.calls[0][1].headers['X-XSRF-TOKEN']).toBeUndefined();
    expect(fetchMock.mock.calls[1][1].headers['X-XSRF-TOKEN']).toBe('cookie-token');
    expect(fetchMock.mock.calls[1][1].body).toBe('{"a":1}');
  });

  it('falls back to the token the server sent as response header', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, { headers: { 'X-XSRF-TOKEN': 'header-token' } }));
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    await request('/api/x');
    await request('/api/x', { method: 'POST' });

    expect(fetchMock.mock.calls[1][1].headers['X-XSRF-TOKEN']).toBe('header-token');
  });

  it('form-encodes form bodies and appends query parameters', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));

    await request('/api/login', {
      method: 'POST',
      form: { username: 'demo', password: 'p&ss' },
      query: { firstResult: 0, maxResults: 15, skipped: undefined },
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/login?firstResult=0&maxResults=15');
    expect(init.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    expect(init.body).toBe('username=demo&password=p%26ss');
  });

  it('throws an ApiError carrying status, message and type of the engine error', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ type: 'AuthorizationException', message: 'not allowed' }, { status: 403 }),
    );

    const error = await request('/api/x').catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 403, message: 'not allowed', type: 'AuthorizationException' });
  });
});

describe('URLs', () => {
  it('builds engine and admin API URLs', () => {
    expect(engineUrl('my engine', '/task')).toBe('/api/engine/engine/my%20engine/task');
    expect(adminUrl('/auth/user/default')).toBe('/api/admin/auth/user/default');
  });
});
