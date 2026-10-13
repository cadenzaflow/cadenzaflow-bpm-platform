import { TaskFormTab } from '../task-form/TaskFormTab';
import type { TaskTab } from './registry';

export const tab: TaskTab = {
  id: 'form',
  label: 'FORM',
  order: 10,
  component: TaskFormTab,
};
