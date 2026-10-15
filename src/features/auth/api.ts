import { config } from '../../lib/config';
import { apiFetch } from '../../lib/httpClient';

export type Identifier = { type: 'phone'; value: string } | { type: 'email'; value: string };

function identifierBody(identifier: Identifier) {
  return identifier.type === 'phone' ? { phoneNumber: identifier.value } : { email: identifier.value };
}

/**
 * Normally resolves to undefined (a plain 202 Accepted, empty body) and the
 * caller navigates to the code-entry screen next. The one exception is the
 * system-account access identifier (see auth-service's SystemAccountService)
 * — the server skips the whole OTP flow for it and returns a real token
 * payload here instead, which the caller detects and uses to sign in
 * directly, no code screen involved.
 */
export function requestOtp(identifier: Identifier): Promise<VerifyOtpResponse | undefined> {
  return apiFetch(`${config.authServiceUrl}/api/auth/otp/request`, {
    method: 'POST',
    body: JSON.stringify(identifierBody(identifier)),
  });
}

export type VerifyOtpResponse = {
  accessToken: string;
  userId: string;
  displayName: string | null;
  avatarObjectKey: string | null;
  email: string | null;
  phoneNumber: string | null;
};

/**
 * Thrown as an ApiError with status 403 and this shape in `body` when the
 * account already has the maximum number of linked devices — see
 * AuthController.DeviceLimitError. The master device must remove one
 * (features/sessions/api.ts's revokeSession) before another can sign in.
 */
export type DeviceLimitErrorBody = { reason: 'DEVICE_LIMIT_REACHED'; maxLinkedDevices: number };

// platform: 'web' (as opposed to mobile's 'mobile') is purely for the
// Session table's own record-keeping — phones, tablets, and web sessions
// all share one device cap regardless of platform value (see
// AuthController#verifyOtp).
export function verifyOtp(identifier: Identifier, code: string, deviceLabel?: string | null): Promise<VerifyOtpResponse> {
  return apiFetch(`${config.authServiceUrl}/api/auth/otp/verify`, {
    method: 'POST',
    body: JSON.stringify({ ...identifierBody(identifier), code, deviceLabel, platform: 'web' }),
  });
}

/** WhatsApp-Web-style QR device linking — see auth-service's PairingController/PairingService. No auth on any of these: the pairing token/code is what gates them, same trust model as an OTP code. `code` is the short, hand-typeable fallback shown alongside the QR — only ever typed on the OTHER (approving) device's manual-entry screen, never used here. `expiresInSeconds` is the admin-configurable pairing lifetime (riskyc.pairing.pending-ttl-seconds) — the caller schedules its own refresh timer from this value instead of hardcoding one. */
export function startPairing(deviceLabel: string): Promise<{ token: string; code: string; expiresInSeconds: number }> {
  return apiFetch(`${config.authServiceUrl}/api/auth/pairing/start`, {
    method: 'POST',
    body: JSON.stringify({ deviceLabel, platform: 'web' }),
  });
}

export type PairingStatus = { status: 'PENDING' | 'APPROVED' | 'DENIED' | 'EXPIRED'; session: VerifyOtpResponse | null };

export function pollPairingStatus(token: string): Promise<PairingStatus> {
  return apiFetch(`${config.authServiceUrl}/api/auth/pairing/${encodeURIComponent(token)}/status`);
}
