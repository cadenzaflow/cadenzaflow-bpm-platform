import { useState } from 'react';
import { Button, InlineNotification, PaginationNav, SkeletonText } from '@carbon/react';
import { Edit, Renew } from '@carbon/icons-react';
import { useTranslation } from 'react-i18next';
import { cockpitUrl } from '../../../shared/api/client';
import { DEFAULT_PAGE_SIZE, usePagedList } from '../../../shared/api/paging';
import { formatDateTime } from '../../../shared/format';
import { ListTable, type Column, type Sorting } from '../../../shared/ui/ListTable';
import { InstanceLink } from '../process-instance/InstanceLink';
import { PluginPoint } from '../../../shared/plugins/PluginPoint';
import { RETRYABLE, type Incident } from './api';
import { AnnotationModal, RetryModal, StacktraceModal } from './IncidentDialogs';

interface IncidentsListProps {
  engine: string;
  /** whose incidents: { processDefinitionIdIn: [...] } or { processInstanceIdIn: [...] } */
  scope: { processDefinitionIdIn: string[] } | { processInstanceIdIn: string[] };
  /** only incidents of these activities (the diagram's selection) */
  activityIds: string[];
  /** activity id → name, from the BPMN XML */
  activityNames: Map<string, string>;
  /** a click on an activity name selects it */
  onActivitySelect?: (activityId: string) => void;
  /** the process instance column (on the definition page) */
  showProcessInstance?: boolean;
}

type Dialog = { kind: 'stacktrace' | 'annotation' | 'retry'; incident: Incident } | null;

/** Open incidents with their stack traces, annotations and retries (the classic Cockpit's incidents tab). */
export function IncidentsList({ engine, scope, activityIds, activityNames, onActivitySelect, showProcessInstance }: IncidentsListProps) {
  const { t, i18n } = useTranslation('cockpit');
  const [page, setPage] = useState(1);
  const [sorting, setSorting] = useState<Sorting>({ sortBy: 'incidentType', sortOrder: 'asc' });
  const [dialog, setDialog] = useState<Dialog>(null);
  const incidents = usePagedList<Incident>(['cockpit', engine, 'list'], {
    listUrl: cockpitUrl(engine, '/incident'),
    countUrl: cockpitUrl(engine, '/incident/count'),
    method: 'POST',
    query: { ...scope, activityIdIn: activityIds.length ? activityIds : undefined },
    page,
    sorting,
  });
  const pageCount = incidents.data ? Math.ceil(incidents.data.count / DEFAULT_PAGE_SIZE) : 0;
  const activity = (id: string | null) => (id ? activityNames.get(id) || id : '');

  const columns: Column<Incident>[] = [
    {
      key: 'message',
      header: t('PLUGIN_INCIDENTS_TAB_MESSAGE'),
      sortBy: 'incidentMessage',
      render: (incident) =>
        RETRYABLE.includes(incident.incidentType) ? (
          <Button kind="ghost" size="sm" className="cz-link-button" onClick={() => setDialog({ kind: 'stacktrace', incident })}>
            {incident.incidentMessage || t('PLUGIN_INCIDENTS_TAB_MESSAGE_NULL')}
          </Button>
        ) : (
          incident.incidentMessage || t('PLUGIN_INCIDENTS_TAB_MESSAGE_NULL')
        ),
    },
    ...(showProcessInstance
      ? [{ key: 'instance', header: t('PLUGIN_INCIDENTS_TAB_MESSAGE_PROCESS_INSTANCE'), render: (incident: Incident) => <InstanceLink engine={engine} id={incident.processInstanceId} /> }]
      : []),
    {
      key: 'timestamp',
      header: t('PLUGIN_INCIDENTS_TAB_TIMESTAMP'),
      sortBy: 'incidentTimestamp',
      render: (incident) => formatDateTime(incident.incidentTimestamp, i18n.language),
    },
    {
      key: 'activity',
      header: t('PLUGIN_INCIDENTS_TAB_ACTIVITY'),
      sortBy: 'activityId',
      render: (incident) =>
        onActivitySelect ? (
          <Button kind="ghost" size="sm" className="cz-link-button" onClick={() => onActivitySelect(incident.activityId)}>
            {activity(incident.activityId)}
          </Button>
        ) : (
          activity(incident.activityId)
        ),
    },
    {
      key: 'failingActivity',
      header: t('PLGN_HIST_FAILING_ACTIVITY'),
      render: (incident) => activity(incident.failedActivityId),
    },
    {
      key: 'cause',
      header: t('PLUGIN_INCIDENTS_TAB_CAUSE_INSTANCE_ID'),
      render: (incident) => <InstanceLink engine={engine} id={incident.causeIncidentProcessInstanceId} />,
    },
    {
      key: 'rootCause',
      header: t('PLUGIN_INCIDENTS_TAB_CAUSE_ROOT_INSTANCE_ID'),
      render: (incident) => <InstanceLink engine={engine} id={incident.rootCauseIncidentProcessInstanceId} />,
    },
    {
      key: 'type',
      header: t('PLUGIN_INCIDENTS_TAB_TYPE'),
      sortBy: 'incidentType',
      render: (incident) => (incident.incidentType === 'failedJob' ? 'Failed Job' : incident.incidentType),
    },
    {
      key: 'annotation',
      header: t('PLUGIN_INCIDENTS_TAB_ANNOTATION'),
      render: (incident) => (
        <span className="cz-annotation">
          <span>{incident.annotation}</span>
          <Button
            kind="ghost"
            size="sm"
            hasIconOnly
            renderIcon={Edit}
            iconDescription={t('PLUGIN_INCIDENTS_TAB_ANNOTATION')}
            onClick={() => setDialog({ kind: 'annotation', incident })}
          />
        </span>
      ),
    },
    {
      key: 'action',
      header: t('PLUGIN_INCIDENTS_TAB_ACTION'),
      render: (incident) => (
        <span className="cz-row-actions">
          {RETRYABLE.includes(incident.incidentType) && (
            <Button
              kind="ghost"
              size="sm"
              hasIconOnly
              renderIcon={Renew}
              iconDescription={t('PLUGIN_JOB_RETRY_LEGEND_1')}
              onClick={() => setDialog({ kind: 'retry', incident })}
            />
          )}
          <PluginPoint module="cockpit" point="cockpit.incident.action" engine={engine} props={{ incidentId: incident.id }} className="cz-plugin-inline" />
        </span>
      ),
    },
  ];

  return (
    <>
      {incidents.isPending && <SkeletonText paragraph lineCount={4} />}
      {incidents.isError && <InlineNotification kind="error" lowContrast hideCloseButton subtitle={incidents.error.message} />}
      {incidents.data?.items.length === 0 && <p className="cz-list-empty">{t('PLUGIN_INCIDENTS_TAB_NO_INCIDENTS')}</p>}
      {!!incidents.data?.items.length && (
        <ListTable
          columns={columns}
          items={incidents.data.items}
          rowKey={(incident) => incident.id}
          sorting={sorting}
          onSortingChange={(next) => {
            setSorting(next);
            setPage(1);
          }}
        />
      )}
      {pageCount > 1 && (
        <PaginationNav totalItems={pageCount} page={page - 1} itemsShown={7} onChange={(index: number) => setPage(index + 1)} />
      )}
      {dialog?.kind === 'stacktrace' && <StacktraceModal engine={engine} incident={dialog.incident} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'annotation' && <AnnotationModal engine={engine} incident={dialog.incident} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'retry' && <RetryModal engine={engine} incident={dialog.incident} onClose={() => setDialog(null)} />}
    </>
  );
}
