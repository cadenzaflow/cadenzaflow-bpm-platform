import { Button, InlineNotification, SkeletonText } from '@carbon/react';
import { WarningFilled } from '@carbon/icons-react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { cockpitUrl, request } from '../../../../shared/api/client';
import { ListTable, type Column } from '../../../../shared/ui/ListTable';
import { InstanceLink } from '../InstanceLink';
import type { InstanceTab, InstanceTabProps } from './registry';

interface CalledInstance {
  id: string;
  businessKey: string | null;
  processDefinitionId: string;
  processDefinitionKey: string;
  processDefinitionName: string | null;
  callActivityId: string;
  callActivityInstanceId: string;
  incidents: { incidentType: string; incidentCount: number }[];
}

/** Instances called from this one's call activities (all, or those of the selected activity instances). */
function CalledInstancesTab({ engine, instance, activityInstanceIds, activityNames, onActivitySelect }: InstanceTabProps) {
  const { t } = useTranslation('cockpit');
  const called = useQuery({
    queryKey: ['cockpit', engine, 'called-instances', instance.id, activityInstanceIds],
    queryFn: () =>
      request<CalledInstance[]>(cockpitUrl(engine, `/process-instance/${encodeURIComponent(instance.id)}/called-process-instances`), {
        method: 'POST',
        json: activityInstanceIds.length ? { activityInstanceIdIn: activityInstanceIds } : {},
      }),
  });

  const columns: Column<CalledInstance>[] = [
    {
      key: 'state',
      header: t('PLUGIN_PROCESS_INSTANCE_STATE'),
      render: (row) =>
        row.incidents.length > 0 && (
          <span className="cz-incident-count">
            <WarningFilled aria-label={t('PLUGIN_PROCESS_INSTANCE_WITH_INCIDENTS')} />
          </span>
        ),
    },
    {
      key: 'instance',
      header: t('PLUGIN_CALLED_PROCESS_PROCESS_INSTANCE'),
      render: (row) => <InstanceLink engine={engine} id={row.id} />,
    },
    {
      key: 'definition',
      header: t('PLUGIN_CALLED_PROCESS_PROCESS_DEFINITION'),
      render: (row) => (
        <Link to="/cockpit/$engine/process-definition/$id" params={{ engine, id: row.processDefinitionId }}>
          {row.processDefinitionName || row.processDefinitionKey}
        </Link>
      ),
    },
    {
      key: 'activity',
      header: t('PLUGIN_CALLED_PROCESS_ACTIVITY'),
      render: (row) => (
        <Button kind="ghost" size="sm" className="cz-link-button" onClick={() => onActivitySelect(row.callActivityId)}>
          {activityNames.get(row.callActivityId) || row.callActivityId}
        </Button>
      ),
    },
    { key: 'businessKey', header: t('PLUGIN_CALLED_PROCESS_BUSINESS_KEY'), render: (row) => row.businessKey },
  ];

  return (
    <>
      {called.isPending && <SkeletonText paragraph lineCount={3} />}
      {called.isError && <InlineNotification kind="error" lowContrast hideCloseButton subtitle={called.error.message} />}
      {called.data?.length === 0 && <p className="cz-list-empty">{t('PLUGIN_CALLED_PROCESS_NO_PROCESS_INSTANCES')}</p>}
      {!!called.data?.length && <ListTable columns={columns} items={called.data} rowKey={(row) => row.id} />}
    </>
  );
}

export const tab: InstanceTab = {
  id: 'called-process-instances-tab',
  label: 'PLUGIN_CALLED_PROCESS_INSTANCE_LABEL',
  order: 30,
  component: CalledInstancesTab,
};
