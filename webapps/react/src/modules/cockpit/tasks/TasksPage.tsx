import { InlineNotification, SkeletonText, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@carbon/react';
import { Information } from '@carbon/icons-react';
import { useQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { engineUrl, request } from '../../../shared/api/client';
import { PluginPoint } from '../../../shared/plugins/PluginPoint';
import { PageFrame } from '../../../shared/ui/PageFrame';

const route = getRouteApi('/cockpit/$engine/tasks');

/** Open tasks by kind of assignment, counted in the history (unfinished tasks), as in the classic Cockpit. */
const ASSIGNMENTS = [
  { key: 'user', label: 'PLUGIN_TASK_ASSIGNED_TO_USER', error: 'PLUGIN_TASK_ERROR_ASSIGNED_TO_USERS', query: { assigned: true } },
  {
    key: 'groups',
    label: 'PLUGIN_TASK_ASSIGNED_TO_ONE',
    error: 'PLUGIN_TASK_ERROR_ASSIGNED_TO_GROUPS',
    query: { unassigned: true, withCandidateGroups: true },
  },
  {
    key: 'unassigned',
    label: 'PLUGIN_TASK_ASSIGNED_UNASSIGNED',
    error: 'PLUGIN_TASK_ERROR_UNASSIGNED',
    query: { unassigned: true, withoutCandidateGroups: true },
  },
] as const;

interface GroupCount {
  /** the group id; null for tasks without a candidate group */
  id: string | null;
  name: string | null;
  taskCount: number;
}

function useOpenTaskCount(engine: string, query: Record<string, boolean>) {
  return useQuery({
    queryKey: ['cockpit', engine, 'open-task-count', query],
    queryFn: async () =>
      (await request<{ count: number }>(engineUrl(engine, '/history/task/count'), { method: 'POST', json: { unfinished: true, ...query } })).count,
  });
}

/** Open tasks per candidate group, with the groups' names where they may be read (otherwise their ids). */
function useGroupCounts(engine: string) {
  return useQuery({
    queryKey: ['cockpit', engine, 'task-group-counts'],
    queryFn: async () => {
      const report = await request<{ groupName: string | null; taskCount: number }[]>(engineUrl(engine, '/task/report/candidate-group-count'));
      const ids = report.map((row) => row.groupName).filter((id): id is string => !!id);
      const names = new Map<string, string>();
      if (ids.length) {
        type Group = { id: string; name: string | null };
        const groups = await request<Group[]>(engineUrl(engine, '/group'), {
          method: 'POST',
          query: { maxResults: ids.length },
          json: { idIn: ids },
        }).catch((): Group[] => []);
        groups.forEach((group) => group.name && names.set(group.id, group.name));
      }
      return report.map((row): GroupCount => ({ id: row.groupName, name: row.groupName && (names.get(row.groupName) ?? row.groupName), taskCount: row.taskCount }));
    },
  });
}

/** Open human tasks by assignment and by candidate group. */
export function TasksPage() {
  const { t } = useTranslation('cockpit');
  const { engine } = route.useParams();
  const total = useOpenTaskCount(engine, {});
  const counts = [useOpenTaskCount(engine, ASSIGNMENTS[0].query), useOpenTaskCount(engine, ASSIGNMENTS[1].query), useOpenTaskCount(engine, ASSIGNMENTS[2].query)];
  const groups = useGroupCounts(engine);
  const failed = [
    ...(total.isError ? [{ key: 'total', text: t('PLUGIN_TASK_ERROR_FETCH', { res: t('PLUGIN_TASK_ERROR_OPEN_TASKS') }), message: total.error.message }] : []),
    ...ASSIGNMENTS.flatMap((assignment, index) => {
      const count = counts[index];
      return count.isError ? [{ key: assignment.key, text: t('PLUGIN_TASK_ERROR_FETCH', { res: t(assignment.error) }), message: count.error.message }] : [];
    }),
    ...(groups.isError ? [{ key: 'groups', text: t('PLUGIN_TASK_ERROR_COUNT'), message: groups.error.message }] : []),
  ];
  const number = (value: number | undefined) => (value === undefined ? <SkeletonText className="cz-count-skeleton" /> : value.toLocaleString());

  return (
    <PageFrame title={t('TASKS_HUMAN_TASKS')} breadcrumbs={[t('TASKS_HUMAN_TASKS')]}>
      {failed.map((failure) => (
        <InlineNotification
          key={failure.key}
          kind="error"
          lowContrast
          hideCloseButton
          title={t('PLUGIN_TASK_ASSIGNED_ERR_COULD_NOT', { err: failure.text })}
          subtitle={failure.message}
        />
      ))}
      <div className="cz-task-dashboard">
        <section>
          <h2 className="cz-section-title">{t('PLUGIN_TASK_ASSIGNMENT_BY_TYPE')}</h2>
          <Table size="md" className="cz-list-table">
            <TableHead>
              <TableRow>
                <TableHeader className="cz-count-column">{t('PLUGIN_TASK_TASKS')}</TableHeader>
                <TableHeader>{t('PLUGIN_TASK_TYPES')}</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {ASSIGNMENTS.map((assignment, index) => (
                <TableRow key={assignment.key}>
                  <TableCell className="cz-count-column">{number(counts[index].data)}</TableCell>
                  <TableCell>{t(assignment.label)}</TableCell>
                </TableRow>
              ))}
              <TableRow className="cz-total-row">
                <TableCell className="cz-count-column">{number(total.data)}</TableCell>
                <TableCell>{t('PLUGIN_TASK_TOTAL')}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </section>
        <section>
          <h2 className="cz-section-title">{t('PLUGIN_TASK_ASSIGNMENT_BY_GROUP')}</h2>
          <Table size="md" className="cz-list-table">
            <TableHead>
              <TableRow>
                <TableHeader className="cz-count-column">{t('PLUGIN_TASK_TASKS')}</TableHeader>
                <TableHeader>{t('PLUGIN_TASK_GROUP')}</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {groups.isPending && (
                <TableRow>
                  <TableCell colSpan={2}>
                    <SkeletonText />
                  </TableCell>
                </TableRow>
              )}
              {groups.data?.map((group) => (
                <TableRow key={group.id ?? ''}>
                  <TableCell className="cz-count-column">{group.taskCount.toLocaleString()}</TableCell>
                  <TableCell title={group.id ?? undefined}>{group.name ?? <span className="cz-null">{t('PLUGIN_TASK_ASSIGNED_WITHOUT_GROUP')}</span>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {groups.data && (
            <p className="cz-task-dashboard__note">
              <Information aria-hidden="true" />
              {t('PLUGIN_TASK_LEGEND_FOOTER')}
            </p>
          )}
        </section>
      </div>
      <PluginPoint module="cockpit" point="cockpit.tasks.dashboard" engine={engine} className="cz-plugin-section" />
    </PageFrame>
  );
}
