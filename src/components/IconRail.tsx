import { useLocation, useNavigate } from 'react-router-dom';

import { Avatar } from './Avatar';
import { useAuth } from '../features/auth/AuthContext';

/** Same path data as mobile's ChatsIcon/StatusIcon/CallsIcon (mobile/src/app/(tabs)/_layout.tsx) — same icon set on both platforms. */
function ChatsSvg() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

function StatusSvg() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" strokeDasharray="3 3" />
      <path d="M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
    </svg>
  );
}

function CallsSvg() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.902.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.908.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

/**
 * Leftmost narrow rail, mounted once at App.tsx's root (alongside the
 * routes, not inside ConversationListPage) so it persists across
 * Chats/Status/Calls/Settings navigation the way WhatsApp Web's own rail
 * does — see joyful-tinkering-owl.md Phase 1.
 */
export function IconRail() {
  const navigate = useNavigate();
  const location = useLocation();
  const { displayName, avatarObjectKey } = useAuth();

  const section = location.pathname.startsWith('/status')
    ? 'status'
    : location.pathname.startsWith('/calls')
      ? 'calls'
      : location.pathname.startsWith('/settings')
        ? 'settings'
        : 'chats';

  return (
    <nav className="icon-rail">
      <button
        type="button"
        className={`icon-rail-button ${section === 'chats' ? 'active' : ''}`}
        title="Chats"
        onClick={() => navigate('/chats')}
      >
        <ChatsSvg />
      </button>
      <button
        type="button"
        className={`icon-rail-button ${section === 'status' ? 'active' : ''}`}
        title="Status"
        onClick={() => navigate('/status')}
      >
        <StatusSvg />
      </button>
      <button
        type="button"
        className={`icon-rail-button ${section === 'calls' ? 'active' : ''}`}
        title="Calls"
        onClick={() => navigate('/calls')}
      >
        <CallsSvg />
      </button>
      <div className="icon-rail-spacer" />
      <button
        type="button"
        className={`icon-rail-avatar ${section === 'settings' ? 'active' : ''}`}
        title="Settings"
        onClick={() => navigate('/settings')}
      >
        <Avatar label={displayName || 'Me'} objectKey={avatarObjectKey} size={32} />
      </button>
    </nav>
  );
}
