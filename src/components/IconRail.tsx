import { faCircleDot, faComment, faGear, faPhone } from '@fortawesome/free-solid-svg-icons';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';

import { Avatar } from './Avatar';
import { Icon } from './Icon';
import { useAuth } from '../features/auth/AuthContext';

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
  const { t } = useTranslation('web');

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
        title={t('rail.chats')}
        onClick={() => navigate('/chats')}
      >
        <Icon icon={faComment} />
      </button>
      <button
        type="button"
        className={`icon-rail-button ${section === 'status' ? 'active' : ''}`}
        title={t('rail.status')}
        onClick={() => navigate('/status')}
      >
        <Icon icon={faCircleDot} />
      </button>
      <button
        type="button"
        className={`icon-rail-button ${section === 'calls' ? 'active' : ''}`}
        title={t('rail.calls')}
        onClick={() => navigate('/calls')}
      >
        <Icon icon={faPhone} />
      </button>
      <button
        type="button"
        className={`icon-rail-button ${section === 'settings' ? 'active' : ''}`}
        title={t('rail.settings')}
        onClick={() => navigate('/settings')}
      >
        <Icon icon={faGear} />
      </button>
      <div className="icon-rail-spacer" />
      <button
        type="button"
        className={`icon-rail-avatar ${section === 'settings' ? 'active' : ''}`}
        title={t('rail.settings')}
        onClick={() => navigate('/settings')}
      >
        <Avatar label={displayName || 'Me'} objectKey={avatarObjectKey} size={32} />
      </button>
    </nav>
  );
}
