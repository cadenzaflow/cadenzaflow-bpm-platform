import { useMemo } from 'react';
import { elementNames } from '../../../../shared/diagram/bpmn-names';
import { IncidentsList } from '../../incidents/IncidentsList';
import { useProcessDefinitionXml } from '../api';
import type { DefinitionTab, DefinitionTabProps } from './registry';

/** Open incidents of the definition's instances, filtered by the selected activities. */
function IncidentsTab({ engine, definition, activityIds, onSearchChange }: DefinitionTabProps) {
  const xml = useProcessDefinitionXml(engine, definition.id);
  const names = useMemo(() => elementNames(xml.data), [xml.data]);
  return (
    <IncidentsList
      engine={engine}
      scope={{ processDefinitionIdIn: [definition.id] }}
      activityIds={activityIds}
      activityNames={names}
      onActivitySelect={(activityId) => onSearchChange({ activityIds: activityId, page: undefined })}
      showProcessInstance
    />
  );
}

export const tab: DefinitionTab = {
  id: 'pd-incidents-tab',
  label: 'PLUGIN_INCIDENTS_LABEL',
  order: 20,
  component: IncidentsTab,
};
