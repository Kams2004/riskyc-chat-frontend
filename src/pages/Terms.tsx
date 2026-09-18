import { useNavigate } from 'react-router-dom';

export function TermsPage() {
  const navigate = useNavigate();
  return (
    <div className="legal-page">
      <button className="back-link" onClick={() => navigate(-1)}>
        ← Back
      </button>
      <h1>Terms of Service</h1>
      <p style={{ color: 'var(--text-muted)', fontSize: 13.5 }}>Last updated: September 2026</p>

      <p>
        These terms govern your use of RiskyC Chat, operated by RiskyC Fashion. By creating an account, you agree to these
        terms and to our <a href="/privacy" style={{ color: 'var(--brand-600)', fontWeight: 600 }}>Privacy Policy</a>.
      </p>

      <h2 style={{ marginTop: 32 }}>Your account</h2>
      <ul>
        <li>You must verify a real phone number or email address to create an account.</li>
        <li>You're responsible for the security of your own account and any devices you're signed in on — you can review and sign out individual devices at any time from Settings → Logged-in devices.</li>
        <li>You must be old enough to legally agree to these terms under the laws of your country.</li>
      </ul>

      <h2 style={{ marginTop: 32 }}>Acceptable use</h2>
      <p>By using RiskyC Chat, you agree not to:</p>
      <ul>
        <li>Send spam, unsolicited bulk messages, or content designed to deceive or defraud others.</li>
        <li>Harass, threaten, or impersonate another person.</li>
        <li>Share content that's illegal, or that infringes someone else's rights.</li>
        <li>Attempt to access another user's account or interfere with the normal operation of the service.</li>
      </ul>
      <p>
        We may suspend or remove accounts that violate these terms. You can report a contact or a message directly from within
        the app, and blocked/reported accounts are reviewed accordingly.
      </p>

      <h2 style={{ marginTop: 32 }}>Content you send</h2>
      <p>
        You retain ownership of the messages, photos, videos and other content you send. You're solely responsible for what
        you share, and you confirm you have the right to share it. Status updates you post are visible to your contacts (as
        defined by your existing conversations) for 24 hours before being permanently deleted.
      </p>

      <h2 style={{ marginTop: 32 }}>Official/broadcast accounts</h2>
      <p>
        Some accounts on RiskyC Chat — including the RiskyC Fashion official account — are broadcast-only: they can send you
        messages and status updates, but you cannot reply to them within that conversation.
      </p>

      <h2 style={{ marginTop: 32 }}>Service availability</h2>
      <p>
        We aim to keep RiskyC Chat available and reliable, but we don't guarantee uninterrupted service, and features may
        change, be added, or be removed over time as the app evolves.
      </p>

      <h2 style={{ marginTop: 32 }}>Ending your account</h2>
      <p>
        You may delete your account at any time from Settings → Account. We may also suspend or terminate an account that
        violates these terms. Either way, once an account is deleted, its profile and message history are permanently removed
        from our systems.
      </p>

      <h2 style={{ marginTop: 32 }}>Contact us</h2>
      <p>
        Questions about these terms can be sent to{' '}
        <a href="mailto:legal@riskycfashion.com" style={{ color: 'var(--brand-600)', fontWeight: 600 }}>legal@riskycfashion.com</a>.
      </p>
    </div>
  );
}
