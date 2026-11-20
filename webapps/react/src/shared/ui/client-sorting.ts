import { useMemo, useState } from 'react';
import type { Sorting } from './ListTable';

type SortValue = string | number | boolean | null | undefined;

function compare(a: SortValue, b: SortValue): number {
  const missingA = a === null || a === undefined || a === '';
  const missingB = b === null || b === undefined || b === '';
  if (missingA || missingB) {
    return missingA === missingB ? 0 : missingA ? -1 : 1;
  }
  return typeof a === 'string' || typeof b === 'string' ? String(a).localeCompare(String(b), undefined, { numeric: true }) : Number(a) - Number(b);
}

/** The items in the order of the sort field; `values` says what a field compares. Rows without a value come first. */
export function sortItems<T>(items: T[], values: Record<string, (item: T) => SortValue>, sorting: Sorting): T[] {
  const value = values[sorting.sortBy];
  if (!value) {
    return items;
  }
  const factor = sorting.sortOrder === 'asc' ? 1 : -1;
  return [...items].sort((a, b) => factor * compare(value(a), value(b)));
}

/**
 * Sorting for a list the page has as a whole, where the REST API has no
 * sorting (job definitions, called definitions and instances): a header
 * click of the ListTable orders the loaded rows.
 */
export function useClientSorting<T>(items: T[] | undefined, values: Record<string, (item: T) => SortValue>, initial: Sorting) {
  const [sorting, setSorting] = useState(initial);
  // `values` is built per render and only read here
  const sorted = useMemo(() => (items ? sortItems(items, values, sorting) : undefined), [items, sorting]);
  return { sorted, sorting, setSorting };
}
