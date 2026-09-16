import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import * as authApi from '../features/auth/api';
import { useAuth } from '../features/auth/AuthContext';
import { maskIdentifier } from '../lib/mask';
import { ApiError } from '../lib/httpClient';

type Mode = 'phone' | 'email';
type Step = 'identifier' | 'verify' | 'done';

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;
const PHONE_PATTERN = /^\+?[0-9]{7,15}$/;
const RESEND_COOLDOWN_SECONDS = 45;
const CODE_LENGTH = 6;

/** React port of the original vanilla-TS sign-in flow (same OTP request/verify logic), now feeding a real session via AuthContext instead of a static "open the app" screen. */
export function SignInPage() {
  const navigate = useNavigate();
  const { signInWithOtp } = useAuth();

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

  async function sendCode(): Promise<'ok' | 'sms_trial_limit' | 'error'> {
    try {
      await authApi.requestOtp({ type: mode, value });
      return 'ok';
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
      <main className="card">
        <div className="brand">
          <div className="logo">RC</div>
          <span className="wordmark">
            RiskyC <em>Chat</em>
          </span>
        </div>

        {step === 'identifier' && (
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
            </form>
          </section>
        )}

        {step === 'verify' && (
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
