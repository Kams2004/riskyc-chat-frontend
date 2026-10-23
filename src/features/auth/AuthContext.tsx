import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';

import { session, type StoredSession } from '../../lib/authStorage';
import { currentDeviceLabel } from '../../lib/deviceLabel';
import { SESSION_REVOKED_EVENT } from '../../lib/httpClient';
import { listSessions, revokeSession } from '../sessions/api';
import * as authApi from './api';
import type { Identifier, VerifyOtpResponse } from './api';

type AuthState = {
  isLoading: boolean;
  userId: string | null;
  accessToken: string | null;
  displayName: string | null;
  avatarObjectKey: string | null;
  email: string | null;
  phoneNumber: string | null;
  /** Whether THIS tab/browser is the account's master device — see SessionResult.isMaster's own doc comment. Defaults to false until the sessions list resolves. */
  isMaster: boolean;
  signInWithOtp: (identifier: Identifier, code: string) => Promise<{ isNewAccount: boolean }>;
  /** Applies a token response obtained without OTP verification — currently only the system-account access identifier's /otp/request short-circuit (see requestOtp's doc comment). */
  completeSystemLogin: (res: VerifyOtpResponse) => void;
  updateProfile: (fields: { displayName?: string; avatarObjectKey?: string | null }) => void;
  signOut: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [stored, setStored] = useState<StoredSession | null>(() => session.load());
  const [isMaster, setIsMaster] = useState(false);

  // Best-effort — a failed fetch just leaves isMaster at its previous value
  // (false by default), which only ever hides a master-only action a real
  // master could have used; it never grants one to a non-master device.
  function refreshIsMaster() {
    listSessions()
      .then((sessions) => setIsMaster(sessions.find((s) => s.isCurrent)?.isMaster ?? false))
      .catch((e) => console.warn('[AuthContext] failed to refresh master-device status', e));
  }

  useEffect(() => {
    if (stored?.accessToken) refreshIsMaster();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // This tab's own session was revoked server-side (see httpClient.ts's
  // SESSION_REVOKED_EVENT doc comment) — clear local state directly rather
  // than calling the full signOut() below: that one makes its own
  // authenticated request (revoke), which would also 401 against an
  // already-dead token and re-fire this same event, looping forever. No
  // server call here is correct anyway — there's nothing left to revoke.
  useEffect(() => {
    function onSessionRevoked() {
      session.clear();
      setStored(null);
      setIsMaster(false);
    }
    window.addEventListener(SESSION_REVOKED_EVENT, onSessionRevoked);
    return () => window.removeEventListener(SESSION_REVOKED_EVENT, onSessionRevoked);
  }, []);

  function applySession(res: VerifyOtpResponse) {
    const next: StoredSession = {
      accessToken: res.accessToken,
      userId: res.userId,
      displayName: res.displayName,
      avatarObjectKey: res.avatarObjectKey,
      email: res.email,
      phoneNumber: res.phoneNumber,
    };
    session.save(next);
    setStored(next);
    refreshIsMaster();
  }

  const value = useMemo<AuthState>(
    () => ({
      isLoading: false,
      userId: stored?.userId ?? null,
      accessToken: stored?.accessToken ?? null,
      displayName: stored?.displayName ?? null,
      avatarObjectKey: stored?.avatarObjectKey ?? null,
      email: stored?.email ?? null,
      phoneNumber: stored?.phoneNumber ?? null,
      isMaster,
      async signInWithOtp(identifier, code) {
        const res = await authApi.verifyOtp(identifier, code, currentDeviceLabel());
        applySession(res);
        return { isNewAccount: !res.displayName };
      },
      completeSystemLogin(res) {
        applySession(res);
      },
      updateProfile(fields) {
        if (!stored) return;
        const next: StoredSession = {
          ...stored,
          displayName: fields.displayName ?? stored.displayName,
          avatarObjectKey: fields.avatarObjectKey === undefined ? stored.avatarObjectKey : fields.avatarObjectKey,
        };
        session.save(next);
        setStored(next);
      },
      signOut() {
        // Fire-and-forget, not awaited: apiFetch reads the token from
        // storage synchronously at call time (see httpClient.ts), so this
        // still captures the right token even though session.clear() below
        // runs on the very next line, and local sign-out stays instant
        // rather than waiting on a network round trip. Best-effort: a
        // network hiccup here shouldn't block signing out locally. Ported
        // from mobile's AuthContext.tsx, which had the exact same gap —
        // signing out never told the server, leaving the session row's
        // revoked flag false forever (harmless for web specifically, since
        // the backend's one-active-mobile-session check is mobile-only, but
        // still a real hygiene gap: the "Logged-in devices" screen's own
        // purpose is to let you revoke sessions, and a signed-out session's
        // token otherwise stays valid indefinitely).
        // If this IS the master device, the server cascades: every other
        // linked device gets signed out too (see SessionController#revoke)
        // — by design, not a bug, see Session.isMaster's own doc comment.
        listSessions()
          .then((sessions) => {
            const current = sessions.find((s) => s.isCurrent);
            return current ? revokeSession(current.id) : undefined;
          })
          .catch((e) => console.warn('[signOut] failed to revoke current session', e));
        session.clear();
        setStored(null);
        setIsMaster(false);
      },
    }),
    [stored, isMaster]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
