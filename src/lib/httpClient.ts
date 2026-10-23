import { session } from './authStorage';

const REQUEST_TIMEOUT_MS = 20000;

/**
 * Fired when an authenticated request (one that attached a stored access
 * token) comes back 401 — the only reliable, request-agnostic signal that
 * this device's own session was revoked server-side (its own master
 * signing it out, a master's self-revoke cascade, or an admin suspension).
 * AuthContext listens for this and signs out locally instead of every
 * screen's own try/catch silently swallowing the error and looking broken.
 * Deliberately NOT fired for a 401 with no stored token to begin with
 * (e.g. a wrong OTP code on verify) — same mobile-side distinction, see
 * mobile/src/lib/httpClient.ts's own copy of this constant.
 */
export const SESSION_REVOKED_EVENT = 'riskyc:sessionRevoked';

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
    if (response.status === 401 && stored?.accessToken) {
      window.dispatchEvent(new CustomEvent(SESSION_REVOKED_EVENT));
    }
    throw new ApiError(`Request to ${url} failed: ${response.status} ${text}`, response.status, body);
  }
  if (!text) {
    return undefined as T;
  }
  return JSON.parse(text) as T;
}
