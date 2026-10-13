import { useEffect, useMemo, useState } from 'react';
import { InlineNotification, PaginationNav, SkeletonText } from '@carbon/react';
import type { QueryParams } from '../api/client';
import { DEFAULT_PAGE_SIZE, usePagedList } from '../api/paging';
import { toQuery, type CriterionType, type SearchState } from '../search/criteria';
import { CriteriaSearch } from '../search/CriteriaSearch';
import { sortingOf, type ListSearch } from '../search/list-search';
import { ListTable, type Column } from './ListTable';

interface SearchableListProps<T extends { id: string }> {
  /** start of the cache key, e.g. ['admin-list', engine] */
  scope: readonly unknown[];
  listUrl: string;
  countUrl: string;
  /** i18n namespace of the criteria labels */
  namespace: string;
  criteria: CriterionType[];
  /** query parts that are always sent, e.g. latestVersion */
  fixedQuery?: Record<string, unknown>;
  /** POST for queries with lists (e.g. variables) */
  method?: 'GET' | 'POST';
  /** more URL parameters of the list request, e.g. deserializeValues */
  listQuery?: QueryParams;
  defaultSortBy: string;
  defaultSortOrder?: 'asc' | 'desc';
  columns: Column<T>[];
  emptyText: string;
  /** shown when the backend could not sort (e.g. LDAP) */
  unsortedNotice?: { title: string; subtitle: string };
  /** state from the URL and how to change it */
  search: ListSearch;
  onSearchChange: (changes: Partial<ListSearch>) => void;
}

/** Search, sortable table and pages of a list resource; the state lives in the URL. */
export function SearchableList<T extends { id: string }>({
  scope,
  listUrl,
  countUrl,
  namespace,
  criteria,
  fixedQuery,
  defaultSortBy,
  defaultSortOrder = 'asc',
  columns,
  emptyText,
  unsortedNotice,
  method,
  listQuery,
  search,
  onSearchChange,
}: SearchableListProps<T>) {
  const [draft, setDraft] = useState<SearchState>({ criteria: search.searchQuery ?? [], matchAny: false });

  // apply the search while typing, without a request per key
  useEffect(() => {
    const timer = setTimeout(() => {
      if (JSON.stringify(draft.criteria) !== JSON.stringify(search.searchQuery ?? [])) {
        onSearchChange({ searchQuery: draft.criteria.length ? draft.criteria : undefined, page: undefined });
      }
    }, 500);
    return () => clearTimeout(timer);
    // only the draft drives this
  }, [draft]);

  const sorting = sortingOf(search, defaultSortBy, defaultSortOrder);
  const query = useMemo(
    () => ({ ...fixedQuery, ...toQuery({ criteria: search.searchQuery ?? [], matchAny: false }, criteria) }),
    [search.searchQuery, criteria, fixedQuery],
  );
  const page = search.page ?? 1;
  const list = usePagedList<T>(scope, { listUrl, countUrl, query, page, sorting, method, listQuery });
  const pageCount = list.data ? Math.ceil(list.data.count / DEFAULT_PAGE_SIZE) : 0;

  return (
    <>
      <CriteriaSearch namespace={namespace} types={criteria} value={draft} onChange={setDraft} allowMatchAny={false} />
      {list.data && !list.data.sortable && unsortedNotice && (
        <InlineNotification kind="info" lowContrast hideCloseButton title={unsortedNotice.title} subtitle={unsortedNotice.subtitle} />
      )}
      {list.isPending && <SkeletonText paragraph lineCount={5} />}
      {list.isError && <InlineNotification kind="error" lowContrast hideCloseButton subtitle={list.error.message} />}
      {list.data?.items.length === 0 && <p className="cz-list-empty">{emptyText}</p>}
      {!!list.data?.items.length && (
        <ListTable
          columns={columns}
          items={list.data.items}
          rowKey={(item) => item.id}
          sorting={sorting}
          sortable={list.data.sortable}
          onSortingChange={(next) => onSearchChange({ sortBy: next.sortBy, sortOrder: next.sortOrder, page: undefined })}
        />
      )}
      {pageCount > 1 && (
        <PaginationNav
          totalItems={pageCount}
          page={page - 1}
          itemsShown={7}
          onChange={(index: number) => onSearchChange({ page: index > 0 ? index + 1 : undefined })}
        />
      )}
    </>
  );
}
