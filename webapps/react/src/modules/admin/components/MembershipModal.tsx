import { useState, type ReactNode } from 'react';
import { Checkbox, InlineNotification, Modal, PaginationNav, SkeletonText } from '@carbon/react';
import { useTranslation } from 'react-i18next';
import { ADMIN_PAGE_SIZE, usePage, type Sorting } from '../api';
import { ListTable, type Column } from './ListTable';

interface MembershipModalProps<T extends { id: string }> {
  engine: string;
  title: string;
  /** list resource of the candidates, e.g. /group */
  listPath: string;
  columns: Column<T>[];
  defaultSortBy: string;
  /** ids that are members already; they are not offered */
  memberIds: Set<string> | undefined;
  /** shown when there is nothing to add */
  emptyText: ReactNode;
  /** shown when this page offers nothing to add but other pages may */
  emptyPageText: string;
  addLabel: string;
  onAdd: (ids: string[]) => Promise<void>;
  onClose: () => void;
}

/** Picks groups, tenants or users to add a membership for; one page at a time, as in the classic Admin. */
export function MembershipModal<T extends { id: string }>({
  engine,
  title,
  listPath,
  columns,
  defaultSortBy,
  memberIds,
  emptyText,
  emptyPageText,
  addLabel,
  onAdd,
  onClose,
}: MembershipModalProps<T>) {
  const { t } = useTranslation('admin');
  const [page, setPage] = useState(1);
  const [sorting, setSorting] = useState<Sorting>({ sortBy: defaultSortBy, sortOrder: 'asc' });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const list = usePage<T>(engine, listPath, {}, page, sorting);
  const available = (list.data?.items ?? []).filter((item) => !memberIds?.has(item.id));
  const pageCount = list.data ? Math.ceil(list.data.count / ADMIN_PAGE_SIZE) : 0;

  const toggle = (id: string, checked: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });

  return (
    <Modal
      open
      size="lg"
      modalHeading={title}
      primaryButtonText={addLabel}
      secondaryButtonText={t('CANCEL')}
      primaryButtonDisabled={selected.size === 0 || busy}
      onRequestClose={onClose}
      onRequestSubmit={async () => {
        setBusy(true);
        try {
          await onAdd([...selected]);
        } finally {
          setBusy(false);
        }
      }}
    >
      {(list.isPending || !memberIds) && <SkeletonText paragraph lineCount={4} />}
      {list.isError && <InlineNotification kind="error" lowContrast hideCloseButton subtitle={list.error.message} />}
      {list.data && memberIds && available.length === 0 && <p>{pageCount > 1 ? emptyPageText : emptyText}</p>}
      {list.data && memberIds && available.length > 0 && (
        <ListTable
          columns={columns}
          items={available}
          rowKey={(item) => item.id}
          sorting={sorting}
          sortable={list.data.sortable}
          onSortingChange={setSorting}
          leading={(item) => (
            <Checkbox
              id={`cz-membership-${item.id}`}
              labelText={item.id}
              hideLabel
              checked={selected.has(item.id)}
              onChange={(_, { checked }) => toggle(item.id, checked)}
            />
          )}
        />
      )}
      {pageCount > 1 && (
        <PaginationNav totalItems={pageCount} page={page - 1} itemsShown={5} onChange={(index: number) => setPage(index + 1)} />
      )}
    </Modal>
  );
}
