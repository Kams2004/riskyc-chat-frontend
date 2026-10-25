import { config } from '../../lib/config';
import { apiFetch, ApiError } from '../../lib/httpClient';

export type SystemAccountInfo = {
  userId: string;
  displayName: string;
  avatarObjectKey: string | null;
  description: string;
  websiteUrl: string;
};

// Same module-level cache as mobile's identical file — this rarely (if
// ever) changes for the lifetime of a tab, and every thread/contact-info
// view wants to know "is the other party the official account". `null`
// means "not fetched yet", `'none'` means the feature is disabled (404).
let cached: SystemAccountInfo | 'none' | null = null;
let inFlight: Promise<SystemAccountInfo | 'none'> | null = null;

async function fetchSystemAccountInfo(): Promise<SystemAccountInfo | 'none'> {
  try {
    return await apiFetch<SystemAccountInfo>(`${config.authServiceUrl}/api/system-account`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return 'none';
    throw e;
  }
}

/** Cached — safe to call from every thread/contact-info view without worrying about redundant network calls. */
export async function getSystemAccountInfo(): Promise<SystemAccountInfo | null> {
  if (cached !== null) return cached === 'none' ? null : cached;
  if (!inFlight) inFlight = fetchSystemAccountInfo();
  const result = await inFlight;
  cached = result;
  inFlight = null;
  return result === 'none' ? null : result;
}
