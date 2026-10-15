/** "First Last", or the user id when the user has no name. */
export function displayName(user: { firstName?: string | null; lastName?: string | null } | undefined, userId: string): string {
  return [user?.firstName, user?.lastName].filter(Boolean).join(' ') || userId;
}

/**
 * The engine REST API writes dates as "2026-10-13T08:49:55.851+0000"; the
 * offset without colon is not ISO 8601 extended format, so normalise it
 * before handing it to Date.
 */
export function parseEngineDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }
  const date = new Date(value.replace(/([+-]\d{2})(\d{2})$/, '$1:$2'));
  return Number.isNaN(date.getTime()) ? null : date;
}

let dateTimePattern: string | undefined;

/** The moment.js format of the classic config.js for dates with time; none: the browser's medium style. */
export function setDateTimePattern(pattern: string | undefined): void {
  dateTimePattern = pattern;
}

export function formatDateTime(value: string | null | undefined, language: string): string {
  const date = parseEngineDate(value);
  if (!date) {
    return '';
  }
  return dateTimePattern
    ? formatMoment(date, dateTimePattern, language)
    : new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

/** moment.js' localized formats, in the language's own order */
const LOCALIZED_FORMATS: Record<string, Intl.DateTimeFormatOptions> = {
  LTS: { timeStyle: 'medium' },
  LT: { timeStyle: 'short' },
  LLLL: { dateStyle: 'full', timeStyle: 'short' },
  llll: { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' },
  LLL: { dateStyle: 'long', timeStyle: 'short' },
  lll: { dateStyle: 'medium', timeStyle: 'short' },
  LL: { dateStyle: 'long' },
  ll: { dateStyle: 'medium' },
  L: { year: 'numeric', month: '2-digit', day: '2-digit' },
  l: { year: 'numeric', month: 'numeric', day: 'numeric' },
};

const MOMENT_TOKENS = new RegExp(
  `\\[([^\\]]*)]|${Object.keys(LOCALIZED_FORMATS).join('|')}|YYYY|YY|MMMM|MMM|MM|M|DD|D|dddd|ddd|HH|H|hh|h|mm|m|ss|s|A|a|Z`,
  'g',
);

/** A date in a moment.js format: the localized formats (LLL, LT, ...) and the common tokens; [text] stays as it is. */
export function formatMoment(date: Date, pattern: string, language: string): string {
  const intl = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(language, options).format(date);
  const pad = (value: number) => String(value).padStart(2, '0');
  const hours12 = date.getHours() % 12 || 12;
  const offset = -date.getTimezoneOffset();
  const tokens: Record<string, () => string> = {
    YYYY: () => String(date.getFullYear()),
    YY: () => String(date.getFullYear()).slice(-2),
    MMMM: () => intl({ month: 'long' }),
    MMM: () => intl({ month: 'short' }),
    MM: () => pad(date.getMonth() + 1),
    M: () => String(date.getMonth() + 1),
    DD: () => pad(date.getDate()),
    D: () => String(date.getDate()),
    dddd: () => intl({ weekday: 'long' }),
    ddd: () => intl({ weekday: 'short' }),
    HH: () => pad(date.getHours()),
    H: () => String(date.getHours()),
    hh: () => pad(hours12),
    h: () => String(hours12),
    mm: () => pad(date.getMinutes()),
    m: () => String(date.getMinutes()),
    ss: () => pad(date.getSeconds()),
    s: () => String(date.getSeconds()),
    A: () => (date.getHours() < 12 ? 'AM' : 'PM'),
    a: () => (date.getHours() < 12 ? 'am' : 'pm'),
    Z: () => `${offset < 0 ? '-' : '+'}${pad(Math.floor(Math.abs(offset) / 60))}:${pad(Math.abs(offset) % 60)}`,
  };
  return pattern.replace(MOMENT_TOKENS, (token: string, literal: string | undefined) =>
    literal !== undefined ? literal : LOCALIZED_FORMATS[token] ? intl(LOCALIZED_FORMATS[token]) : tokens[token](),
  );
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
];

/** "3 hours ago", "in 2 days" */
export function formatRelative(value: string | null | undefined, language: string, now = Date.now()): string {
  const date = parseEngineDate(value);
  if (!date) {
    return '';
  }
  const seconds = Math.round((date.getTime() - now) / 1000);
  const format = new Intl.RelativeTimeFormat(language, { numeric: 'auto' });
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) {
      return format.format(Math.round(seconds / size), unit);
    }
  }
  return format.format(seconds, 'second');
}
