import { useState } from 'react';
import { InlineNotification, Modal, PaginationNav, SkeletonText } from '@carbon/react';
import { useTranslation } from 'react-i18next';
import { engineUrl } from '../../../shared/api/client';
import { usePagedList } from '../../../shared/api/paging';
import { formatDateTime } from '../../../shared/format';
import { ListTable, type Column, type Sorting } from '../../../shared/ui/ListTable';
import type { JobLog } from './api';

const PAGE_SIZE = 10;

const stateOf = (log: JobLog) =>
  log.failureLog ? 'PLGN_EXT_FAILED' : log.successLog ? 'PLGN_EXT_SUCCESSFUL' : log.deletionLog ? 'PLGN_EXT_DELETED' : 'PLGN_EXT_CREATED';

/** The history of one job: created, failed (with stack trace), succeeded or deleted, newest first. */
export function JobLogModal({ engine, jobId, onClose }: { engine: string; jobId: string; onClose: () => void }) {
  const { t, i18n } = useTranslation('cockpit');
  const [page, setPage] = useState(1);
  const [sorting, setSorting] = useState<Sorting>({ sortBy: 'timestamp', sortOrder: 'desc' });
  const logs = usePagedList<JobLog>(['cockpit', engine, 'job-log'], {
    listUrl: engineUrl(engine, '/history/job-log'),
    countUrl: engineUrl(engine, '/history/job-log/count'),
    query: { jobId },
    page,
    sorting,
    pageSize: PAGE_SIZE,
  });
  const pageCount = logs.data ? Math.ceil(logs.data.count / PAGE_SIZE) : 0;

  const columns: Column<JobLog>[] = [
    { key: 'state', header: t('PLGN_HIST_STATE'), render: (log) => t(stateOf(log)) },
    {
      key: 'message',
      header: t('PLGN_HIST_MESSAGE'),
      render: (log) =>
        log.failureLog &&
        (log.jobExceptionMessage ? (
          <a
            href={engineUrl(engine, `/history/job-log/${encodeURIComponent(log.id)}/stacktrace`)}
            target="_blank"
            rel="noreferrer"
            title={t('PLGN_HIST_OPEN_STACKTRACE')}
          >
            {log.jobExceptionMessage}
          </a>
        ) : (
          <span className="cz-null">{t('PLGN_HIST_MESSAGE_NULL')}</span>
        )),
    },
    { key: 'timestamp', header: t('PLGN_HIST_TIMESTAMPE'), sortBy: 'timestamp', render: (log) => formatDateTime(log.timestamp, i18n.language) },
    { key: 'jobId', header: t('PLGN_HIST_JOB_ID'), sortBy: 'jobId', render: (log) => log.jobId },
    { key: 'type', header: t('PLGN_HIST_TYPE'), render: (log) => log.jobDefinitionType },
    { key: 'configuration', header: t('PLGN_HIST_CONFIGURATION'), render: (log) => log.jobDefinitionConfiguration },
    { key: 'retries', header: t('PLGN_HIST_RETRIES'), sortBy: 'jobRetries', render: (log) => log.jobRetries },
    { key: 'hostname', header: t('PLGN_HIST_HOSTNAME'), sortBy: 'hostname', render: (log) => log.hostname },
    { key: 'priority', header: t('PLGN_HIST_PRIORITY'), sortBy: 'jobPriority', render: (log) => log.jobPriority },
  ];

  return (
    <Modal open passiveModal size="lg" modalHeading={t('PLGN_BATCH_JOB_LOG_HEADER')} onRequestClose={onClose}>
      {logs.isPending && <SkeletonText paragraph lineCount={4} />}
      {logs.isError && <InlineNotification kind="error" lowContrast hideCloseButton title={t('PLGN_BATCH_NO_JOB_ERROR')} subtitle={logs.error.message} />}
      {logs.data?.items.length === 0 && <p className="cz-list-empty">{t('PLGN_BATCH_NO_JOB_LOGS')}</p>}
      {!!logs.data?.items.length && (
        <ListTable
          columns={columns}
          items={logs.data.items}
          rowKey={(log) => log.id}
          sorting={sorting}
          onSortingChange={(next) => {
            setSorting(next);
            setPage(1);
          }}
        />
      )}
      {pageCount > 1 && <PaginationNav totalItems={pageCount} page={page - 1} itemsShown={5} onChange={(index: number) => setPage(index + 1)} />}
    </Modal>
  );
}
