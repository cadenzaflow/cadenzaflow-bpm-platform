import type { ReactNode } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@carbon/react';

/** Sort field and order of a REST list query. */
export interface Sorting {
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

export interface Column<T> {
  key: string;
  header: string;
  /** sort field of the REST query; columns without it are not sortable */
  sortBy?: string;
  render: (item: T) => ReactNode;
}

interface ListTableProps<T> {
  columns: Column<T>[];
  items: T[];
  rowKey: (item: T) => string;
  sorting?: Sorting;
  /** false: the identity provider cannot sort, headers are plain */
  sortable?: boolean;
  onSortingChange?: (sorting: Sorting) => void;
  /** e.g. a checkbox column */
  leading?: (item: T) => ReactNode;
}

/** A list (users, process definitions, ...); a header click sorts by that column, a second click reverses. */
export function ListTable<T>({ columns, items, rowKey, sorting, sortable = true, onSortingChange, leading }: ListTableProps<T>) {
  const direction = (column: Column<T>) =>
    sorting && sorting.sortBy === column.sortBy ? (sorting.sortOrder === 'asc' ? 'ASC' : 'DESC') : 'NONE';

  return (
    <Table size="md" className="cz-list-table">
      <TableHead>
        <TableRow>
          {leading && <TableHeader aria-hidden="true" />}
          {columns.map((column) =>
            column.sortBy && sortable && onSortingChange ? (
              <TableHeader
                key={column.key}
                isSortable
                isSortHeader={sorting?.sortBy === column.sortBy}
                sortDirection={direction(column)}
                onClick={() =>
                  onSortingChange({
                    sortBy: column.sortBy!,
                    sortOrder: sorting && sorting.sortBy === column.sortBy && sorting.sortOrder === 'asc' ? 'desc' : 'asc',
                  })
                }
              >
                {column.header}
              </TableHeader>
            ) : (
              <TableHeader key={column.key}>{column.header}</TableHeader>
            ),
          )}
        </TableRow>
      </TableHead>
      <TableBody>
        {items.map((item) => (
          <TableRow key={rowKey(item)}>
            {leading && <TableCell>{leading(item)}</TableCell>}
            {columns.map((column) => (
              <TableCell key={column.key}>{column.render(item)}</TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
