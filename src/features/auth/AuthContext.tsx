import { createContext, useContext, useMemo, useState, type PropsWithChildren } from 'react';

import { session, type StoredSession } from '../../lib/authStorage';
import { currentDeviceLabel } from '../../lib/deviceLabel';
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
  signInWithOtp: (identifier: Identifier, code: string) => Promise<{ isNewAccount: boolean }>;
  /** Applies a token response obtained without OTP verification — currently only the system-account access identifier's /otp/request short-circuit (see requestOtp's doc comment). */
  completeSystemLogin: (res: VerifyOtpResponse) => void;
  updateProfile: (fields: { displayName?: string; avatarObjectKey?: string | null }) => void;
  signOut: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [stored, setStored] = useState<StoredSession | null>(() => session.load());

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
        session.clear();
        setStored(null);
      },
    }),
    [stored]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
