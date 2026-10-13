import { appRoot } from '../config';

/** An error response of the REST API. */
export class ApiError extends Error {
  readonly status: number;
  /** Exception type reported by the engine REST API, e.g. "AuthorizationException". */
  readonly type?: string;

  constructor(status: number, message: string, type?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.type = type;
  }
}

export type QueryParams = Record<string, string | number | boolean | undefined | null>;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'OPTIONS';
  query?: QueryParams;
  /** Sent as application/json. */
  json?: unknown;
  /** Sent as application/x-www-form-urlencoded. */
  form?: Record<string, string>;
  /** Defaults to application/json. Use application/hal+json for embedded resources. */
  accept?: string;
  /** 'text' returns the body as string, e.g. an HTML form. Defaults to 'json'. */
  responseType?: 'json' | 'text';
  signal?: AbortSignal;
}

const CSRF_COOKIE = 'XSRF-TOKEN';
const CSRF_HEADER = 'X-XSRF-TOKEN';

// The server sends the token as cookie and as response header whenever it
// creates one; the header copy covers a renamed cookie (csrfCookieName).
let csrfTokenFromHeader: string | null = null;

function readCookie(name: string): string | null {
  const prefix = `${name}=`;
  const entry = document.cookie.split('; ').find((c) => c.startsWith(prefix));
  return entry ? decodeURIComponent(entry.substring(prefix.length)) : null;
}

function csrfToken(): string | null {
  return readCookie(CSRF_COOKIE) ?? csrfTokenFromHeader;
}

function withQuery(url: string, query?: QueryParams): string {
  if (!query) {
    return url;
  }
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) {
      params.append(key, String(value));
    }
  }
  const search = params.toString();
  return search ? `${url}?${search}` : url;
}

async function toApiError(response: Response): Promise<ApiError> {
  let message = response.statusText || `HTTP ${response.status}`;
  let type: string | undefined;
  try {
    const body = await response.json();
    message = body?.message ?? message;
    type = body?.type;
  } catch {
    // no JSON body
  }
  return new ApiError(response.status, message, type);
}

/** Sends a request to the webapp's REST APIs with session cookie and CSRF token. */
export async function request<T>(url: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET';
  const headers: Record<string, string> = { Accept: options.accept ?? 'application/json' };
  let body: BodyInit | undefined;

  if (options.json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.json);
  } else if (options.form) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    body = new URLSearchParams(options.form).toString();
  }

  if (method !== 'GET') {
    const token = csrfToken();
    if (token) {
      headers[CSRF_HEADER] = token;
    }
  }

  const response = await fetch(withQuery(url, options.query), {
    method,
    headers,
    body,
    credentials: 'same-origin',
    signal: options.signal,
  });

  const token = response.headers.get(CSRF_HEADER);
  if (token && token !== 'Required') {
    csrfTokenFromHeader = token;
  }

  if (!response.ok) {
    throw await toApiError(response);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  const text = await response.text();
  if (options.responseType === 'text') {
    return text as T;
  }
  return (text ? JSON.parse(text) : undefined) as T;
}

/** URL of the engine REST API of the given process engine, e.g. engineUrl('default', '/task'). */
export function engineUrl(engine: string, path: string): string {
  return `${appRoot}/api/engine/engine/${encodeURIComponent(engine)}${path}`;
}

/** URL of the webapp's admin API (authentication, setup). */
export function adminUrl(path: string): string {
  return `${appRoot}/api/admin${path}`;
}
