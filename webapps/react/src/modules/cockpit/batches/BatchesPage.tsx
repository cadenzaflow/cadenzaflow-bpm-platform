import { useEffect, useMemo, useState } from 'react';
import { Button, InlineNotification, PaginationNav, ProgressBar, SkeletonText } from '@carbon/react';
import { getRouteApi } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { engineUrl } from '../../../shared/api/client';
import { usePagedList } from '../../../shared/api/paging';
import { formatDateTime } from '../../../shared/format';
import { toQuery, type CriterionType, type SearchState } from '../../../shared/search/criteria';
import { CriteriaSearch } from '../../../shared/search/CriteriaSearch';
import { ListTable, type Column, type Sorting } from '../../../shared/ui/ListTable';
import { PageFrame } from '../../../shared/ui/PageFrame';
import { REFRESH_INTERVAL, useUserNames, type Batch, type BatchKind } from './api';
import { BatchDetails } from './BatchDetails';
import { progressOf, type BatchesSearch } from './search';

const route = getRouteApi('/cockpit/$engine/batch');

// the classic Cockpit shows batches ten at a time
const PAGE_SIZE = 10;

const BATCH_CRITERIA: CriterionType[] = [
  { key: 'createdBy', label: 'BATCHES_USER_ID', kind: 'property', operators: ['eq'] },
  { key: 'started', label: 'BATCHES_START_TIME', kind: 'property', operators: ['Before', 'After'], valueType: 'date' },
  { key: 'withFailures', label: 'BATCHES_HAS_FAILED_JOBS', kind: 'flag', operators: [] },
  { key: 'withoutFailures', label: 'BATCHES_HAS_NO_FAILED_JOBS', kind: 'flag', operators: [] },
];

const ENDED = { completed: true };

interface BatchListProps {
  engine: string;
  kind: BatchKind;
  query: Record<string, unknown>;
  defaultSorting: Sorting;
  columns: Column<Batch>[];
  emptyText: string;
  onLoaded?: (batches: Batch[]) => void;
}

/** One page of running or ended batches, sorted by a header click, refreshed every few seconds. */
function BatchList({ engine, kind, query, defaultSorting, columns, emptyText, onLoaded }: BatchListProps) {
  const [page, setPage] = useState(1);
  const [sorting, setSorting] = useState(defaultSorting);
  const batches = usePagedList<Batch>(
    ['cockpit', engine, 'list'],
    {
      listUrl: engineUrl(engine, kind === 'runtime' ? '/batch/statistics' : '/history/batch'),
      countUrl: engineUrl(engine, kind === 'runtime' ? '/batch/statistics/count' : '/history/batch/count'),
      query,
      page,
      sorting,
      pageSize: PAGE_SIZE,
    },
    // both lists, so a batch that ends moves from one to the other
    { refetchInterval: REFRESH_INTERVAL },
  );
  const pageCount = batches.data ? Math.ceil(batches.data.count / PAGE_SIZE) : 0;

  useEffect(() => {
    if (batches.data) {
      onLoaded?.(batches.data.items);
    }
  }, [batches.data]);

  // a new search starts on the first page
  useEffect(() => setPage(1), [JSON.stringify(query)]);

  return (
    <>
      {batches.isPending && <SkeletonText paragraph lineCount={3} />}
      {batches.isError && <InlineNotification kind="error" lowContrast hideCloseButton subtitle={batches.error.message} />}
      {batches.data?.items.length === 0 && <p className="cz-list-empty">{emptyText}</p>}
      {!!batches.data?.items.length && (
        <ListTable
          columns={columns}
          items={batches.data.items}
          rowKey={(batch) => batch.id}
          sorting={sorting}
          onSortingChange={(next) => {
            setSorting(next);
            setPage(1);
          }}
        />
      )}
      {pageCount > 1 && (
        <PaginationNav totalItems={pageCount} page={page - 1} itemsShown={5} onChange={(index: number) => setPage(index + 1)} />
      )}
    </>
  );
}

/**
 * Batches as in the classic Cockpit: the running ones (refreshed every few
 * seconds, with progress and failed jobs) and the ended ones on the left,
 * the selected batch on the right.
 */
export function BatchesPage() {
  const { t, i18n } = useTranslation('cockpit');
  const { engine } = route.useParams();
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const [draft, setDraft] = useState<SearchState>({ criteria: search.searchQuery ?? [], matchAny: false });
  const [creators, setCreators] = useState<string[]>([]);
  const userNames = useUserNames(engine, creators);
  const query = useMemo(() => toQuery({ criteria: search.searchQuery ?? [], matchAny: false }, BATCH_CRITERIA), [search.searchQuery]);

  const update = (changes: Partial<BatchesSearch>, replace = false) =>
    navigate({ search: (previous: BatchesSearch) => ({ ...previous, ...changes }), replace });

  // apply the search while typing, without a request per key
  useEffect(() => {
    const timer = setTimeout(() => {
      if (JSON.stringify(draft.criteria) !== JSON.stringify(search.searchQuery ?? [])) {
        update({ searchQuery: draft.criteria.length ? draft.criteria : undefined });
      }
    }, 500);
    return () => clearTimeout(timer);
    // only the draft drives this
  }, [draft]);

  const date = (value: string | null | undefined) => (value ? formatDateTime(value, i18n.language) : null);
  const idColumn = (kind: BatchKind): Column<Batch> => ({
    key: 'id',
    header: t('BATCHES_PROGRESS_ID'),
    sortBy: 'batchId',
    render: (batch) => (
      <Button
        kind="ghost"
        size="sm"
        className="cz-link-button"
        aria-current={batch.id === search.details ? 'true' : undefined}
        onClick={() => update({ details: batch.id, type: kind })}
      >
        {batch.id}
      </Button>
    ),
  });

  const runningColumns: Column<Batch>[] = [
    idColumn('runtime'),
    { key: 'type', header: t('BATCHES_PROGRESS_TYPE'), render: (batch) => batch.type },
    {
      key: 'user',
      header: t('BATCHES_PROGRESS_USER'),
      render: (batch) => batch.createUserId && (userNames.data?.get(batch.createUserId) ?? batch.createUserId),
    },
    { key: 'startTime', header: t('BATCHES_PROGRESS_START_TIME'), sortBy: 'startTime', render: (batch) => date(batch.startTime) },
    { key: 'failedJobs', header: t('BATCHES_PROGRESS_FAIL_JOBS'), render: (batch) => batch.failedJobs },
    {
      key: 'progress',
      header: t('BATCHES_PROGRESS_PROGRESS'),
      render: (batch) => {
        const progress = progressOf(batch);
        return progress === undefined ? null : (
          <ProgressBar label={t('BATCHES_PROGRESS_PROGRESS')} hideLabel value={progress} size="small" helperText={`${progress}%`} />
        );
      },
    },
  ];

  const endedColumns: Column<Batch>[] = [
    idColumn('history'),
    { key: 'type', header: t('BATCHES_PROGRESS_TYPE'), render: (batch) => batch.type },
    { key: 'startTime', header: t('BATCHES_PROGRESS_START_TIME'), sortBy: 'startTime', render: (batch) => date(batch.startTime) },
    { key: 'endTime', header: t('BATCHES_PROGRESS_END_TIME'), sortBy: 'endTime', render: (batch) => date(batch.endTime) },
  ];

  return (
    <PageFrame wide title={t('BATCHES_TITLE_BATCHES')} breadcrumbs={[t('BATCHES_BREAD_BATCHES')]}>
      <div className="cz-batches">
        <div className="cz-batches__lists">
          <section>
            <h2 className="cz-section-title">{t('BATCHES_PROGRESS_IN')}</h2>
            <CriteriaSearch namespace="cockpit" types={BATCH_CRITERIA} value={draft} onChange={setDraft} allowMatchAny={false} />
            <BatchList
              engine={engine}
              kind="runtime"
              query={query}
              defaultSorting={{ sortBy: 'batchId', sortOrder: 'asc' }}
              columns={runningColumns}
              emptyText={t('BATCHES_PROGRESS_NO_RUNNING')}
              onLoaded={(batches) => setCreators(batches.map((batch) => batch.createUserId).filter((id): id is string => !!id))}
            />
          </section>
          <section>
            <h2 className="cz-section-title">{t('BATCHES_PROGRESS_END')}</h2>
            <BatchList
              engine={engine}
              kind="history"
              query={ENDED}
              defaultSorting={{ sortBy: 'startTime', sortOrder: 'desc' }}
              columns={endedColumns}
              emptyText={t('BATCHES_PROGRESS_NO_FINISHED')}
            />
          </section>
        </div>
        {search.details && (
          <BatchDetails
            engine={engine}
            id={search.details}
            kind={search.type}
            onKindFound={(type) => update({ type }, true)}
            onDeleted={() => update({ details: undefined, type: undefined })}
          />
        )}
      </div>
    </PageFrame>
  );
}
