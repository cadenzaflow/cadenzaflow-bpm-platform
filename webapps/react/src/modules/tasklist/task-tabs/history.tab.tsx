import { useState } from 'react';
import { InlineNotification, PaginationNav, SkeletonText } from '@carbon/react';
import { useTranslation } from 'react-i18next';
import { formatDateTime } from '../../../shared/format';
import { HISTORY_PAGE_SIZE, useTaskHistory, type Change } from '../task-history';
import type { TaskTab, TaskTabProps } from './registry';

function ChangeValue({ change, value }: { change: Change; value: string | null }) {
  const { i18n } = useTranslation();
  if (value === null || value === '') {
    return <span className="cz-history__empty-value">–</span>;
  }
  if (change.isDate) {
    return <>{new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }).format(Number(value))}</>;
  }
  return <>{value}</>;
}

/** Operations on the task (claim, assign, set due date, …) and its comments, newest first. */
function HistoryTab({ engine, task }: TaskTabProps) {
  const { t, i18n } = useTranslation('tasklist');
  const [page, setPage] = useState(1);
  const history = useTaskHistory(engine, task.id, page);

  if (history.isPending) {
    return <SkeletonText paragraph lineCount={4} />;
  }
  if (history.isError) {
    return <InlineNotification kind="error" lowContrast hideCloseButton subtitle={history.error.message} />;
  }
  if (history.data.days.length === 0) {
    return <p className="cz-tasklist__empty">{t('NO_HISTORY')}</p>;
  }

  const pageCount = Math.ceil(history.data.count / HISTORY_PAGE_SIZE);
  const dayFormat = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'full' });
  const timeFormat = new Intl.DateTimeFormat(i18n.language, { timeStyle: 'short' });

  return (
    <div className="cz-history">
      {history.data.days.map(({ day, events }) => (
        <section key={day} className="cz-history__day">
          <h3 className="cz-history__date">{dayFormat.format(new Date(`${day}T00:00:00`))}</h3>
          <ul>
            {events.map((event) => (
              <li key={`${event.kind}-${event.id}`} className="cz-history__event">
                <span className="cz-history__meta" title={formatDateTime(event.time.toISOString(), i18n.language)}>
                  {timeFormat.format(event.time)} · {event.userId ?? ''}
                </span>
                {event.kind === 'comment' ? (
                  <>
                    <strong>{t('Comment')}</strong>
                    <p className="cz-history__comment">{event.message}</p>
                  </>
                ) : (
                  <>
                    <strong>{t(event.type, { defaultValue: event.type })}</strong>
                    {event.changes.length > 0 && (
                      <dl className="cz-history__changes">
                        {event.changes.map((change, index) => (
                          <div key={index}>
                            <dt>{t(change.property, { defaultValue: change.property })}</dt>
                            <dd>
                              <ChangeValue change={change} value={change.orgValue} /> →{' '}
                              <ChangeValue change={change} value={change.newValue} />
                            </dd>
                          </div>
                        ))}
                      </dl>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
      {pageCount > 1 && (
        <PaginationNav totalItems={pageCount} page={page - 1} itemsShown={5} onChange={(index: number) => setPage(index + 1)} />
      )}
    </div>
  );
}

export const tab: TaskTab = {
  id: 'history',
  label: 'HISTORY',
  order: 20,
  component: HistoryTab,
};
