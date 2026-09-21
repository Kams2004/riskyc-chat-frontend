import { faAddressBook, faBell, faCamera, faImage, faMicrophone, type IconDefinition } from '@fortawesome/free-solid-svg-icons';

import { Icon } from '../components/Icon';

export function PermissionsPage() {
  return (
    <div className="legal-page">
      <h1>App Permissions</h1>
      <p style={{ color: 'var(--text-muted)', fontSize: 13.5 }}>Last updated: June 2025</p>

      <p>
        RiskyC Chat requests the following permissions to give you the best messaging experience.
        You are always in control — you can grant or revoke any permission at any time through your device settings.
      </p>

      <PermSection icon={faAddressBook} title="Contacts"
        why="RiskyC Chat reads your device contacts to automatically show which of your contacts are already on RiskyC Chat, so you can start chatting immediately."
        how="Contact data is matched against our servers using phone numbers and email addresses. We never store your full contact list on our servers."
        manage="Settings → Apps → RiskyC Chat → Permissions → Contacts"
      />
      <PermSection icon={faImage} title="Media (Photos, Videos & Files)"
        why="Required to let you share photos, videos, audio files and documents in conversations, and to set your profile picture."
        how="Media is only accessed when you explicitly choose to share or upload a file. We do not scan or index your media library."
        manage="Settings → Apps → RiskyC Chat → Permissions → Storage / Media"
      />
      <PermSection icon={faCamera} title="Camera"
        why="Allows you to take photos or videos directly inside the app to share in conversations, or to scan QR codes to add contacts."
        how="The camera is only activated when you tap the camera button. It is never accessed in the background."
        manage="Settings → Apps → RiskyC Chat → Permissions → Camera"
      />
      <PermSection icon={faBell} title="Notifications"
        why="Lets RiskyC Chat notify you of new messages, missed calls, and other important events even when the app is in the background."
        how="Notifications are delivered through your device's push notification service. You can customise notification sounds in Settings."
        manage="Settings → Apps → RiskyC Chat → Notifications"
      />
      <PermSection icon={faMicrophone} title="Microphone"
        why="Required to record voice messages and to participate in voice and video calls."
        how="The microphone is only activated during an active call or while recording a voice message. It is never accessed passively."
        manage="Settings → Apps → RiskyC Chat → Permissions → Microphone"
      />

      <h2 style={{ marginTop: 40 }}>Managing your permissions</h2>
      <ol>
        <li>Open your device <strong>Settings</strong>.</li>
        <li>Tap <strong>Apps</strong> (or <em>Application Manager</em>).</li>
        <li>Find and tap <strong>RiskyC Chat</strong>.</li>
        <li>Tap <strong>Permissions</strong> to see the full list.</li>
      </ol>
      <p>Revoking a permission disables the related feature but does not affect your account or message history.</p>

      <h2 style={{ marginTop: 40 }}>Questions?</h2>
      <p>
        Read our{' '}
        <a href="/privacy" style={{ color: 'var(--brand-600)', fontWeight: 600 }}>Privacy Policy</a>
        {' '}or contact us at{' '}
        <a href="mailto:privacy@riskycfashion.com" style={{ color: 'var(--brand-600)', fontWeight: 600 }}>privacy@riskycfashion.com</a>.
      </p>
    </div>
  );
}

function PermSection({ icon, title, why, how, manage }: { icon: IconDefinition; title: string; why: string; how: string; manage: string }) {
  return (
    <div style={{ background: 'var(--tint1)', borderRadius: 14, padding: '20px 22px', marginTop: 20 }}>
      <h2 style={{ margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 10, fontSize: 18 }}>
        <span style={{ fontSize: 20, color: 'var(--brand-600)' }}><Icon icon={icon} /></span>{title}
      </h2>
      <p style={{ margin: '0 0 8px', fontSize: 14 }}><strong>Why we need it: </strong>{why}</p>
      <p style={{ margin: '0 0 8px', fontSize: 14 }}><strong>How we use it: </strong>{how}</p>
      <p style={{ margin: 0, fontSize: 13.5, color: 'var(--text-muted)' }}><strong>To manage: </strong>{manage}</p>
    </div>
  );
}
