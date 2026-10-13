import { useTranslation } from 'react-i18next';
import type { TaskTab, TaskTabProps } from './registry';

function DescriptionTab({ task }: TaskTabProps) {
  const { t } = useTranslation('tasklist');
  return <p className="cz-task-description">{task.description || t('NO_DESCRIPTION')}</p>;
}

export const tab: TaskTab = {
  id: 'description',
  label: 'DESCRIPTION',
  order: 40,
  component: DescriptionTab,
};
