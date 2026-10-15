import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import commonEn from '../locales/en/common.json';
import commonDe from '../locales/de/common.json';
import tasklistEn from '../locales/en/tasklist.json';
import tasklistDe from '../locales/de/tasklist.json';
import adminEn from '../locales/en/admin.json';
import adminDe from '../locales/de/admin.json';
import cockpitEn from '../locales/en/cockpit.json';
import cockpitDe from '../locales/de/cockpit.json';
import welcomeEn from '../locales/en/welcome.json';
import welcomeDe from '../locales/de/welcome.json';

// Texts that already exist in the AngularJS webapps (public/app/*/locales)
// keep their key and translation, so existing translations carry over; only
// the keys this UI uses are copied. New texts get new keys.
export const resources = {
  en: { common: commonEn, tasklist: tasklistEn, admin: adminEn, cockpit: cockpitEn, welcome: welcomeEn },
  de: { common: commonDe, tasklist: tasklistDe, admin: adminDe, cockpit: cockpitDe, welcome: welcomeDe },
} as const;

export const SUPPORTED_LANGUAGES = Object.keys(resources);

const baseLanguage = (language: string) => language.toLowerCase().split('-')[0];

export function detectLanguage(languages: readonly string[] = navigator.languages ?? [navigator.language]): string {
  return chooseLanguage(undefined, languages);
}

/**
 * The browser's preferred language among those this UI has and the classic
 * config.js allows (locales.availableLocales), else its fallbackLocale, else English.
 */
export function chooseLanguage(
  locales: { available: string[]; fallback: string } | undefined,
  languages: readonly string[] = navigator.languages ?? [navigator.language],
): string {
  const allowed = locales ? SUPPORTED_LANGUAGES.filter((language) => locales.available.map(baseLanguage).includes(language)) : SUPPORTED_LANGUAGES;
  const preferred = languages.map(baseLanguage).find((language) => allowed.includes(language));
  const fallback = locales ? baseLanguage(locales.fallback) : 'en';
  return preferred ?? (SUPPORTED_LANGUAGES.includes(fallback) ? fallback : 'en');
}

export function initI18n(language = detectLanguage()) {
  return i18next.use(initReactI18next).init({
    resources,
    lng: language,
    fallbackLng: 'en',
    ns: ['common', 'tasklist', 'admin', 'cockpit', 'welcome'],
    defaultNS: 'common',
    fallbackNS: 'common',
    interpolation: { escapeValue: false },
  });
}
