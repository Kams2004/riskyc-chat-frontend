import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enAuth from './locales/en/auth';
import enCalls from './locales/en/calls';
import enChats from './locales/en/chats';
import enCommon from './locales/en/common';
import enGroups from './locales/en/groups';
import enMedia from './locales/en/media';
import enSettings from './locales/en/settings';
import enStatus from './locales/en/status';
import enWeb from './locales/en/web';
import frAuth from './locales/fr/auth';
import frCalls from './locales/fr/calls';
import frChats from './locales/fr/chats';
import frCommon from './locales/fr/common';
import frGroups from './locales/fr/groups';
import frMedia from './locales/fr/media';
import frSettings from './locales/fr/settings';
import frStatus from './locales/fr/status';
import frWeb from './locales/fr/web';

/** Same namespace set as mobile's i18n/index.ts, plus a web-only 'web' namespace for rail/sidebar/search chrome that has no mobile equivalent to reuse. */
export const SUPPORTED_LANGUAGES = ['en', 'fr'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const LANGUAGE_KEY = 'riskyc.pref.language';

const resources = {
  en: { common: enCommon, auth: enAuth, chats: enChats, groups: enGroups, settings: enSettings, calls: enCalls, media: enMedia, status: enStatus, web: enWeb },
  fr: { common: frCommon, auth: frAuth, chats: frChats, groups: frGroups, settings: frSettings, calls: frCalls, media: frMedia, status: frStatus, web: frWeb },
};

function isSupported(value: string | null | undefined): value is SupportedLanguage {
  return !!value && (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

/** Browser language if it's one we support, else 'en' — same fallback rule as mobile's detectDeviceLanguage. */
function detectBrowserLanguage(): SupportedLanguage {
  const code = navigator.language?.split('-')[0];
  return isSupported(code) ? code : 'en';
}

function readStoredLanguage(): SupportedLanguage | null {
  try {
    const stored = localStorage.getItem(LANGUAGE_KEY);
    return isSupported(stored) ? stored : null;
  } catch {
    return null;
  }
}

/** Persisted choice (localStorage — same mechanism as wallpaper.ts/starredMessages.ts) if there is one, else the browser's own language when supported, else English. Synchronous, unlike mobile's SecureStore-backed version, so no init gate is needed before the first render. */
export function initI18n() {
  const language = readStoredLanguage() ?? detectBrowserLanguage();

  i18n.use(initReactI18next).init({
    resources,
    lng: language,
    fallbackLng: 'en',
    defaultNS: 'common',
    ns: ['common', 'auth', 'chats', 'groups', 'settings', 'calls', 'media', 'status', 'web'],
    interpolation: { escapeValue: false },
    compatibilityJSON: 'v4',
  });
}

export function setAppLanguage(language: SupportedLanguage) {
  try {
    localStorage.setItem(LANGUAGE_KEY, language);
  } catch {
    // Private browsing / storage disabled — the choice just won't persist across reloads.
  }
  i18n.changeLanguage(language);
}

export default i18n;
