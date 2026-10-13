import type { ReactNode } from 'react';
import { InlineNotification, SkeletonText, Tile } from '@carbon/react';
import { Link, getRouteApi } from '@tanstack/react-router';
import { PluginPoint } from '../../../shared/plugins/PluginPoint';
import { useTranslation } from 'react-i18next';
import { BarList, type BarItem } from '../../../shared/ui/BarList';
import { incidentCount, useCount, useProcessStatistics, type ProcessStatistics } from '../api';

const route = getRouteApi('/cockpit/$engine/');

/** Per process (all versions of a key): running instances and open incidents. */
export function byProcess(statistics: ProcessStatistics[]) {
  const processes = new Map<string, { label: string; instances: number; incidents: number }>();
  for (const entry of statistics) {
    const key = entry.definition.key + (entry.definition.tenantId ? `@${entry.definition.tenantId}` : '');
    const process = processes.get(key) ?? { label: entry.definition.name || entry.definition.key, instances: 0, incidents: 0 };
    process.instances += entry.instances;
    process.incidents += incidentCount(entry);
    processes.set(key, process);
  }
  return [...processes.entries()].map(([key, process]) => ({ key, ...process }));
}

function Card({ title, total, children }: { title: string; total: ReactNode; children?: ReactNode }) {
  return (
    <Tile className="cz-dashboard-card">
      <h2 className="cz-dashboard-card__title">{title}</h2>
      <p className="cz-dashboard-card__total">{total}</p>
      {children}
    </Tile>
  );
}

/** Right now (running instances, open incidents, open human tasks) and what is deployed, as in the classic Cockpit. */
export function CockpitDashboard() {
  const { t } = useTranslation('cockpit');
  const { engine } = route.useParams();
  const statistics = useProcessStatistics(engine);
  const tasks = useCount(engine, '/task/count');
  const assigned = useCount(engine, '/task/count', { assigned: true });
  const toGroups = useCount(engine, '/task/count', { unassigned: true, withCandidateGroups: true });
  const unassigned = useCount(engine, '/task/count', { unassigned: true, withoutCandidateGroups: true });
  const processDefinitions = useCount(engine, '/process-definition/count', { latestVersion: true });
  const decisionDefinitions = useCount(engine, '/decision-definition/count', { latestVersion: true });
  const deployments = useCount(engine, '/deployment/count');

  const processes = statistics.data ? byProcess(statistics.data) : [];
  const instances: BarItem[] = processes.map((process) => ({ key: process.key, label: process.label, value: process.instances }));
  const incidents: BarItem[] = processes.map((process) => ({ key: process.key, label: process.label, value: process.incidents }));
  const sum = (items: BarItem[]) => items.reduce((total, item) => total + item.value, 0);
  const processesLink = (value: number) => (
    <Link to="/cockpit/$engine/processes" params={{ engine }}>
      {value.toLocaleString()}
    </Link>
  );
  // a count that opens its section; a dash while loading
  const countLink = (value: number | undefined, to: '/cockpit/$engine/tasks' | '/cockpit/$engine/decisions' | '/cockpit/$engine/repository') =>
    value === undefined ? (
      '–'
    ) : (
      <Link to={to} params={{ engine }}>
        {value.toLocaleString()}
      </Link>
    );

  return (
    <section className="cz-page cz-cockpit-dashboard">
      <h1 className="cz-page__title">{t('DASHBOARD_DASHBOARD')}</h1>

      <h2 className="cz-cockpit-dashboard__section">{t('DASHBOARD_RIGHT_NOW')}</h2>
      {statistics.isError && <InlineNotification kind="error" lowContrast hideCloseButton subtitle={statistics.error.message} />}
      <div className="cz-cockpit-dashboard__cards">
        <Card title={t('DASHBOARD_RUNNING_PROCESS_INSTANCE')} total={statistics.data ? processesLink(sum(instances)) : <SkeletonText />}>
          <BarList items={instances} label={t('DASHBOARD_RUNNING_PROCESS_INSTANCE')} othersLabel={t('DASHBOARD_OTHERS')} />
        </Card>
        <Card title={t('DASHBOARD_OPEN_INCIDENTS')} total={statistics.data ? processesLink(sum(incidents)) : <SkeletonText />}>
          <BarList items={incidents} label={t('DASHBOARD_OPEN_INCIDENTS')} othersLabel={t('DASHBOARD_OTHERS')} />
        </Card>
        <Card title={t('DASHBOARD_OPEN_HUMAN_TASKS')} total={countLink(tasks.data, '/cockpit/$engine/tasks')}>
          <BarList
            items={[
              { key: 'user', label: t('DASHBOARD_ASSIGNED_TO_USER'), value: assigned.data ?? 0 },
              { key: 'groups', label: t('DASHBOARD_ASSIGNED_TO_GROUPS'), value: toGroups.data ?? 0 },
              { key: 'unassigned', label: t('DASHBOARD_UNASSIGNED'), value: unassigned.data ?? 0 },
            ]}
            label={t('DASHBOARD_OPEN_HUMAN_TASKS')}
            othersLabel={t('DASHBOARD_OTHERS')}
          />
        </Card>
      </div>

      <h2 className="cz-cockpit-dashboard__section">{t('DASHBOARD_DEPLOYED')}</h2>
      <div className="cz-cockpit-dashboard__cards">
        <Card
          title={t('DASHBOARD_PROCESS_DEFINITIONS')}
          total={processDefinitions.data === undefined ? '–' : processesLink(processDefinitions.data)}
        />
        <Card title={t('DASHBOARD_DECISION_DEFINITIONS')} total={countLink(decisionDefinitions.data, '/cockpit/$engine/decisions')} />
        <Card title={t('DASHBOARD_DEPLOYMENTS')} total={countLink(deployments.data, '/cockpit/$engine/repository')} />
      </div>
      <PluginPoint module="cockpit" point="cockpit.dashboard" engine={engine} className="cz-plugin-section" />
    </section>
  );
}
