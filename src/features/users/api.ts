import { config } from '../../lib/config';
import { apiFetch, ApiError } from '../../lib/httpClient';

export type UserResult = {
  userId: string;
  displayName: string | null;
  email: string | null;
  phoneNumber: string | null;
  avatarObjectKey: string | null;
};

export function searchUsers(query: string): Promise<UserResult[]> {
  const params = query ? `?q=${encodeURIComponent(query)}` : '';
  return apiFetch(`${config.authServiceUrl}/api/users${params}`);
}

export function getUser(userId: string): Promise<UserResult> {
  return apiFetch(`${config.authServiceUrl}/api/users/${userId}`);
}

/**
 * Looks up a single phone number the caller typed manually. Returns the
 * account if one is registered with that exact number, or null if not —
 * same endpoint/contract as mobile's lookupByPhone, used to decide between
 * "start a chat with this person" and "offer to invite this number".
 */
export async function lookupByPhone(phoneNumber: string): Promise<UserResult | null> {
  try {
    return await apiFetch<UserResult>(`${config.authServiceUrl}/api/users/lookup-by-phone`, {
      method: 'POST',
      body: JSON.stringify({ phoneNumber }),
    });
  } catch (e: unknown) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

export function updateMyProfile(fields: { displayName?: string; avatarObjectKey?: string }): Promise<UserResult> {
  return apiFetch(`${config.authServiceUrl}/api/users/me`, {
    method: 'PUT',
    body: JSON.stringify(fields),
  });
}

export function deleteMyAccount(): Promise<void> {
  return apiFetch(`${config.authServiceUrl}/api/users/me`, { method: 'DELETE' });
}

export type IdentifierField = { newPhoneNumber: string } | { newEmail: string };

function identifierChangeBody(field: IdentifierField) {
  return 'newPhoneNumber' in field ? { newPhoneNumber: field.newPhoneNumber } : { newEmail: field.newEmail };
}

export function requestIdentifierChange(field: IdentifierField): Promise<void> {
  return apiFetch(`${config.authServiceUrl}/api/users/me/identifier/request-otp`, {
    method: 'POST',
    body: JSON.stringify(identifierChangeBody(field)),
  });
}

export function confirmIdentifierChange(field: IdentifierField, code: string): Promise<UserResult> {
  return apiFetch(`${config.authServiceUrl}/api/users/me/identifier/confirm`, {
    method: 'POST',
    body: JSON.stringify({ ...identifierChangeBody(field), code }),
  });
}

export function listBlockedUsers(): Promise<{ userId: string }[]> {
  return apiFetch(`${config.authServiceUrl}/api/users/me/blocked`);
}

export function blockUser(userId: string): Promise<void> {
  return apiFetch(`${config.authServiceUrl}/api/users/me/blocked/${userId}`, { method: 'POST' });
}

export function unblockUser(userId: string): Promise<void> {
  return apiFetch(`${config.authServiceUrl}/api/users/me/blocked/${userId}`, { method: 'DELETE' });
}

export function reportUser(userId: string, reason: string): Promise<void> {
  return apiFetch(`${config.authServiceUrl}/api/users/${userId}/report`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}
