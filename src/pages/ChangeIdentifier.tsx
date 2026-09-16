import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { confirmIdentifierChange, requestIdentifierChange, type IdentifierField } from '../features/users/api';
import { ApiError } from '../lib/httpClient';

type Mode = 'phone' | 'email';
const CODE_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 45;

function fieldFor(mode: Mode, value: string): IdentifierField {
  return mode === 'phone' ? { newPhoneNumber: value } : { newEmail: value };
}

/** Web port of mobile's change-identifier.tsx — same two-step flow against the same Phase 2 backend endpoints. */
export function ChangeIdentifierPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const mode: Mode = (location.state as { mode?: Mode } | null)?.mode === 'phone' ? 'phone' : 'email';

  const [step, setStep] = useState<'enter' | 'verify'>('enter');
  const [value, setValue] = useState('');
  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [smsTrialLimitReached, setSmsTrialLimitReached] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  function describeError(e: unknown): string {
    if (e instanceof ApiError) {
      if (e.status === 409) return `This ${mode === 'phone' ? 'number' : 'email'} is already in use by another account.`;
      if (e.status === 401) return 'Incorrect or expired code — please try again.';
      if (e.status === 400) return mode === 'phone' ? 'Enter a valid phone number.' : 'Enter a valid email address.';
      const reason = (e.body as { reason?: string } | undefined)?.reason;
      if (e.status === 429 && reason !== 'SMS_TRIAL_LIMIT_REACHED') {
        return "You're sending codes too quickly — please wait a bit before trying again.";
      }
    }
    // Anything else (including ApiError.message itself, a raw "Request to
    // <url> failed: <status> <body>" diagnostic string) isn't fit to show a
    // user — same reasoning as SignIn.tsx's verify-step error handling.
    return 'Something went wrong. Please try again.';
  }

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await requestIdentifierChange(fieldFor(mode, value));
      setStep('verify');
      setCode('');
      setSmsTrialLimitReached(false);
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (e) {
      if (e instanceof ApiError && e.status === 429 && (e.body as { reason?: string } | undefined)?.reason === 'SMS_TRIAL_LIMIT_REACHED') {
        setError("You've reached the SMS code limit for this number. Please try again later, or use email instead.");
      } else {
        setError(describeError(e));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResend() {
    if (isResending || resendCooldown > 0 || smsTrialLimitReached) return;
    setError(null);
    setIsResending(true);
    try {
      await requestIdentifierChange(fieldFor(mode, value));
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (e) {
      if (e instanceof ApiError && e.status === 429 && (e.body as { reason?: string } | undefined)?.reason === 'SMS_TRIAL_LIMIT_REACHED') {
        setSmsTrialLimitReached(true);
      } else {
        setError(describeError(e));
      }
    } finally {
      setIsResending(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await confirmIdentifierChange(fieldFor(mode, value), code);
      navigate('/settings/account');
    } catch (e) {
      setError(describeError(e));
      setCode('');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="settings-page">
      <button className="back-link" onClick={() => (step === 'verify' ? setStep('enter') : navigate(-1))}>
        ← Back
      </button>
      <h1>Change {mode === 'phone' ? 'phone number' : 'email'}</h1>

      {step === 'enter' ? (
        <form onSubmit={handleSendCode}>
          <p className="subtitle">
            Enter your new {mode === 'phone' ? 'phone number' : 'email address'}. We'll send a code to confirm it's yours.
          </p>
          <input
            className="input"
            placeholder={mode === 'phone' ? '+237 6XX XXX XXX' : 'you@example.com'}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
          />
          {error && <p className="error">{error}</p>}
          <button type="submit" className="button" disabled={!value || isSubmitting}>
            {isSubmitting ? <span className="spinner" /> : 'Send code'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerify}>
          <p className="subtitle">
            Enter the code we sent to <strong>{value}</strong>
          </p>
          <input
            className="input code-input"
            inputMode="numeric"
            maxLength={CODE_LENGTH}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH))}
            autoFocus
          />
          {error && <p className="error">{error}</p>}
          <button type="submit" className="button" disabled={code.length !== CODE_LENGTH || isSubmitting}>
            {isSubmitting ? <span className="spinner" /> : 'Verify'}
          </button>

          {!smsTrialLimitReached ? (
            <button type="button" className="link-button" onClick={handleResend} disabled={isResending || resendCooldown > 0}>
              {resendCooldown > 0 ? `Resend code (${resendCooldown}s)` : isResending ? 'Sending…' : 'Resend code'}
            </button>
          ) : (
            <p className="trial-limit-text" style={{ marginTop: 16 }}>
              You've reached the SMS code limit for this number. Please try again later, or use email instead.
            </p>
          )}
        </form>
      )}
    </div>
  );
}
