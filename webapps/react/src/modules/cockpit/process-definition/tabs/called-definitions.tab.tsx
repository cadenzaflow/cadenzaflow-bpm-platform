import { useMemo } from 'react';
import { Button, InlineNotification, SkeletonText } from '@carbon/react';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { elementNames } from '../../../../shared/diagram/bpmn-names';
import { useClientSorting } from '../../../../shared/ui/client-sorting';
import { ListTable, type Column } from '../../../../shared/ui/ListTable';
import { useCalledDefinitions, useProcessDefinitionXml } from '../api';
import { mergeCalled, type CalledRow } from '../called';
import type { DefinitionTab, DefinitionTabProps } from './registry';

/** Process definitions called from this one: running now, referenced in the BPMN, or both. */
function CalledDefinitionsTab({ engine, definition, activityIds, onSearchChange }: DefinitionTabProps) {
  const { t } = useTranslation('cockpit');
  const xml = useProcessDefinitionXml(engine, definition.id);
  const names = useMemo(() => elementNames(xml.data), [xml.data]);
  const { running, referenced } = useCalledDefinitions(engine, definition.id, activityIds);
  const merged = useMemo(
    () => (running.data && referenced.data ? mergeCalled(running.data, referenced.data, activityIds) : undefined),
    [running.data, referenced.data, activityIds.join(',')],
  );
  const { sorted: rows, sorting, setSorting } = useClientSorting(
    merged,
    {
      label: (row) => row.name || row.key,
      state: (row) => t(row.state),
      activity: (row) => names.get(row.calledFromActivityIds[0]) || row.calledFromActivityIds[0],
    },
    { sortBy: 'label', sortOrder: 'asc' },
  );
  const failure = running.error ?? referenced.error;

  const columns: Column<CalledRow>[] = [
    {
      key: 'definition',
      header: t('PLUGIN_CALLED_PROCESS'),
      sortBy: 'label',
      render: (row) => (
        <Link to="/cockpit/$engine/process-definition/$id" params={{ engine, id: row.id }} search={{ parentProcessDefinitionId: definition.id }}>
          {row.name || row.key}
        </Link>
      ),
    },
    { key: 'state', header: t('PLUGIN_CALLED_PROCESS_STATE'), sortBy: 'state', render: (row) => t(row.state) },
    {
      key: 'activity',
      header: t('PLUGIN_ACTIVITY'),
      sortBy: 'activity',
      render: (row) => (
        <span className="cz-activity-list">
          {row.calledFromActivityIds.map((activityId) => (
            <Button
              key={activityId}
              kind="ghost"
              size="sm"
              className="cz-link-button"
              onClick={() => onSearchChange({ activityIds: activityId, page: undefined })}
            >
              {names.get(activityId) || activityId}
            </Button>
          ))}
        </span>
      ),
    },
  ];

  return (
    <>
      {!rows && !failure && <SkeletonText paragraph lineCount={3} />}
      {failure && <InlineNotification kind="error" lowContrast hideCloseButton subtitle={failure.message} />}
      {rows?.length === 0 && <p className="cz-list-empty">{t('PLUGIN_CALLED_PROCESS_EMPTY')}</p>}
      {!!rows?.length && <ListTable columns={columns} items={rows} rowKey={(row) => row.id} sorting={sorting} onSortingChange={setSorting} />}
    </>
  );
}

export const tab: DefinitionTab = {
  id: 'call-process-definitions-table',
  label: 'PLUGIN_CALLED_PROCESS_DEFINITIONS_LABEL',
  order: 30,
  component: CalledDefinitionsTab,
};
