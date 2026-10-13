import { useEffect, useRef, useState } from 'react';
import { Checkbox, InlineNotification, Modal, PaginationNav, RadioButton, RadioButtonGroup, SkeletonText, Stack, TextInput } from '@carbon/react';
import { useTranslation } from 'react-i18next';
import { engineUrl } from '../../../../shared/api/client';
import { usePagedList } from '../../../../shared/api/paging';
import { notify } from '../../../../shared/notifications';
import { ListTable, type Column } from '../../../../shared/ui/ListTable';
import { parseLocalDateTime, toEngineDate, toLocalDateTimeText } from '../../../../shared/variables';
import { useBulkRetry, type FailedJob } from './api';

// the classic dialog shows the failed jobs five at a time
const PAGE_SIZE = 5;

interface BulkRetryModalProps {
  engine: string;
  processInstanceId: string;
  /** the activity instance a job's execution runs in, by name */
  scopeOf: (executionId: string) => string | undefined;
  onClose: () => void;
}

/** Increments the retries of the selected failed jobs of the instance, then shows how each one went. */
export function BulkRetryModal({ engine, processInstanceId, scopeOf, onClose }: BulkRetryModalProps) {
  const { t } = useTranslation('cockpit');
  const retry = useBulkRetry(engine);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Map<string, FailedJob>>(new Map());
  const [dueDate, setDueDate] = useState<'keep' | 'set'>('keep');
  const [dueDateText, setDueDateText] = useState(() => toLocalDateTimeText(new Date()));
  const parsed = parseLocalDateTime(dueDateText);
  const jobs = usePagedList<FailedJob>(['cockpit', engine, 'failed-jobs', processInstanceId], {
    listUrl: engineUrl(engine, '/job'),
    countUrl: engineUrl(engine, '/job/count'),
    query: { processInstanceId, withException: true, noRetriesLeft: true },
    page,
    pageSize: PAGE_SIZE,
  });
  const items = jobs.data?.items ?? [];
  const pageCount = jobs.data ? Math.ceil(jobs.data.count / PAGE_SIZE) : 0;
  const results = retry.data;

  // all jobs fit on one page: they start selected, as in the classic dialog (once, a refetch keeps the choice)
  const preselected = useRef(false);
  useEffect(() => {
    if (jobs.data && !preselected.current) {
      preselected.current = true;
      if (jobs.data.count <= PAGE_SIZE) {
        setSelected(new Map(jobs.data.items.map((job) => [job.id, job])));
      }
    }
  }, [jobs.data]);

  const toggle = (job: FailedJob, checked: boolean) =>
    setSelected((previous) => {
      const next = new Map(previous);
      if (checked) {
        next.set(job.id, job);
      } else {
        next.delete(job.id);
      }
      return next;
    });
  const allSelected = items.length > 0 && items.every((job) => selected.has(job.id));

  const submit = () =>
    retry.mutate(
      { ids: [...selected.keys()], dueDate: dueDate === 'set' && parsed ? toEngineDate(parsed) : undefined },
      {
        onSuccess: (outcome) =>
          [...outcome.values()].every(Boolean)
            ? notify({ kind: 'success', title: t('PLUGIN_JOB_RETRY_STATUS_FINISHED'), subtitle: t('PLUGIN_JOB_RETRY_MESSAGE_2') })
            : notify({ kind: 'error', title: t('PLUGIN_JOB_RETRY_STATUS_FINISHED'), subtitle: t('PLUGIN_JOB_RETRY_ERROR_2') }),
      },
    );

  const scope = (job: FailedJob) => scopeOf(job.executionId);
  const columns: Column<FailedJob>[] = [
    { key: 'id', header: t('PLUGIN_JOB_RETRY_BULK_ID'), render: (job) => job.id },
    { key: 'scope', header: t('PLUGIN_JOB_RETRY_BULK_SCOPE'), render: scope },
    results
      ? {
          key: 'status',
          header: t('PLUGIN_JOB_RETRY_BULK_STATUS'),
          render: (job) => t(results.get(job.id) ? 'PLUGIN_JOB_RETRY_BULK_SUCCESSFUL' : 'PLUGIN_JOB_RETRY_BULK_FAILED'),
        }
      : { key: 'exception', header: t('PLUGIN_JOB_RETRY_BULK_EXCEPTION'), render: (job) => job.exceptionMessage },
  ];

  if (results) {
    return (
      <Modal open passiveModal size="lg" modalHeading={t('PLUGIN_JOB_RETRY_BULK_INCREMENT_RETRIES')} onRequestClose={onClose}>
        <ListTable columns={columns} items={[...selected.values()]} rowKey={(job) => job.id} />
      </Modal>
    );
  }

  return (
    <Modal
      open
      size="lg"
      modalHeading={t('PLUGIN_JOB_RETRY_BULK_INCREMENT_RETRIES')}
      primaryButtonText={`${t('PLUGIN_JOB_RETRY_BULK_RETRY')} (${t('PLUGIN_JOB_RETRY_BULK_JOBS', { count: selected.size })})`}
      secondaryButtonText={t('PLUGIN_JOB_RETRY_BULK_CLOSE')}
      primaryButtonDisabled={!selected.size || (dueDate === 'set' && !parsed) || retry.isPending}
      onRequestClose={onClose}
      onRequestSubmit={submit}
    >
      <Stack gap={6}>
        <RadioButtonGroup
          name="cz-bulk-retry-due-date"
          legendText={t('PLUGIN_JOB_RETRY_DUE_DATE_INFO')}
          orientation="vertical"
          valueSelected={dueDate}
          onChange={(value) => setDueDate(value as 'keep' | 'set')}
        >
          <RadioButton id="cz-bulk-retry-keep" value="keep" labelText={t('PLUGIN_JOB_RETRY_DUE_DATE_KEEP')} />
          <RadioButton id="cz-bulk-retry-set" value="set" labelText={t('PLUGIN_JOB_RETRY_DUE_DATE_SET')} />
        </RadioButtonGroup>
        {dueDate === 'set' && (
          <TextInput
            id="cz-bulk-retry-date"
            labelText={t('PLUGIN_JOB_RETRY_DUE_DATE')}
            placeholder="yyyy-MM-ddTHH:mm:ss"
            value={dueDateText}
            invalid={!parsed}
            invalidText={t(dueDateText ? 'PLUGIN_JOB_RETRY_DUE_DATE_PATTERN' : 'PLUGIN_JOB_RETRY_DUE_DATE_REQUIRED')}
            onChange={(event) => setDueDateText(event.target.value)}
          />
        )}
        <section>
          <p className="cz-modal-section-title">{t('PLUGIN_JOB_RETRY_BULK_SELECT_FAILED_JOB')}</p>
          {jobs.isPending && <SkeletonText paragraph lineCount={3} />}
          {jobs.isError && <InlineNotification kind="error" lowContrast hideCloseButton subtitle={jobs.error.message} />}
          {jobs.data?.count === 0 && <p className="cz-list-empty">{t('PLUGIN_JOB_RETRY_BULK_THERE_ARE_NO_FAILED_JOBS')}</p>}
          {items.length > 0 && (
            <ListTable
              columns={columns}
              items={items}
              rowKey={(job) => job.id}
              leadingHeader={
                <Checkbox
                  id="cz-bulk-retry-all"
                  labelText={t('PLUGIN_JOB_RETRY_BULK_RETRIES_FAILED_JOB')}
                  hideLabel
                  checked={allSelected}
                  onChange={(_, { checked }) => items.forEach((job) => toggle(job, checked))}
                />
              }
              leading={(job) => (
                <Checkbox
                  id={`cz-bulk-retry-${job.id}`}
                  labelText={job.id}
                  hideLabel
                  checked={selected.has(job.id)}
                  onChange={(_, { checked }) => toggle(job, checked)}
                />
              )}
            />
          )}
          {pageCount > 1 && (
            <PaginationNav totalItems={pageCount} page={page - 1} itemsShown={5} onChange={(index: number) => setPage(index + 1)} />
          )}
        </section>
      </Stack>
    </Modal>
  );
}
