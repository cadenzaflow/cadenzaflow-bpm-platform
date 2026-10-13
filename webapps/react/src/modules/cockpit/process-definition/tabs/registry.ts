import type { ComponentType } from 'react';
import type { ProcessDefinition } from '../../api';
import type { ProcessDefinitionSearch } from '../search';

export interface DefinitionTabProps {
  engine: string;
  definition: ProcessDefinition;
  /** activities selected in the diagram */
  activityIds: string[];
  search: ProcessDefinitionSearch;
  onSearchChange: (changes: Partial<ProcessDefinitionSearch>) => void;
}

/** A tab of the process definition page (the classic Cockpit's "cockpit.processDefinition.runtime.tab" plugins). */
export interface DefinitionTab {
  /** value of the tab URL parameter */
  id: string;
  /** i18n key (cockpit namespace) of the tab title */
  label: string;
  /** ascending */
  order: number;
  component: ComponentType<DefinitionTabProps>;
}

// Every *.tab.tsx file next to this one contributes one tab.
const tabModules = import.meta.glob<{ tab: DefinitionTab }>('./*.tab.tsx', { eager: true });

export const definitionTabs: DefinitionTab[] = Object.values(tabModules)
  .map((module) => module.tab)
  .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
