import { faComment } from '@fortawesome/free-solid-svg-icons';
import { useNavigate } from 'react-router-dom';

import { Icon } from '../components/Icon';

/**
 * Public landing page a shared invite link points to (see mobile's
 * "Invite a friend" and this app's own NewChat page — both just share/copy
 * `<origin>/invite`, no referral tracking, no fabricated store links since
 * this app isn't published anywhere yet). "Open in app" uses the
 * `riskycchat://` scheme already declared in mobile's app.json; if nothing
 * on the device catches it, the browser just does nothing — a harmless,
 * honest degradation rather than a fake "download" link.
 */
export function InvitePage() {
  const navigate = useNavigate();
  return (
    <div className="legal-page" style={{ textAlign: 'center' }}>
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: 20,
          margin: '12px auto 20px',
          background: 'linear-gradient(135deg, var(--brand-400), var(--brand-600))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 30,
          color: '#fff',
        }}
      >
        <Icon icon={faComment} />
      </div>
      <h1>You're invited to RiskyC Chat</h1>
      <p>A friend wants to chat with you on RiskyC Chat — fast, simple messaging with voice/video calls, groups, and more.</p>

      <button className="button" style={{ marginTop: 20 }} onClick={() => { window.location.href = 'riskycchat://'; }}>
        Open in app
      </button>
      <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 8 }}>
        Already have the app installed? Tap above to open it.
      </p>

      <button className="link-button" style={{ marginTop: 18 }} onClick={() => navigate('/')}>
        Or use RiskyC Chat on the web
      </button>
    </div>
  );
}
