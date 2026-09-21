import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { useNavigate } from 'react-router-dom';

import { Icon } from '../components/Icon';

export function PrivacyPage() {
  const navigate = useNavigate();
  return (
    <div className="legal-page">
      <button className="back-link" onClick={() => navigate(-1)}>
        <Icon icon={faArrowLeft} /> Back
      </button>
      <h1>Privacy Policy</h1>
      <p style={{ color: 'var(--text-muted)', fontSize: 13.5 }}>Last updated: September 2026</p>

      <p>
        RiskyC Chat ("we", "us") is operated by RiskyC Fashion. This page explains what we collect, why, and how you stay in
        control of it.
      </p>

      <h2 style={{ marginTop: 32 }}>What we collect</h2>
      <ul>
        <li><strong>Account info:</strong> your phone number or email address, and any display name or profile photo you add.</li>
        <li><strong>Messages and media:</strong> text, photos, videos, voice notes and documents you send. Message content is stored so it can be delivered and kept as history in your conversations.</li>
        <li><strong>Status updates:</strong> anything you post to Status is stored for 24 hours and then permanently deleted. We keep a record of who viewed your own status (visible only to you), and nobody else's.</li>
        <li><strong>Calls:</strong> we log that a call happened (participants, duration, outcome) — never the audio or video itself, which travels directly between participants or through our relay without being recorded.</li>
        <li><strong>Device contacts:</strong> read only to match against existing RiskyC Chat accounts, and only on your device. We never upload or store your full contact list on our servers — see our <a href="/permissions" style={{ color: 'var(--brand-600)', fontWeight: 600 }}>App Permissions</a> page for details.</li>
        <li><strong>Technical data:</strong> basic device/session info (push token, device label, IP address at sign-in) needed to deliver notifications and let you manage your logged-in devices.</li>
      </ul>

      <h2 style={{ marginTop: 32 }}>What we don't do</h2>
      <ul>
        <li>We don't sell your data to advertisers or data brokers.</li>
        <li>We don't read your messages for advertising purposes.</li>
        <li>We don't store your device's full contact list on our servers — only which of your contacts already have an account, computed on demand.</li>
      </ul>

      <h2 style={{ marginTop: 32 }}>How long we keep things</h2>
      <p>
        Messages stay in your conversation history until you delete them, either for yourself or (within the allowed window)
        for everyone. If you turn on disappearing messages for a conversation, new messages sent there are permanently removed
        after the duration you choose. Status updates disappear automatically after 24 hours. If you delete your account, your
        profile and message history are permanently removed from our systems; people you've chatted with keep their own copy
        of the conversation, same as if you'd deleted the app.
      </p>

      <h2 style={{ marginTop: 32 }}>Your controls</h2>
      <ul>
        <li>Block or report anyone directly from a conversation.</li>
        <li>Mute a conversation or turn off read receipts in Settings → Privacy.</li>
        <li>Review and sign out any of your logged-in devices individually.</li>
        <li>Delete your account at any time from Settings → Account — this permanently removes your profile and data.</li>
      </ul>

      <h2 style={{ marginTop: 32 }}>Contact us</h2>
      <p>
        Questions about this policy or your data can be sent to{' '}
        <a href="mailto:privacy@riskycfashion.com" style={{ color: 'var(--brand-600)', fontWeight: 600 }}>privacy@riskycfashion.com</a>.
      </p>
    </div>
  );
}
