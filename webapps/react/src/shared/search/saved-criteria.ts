import { parseCriteria, type Criterion } from './criteria';

/** Named sets of search criteria, kept in this browser per search (as the AngularJS search widget does). */
export type CriteriaSets = Record<string, Criterion[]>;

const storageKey = (group: string) => `cadenzaflow.search.${group}`;

/** The saved sets of a search; none when the browser keeps nothing or what it kept cannot be read. */
export function readCriteriaSets(group: string): CriteriaSets {
  try {
    const stored = JSON.parse(window.localStorage.getItem(storageKey(group)) ?? '{}');
    if (!stored || typeof stored !== 'object' || Array.isArray(stored)) {
      return {};
    }
    const sets: CriteriaSets = {};
    for (const [name, criteria] of Object.entries(stored)) {
      const parsed = parseCriteria(JSON.stringify(criteria));
      if (parsed.length) {
        sets[name] = parsed;
      }
    }
    return sets;
  } catch {
    return {};
  }
}

/** @return false when the browser does not keep it (storage blocked or full) */
export function writeCriteriaSets(group: string, sets: CriteriaSets): boolean {
  try {
    if (Object.keys(sets).length) {
      window.localStorage.setItem(storageKey(group), JSON.stringify(sets));
    } else {
      window.localStorage.removeItem(storageKey(group));
    }
    return true;
  } catch {
    return false;
  }
}
