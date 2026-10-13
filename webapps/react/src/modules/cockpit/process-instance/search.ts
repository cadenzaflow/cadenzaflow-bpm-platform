/**
 * State of the process instance page in the query string: the tab and the
 * selection, by activity (from the diagram) and by activity instance (from
 * the tree), as in the classic Cockpit.
 */
export interface ProcessInstanceSearch {
  tab?: string;
  /** comma separated activity ids */
  activityIds?: string;
  /** comma separated activity instance ids */
  activityInstanceIds?: string;
}

export function validateProcessInstanceSearch(search: Record<string, unknown>): ProcessInstanceSearch {
  const text = (value: unknown) => (typeof value === 'string' && value ? value : undefined);
  return { tab: text(search.tab), activityIds: text(search.activityIds), activityInstanceIds: text(search.activityInstanceIds) };
}

export const listOf = (value: string | undefined) => (value ?? '').split(',').filter(Boolean);
export const textOf = (ids: string[]) => (ids.length ? ids.join(',') : undefined);

/** Adds the id to the list or takes it out (Ctrl/Cmd click), or makes it the only one (plain click). */
export function toggle(ids: string[], id: string, add: boolean): string[] {
  if (!add) {
    return ids.length === 1 && ids[0] === id ? [] : [id];
  }
  return ids.includes(id) ? ids.filter((other) => other !== id) : [...ids, id];
}
