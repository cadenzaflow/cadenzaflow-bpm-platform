import { useEffect, useMemo, useState } from 'react';
import { InlineNotification, PaginationNav, SkeletonText } from '@carbon/react';
import { useTranslation } from 'react-i18next';
import type { QueryParams } from '../../../shared/api/client';
import { toQuery, type CriterionType, type SearchState } from '../../../shared/search/criteria';
import { CriteriaSearch } from '../../../shared/search/CriteriaSearch';
import { ADMIN_PAGE_SIZE, usePage } from '../api';
import { sortingOf, type AdminListSearch } from '../search';
import { ListTable, type Column } from './ListTable';

interface ResourceListProps<T extends { id: string }> {
  engine: string;
  /** list resource, e.g. /user */
  listPath: string;
  criteria: CriterionType[];
  defaultSortBy: string;
  columns: Column<T>[];
  emptyText: string;
  /** state from the URL and how to change it */
  search: AdminListSearch;
  onSearchChange: (changes: Partial<AdminListSearch>) => void;
}

/** Search, sortable table and pages of users, groups or tenants; the state lives in the URL. */
export function ResourceList<T extends { id: string }>({
  engine,
  listPath,
  criteria,
  defaultSortBy,
  columns,
  emptyText,
  search,
  onSearchChange,
}: ResourceListProps<T>) {
  const { t } = useTranslation('admin');
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

  const sorting = sortingOf(search, defaultSortBy);
  const query = useMemo(
    () => toQuery({ criteria: search.searchQuery ?? [], matchAny: false }, criteria) as QueryParams,
    [search.searchQuery, criteria],
  );
  const page = search.page ?? 1;
  const list = usePage<T>(engine, listPath, query, page, sorting);
  const pageCount = list.data ? Math.ceil(list.data.count / ADMIN_PAGE_SIZE) : 0;

  return (
    <>
      <CriteriaSearch namespace="admin" types={criteria} value={draft} onChange={setDraft} allowMatchAny={false} />
      {list.data && !list.data.sortable && (
        <InlineNotification
          kind="info"
          lowContrast
          hideCloseButton
          title={t('USERS_NO_SORTING_HEADER')}
          subtitle={t('USERS_NO_SORTING_BODY')}
        />
      )}
      {list.isPending && <SkeletonText paragraph lineCount={5} />}
      {list.isError && <InlineNotification kind="error" lowContrast hideCloseButton subtitle={list.error.message} />}
      {list.data?.items.length === 0 && <p className="cz-admin-empty">{emptyText}</p>}
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
