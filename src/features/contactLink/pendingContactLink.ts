import { COUNTRIES } from '../../lib/countries';

const KEY = 'riskycchat.pendingContactPath';

/**
 * /contact?phone=… opened while signed out: remembered for this browser tab so sign-in lands back on it instead of
 * the chat list (see SignIn's redirects). sessionStorage, so a link never reopens in a later visit by surprise.
 */
export function rememberPendingContactPath(path: string) {
  try {
    sessionStorage.setItem(KEY, path);
  } catch {
    // storage unavailable (private mode) — sign-in simply lands on the chat list
  }
}

/** Where to go right after signing in: a remembered contact link (once), otherwise the chat list. */
export function takePostSignInPath(): string {
  try {
    const path = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    if (path && path.startsWith('/contact')) return path;
  } catch {
    // ignore
  }
  return '/chats';
}

/**
 * A link's phone is meant to be E.164 but may arrive without '+' or with spaces. Accounts are stored in full
 * international form: keep an explicit '+'; digits already starting with the default country code (with room for a
 * local number after it) count as international; otherwise prepend the signed-in user's own country code, or the
 * default (first) country — the same default the New chat page uses.
 */
export function normalizeLinkPhone(raw: string, ownPhoneNumber?: string | null): string {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/[^\d]/g, '');
  if (trimmed.startsWith('+')) return `+${digits}`;
  const own = ownPhoneNumber
    ? [...COUNTRIES].sort((a, b) => b.dialCode.length - a.dialCode.length).find((c) => ownPhoneNumber.startsWith(c.dialCode))
    : undefined;
  const dial = (own ?? COUNTRIES[0]).dialCode;
  const dialDigits = dial.replace('+', '');
  if (digits.startsWith(dialDigits) && digits.length >= dialDigits.length + 8) return `+${digits}`;
  return `${dial}${digits}`;
}
