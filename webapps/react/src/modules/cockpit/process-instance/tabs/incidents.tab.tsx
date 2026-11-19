import { IncidentsList } from '../../incidents/IncidentsList';
import type { InstanceTab, InstanceTabProps } from './registry';

/** Open incidents of this instance, filtered by the selected activities. */
function IncidentsTab({ engine, instance, activityIds, activityNames, onActivitySelect, search, onSearchChange }: InstanceTabProps) {
  return (
    <IncidentsList
      engine={engine}
      scope={{ processInstanceIdIn: [instance.id] }}
      activityIds={activityIds}
      activityNames={activityNames}
      onActivitySelect={onActivitySelect}
      stacktrace={search.incidentStacktrace}
      onStacktraceChange={(incidentStacktrace) => onSearchChange({ incidentStacktrace })}
    />
  );
}

export const tab: InstanceTab = {
  id: 'incidents-tab',
  label: 'PLUGIN_INCIDENTS_LABEL',
  order: 20,
  component: IncidentsTab,
};
