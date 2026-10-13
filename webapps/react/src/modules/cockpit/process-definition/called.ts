/** A process definition called from call activities of another one. */
export interface CalledDefinition {
  id: string;
  key: string;
  name: string | null;
  version: number;
  calledFromActivityIds: string[];
}

export type CalledState =
  | 'PLUGIN_CALLED_PROCESS_DEFINITIONS_RUNNING_LABEL'
  | 'PLUGIN_CALLED_PROCESS_DEFINITIONS_REFERENCED_LABEL'
  | 'PLUGIN_CALLED_PROCESS_DEFINITIONS_RUNNING_AND_REFERENCED_LABEL';

export interface CalledRow extends CalledDefinition {
  /** i18n key: running (instances called right now), referenced (in the BPMN) or both */
  state: CalledState;
}

/**
 * Called process definitions as the classic Cockpit lists them: those with
 * running called instances and those referenced in the BPMN, merged by id;
 * a selection of activities limits the referenced ones to those activities
 * (the running ones are queried with the selection already).
 */
export function mergeCalled(running: CalledDefinition[], referenced: CalledDefinition[], activityIds: string[]): CalledRow[] {
  const rows = new Map<string, CalledRow>();
  for (const definition of running) {
    rows.set(definition.id, { ...definition, state: 'PLUGIN_CALLED_PROCESS_DEFINITIONS_RUNNING_LABEL' });
  }
  for (const definition of referenced) {
    const from = activityIds.length
      ? definition.calledFromActivityIds.filter((id) => activityIds.includes(id))
      : definition.calledFromActivityIds;
    if (!from.length) {
      continue;
    }
    const existing = rows.get(definition.id);
    rows.set(
      definition.id,
      existing
        ? {
            ...existing,
            calledFromActivityIds: [...new Set([...existing.calledFromActivityIds, ...from])].sort(),
            state: 'PLUGIN_CALLED_PROCESS_DEFINITIONS_RUNNING_AND_REFERENCED_LABEL',
          }
        : { ...definition, calledFromActivityIds: [...from].sort(), state: 'PLUGIN_CALLED_PROCESS_DEFINITIONS_REFERENCED_LABEL' },
    );
  }
  return [...rows.values()].sort((a, b) => (a.name || a.key).localeCompare(b.name || b.key));
}
