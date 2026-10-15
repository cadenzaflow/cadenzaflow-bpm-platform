import { useState } from 'react';
import { CodeSnippet, InlineNotification, Link, Modal, RadioButton, RadioButtonGroup, SkeletonText, Stack, TextArea, TextInput } from '@carbon/react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { request } from '../../../shared/api/client';
import { useSettings } from '../../../shared/classic-settings';
import { notify } from '../../../shared/notifications';
import { toEngineDate, parseLocalDateTime, toLocalDateTimeText } from '../../../shared/variables';
import { stacktraceUrl, useAnnotation, useRetry, type Incident } from './api';

interface DialogProps {
  engine: string;
  incident: Incident;
  onClose: () => void;
}

/** The stack trace of the incident's root cause, to read and copy. */
export function StacktraceModal({ engine, incident, onClose }: DialogProps) {
  const { t } = useTranslation('cockpit');
  const url = stacktraceUrl(engine, incident);
  const stacktrace = useQuery({
    queryKey: ['cockpit', engine, 'stacktrace', url],
    queryFn: () => request<string>(url, { accept: 'text/plain', responseType: 'text' }),
  });
  return (
    <Modal open passiveModal size="lg" modalHeading={t('PLUGIN_INCIDENTS_TAB_STACKTRACE_HEADER')} onRequestClose={onClose}>
      {stacktrace.isPending && <SkeletonText paragraph lineCount={8} />}
      {stacktrace.isError && <InlineNotification kind="error" lowContrast hideCloseButton subtitle={stacktrace.error.message} />}
      {stacktrace.data !== undefined && (
        <Stack gap={4}>
          <CodeSnippet type="multi" feedback={t('PLUGIN_INCIDENTS_TAB_STACKTRACE_COPY')} maxCollapsedNumberOfRows={30}>
            {stacktrace.data}
          </CodeSnippet>
          <Link href={url} target="_blank" rel="noreferrer">
            {t('PLUGIN_INCIDENTS_TAB_STACKTRACE_OPEN_NEW_TAB')}
          </Link>
        </Stack>
      )}
    </Modal>
  );
}

/** Writes a note on the incident; an empty note removes it. */
export function AnnotationModal({ engine, incident, onClose }: DialogProps) {
  const { t } = useTranslation('cockpit');
  const annotation = useAnnotation(engine);
  // userOperationLogAnnotationLength of the classic config.js
  const maxLength = useSettings('cockpit').annotationLength;
  const [text, setText] = useState(incident.annotation ?? '');
  return (
    <Modal
      open
      modalHeading={t('PLUGIN_INCIDENTS_TAB_ANNOTATION')}
      primaryButtonText={t('SAVE')}
      secondaryButtonText={t('CANCEL')}
      primaryButtonDisabled={annotation.isPending || text.trim() === (incident.annotation ?? '')}
      onRequestClose={onClose}
      onRequestSubmit={() =>
        annotation.mutate(
          { incident, annotation: text.trim() },
          {
            onSuccess: onClose,
            onError: (error) => notify({ kind: 'error', title: t('PLUGIN_INCIDENTS_TAB_ANNOTATION'), subtitle: error.message }),
          },
        )
      }
    >
      <TextArea
        id="cz-incident-annotation"
        labelText={t('PLUGIN_INCIDENTS_TAB_ANNOTATION')}
        hideLabel
        rows={4}
        maxCount={maxLength}
        enableCounter
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
    </Modal>
  );
}

/**
 * One more retry for the failed job of the incident (keeping its due date or
 * setting a new one) or for its external task.
 */
export function RetryModal({ engine, incident, onClose }: DialogProps) {
  const { t } = useTranslation('cockpit');
  const retry = useRetry(engine);
  const job = incident.incidentType === 'failedJob';
  const [dueDate, setDueDate] = useState<'keep' | 'set'>('keep');
  const [dueDateText, setDueDateText] = useState(() => toLocalDateTimeText(new Date()));
  const parsed = parseLocalDateTime(dueDateText);
  const valid = !job || dueDate === 'keep' || !!parsed;

  return (
    <Modal
      open
      modalHeading={t('PLUGIN_JOB_RETRY_LEGEND_1')}
      primaryButtonText={t('PLUGIN_JOB_RETRY_BTN_RETRY')}
      secondaryButtonText={t('PLUGIN_JOB_RETRY_BTN_CLOSE')}
      primaryButtonDisabled={!valid || retry.isPending}
      onRequestClose={onClose}
      onRequestSubmit={() =>
        retry.mutate(
          { incident, dueDate: job && dueDate === 'set' && parsed ? toEngineDate(parsed) : undefined },
          {
            onSuccess: () => {
              notify({
                kind: 'success',
                title: t(job ? 'PLUGIN_JOB_RETRY_STATUS_FINISHED' : 'PLUGIN_EXTERNAL_TASK_STATUS_FINISHED'),
                subtitle: t(job ? 'PLUGIN_JOB_RETRY_MESSAGE_1' : 'PLUGIN_EXTERNAL_TASK_MESSAGE_1'),
              });
              onClose();
            },
            onError: (error) =>
              notify({
                kind: 'error',
                title: t('PLUGIN_JOB_RETRY_LEGEND_1'),
                subtitle: job ? `${t('PLUGIN_JOB_RETRY_ERROR_1')}${error.message}` : t('PLUGIN_EXTERNAL_TASK_MESSAGE_2', { message: error.message }),
              }),
          },
        )
      }
    >
      <Stack gap={5}>
        <p>{t('PLUGIN_JOB_RETRY_LEGEND_2')}</p>
        {job && (
          <>
            <RadioButtonGroup
              legendText={t('PLUGIN_JOB_RETRY_DUE_DATE_INFO')}
              name="cz-retry-due-date"
              orientation="vertical"
              valueSelected={dueDate}
              onChange={(value) => setDueDate(value as 'keep' | 'set')}
            >
              <RadioButton id="cz-retry-keep" value="keep" labelText={t('PLUGIN_JOB_RETRY_DUE_DATE_KEEP')} />
              <RadioButton id="cz-retry-set" value="set" labelText={t('PLUGIN_JOB_RETRY_DUE_DATE_SET')} />
            </RadioButtonGroup>
            {dueDate === 'set' && (
              <TextInput
                id="cz-retry-due"
                type="datetime-local"
                step={1}
                labelText={t('PLUGIN_JOB_RETRY_DUE_DATE')}
                value={dueDateText}
                invalid={!parsed}
                invalidText={t(dueDateText ? 'PLUGIN_JOB_RETRY_DUE_DATE_PATTERN' : 'PLUGIN_JOB_RETRY_DUE_DATE_REQUIRED')}
                onChange={(event) => setDueDateText(event.target.value)}
              />
            )}
          </>
        )}
        <p>{t('PLUGIN_JOB_RETRY_LEGEND_3')}</p>
      </Stack>
    </Modal>
  );
}
