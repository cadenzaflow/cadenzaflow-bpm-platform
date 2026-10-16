import { useState } from 'react';
import {
  Checkbox,
  CodeSnippet,
  CopyButton,
  InlineNotification,
  SkeletonText,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TextInput,
} from '@carbon/react';
import { Information } from '@carbon/icons-react';
import { Link, getRouteApi } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { PluginView } from '../../../shared/plugins/PluginPoint';
import { usePluginPoint } from '../../../shared/plugins/plugins';
import { PageFrame } from '../../../shared/ui/PageFrame';
import { useAnnualMetrics, useDiagnostics, useMonthlyMetrics } from './api';
import { MetricsChart } from './MetricsChart';
import { LEGACY_METRICS, formatDate, parseDate, subscriptionYear, type MetricKey, type MetricsRow } from './metrics';
import { SYSTEM_SECTIONS, type SystemSearch } from './search';

const route = getRouteApi('/admin/$engine/system');

/**
 * General information, execution metrics and diagnostics (?section=, as in
 * the classic Admin), followed by the sections of admin.system plugins.
 */
export function SystemPage() {
  const { t } = useTranslation('admin');
  const { engine } = route.useParams();
  const { section } = route.useSearch();
  const plugins = usePluginPoint('admin', 'admin.system');
  const sections = [
    ...SYSTEM_SECTIONS.map((candidate) => ({ id: candidate.id as string, label: candidate.label as string, plugin: undefined })),
    ...plugins.map((plugin) => ({ id: plugin.id, label: plugin.label ?? plugin.id, plugin })),
  ];
  const selected = sections.find((candidate) => candidate.id === section) ?? sections[0];

  return (
    <div className="cz-admin-split">
      <nav className="cz-admin-split__nav" aria-label={t('SYSTEM_SYSTEM_SETTINGS')}>
        <ul>
          {sections.map((candidate) => (
            <li key={candidate.id}>
              <Link
                to="/admin/$engine/system"
                params={{ engine }}
                search={{ section: candidate.id } satisfies SystemSearch}
                className={candidate.id === selected.id ? 'is-active' : undefined}
                aria-current={candidate.id === selected.id ? 'page' : undefined}
              >
                {t(candidate.label)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <PageFrame title={t(selected.label)} breadcrumbs={[t('SYSTEM_SYSTEM_SETTINGS'), t(selected.label)]}>
        {selected.id === 'system-settings-general' && <General engine={engine} />}
        {selected.id === 'system-settings-metrics' && <ExecutionMetrics engine={engine} />}
        {selected.id === 'diagnostics-system-settings' && <Diagnostics engine={engine} />}
        {selected.plugin && <PluginView plugin={selected.plugin} engine={engine} />}
      </PageFrame>
    </div>
  );
}

function General({ engine }: { engine: string }) {
  const { t } = useTranslation('admin');
  return (
    <>
      <h2 className="cz-admin-form__section">{t('SYSTEM_GENERAL_SETTINGS')}</h2>
      <InlineNotification
        kind="success"
        lowContrast
        hideCloseButton
        title={t('SYSTEM_PROCESS_ENGINE')}
      >
        <code>{engine}</code> {t('SYSTEM_PROCESS_RUNNING')}
      </InlineNotification>
    </>
  );
}

const START_DATE_KEY = 'cz-admin-metrics-contract-start';

/** The contract start date the user chose last time (kept in this browser), else January 1st. */
function storedStartDate(): string {
  try {
    const stored = localStorage.getItem(START_DATE_KEY);
    if (stored && parseDate(stored)) {
      return stored;
    }
  } catch {
    // storage not available
  }
  return `${new Date().getFullYear()}-01-01`;
}

function ExecutionMetrics({ engine }: { engine: string }) {
  const { t } = useTranslation('admin');
  const [startText, setStartText] = useState(storedStartDate);
  const [legacy, setLegacy] = useState(false);
  const parsed = parseDate(startText);
  const [contractStart, setContractStart] = useState(() => parseDate(startText)!);
  const monthly = useMonthlyMetrics(engine, contractStart, legacy);
  const annual = useAnnualMetrics(engine, contractStart);
  const diagnostics = useDiagnostics(engine);
  const monthlyKeys: MetricKey[] = ['PI', 'DI', 'TU', ...(legacy ? LEGACY_METRICS : [])];
  const allKeys: MetricKey[] = ['PI', 'DI', 'TU', ...LEGACY_METRICS];
  const failed = (error: Error) => t('EXECUTION_METRICS_FETCH_DATA_ERROR_MESSAGE', { msg: error.message });

  const changeStart = (text: string) => {
    setStartText(text);
    const date = parseDate(text);
    if (date && date <= new Date()) {
      setContractStart(date);
      try {
        localStorage.setItem(START_DATE_KEY, text);
      } catch {
        // storage not available
      }
    }
  };

  const yearLabel = (row: MetricsRow) => {
    const year = subscriptionYear(Number(row.label), contractStart, new Date());
    return t(year.current ? 'EXECUTION_METRICS_ANNUAL_FORMAT_CURRENT' : 'EXECUTION_METRICS_ANNUAL_FORMAT', year);
  };
  const copyText = (row: MetricsRow) =>
    [yearLabel(row), ...allKeys.map((key) => `- ${key}: ${row.sums[key].toLocaleString()}`), '', JSON.stringify(diagnostics.data ?? {}, null, 2)].join('\n');

  return (
    <div className="cz-metrics">
      <InlineNotification kind="info" lowContrast hideCloseButton>
        <span>
          {t('EXECUTION_METRICS_INFO_1')} <strong>{t('EXECUTION_METRICS_FNI')}</strong>, <strong>{t('EXECUTION_METRICS_EDE')}</strong>,{' '}
          <strong>{t('EXECUTION_METRICS_RPI')}</strong> {t('EXECUTION_METRICS_AND')} <strong>{t('EXECUTION_METRICS_DI')}</strong>{' '}
          {t('EXECUTION_METRICS_INFO_2')} {t('EXECUTION_METRICS_AND')} <strong>{t('EXECUTION_METRICS_TW')}</strong>{' '}
          {t('EXECUTION_METRICS_INFO_3')} {t('EXECUTION_METRICS_INFO_4')}
        </span>
      </InlineNotification>
      <TextInput
        id="cz-metrics-start"
        type="date"
        className="cz-metrics__start"
        labelText={t('EXECUTION_METRICS_START_DATE')}
        value={startText}
        max={formatDate(new Date())}
        invalid={!parsed}
        invalidText="yyyy-MM-dd"
        onChange={(event) => changeStart(event.target.value)}
      />

      <div className="cz-metrics__heading">
        <h2 className="cz-admin-form__section">{t('EXECUTION_METRICS_MONTHLY_TABLE_TITLE')}</h2>
        <Checkbox
          id="cz-metrics-legacy"
          labelText={t('EXECUTION_METRICS_SHOW_LEGACY')}
          checked={legacy}
          onChange={(_, { checked }) => setLegacy(checked)}
        />
      </div>
      {monthly.isPending && <SkeletonText paragraph lineCount={6} />}
      {monthly.isError && <InlineNotification kind="error" lowContrast hideCloseButton subtitle={failed(monthly.error)} />}
      {monthly.data && (
        <>
          <MetricsChart rows={[...monthly.data].reverse()} keys={monthlyKeys} title={t('EXECUTION_METRICS_MONTHLY_TABLE_TITLE')} />
          <Table size="sm" className="cz-metrics__table">
            <TableHead>
              <TableRow>
                <TableHeader>{t('EXECUTION_METRICS_MONTHLY_START_DATE')}</TableHeader>
                {monthlyKeys.map((key) => (
                  <TableHeader key={key} className="cz-metrics__number">
                    {key}
                    {key === 'TU' && (
                      <span className="cz-metrics__hint" title={t('EXECUTION_METRICS_TU_TOOLTIP')}>
                        <Information aria-label={t('EXECUTION_METRICS_TU_TOOLTIP')} />
                      </span>
                    )}
                  </TableHeader>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {monthly.data.map((row) => (
                <TableRow key={row.label} className={row.activeYear ? undefined : 'cz-metrics__previous-year'}>
                  <TableCell>{row.label}</TableCell>
                  {monthlyKeys.map((key) => (
                    <TableCell key={key} className="cz-metrics__number">
                      {row.sums[key].toLocaleString()}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}

      <h2 className="cz-admin-form__section cz-metrics__heading">{t('EXECUTION_METRICS_ANNUAL_TABLE_TITLE')}</h2>
      {annual.isPending && <SkeletonText paragraph lineCount={3} />}
      {annual.isError && <InlineNotification kind="error" lowContrast hideCloseButton subtitle={failed(annual.error)} />}
      {annual.data?.length === 0 && <p className="cz-list-empty">{t('EXECUTION_METRICS_ANNUAL_TABLE_EMPTY')}</p>}
      {!!annual.data?.length && (
        <Table size="sm" className="cz-metrics__table">
          <TableHead>
            <TableRow>
              <TableHeader aria-hidden="true" />
              {allKeys.map((key) => (
                <TableHeader key={key} className="cz-metrics__number">
                  {key}
                </TableHeader>
              ))}
              <TableHeader>{t('EXECUTION_METRICS_COPY_HEADER')}</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {annual.data.map((row) => (
              <TableRow key={row.label}>
                <TableCell>{yearLabel(row)}</TableCell>
                {allKeys.map((key) => (
                  <TableCell key={key} className="cz-metrics__number">
                    {row.sums[key].toLocaleString()}
                  </TableCell>
                ))}
                <TableCell>
                  <CopyButton
                    iconDescription={t('EXECUTION_METRICS_COPY_TOOLTIP')}
                    onClick={() => navigator.clipboard?.writeText(copyText(row))}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function Diagnostics({ engine }: { engine: string }) {
  const { t } = useTranslation('admin');
  const diagnostics = useDiagnostics(engine);
  return (
    <>
      <InlineNotification kind="info" lowContrast hideCloseButton subtitle={t('DIAGNOSTICS_INTRODUCTION')} />
      {diagnostics.isPending && <SkeletonText paragraph lineCount={8} />}
      {diagnostics.isError && (
        <InlineNotification
          kind="error"
          lowContrast
          hideCloseButton
          title={t('ERROR')}
          subtitle={t('DIAGNOSTICS_FETCH_DATA_ERROR_MESSAGE', { msg: diagnostics.error.message })}
        />
      )}
      {diagnostics.data && (
        <>
          <h2 className="cz-admin-form__section cz-metrics__heading">{t('DIAGNOSTICS_DATA')}</h2>
          <CodeSnippet type="multi" feedback={t('EXECUTION_METRICS_COPY_HEADER')} maxCollapsedNumberOfRows={40}>
            {JSON.stringify(diagnostics.data, null, 2)}
          </CodeSnippet>
        </>
      )}
    </>
  );
}
