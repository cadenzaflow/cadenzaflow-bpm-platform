import { useEffect, useState } from 'react';
import {
  Button,
  InlineNotification,
  Modal,
  PaginationNav,
  RadioButton,
  RadioButtonGroup,
  SkeletonText,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@carbon/react';
import { Pause, Play, Renew, RecentlyViewed, TrashCan } from '@carbon/icons-react';
import { useTranslation } from 'react-i18next';
import { engineUrl } from '../../../shared/api/client';
import { usePagedList } from '../../../shared/api/paging';
import { formatDateTime } from '../../../shared/format';
import { notify } from '../../../shared/notifications';
import { ListTable, type Column, type Sorting } from '../../../shared/ui/ListTable';
import {
  REFRESH_INTERVAL,
  useBatch,
  useBatchRetry,
  useBatchSuspension,
  useDeleteBatch,
  useDeleteJob,
  useUserName,
  type Batch,
  type BatchJob,
  type BatchKind,
} from './api';
import { JobLogModal } from './JobLogModal';

const PAGE_SIZE = 10;

/** The properties shown for a batch, in the classic order; a property without value is left out. */
const PROPERTIES: (keyof Batch | 'user')[] = [
  'id',
  'startTime',
  'executionStartTime',
  'endTime',
  'type',
  'user',
  'totalJobs',
  'completedJobs',
  'remainingJobs',
  'batchJobsPerSeed',
  'invocationsPerBatchJob',
  'tenantId',
  'batchJobDefinitionId',
  'monitorJobDefinitionId',
  'seedJobDefinitionId',
];

const EXCEPTION_PREVIEW = 120;

/** The failed jobs of a running batch: retried, deleted, their stack traces and logs. */
function FailedJobs({ engine, batch }: { engine: string; batch: Batch }) {
  const { t } = useTranslation('cockpit');
  const [page, setPage] = useState(1);
  const [sorting, setSorting] = useState<Sorting>({ sortBy: 'jobId', sortOrder: 'asc' });
  const [log, setLog] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const retry = useBatchRetry(engine);
  const remove = useDeleteJob(engine);
  const jobs = usePagedList<BatchJob>(
    ['cockpit', engine, 'list'],
    {
      listUrl: engineUrl(engine, '/job'),
      countUrl: engineUrl(engine, '/job/count'),
      method: 'POST',
      query: { jobDefinitionId: batch.batchJobDefinitionId, withException: true, noRetriesLeft: true },
      page,
      sorting,
      pageSize: PAGE_SIZE,
    },
    { refetchInterval: REFRESH_INTERVAL },
  );
  const pageCount = jobs.data ? Math.ceil(jobs.data.count / PAGE_SIZE) : 0;

  const columns: Column<BatchJob>[] = [
    { key: 'id', header: t('BATCHES_PROGRESS_ID'), sortBy: 'jobId', render: (job) => job.id },
    {
      key: 'exception',
      header: t('BATCHES_PROGRESS_EXCEPTION'),
      render: (job) => (
        <>
          <span className="cz-variable-value">
            {(job.exceptionMessage ?? '').length > EXCEPTION_PREVIEW ? `${job.exceptionMessage!.slice(0, EXCEPTION_PREVIEW)}…` : job.exceptionMessage}
          </span>{' '}
          <a
            href={engineUrl(engine, `/job/${encodeURIComponent(job.id)}/stacktrace`)}
            target="_blank"
            rel="noreferrer"
            title={t('BATCHES_PROGRESS_TOOLTIP_OPEN_STACK')}
          >
            {t('BATCHES_PROGRESS_FULL_STACK_TRACE')}
          </a>
        </>
      ),
    },
    {
      key: 'actions',
      header: t('BATCHES_PROGRESS_ACTIONS'),
      render: (job) => (
        <span className="cz-row-actions">
          <Button
            kind="ghost"
            size="sm"
            hasIconOnly
            renderIcon={Renew}
            iconDescription={t('BATCHES_PROGRESS_TOOLTIP_INCREMENT_RETRIES')}
            disabled={retry.isPending}
            onClick={() =>
              retry.mutate(
                { jobId: job.id },
                { onError: (error) => notify({ kind: 'error', title: t('BATCHES_RETRY_JOB_STATUS'), subtitle: t('BATCHES_RETRY_JOB_FAILED', { message: error.message }) }) },
              )
            }
          />
          <Button
            kind="ghost"
            size="sm"
            hasIconOnly
            renderIcon={TrashCan}
            iconDescription={t('BATCHES_PROGRESS_TOOLTIP_DELETE_JOB')}
            onClick={() => setDeleting(job.id)}
          />
          <Button
            kind="ghost"
            size="sm"
            hasIconOnly
            renderIcon={RecentlyViewed}
            iconDescription={t('BATCHES_PROGRESS_TOOLTIP_JOB_LOG')}
            onClick={() => setLog(job.id)}
          />
        </span>
      ),
    },
  ];

  return (
    <section>
      <h3 className="cz-section-title">{t('BATCHES_PROGRESS_FAIL_JOBS')}</h3>
      {jobs.isPending && <SkeletonText paragraph lineCount={2} />}
      {jobs.isError && <InlineNotification kind="error" lowContrast hideCloseButton subtitle={jobs.error.message} />}
      {jobs.data?.items.length === 0 && <p className="cz-list-empty">{t('BATCHES_PROGRESS_NO_FAILED_JOBS')}</p>}
      {!!jobs.data?.items.length && (
        <ListTable columns={columns} items={jobs.data.items} rowKey={(job) => job.id} sorting={sorting} onSortingChange={setSorting} />
      )}
      {pageCount > 1 && <PaginationNav totalItems={pageCount} page={page - 1} itemsShown={5} onChange={(index: number) => setPage(index + 1)} />}
      {log && <JobLogModal engine={engine} jobId={log} onClose={() => setLog(null)} />}
      {deleting && (
        <Modal
          open
          danger
          modalHeading={t('BATCHES_PROGRESS_TOOLTIP_DELETE_JOB')}
          primaryButtonText={t('PLGN_HIST_DELETE')}
          secondaryButtonText={t('BATCHES_DELETE_BTN_CANCEL')}
          primaryButtonDisabled={remove.isPending}
          onRequestClose={() => setDeleting(null)}
          onRequestSubmit={() =>
            remove.mutate(deleting, {
              onSuccess: () => setDeleting(null),
              onError: (error) => notify({ kind: 'error', title: t('BATCHES_DELETE_JOB_STATUS'), subtitle: t('BATCHES_DELETE_JOB_FAILED', { message: error.message }) }),
            })
          }
        >
          <p>
            <code>{deleting}</code>
          </p>
        </Modal>
      )}
    </section>
  );
}

/** Deletes a batch; a running one with or without its history (historic batch and job logs). */
function DeleteBatchModal({ engine, batch, kind, onClose, onDeleted }: { engine: string; batch: Batch; kind: BatchKind; onClose: () => void; onDeleted: () => void }) {
  const { t } = useTranslation('cockpit');
  const remove = useDeleteBatch(engine);
  const [cascade, setCascade] = useState(false);

  return (
    <Modal
      open
      danger
      modalHeading={t('BATCHES_DELETE_TITLE')}
      primaryButtonText={t('BATCHES_DELETE_BTN_CONFIRM')}
      secondaryButtonText={t('BATCHES_DELETE_BTN_CANCEL')}
      primaryButtonDisabled={remove.isPending}
      onRequestClose={onClose}
      onRequestSubmit={() =>
        // the promise settles even when this dialog is gone by then
        remove.mutateAsync({ id: batch.id, kind, cascade }).then(
          () => {
            onClose();
            onDeleted();
          },
          (error: Error) =>
            notify({ kind: 'error', title: t('BATCHES_DELETE_BATCH_STATUS'), subtitle: t('BATCHES_DELETE_BATCH_FAILED', { message: error.message }) }),
        )
      }
    >
      {kind === 'runtime' ? (
        <RadioButtonGroup
          name="cz-delete-batch-history"
          legendText={t('BATCHES_DELETE_LEGEND')}
          orientation="vertical"
          valueSelected={cascade ? 'delete' : 'keep'}
          onChange={(value) => setCascade(value === 'delete')}
        >
          <RadioButton id="cz-delete-batch-keep" value="keep" labelText={t('BATCHES_DELETE_INPUT_KEEP')} />
          <RadioButton id="cz-delete-batch-cascade" value="delete" labelText={t('BATCHES_DELETE_INPUT_DELETE')} />
        </RadioButtonGroup>
      ) : (
        <p>{t('BATCHES_DELETE_LEGEND')}</p>
      )}
    </Modal>
  );
}

interface BatchDetailsProps {
  engine: string;
  id: string;
  /** where the batch was last seen; a running batch that ended is looked up in the history */
  kind: BatchKind | undefined;
  onKindFound: (kind: BatchKind) => void;
  onDeleted: () => void;
}

/** The selected batch: its properties, actions and, while it runs, its failed jobs. */
export function BatchDetails({ engine, id, kind, onKindFound, onDeleted }: BatchDetailsProps) {
  const { t, i18n } = useTranslation('cockpit');
  const batch = useBatch(engine, id, kind);
  const user = useUserName(engine, batch.data?.batch.createUserId);
  const suspension = useBatchSuspension(engine);
  const retry = useBatchRetry(engine);
  const [deleting, setDeleting] = useState(false);
  const found = batch.data?.kind;

  useEffect(() => {
    if (found && found !== kind) {
      onKindFound(found);
    }
  }, [found, kind]);

  if (batch.isPending) {
    return (
      <section className="cz-batches__details">
        <SkeletonText paragraph lineCount={6} />
      </section>
    );
  }
  if (batch.isError) {
    return (
      <section className="cz-batches__details">
        <InlineNotification kind="error" lowContrast hideCloseButton subtitle={batch.error.message} />
      </section>
    );
  }

  const { batch: data, kind: current } = batch.data;
  const running = current === 'runtime';
  const value = (property: (typeof PROPERTIES)[number]) => {
    if (property === 'user') {
      return data.createUserId ? (user.data ?? data.createUserId) : null;
    }
    const raw = data[property];
    if (raw === null || raw === undefined || raw === '' || raw === false) {
      return null;
    }
    const text = property.endsWith('Time') ? formatDateTime(String(raw), i18n.language) : String(raw);
    return property === 'remainingJobs' && data.failedJobs ? `${text} ${t('BATCHES_PROGRESS_FAILED', { jobs: data.failedJobs })}` : text;
  };

  return (
    <section className="cz-batches__details">
      <header className="cz-batches__details-header">
        <h2 className="cz-section-title">
          {t(running ? 'BATCHES_PROGRESS_IN_PROGRESS' : 'BATCHES_PROGRESS_COMPLETED')} {t('BATCHES_PROGRESS_BATCH_DETAILS')}
        </h2>
        <span className="cz-row-actions">
          {running && (
            <Button
              kind="ghost"
              size="sm"
              hasIconOnly
              renderIcon={data.suspended ? Play : Pause}
              iconDescription={t(data.suspended ? 'BATCHES_PROGRESS_TOOLTIP_ACTIVATE_BATCH' : 'BATCHES_PROGRESS_TOOLTIP_SUSPEND_BATCH')}
              disabled={suspension.isPending}
              onClick={() =>
                suspension.mutate({ id: data.id, suspended: !data.suspended }, { onError: (error) => notify({ kind: 'error', title: t('BATCHES_BREAD_BATCHES'), subtitle: error.message }) })
              }
            />
          )}
          {running && !!data.failedJobs && data.batchJobDefinitionId && (
            <Button
              kind="ghost"
              size="sm"
              hasIconOnly
              renderIcon={Renew}
              iconDescription={t('BATCHES_PROGRESS_TOOLTIP_INCREMENT_NUMBER')}
              disabled={retry.isPending}
              onClick={() =>
                retry.mutate(
                  { jobDefinitionId: data.batchJobDefinitionId! },
                  { onError: (error) => notify({ kind: 'error', title: t('BATCHES_RETRY_JOB_STATUS'), subtitle: t('BATCHES_RETRY_JOB_FAILED', { message: error.message }) }) },
                )
              }
            />
          )}
          <Button
            kind="danger--ghost"
            size="sm"
            hasIconOnly
            renderIcon={TrashCan}
            iconDescription={t('BATCHES_PROGRESS_TOOLTIP_DELETE_BATCH')}
            onClick={() => setDeleting(true)}
          />
        </span>
      </header>
      <Table size="sm" className="cz-list-table">
        <TableHead>
          <TableRow>
            <TableHeader>{t('BATCHES_PROGRESS_PROPERTY')}</TableHeader>
            <TableHeader>{t('BATCHES_PROGRESS_VALUE')}</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {PROPERTIES.map((property) => {
            const text = value(property);
            return text === null && property !== 'executionStartTime' ? null : (
              <TableRow key={property}>
                <TableCell>{property}</TableCell>
                <TableCell className="cz-variable-value">{text}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {running && <FailedJobs engine={engine} batch={data} />}
      {deleting && <DeleteBatchModal engine={engine} batch={data} kind={current} onClose={() => setDeleting(false)} onDeleted={onDeleted} />}
    </section>
  );
}
