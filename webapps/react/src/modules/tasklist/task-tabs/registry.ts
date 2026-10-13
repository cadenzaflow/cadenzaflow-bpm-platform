import type { ComponentType } from 'react';
import type { Task } from '../api';

export interface TaskTabProps {
  engine: string;
  task: Task;
  /** A tab that completes the task (the form) calls this afterwards. */
  onTaskCompleted: () => void;
}

/** A tab of the task detail panel (the AngularJS Tasklist's "tasklist.task.detail" plugins). */
export interface TaskTab {
  /** Value of the detailsTab URL parameter. */
  id: string;
  /** i18n key of the tab title. */
  label: string;
  /** Ascending. The AngularJS Tasklist order is form, history, diagram, description (10, 20, 30, 40). */
  order: number;
  /** Hides the tab for tasks it does not apply to. */
  visible?: (task: Task) => boolean;
  component: ComponentType<TaskTabProps>;
}

// Every *.tab.tsx file next to this one contributes one tab: adding a tab
// means adding a file, no central list to edit.
const tabModules = import.meta.glob<{ tab: TaskTab }>('./*.tab.tsx', { eager: true });

export function sortTabs(tabs: TaskTab[]): TaskTab[] {
  return [...tabs].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

export const taskTabs: TaskTab[] = sortTabs(Object.values(tabModules).map((module) => module.tab));

export function visibleTabs(task: Task, tabs: TaskTab[] = taskTabs): TaskTab[] {
  return tabs.filter((tab) => !tab.visible || tab.visible(task));
}
