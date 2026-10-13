import type { ComponentType } from 'react';
import type { ListSearch } from '../../../../shared/search/list-search';
import type { ProcessDefinition } from '../../api';
import type { ProcessInstance } from '../api';

export interface InstanceTabProps {
  engine: string;
  instance: ProcessInstance;
  definition: ProcessDefinition;
  /** activities selected in the diagram or the tree */
  activityIds: string[];
  /** activity instances selected (all instances of the selected activities, or picked in the tree) */
  activityInstanceIds: string[];
  /** activity id → name, from the BPMN XML */
  activityNames: Map<string, string>;
  /** activity instance id → name of its activity (the process instance's id → the process) */
  activityInstanceNames: Map<string, string>;
  /** selects an activity, as a click in the diagram does */
  onActivitySelect: (activityId: string) => void;
  /** selects an activity instance, as a click in the tree does */
  onActivityInstanceSelect: (activityInstanceId: string) => void;
  /** search, sorting and page of the tab's list, in the URL */
  search: ListSearch;
  onSearchChange: (changes: Partial<ListSearch>) => void;
}

/** A tab of the process instance page (the classic Cockpit's "cockpit.processInstance.runtime.tab" plugins). */
export interface InstanceTab {
  /** value of the tab URL parameter */
  id: string;
  /** i18n key (cockpit namespace) of the tab title */
  label: string;
  /** ascending */
  order: number;
  component: ComponentType<InstanceTabProps>;
}

// Every *.tab.tsx file next to this one contributes one tab.
const tabModules = import.meta.glob<{ tab: InstanceTab }>('./*.tab.tsx', { eager: true });

export const instanceTabs: InstanceTab[] = Object.values(tabModules)
  .map((module) => module.tab)
  .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
