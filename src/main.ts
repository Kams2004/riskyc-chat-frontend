import { ApiError, requestOtp, verifyOtp, type Identifier } from './api';

type Mode = 'phone' | 'email';

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;
const PHONE_PATTERN = /^\+?[0-9]{7,15}$/;
const RESEND_COOLDOWN_SECONDS = 45;

const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const titleEl = el<HTMLHeadingElement>('title');
const tabPhone = el<HTMLButtonElement>('tab-phone');
const tabEmail = el<HTMLButtonElement>('tab-email');
const inputPhone = el<HTMLInputElement>('input-phone');
const inputEmail = el<HTMLInputElement>('input-email');
const inputCompany = el<HTMLInputElement>('input-company'); // honeypot
const identifierForm = el<HTMLFormElement>('identifier-form');
const identifierError = el<HTMLParagraphElement>('identifier-error');
const btnSendCode = el<HTMLButtonElement>('btn-send-code');

const stepIdentifier = el<HTMLElement>('step-identifier');
const stepVerify = el<HTMLElement>('step-verify');
const stepDone = el<HTMLElement>('step-done');
const verifySubtitle = el<HTMLParagraphElement>('verify-subtitle');
const verifyForm = el<HTMLFormElement>('verify-form');
const inputCode = el<HTMLInputElement>('input-code');
const verifyError = el<HTMLParagraphElement>('verify-error');
const btnVerify = el<HTMLButtonElement>('btn-verify');
const btnResend = el<HTMLButtonElement>('btn-resend');
const btnBack = el<HTMLButtonElement>('btn-back');
const doneMessage = el<HTMLParagraphElement>('done-message');

let mode: Mode = 'phone';
let pendingIdentifier: Identifier | null = null;
let resendTimer: ReturnType<typeof setInterval> | null = null;

function setMode(next: Mode) {
  mode = next;
  tabPhone.classList.toggle('active', next === 'phone');
  tabPhone.setAttribute('aria-selected', String(next === 'phone'));
  tabEmail.classList.toggle('active', next === 'email');
  tabEmail.setAttribute('aria-selected', String(next === 'email'));
  inputPhone.classList.toggle('hidden', next !== 'phone');
  inputEmail.classList.toggle('hidden', next !== 'email');
  titleEl.textContent = `Enter your ${next === 'phone' ? 'phone number' : 'email address'}`;
  identifierError.classList.add('hidden');
}

tabPhone.addEventListener('click', () => setMode('phone'));
tabEmail.addEventListener('click', () => setMode('email'));

function showStep(step: 'identifier' | 'verify' | 'done') {
  stepIdentifier.classList.toggle('hidden', step !== 'identifier');
  stepVerify.classList.toggle('hidden', step !== 'verify');
  stepDone.classList.toggle('hidden', step !== 'done');
}

function setButtonLoading(button: HTMLButtonElement, loading: boolean) {
  button.disabled = loading;
  button.querySelector('.button-label')!.classList.toggle('hidden', loading);
  button.querySelector('.spinner')!.classList.toggle('hidden', !loading);
}

/** Mirrors mobile's lib/mask.ts — the account identifier shouldn't sit in plain text even on our own success screen. */
function maskIdentifier(identifier: string): string {
  if (identifier.includes('@')) {
    const [local, domain] = identifier.split('@');
    return local.length <= 2 ? `${local.slice(0, 1)}***@${domain}` : `${local.slice(0, 1)}***${local.slice(-1)}@${domain}`;
  }
  return identifier.length <= 4 ? `***${identifier.slice(-2)}` : `${identifier.slice(0, 3)}***${identifier.slice(-2)}`;
}

function startResendCooldown() {
  let remaining = RESEND_COOLDOWN_SECONDS;
  btnResend.disabled = true;
  btnResend.textContent = `Resend code (${remaining}s)`;
  if (resendTimer) clearInterval(resendTimer);
  resendTimer = setInterval(() => {
    remaining -= 1;
    if (remaining <= 0) {
      clearInterval(resendTimer!);
      resendTimer = null;
      btnResend.disabled = false;
      btnResend.textContent = 'Resend code';
      return;
    }
    btnResend.textContent = `Resend code (${remaining}s)`;
  }, 1000);
}

async function sendCode(identifier: Identifier): Promise<boolean> {
  try {
    await requestOtp(identifier);
    return true;
  } catch (e) {
    const message = e instanceof ApiError ? e.message : 'Something went wrong. Please try again.';
    identifierError.textContent = message;
    identifierError.classList.remove('hidden');
    return false;
  }
}

identifierForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  identifierError.classList.add('hidden');

  // Honeypot tripped — a real visitor never fills this in. Fail silently,
  // no error, no request sent — don't tip off the bot that anything special
  // happened.
  if (inputCompany.value.trim() !== '') {
    return;
  }

  const rawValue = (mode === 'phone' ? inputPhone.value : inputEmail.value).trim();
  const pattern = mode === 'phone' ? PHONE_PATTERN : EMAIL_PATTERN;
  if (!pattern.test(rawValue)) {
    identifierError.textContent =
      mode === 'phone' ? 'Enter a valid phone number (7-15 digits).' : 'Enter a valid email address.';
    identifierError.classList.remove('hidden');
    return;
  }

  const identifier: Identifier = { type: mode, value: rawValue };
  setButtonLoading(btnSendCode, true);
  const ok = await sendCode(identifier);
  setButtonLoading(btnSendCode, false);
  if (!ok) return;

  pendingIdentifier = identifier;
  verifySubtitle.textContent = `We sent a 6-digit code to ${maskIdentifier(rawValue)}.`;
  inputCode.value = '';
  verifyError.classList.add('hidden');
  showStep('verify');
  startResendCooldown();
  inputCode.focus();
});

verifyForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  verifyError.classList.add('hidden');
  if (!pendingIdentifier) return;

  const code = inputCode.value.trim();
  if (!/^[0-9]{6}$/.test(code)) {
    verifyError.textContent = 'Enter the 6-digit code.';
    verifyError.classList.remove('hidden');
    return;
  }

  setButtonLoading(btnVerify, true);
  try {
    const result = await verifyOtp(pendingIdentifier, code);
    doneMessage.textContent = result.displayName
      ? `Welcome back, ${result.displayName}. Open the RiskyC Chat app on your phone to start chatting.`
      : "You're all set — open the RiskyC Chat app on your phone to finish setting up your profile.";
    showStep('done');
  } catch (e) {
    verifyError.textContent = e instanceof ApiError ? e.message : 'Incorrect or expired code — please try again.';
    verifyError.classList.remove('hidden');
  } finally {
    setButtonLoading(btnVerify, false);
  }
});

btnResend.addEventListener('click', async () => {
  if (!pendingIdentifier || btnResend.disabled) return;
  verifyError.classList.add('hidden');
  const ok = await sendCode(pendingIdentifier);
  if (ok) {
    startResendCooldown();
  } else {
    // requestOtp's error lands in identifierError (shared helper) — mirror
    // it here since that field isn't visible on this step.
    verifyError.textContent = identifierError.textContent;
    verifyError.classList.remove('hidden');
  }
});

btnBack.addEventListener('click', () => {
  pendingIdentifier = null;
  if (resendTimer) {
    clearInterval(resendTimer);
    resendTimer = null;
  }
  showStep('identifier');
});

setMode('phone');
