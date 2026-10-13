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

export function formatDateTime(value: string | null | undefined, language: string): string {
  const date = parseEngineDate(value);
  return date ? new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short' }).format(date) : '';
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
