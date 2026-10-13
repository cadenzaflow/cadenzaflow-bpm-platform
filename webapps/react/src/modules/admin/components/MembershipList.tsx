import { useState } from 'react';
import { Button, InlineNotification, PaginationNav, SkeletonText } from '@carbon/react';
import type { QueryParams } from '../../../shared/api/client';
import { ADMIN_PAGE_SIZE, usePage, type Sorting } from '../api';
import { ListTable, type Column } from './ListTable';

interface MembershipListProps<T extends { id: string }> {
  engine: string;
  title: string;
  /** list resource and query of the members, e.g. /group with { member: 'mary' } */
  listPath: string;
  query: QueryParams;
  columns: Column<T>[];
  defaultSortBy: string;
  emptyText: string;
  /** a "Remove" button per row; read-only without it */
  remove?: { header: string; label: string; busy: boolean; run: (id: string) => void };
}

/** The groups, tenants or users something is a member of: sortable, paged, optionally removable. */
export function MembershipList<T extends { id: string }>({
  engine,
  title,
  listPath,
  query,
  columns,
  defaultSortBy,
  emptyText,
  remove,
}: MembershipListProps<T>) {
  const [page, setPage] = useState(1);
  const [sorting, setSorting] = useState<Sorting>({ sortBy: defaultSortBy, sortOrder: 'asc' });
  const members = usePage<T>(engine, listPath, query, page, sorting);
  const pageCount = members.data ? Math.ceil(members.data.count / ADMIN_PAGE_SIZE) : 0;

  return (
    <div className="cz-admin-memberships">
      <h2 className="cz-admin-form__section">{title}</h2>
      {members.isPending && <SkeletonText paragraph lineCount={3} />}
      {members.isError && <InlineNotification kind="error" lowContrast hideCloseButton subtitle={members.error.message} />}
      {members.data?.items.length === 0 && <p className="cz-admin-empty">{emptyText}</p>}
      {!!members.data?.items.length && (
        <ListTable
          columns={
            remove
              ? [
                  ...columns,
                  {
                    key: 'action',
                    header: remove.header,
                    render: (item) => (
                      <Button kind="ghost" size="sm" disabled={remove.busy} onClick={() => remove.run(item.id)}>
                        {remove.label}
                      </Button>
                    ),
                  },
                ]
              : columns
          }
          items={members.data.items}
          rowKey={(item) => item.id}
          sorting={sorting}
          sortable={members.data.sortable}
          onSortingChange={setSorting}
        />
      )}
      {pageCount > 1 && (
        <PaginationNav totalItems={pageCount} page={page - 1} itemsShown={7} onChange={(index: number) => setPage(index + 1)} />
      )}
    </div>
  );
}
