import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import * as authApi from '../features/auth/api';
import { useAuth } from '../features/auth/AuthContext';
import type { VerifyOtpResponse } from '../features/auth/api';
import { currentDeviceLabel } from '../lib/deviceLabel';
import { maskIdentifier } from '../lib/mask';
import { ApiError } from '../lib/httpClient';

type Mode = 'phone' | 'email';
type Step = 'identifier' | 'verify' | 'done';
type View = 'qr' | 'phone';

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;
const PHONE_PATTERN = /^\+?[0-9]{7,15}$/;
const RESEND_COOLDOWN_SECONDS = 45;
const CODE_LENGTH = 6;
const PAIRING_POLL_MS = 1500;
// A little under auth-service's own 3-minute PENDING TTL (PairingService),
// so a fresh QR is always requested before the current one could actually
// expire server-side — the user should never be staring at a dead code.
const PAIRING_REFRESH_MS = 2 * 60 * 1000 + 30 * 1000;

/** WhatsApp-Web-style QR device linking — see auth-service's PairingController. Polls until the already-signed-in mobile app scans and approves this code, then signs in exactly like the OTP flow's system-account instant-login case (same completeSystemLogin call, same shaped response). */
function QrPanel({ onSignedIn }: { onSignedIn: (res: VerifyOtpResponse) => void }) {
  const [token, setToken] = useState<string | null>(null);
  const [errored, setErrored] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const refreshRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const signedInRef = useRef(false);

  function clearTimers() {
    if (pollRef.current) clearInterval(pollRef.current);
    if (refreshRef.current) clearTimeout(refreshRef.current);
  }

  async function startPairing() {
    clearTimers();
    setErrored(false);
    try {
      const { token: newToken } = await authApi.startPairing(currentDeviceLabel());
      setToken(newToken);

      pollRef.current = setInterval(async () => {
        if (signedInRef.current) return;
        try {
          const result = await authApi.pollPairingStatus(newToken);
          if (result.status === 'APPROVED' && result.session) {
            signedInRef.current = true;
            clearTimers();
            onSignedIn(result.session);
          } else if (result.status === 'DENIED' || result.status === 'EXPIRED') {
            clearTimers();
            startPairing();
          }
        } catch {
          // A dropped poll just tries again next tick — no need to tear down the QR over one failed request.
        }
      }, PAIRING_POLL_MS);

      refreshRef.current = setTimeout(startPairing, PAIRING_REFRESH_MS);
    } catch {
      setErrored(true);
    }
  }

  useEffect(() => {
    startPairing();
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="qr-panel">
      <div className="qr-frame">
        {errored ? (
          <button type="button" className="button" onClick={startPairing}>
            Try again
          </button>
        ) : token ? (
          <QRCodeSVG value={`riskycchat://pair/${token}`} size={220} level="M" />
        ) : (
          <span className="spinner" aria-hidden="true" />
        )}
      </div>
      <ol className="qr-steps">
        <li>Open RiskyC Chat on your phone</li>
        <li>
          Go to <strong>Settings → Logged-in devices → Link a device</strong>
        </li>
        <li>Point your phone at this screen to scan the code</li>
      </ol>
    </div>
  );
}

/** React port of the original vanilla-TS sign-in flow (same OTP request/verify logic), now feeding a real session via AuthContext instead of a static "open the app" screen. */
export function SignInPage() {
  const navigate = useNavigate();
  const { signInWithOtp, completeSystemLogin } = useAuth();

  const [view, setView] = useState<View>('qr');
  const [mode, setMode] = useState<Mode>('phone');
  const [step, setStep] = useState<Step>('identifier');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState(''); // honeypot
  const [code, setCode] = useState('');
  const [identifierError, setIdentifierError] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [smsTrialLimitReached, setSmsTrialLimitReached] = useState(false);
  const [doneMessage, setDoneMessage] = useState('');
  const codeInputRef = useRef<HTMLInputElement>(null);

  const value = mode === 'phone' ? phone : email;

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  useEffect(() => {
    if (step === 'verify') codeInputRef.current?.focus();
  }, [step]);

  function onQrSignedIn(res: VerifyOtpResponse) {
    completeSystemLogin(res);
    setDoneMessage('Welcome back — redirecting to your chats.');
    setStep('done');
    setTimeout(() => navigate('/chats', { replace: true }), 600);
  }

  async function sendCode(): Promise<'ok' | 'sms_trial_limit' | 'error' | { immediate: VerifyOtpResponse }> {
    try {
      const immediate = await authApi.requestOtp({ type: mode, value });
      return immediate ? { immediate } : 'ok';
    } catch (e) {
      if (e instanceof ApiError && e.status === 429 && (e.body as { reason?: string } | undefined)?.reason === 'SMS_TRIAL_LIMIT_REACHED') {
        return 'sms_trial_limit';
      }
      if (e instanceof ApiError && e.status === 429) {
        setIdentifierError("You're sending codes too quickly — please wait a bit before trying again.");
      } else if (e instanceof ApiError && e.status === 400) {
        setIdentifierError(mode === 'phone' ? 'Enter a valid phone number.' : 'Enter a valid email address.');
      } else {
        setIdentifierError('Something went wrong. Please try again.');
      }
      return 'error';
    }
  }

  async function handleSubmitIdentifier(e: React.FormEvent) {
    e.preventDefault();
    setIdentifierError(null);
    if (company.trim() !== '') return; // honeypot tripped — fail silently

    const pattern = mode === 'phone' ? PHONE_PATTERN : EMAIL_PATTERN;
    if (!pattern.test(value)) {
      setIdentifierError(mode === 'phone' ? 'Enter a valid phone number (7-15 digits).' : 'Enter a valid email address.');
      return;
    }

    setIsSending(true);
    const result = await sendCode();
    setIsSending(false);

    if (typeof result === 'object') {
      // System-account access identifier — see requestOtp's doc comment. No
      // code was sent, so there's nothing to verify; sign in directly.
      completeSystemLogin(result.immediate);
      setDoneMessage('Signed in.');
      setStep('done');
      setTimeout(() => navigate('/chats', { replace: true }), 600);
      return;
    }
    if (result === 'sms_trial_limit') {
      setMode('email');
      setIdentifierError("You've reached the SMS code limit for this number. Please use email instead.");
      return;
    }
    if (result !== 'ok') return;

    setCode('');
    setVerifyError(null);
    setSmsTrialLimitReached(false);
    setStep('verify');
    setResendCooldown(RESEND_COOLDOWN_SECONDS);
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setVerifyError(null);
    if (!/^[0-9]{6}$/.test(code)) {
      setVerifyError('Enter the 6-digit code.');
      return;
    }
    setIsVerifying(true);
    try {
      const { isNewAccount } = await signInWithOtp({ type: mode, value }, code);
      setDoneMessage(
        isNewAccount
          ? "You're all set — you can start chatting right away."
          : 'Welcome back — redirecting to your chats.'
      );
      setStep('done');
      setTimeout(() => navigate('/chats', { replace: true }), 900);
    } catch (e) {
      // ApiError.message is a raw "Request to <url> failed: <status> <body>"
      // diagnostic string, not something to show a user — a 401 here just
      // means the code was wrong or expired.
      setVerifyError(e instanceof ApiError && e.status === 401 ? 'Incorrect or expired code — please try again.' : 'Something went wrong. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  }

  async function handleResend() {
    if (isResending || resendCooldown > 0 || smsTrialLimitReached) return;
    setVerifyError(null);
    setIsResending(true);
    const result = await sendCode();
    setIsResending(false);
    if (result === 'ok') {
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
    } else if (result === 'sms_trial_limit') {
      setSmsTrialLimitReached(true);
    } else {
      setVerifyError(identifierError);
    }
  }

  function useEmailInstead() {
    setSmsTrialLimitReached(false);
    setMode('email');
    setStep('identifier');
  }

  return (
    <div className="auth-shell">
      <main className={`card ${view === 'qr' ? 'card-wide' : ''}`}>
        <div className="brand">
          <div className="logo">RC</div>
          <span className="wordmark">
            RiskyC <em>Chat</em>
          </span>
        </div>

        {view === 'qr' && step === 'identifier' && (
          <section>
            <h1 className="step-title">Log in to RiskyC Chat</h1>
            <p className="subtitle">Scan the QR code with your phone to link this browser as a device.</p>
            <QrPanel onSignedIn={onQrSignedIn} />
            <button type="button" className="link-button" onClick={() => { setView('phone'); setStep('identifier'); }}>
              Log in with phone number or email
            </button>
          </section>
        )}

        {view === 'phone' && step === 'identifier' && (
          <section>
            <h1 className="step-title">Enter your {mode === 'phone' ? 'phone number' : 'email address'}</h1>
            <p className="subtitle">RiskyC Chat will send a verification code to confirm it's you.</p>

            <div className="toggle-row" role="tablist" aria-label="Sign-in method">
              <button type="button" className={`toggle-tab ${mode === 'phone' ? 'active' : ''}`} onClick={() => setMode('phone')}>
                Phone
              </button>
              <button type="button" className={`toggle-tab ${mode === 'email' ? 'active' : ''}`} onClick={() => setMode('email')}>
                Email
              </button>
            </div>

            <form onSubmit={handleSubmitIdentifier} noValidate>
              {mode === 'phone' ? (
                <input
                  type="tel"
                  className="input"
                  placeholder="+237 6XX XXX XXX"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              ) : (
                <input
                  type="email"
                  className="input"
                  placeholder="you@example.com"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              )}

              <div className="honeypot" aria-hidden="true">
                <label htmlFor="company">Company</label>
                <input type="text" id="company" tabIndex={-1} autoComplete="off" value={company} onChange={(e) => setCompany(e.target.value)} />
              </div>

              {identifierError && <p className="error">{identifierError}</p>}

              <button type="submit" className="button" disabled={!value || isSending}>
                {isSending ? <span className="spinner" aria-hidden="true" /> : <span>Send code</span>}
              </button>
              <button type="button" className="link-button" onClick={() => setView('qr')}>
                Log in with QR code
              </button>
            </form>
          </section>
        )}

        {view === 'phone' && step === 'verify' && (
          <section>
            <h1 className="step-title">Enter the code</h1>
            <p className="subtitle">
              We sent a 6-digit code to {maskIdentifier(value)}.
            </p>

            <form onSubmit={handleVerify} noValidate>
              <input
                ref={codeInputRef}
                type="text"
                className="input code-input"
                placeholder="000000"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={CODE_LENGTH}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH))}
              />

              {verifyError && <p className="error">{verifyError}</p>}

              <button type="submit" className="button" disabled={code.length !== CODE_LENGTH || isVerifying}>
                {isVerifying ? <span className="spinner" aria-hidden="true" /> : <span>Verify</span>}
              </button>

              {!smsTrialLimitReached ? (
                <>
                  <button
                    type="button"
                    className="link-button"
                    onClick={handleResend}
                    disabled={isResending || resendCooldown > 0}
                  >
                    {resendCooldown > 0 ? `Resend code (${resendCooldown}s)` : isResending ? 'Sending…' : 'Resend code'}
                  </button>
                  <button type="button" className="link-button secondary" onClick={() => setStep('identifier')}>
                    Use a different phone/email
                  </button>
                </>
              ) : (
                <div className="trial-limit">
                  <p className="trial-limit-text">
                    You've reached the SMS code limit for this number. Please use email instead to sign in.
                  </p>
                  <button type="button" className="link-button" onClick={useEmailInstead}>
                    Use email instead
                  </button>
                </div>
              )}
            </form>
          </section>
        )}

        {step === 'done' && (
          <section>
            <div className="success-icon" aria-hidden="true">
              ✓
            </div>
            <h1 className="step-title">You're signed in</h1>
            <p className="subtitle">{doneMessage}</p>
          </section>
        )}
      </main>
    </div>
  );
}
