import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import commonEn from '../locales/en/common.json';
import commonDe from '../locales/de/common.json';
import tasklistEn from '../locales/en/tasklist.json';
import tasklistDe from '../locales/de/tasklist.json';
import adminEn from '../locales/en/admin.json';
import adminDe from '../locales/de/admin.json';

// Texts that already exist in the AngularJS webapps (public/app/*/locales)
// keep their key and translation, so existing translations carry over; only
// the keys this UI uses are copied. New texts get new keys.
export const resources = {
  en: { common: commonEn, tasklist: tasklistEn, admin: adminEn },
  de: { common: commonDe, tasklist: tasklistDe, admin: adminDe },
} as const;

export const SUPPORTED_LANGUAGES = Object.keys(resources);

export function detectLanguage(languages: readonly string[] = navigator.languages ?? [navigator.language]): string {
  for (const language of languages) {
    const base = language.toLowerCase().split('-')[0];
    if (SUPPORTED_LANGUAGES.includes(base)) {
      return base;
    }
  }
  return 'en';
}

export function initI18n(language = detectLanguage()) {
  return i18next.use(initReactI18next).init({
    resources,
    lng: language,
    fallbackLng: 'en',
    ns: ['common', 'tasklist', 'admin'],
    defaultNS: 'common',
    fallbackNS: 'common',
    interpolation: { escapeValue: false },
  });
}
