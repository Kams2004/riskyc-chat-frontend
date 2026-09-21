import { useNavigate } from 'react-router-dom';

import { Avatar } from '../components/Avatar';
import { useAuth } from '../features/auth/AuthContext';
import { setWallpaperVariant, useWallpaperVariant, type WallpaperVariant } from '../lib/wallpaper';

const WALLPAPER_OPTIONS: { value: WallpaperVariant; label: string }[] = [
  { value: 'doodle', label: 'Doodle' },
  { value: 'dots', label: 'Dots' },
  { value: 'plain', label: 'Plain' },
];

export function SettingsPage() {
  const { displayName, avatarObjectKey } = useAuth();
  const navigate = useNavigate();
  const wallpaper = useWallpaperVariant();

  return (
    <div className="settings-page">
      <button className="back-link" onClick={() => navigate('/chats')}>
        ← Back to chats
      </button>
      <h1>Settings</h1>

      <div className="settings-row" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <Avatar label={displayName || 'Me'} objectKey={avatarObjectKey} size={52} />
        <div>
          <p className="settings-row-value" style={{ margin: 0 }}>
            {displayName || 'Your profile'}
          </p>
        </div>
      </div>

      <div className="settings-row" onClick={() => navigate('/settings/account')} style={{ cursor: 'pointer' }}>
        <p className="settings-row-label">Account</p>
        <p className="settings-row-value">Phone number, email, delete account</p>
      </div>

      <div className="settings-row" onClick={() => navigate('/settings/devices')} style={{ cursor: 'pointer' }}>
        <p className="settings-row-label">Logged-in devices</p>
        <p className="settings-row-value">See where you're signed in, sign out remotely</p>
      </div>

      <div className="settings-row">
        <p className="settings-row-label">Chat wallpaper</p>
        <div className="wallpaper-swatch-row">
          {WALLPAPER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`wallpaper-swatch wallpaper-${opt.value} ${wallpaper === opt.value ? 'active' : ''}`}
              onClick={() => setWallpaperVariant(opt.value)}
              title={opt.label}
            >
              {wallpaper === opt.value && <span className="wallpaper-swatch-check">✓</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="settings-row" onClick={() => navigate('/privacy')} style={{ cursor: 'pointer' }}>
        <p className="settings-row-label">Privacy &amp; Terms</p>
        <p className="settings-row-value">Read our policies</p>
      </div>
    </div>
  );
}
