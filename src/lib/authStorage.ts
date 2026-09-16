/**
 * The current web app has no session persistence at all today — after
 * verifyOtp it just shows a static "done" screen. localStorage is the right
 * tradeoff here (not, say, an httpOnly cookie + server session): the
 * security scope for this app is "general hardening," not zero-trust/E2E,
 * and mobile's own token storage (expo-secure-store) is likewise a plain
 * bearer token, not a server session — this matches that shape on web.
 */
const STORAGE_KEY = 'riskyc.session';

export type StoredSession = {
  accessToken: string;
  userId: string;
  displayName: string | null;
  avatarObjectKey: string | null;
  email: string | null;
  phoneNumber: string | null;
};

export const session = {
  load(): StoredSession | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as StoredSession) : null;
    } catch {
      return null;
    }
  },
  save(value: StoredSession) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch {
      // Best-effort — a viewer with storage disabled just won't stay signed in across reloads.
    }
  },
  clear() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // No-op if storage is unavailable.
    }
  },
};
