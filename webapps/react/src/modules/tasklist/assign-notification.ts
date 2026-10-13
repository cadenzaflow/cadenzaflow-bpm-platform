import { getRouteApi } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { engineUrl, request } from '../../shared/api/client';
import { notify } from '../../shared/notifications';
import type { TasklistSearch } from './search';

const route = getRouteApi('/tasklist/$engine');

interface AssignedTask {
  id: string;
  name: string | null;
  taskDefinitionKey: string;
}

/**
 * After a task was completed or a process started: lists the tasks of that
 * process instance which are now assigned to the user, each one opening the
 * task (as the classic Tasklist does).
 */
export function useAssignNotification(engine: string) {
  const { t } = useTranslation('tasklist');
  const navigate = route.useNavigate();

  return async (assignee: string | null | undefined, processInstanceId: string | null | undefined) => {
    if (!assignee || !processInstanceId) {
      return;
    }
    const tasks = await request<AssignedTask[]>(engineUrl(engine, '/task'), {
      query: { assignee, processInstanceId, maxResults: 15 },
    }).catch((): AssignedTask[] => []);
    if (tasks.length === 0) {
      return;
    }
    notify({
      kind: 'info',
      title: t('ASSIGN_NOTE_PROCESS'),
      timeout: 16_000,
      actions: tasks.map((task) => ({
        label: task.name || task.taskDefinitionKey,
        onClick: () =>
          navigate({ search: (previous: TasklistSearch) => ({ ...previous, task: task.id, detailsTab: undefined }) }),
      })),
    });
  };
}
