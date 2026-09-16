import { session } from './authStorage';

const REQUEST_TIMEOUT_MS = 20000;

/** Same shape as mobile's — carries status + parsed body so callers can branch on specific server-side reasons. */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown
  ) {
    super(message);
  }
}

/** Generic authenticated fetch wrapper — same pattern as mobile/src/lib/httpClient.ts's apiFetch. */
export async function apiFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const stored = session.load();
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (stored?.accessToken) {
    headers.set('Authorization', `Bearer ${stored.accessToken}`);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, { ...init, headers, signal: controller.signal });
  } catch (e) {
    if (controller.signal.aborted) {
      throw new ApiError(`Request to ${url} timed out after ${REQUEST_TIMEOUT_MS / 1000}s`, 0);
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }
  const text = await response.text();

  if (!response.ok) {
    let body: unknown;
    try {
      body = text ? JSON.parse(text) : undefined;
    } catch {
      body = undefined;
    }
    throw new ApiError(`Request to ${url} failed: ${response.status} ${text}`, response.status, body);
  }
  if (!text) {
    return undefined as T;
  }
  return JSON.parse(text) as T;
}
