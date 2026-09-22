import { faArrowLeft, faCheck } from '@fortawesome/free-solid-svg-icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { Avatar } from '../components/Avatar';
import { Icon } from '../components/Icon';
import { useAuth } from '../features/auth/AuthContext';
import { setAppLanguage, SUPPORTED_LANGUAGES, type SupportedLanguage } from '../i18n';
import { useTheme, type ThemePreference } from '../lib/ThemeContext';
import { setWallpaperVariant, useWallpaperVariant, type WallpaperVariant } from '../lib/wallpaper';

const WALLPAPER_OPTIONS: { value: WallpaperVariant; label: string }[] = [
  { value: 'doodle', label: 'Doodle' },
  { value: 'dots', label: 'Dots' },
  { value: 'plain', label: 'Plain' },
];

const THEME_OPTIONS: ThemePreference[] = ['system', 'light', 'dark'];

export function SettingsPage() {
  const { displayName, avatarObjectKey, signOut } = useAuth();
  const navigate = useNavigate();
  const wallpaper = useWallpaperVariant();
  const { preference, setPreference } = useTheme();
  const { t, i18n } = useTranslation(['settings', 'web']);
  const currentLanguage = (i18n.language?.split('-')[0] as SupportedLanguage) || 'en';
  const languageLabels: Record<SupportedLanguage, string> = { en: t('language.english'), fr: t('language.french') };
  const themeLabels: Record<ThemePreference, string> = { system: t('index.themeSystem'), light: t('index.themeLight'), dark: t('index.themeDark') };

  function handleSignOut() {
    if (!window.confirm(t('index.signOutConfirmBody'))) return;
    signOut();
    navigate('/', { replace: true });
  }

  return (
    <div className="settings-page">
      <button className="back-link" onClick={() => navigate('/chats')}>
        <Icon icon={faArrowLeft} /> {t('common:back')}
      </button>
      <h1>{t('index.title')}</h1>

      <div className="settings-row" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <Avatar label={displayName || 'Me'} objectKey={avatarObjectKey} size={52} />
        <div>
          <p className="settings-row-value" style={{ margin: 0 }}>
            {displayName || 'Your profile'}
          </p>
        </div>
      </div>

      <div className="settings-row" onClick={() => navigate('/settings/account')} style={{ cursor: 'pointer' }}>
        <p className="settings-row-label">{t('index.account')}</p>
        <p className="settings-row-value">Phone number, email, delete account</p>
      </div>

      <div className="settings-row" onClick={() => navigate('/settings/devices')} style={{ cursor: 'pointer' }}>
        <p className="settings-row-label">{t('index.loggedInDevices')}</p>
        <p className="settings-row-value">See where you're signed in, sign out remotely</p>
      </div>

      <div className="settings-row">
        <p className="settings-row-label">{t('index.appearance')}</p>
        <div className="toggle-row" style={{ marginTop: 8 }}>
          {THEME_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              className={`toggle-tab ${preference === opt ? 'active' : ''}`}
              onClick={() => setPreference(opt)}
            >
              {themeLabels[opt]}
            </button>
          ))}
        </div>
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
              {wallpaper === opt.value && <span className="wallpaper-swatch-check"><Icon icon={faCheck} /></span>}
            </button>
          ))}
        </div>
      </div>

      <div className="settings-row">
        <p className="settings-row-label">{t('index.language')}</p>
        <div className="toggle-row" style={{ marginTop: 8 }}>
          {SUPPORTED_LANGUAGES.map((lang) => (
            <button
              key={lang}
              type="button"
              className={`toggle-tab ${currentLanguage === lang ? 'active' : ''}`}
              onClick={() => setAppLanguage(lang)}
            >
              {languageLabels[lang]}
            </button>
          ))}
        </div>
      </div>

      <div className="settings-row" onClick={() => navigate('/privacy')} style={{ cursor: 'pointer' }}>
        <p className="settings-row-label">Privacy &amp; Terms</p>
        <p className="settings-row-value">Read our policies</p>
      </div>

      <div className="settings-row" onClick={handleSignOut} style={{ cursor: 'pointer' }}>
        <p className="settings-row-value" style={{ color: 'var(--error)', fontWeight: 600 }}>{t('index.signOut')}</p>
      </div>
    </div>
  );
}
