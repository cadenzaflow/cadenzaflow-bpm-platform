import { Select, SelectItem } from '@carbon/react';
import { getRouteApi } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { PluginView } from '../../../shared/plugins/PluginPoint';
import { usePluginPoint } from '../../../shared/plugins/plugins';
import { PageFrame } from '../../../shared/ui/PageFrame';

const route = getRouteApi('/cockpit/$engine/reports');

/** State of the Reports page in the query string: the report shown (a plugin id). */
export interface ReportsSearch {
  report?: string;
}

export function validateReportsSearch(search: Record<string, unknown>): ReportsSearch {
  return { report: typeof search.report === 'string' && search.report ? search.report : undefined };
}

/** The reports of report plugins (cockpit.report): one at a time, the first by default. */
export function ReportsPage() {
  const { t } = useTranslation('cockpit');
  const { engine } = route.useParams();
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const reports = usePluginPoint('cockpit', 'cockpit.report');
  const report = reports.find((plugin) => plugin.id === search.report) ?? reports[0];
  const name = (id: string) => t(reports.find((plugin) => plugin.id === id)?.label ?? id);

  return (
    <PageFrame
      wide
      title={report ? t('REPORTS_VIEW_TITLE_SET', { name: name(report.id) }) : t('COCKPIT_REPORTS')}
      breadcrumbs={[t('REPORTS_VIEW_BREAD_CRUMB')]}
    >
      {reports.length === 0 && <p className="cz-list-empty">{t('REPORTS_TYPE_NO_AVAILABLE_REPORTS')}</p>}
      {reports.length > 1 && (
        <Select
          id="cz-report"
          labelText={t('REPORTS_TYPE_AVAILABLE_REPORTS')}
          className="cz-report-select"
          value={report?.id}
          onChange={(event) => navigate({ search: { report: event.target.value } })}
        >
          {reports.map((plugin) => (
            <SelectItem key={plugin.id} value={plugin.id} text={name(plugin.id)} />
          ))}
        </Select>
      )}
      {report && <PluginView key={report.id} plugin={report} engine={engine} />}
    </PageFrame>
  );
}
