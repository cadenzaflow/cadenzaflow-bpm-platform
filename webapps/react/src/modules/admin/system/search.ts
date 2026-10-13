/** Sections of the system page, with the ids of the classic Admin (#/system?section=...). */
export const SYSTEM_SECTIONS = [
  { id: 'system-settings-general', label: 'SYSTEM_GENERAL' },
  { id: 'system-settings-metrics', label: 'EXECUTION_METRICS' },
  { id: 'diagnostics-system-settings', label: 'DIAGNOSTICS' },
] as const;

export interface SystemSearch {
  section?: string;
}

export function validateSystemSearch(search: Record<string, unknown>): SystemSearch {
  return { section: SYSTEM_SECTIONS.some((section) => section.id === search.section) ? (search.section as string) : undefined };
}
