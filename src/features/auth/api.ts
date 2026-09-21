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

// platform: 'web' (as opposed to mobile's 'mobile') is purely for the
// Session table's own record-keeping — web is deliberately exempt from
// auth-service's one-active-mobile-session-per-account rule either way, see
// AuthController.OtpVerifyRequest's own doc comment.
export function verifyOtp(identifier: Identifier, code: string, deviceLabel?: string | null): Promise<VerifyOtpResponse> {
  return apiFetch(`${config.authServiceUrl}/api/auth/otp/verify`, {
    method: 'POST',
    body: JSON.stringify({ ...identifierBody(identifier), code, deviceLabel, platform: 'web' }),
  });
}

/** WhatsApp-Web-style QR device linking — see auth-service's PairingController/PairingService. No auth on any of these three: the pairing token itself (32 random bytes) is what gates them, same trust model as an OTP code. */
export function startPairing(deviceLabel: string): Promise<{ token: string }> {
  return apiFetch(`${config.authServiceUrl}/api/auth/pairing/start`, {
    method: 'POST',
    body: JSON.stringify({ deviceLabel }),
  });
}

export type PairingStatus = { status: 'PENDING' | 'APPROVED' | 'DENIED' | 'EXPIRED'; session: VerifyOtpResponse | null };

export function pollPairingStatus(token: string): Promise<PairingStatus> {
  return apiFetch(`${config.authServiceUrl}/api/auth/pairing/${encodeURIComponent(token)}/status`);
}
