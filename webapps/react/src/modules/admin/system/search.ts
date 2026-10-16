/** Sections of the system page, with the ids of the classic Admin (#/system?section=...). */
export const SYSTEM_SECTIONS = [
  { id: 'system-settings-general', label: 'SYSTEM_GENERAL' },
  { id: 'system-settings-metrics', label: 'EXECUTION_METRICS' },
  { id: 'diagnostics-system-settings', label: 'DIAGNOSTICS' },
] as const;

export interface SystemSearch {
  section?: string;
}

/** A built-in section or one of a plugin (its id); the page shows the first section for one it does not have. */
export function validateSystemSearch(search: Record<string, unknown>): SystemSearch {
  return { section: typeof search.section === 'string' && search.section ? search.section : undefined };
}
