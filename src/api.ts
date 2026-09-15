/**
 * Same pattern as mobile/src/lib/config.ts — defaults to the deployed VPS so
 * a fresh clone works with zero setup; override via .env.local for local
 * backend dev. Plain HTTP, not HTTPS: the VPS has no TLS-terminating
 * reverse proxy in front of auth-service yet (same caveat as the mobile
 * app — traffic is unencrypted on the wire until that's added).
 */
const AUTH_SERVICE_URL = import.meta.env.VITE_AUTH_SERVICE_URL ?? 'http://167.86.120.214:8091';

const REQUEST_TIMEOUT_MS = 20000;

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public reason?: string
  ) {
    super(message);
  }
}

async function apiFetch<T>(path: string, body: unknown): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${AUTH_SERVICE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    if (controller.signal.aborted) {
      throw new ApiError('Request timed out — check your connection and try again.', 0);
    }
    throw new ApiError('Could not reach the server — check your connection and try again.', 0);
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 429) {
    const bodyText = await response.text();
    let reason: string | undefined;
    try {
      reason = bodyText ? (JSON.parse(bodyText) as { reason?: string }).reason : undefined;
    } catch {
      reason = undefined;
    }
    throw new ApiError('Too many attempts — please wait a bit before trying again.', 429, reason);
  }
  if (!response.ok) {
    throw new ApiError('Something went wrong. Please check your details and try again.', response.status);
  }
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export type Identifier = { type: 'phone'; value: string } | { type: 'email'; value: string };

export function requestOtp(identifier: Identifier): Promise<void> {
  const body = identifier.type === 'phone' ? { phoneNumber: identifier.value } : { email: identifier.value };
  return apiFetch('/api/auth/otp/request', body);
}

export type TokenResponse = {
  accessToken: string;
  userId: string;
  displayName: string | null;
  avatarObjectKey: string | null;
  email: string | null;
  phoneNumber: string | null;
};

export function verifyOtp(identifier: Identifier, code: string): Promise<TokenResponse> {
  const body =
    identifier.type === 'phone' ? { phoneNumber: identifier.value, code } : { email: identifier.value, code };
  return apiFetch('/api/auth/otp/verify', body);
}
