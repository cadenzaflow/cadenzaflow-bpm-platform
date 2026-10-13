import { useEffect, useMemo, useState } from 'react';
import { Button, InlineNotification, PaginationNav, Select, SelectItem, SkeletonText } from '@carbon/react';
import { SortAscending, SortDescending, TrashCan } from '@carbon/icons-react';
import { useTranslation } from 'react-i18next';
import { engineUrl } from '../../../shared/api/client';
import { DEFAULT_PAGE_SIZE, usePagedList } from '../../../shared/api/paging';
import { formatDateTime } from '../../../shared/format';
import { toQuery, type CriterionType, type SearchState } from '../../../shared/search/criteria';
import { CriteriaSearch } from '../../../shared/search/CriteriaSearch';
import { sortingOf } from '../../../shared/search/list-search';
import type { Deployment } from './api';
import { DeleteDeploymentModal } from './DeleteDeploymentModal';
import type { RepositorySearch } from './search';

const DEPLOYMENT_CRITERIA: CriterionType[] = [
  { key: 'name', label: 'REPOSITORY_SEARCH_TYPE_NAME', kind: 'property', operators: ['Like', 'eq'] },
  { key: 'id', label: 'REPOSITORY_SEARCH_TYPE_ID', kind: 'property', operators: ['eq'] },
  {
    key: 'deploymentTime',
    label: 'REPOSITORY_SEARCH_TYPE_TIME',
    kind: 'property',
    operators: ['Before', 'After'],
    valueType: 'date',
    params: { Before: 'before', After: 'after' },
  },
  { key: 'source', label: 'REPOSITORY_SEARCH_TYPE_SOURCE', kind: 'property', operators: ['eq'] },
  { key: 'withoutSource', label: 'REPOSITORY_SEARCH_TYPE_SOURCE_UNDEFINED', kind: 'flag', operators: [] },
  { key: 'tenantIdIn', label: 'REPOSITORY_SEARCH_TYPE_TENANT_ID', kind: 'property', operators: ['eq'], valueType: 'list' },
  { key: 'withoutTenantId', label: 'REPOSITORY_SEARCH_TYPE_WITHOUT_TENANT_ID', kind: 'flag', operators: [] },
];

const SORT_FIELDS = [
  { key: 'deploymentTime', label: 'REPOSITORY_DEPLOYMENTS_DEPLOYMENT_TIME' },
  { key: 'name', label: 'REPOSITORY_DEPLOYMENTS_NAME' },
  { key: 'id', label: 'REPOSITORY_DEPLOYMENTS_ID' },
];

interface DeploymentsColumnProps {
  engine: string;
  search: RepositorySearch;
  onSearchChange: (changes: Partial<RepositorySearch>) => void;
  /** a deployment was picked; `replace` when it was picked for the user (the first of the list) */
  onSelect: (deploymentId: string | undefined, replace: boolean) => void;
}

/** The deployments, searched, sorted and paged in the URL; the selected one shows its resources. */
export function DeploymentsColumn({ engine, search, onSearchChange, onSelect }: DeploymentsColumnProps) {
  const { t, i18n } = useTranslation('cockpit');
  const [draft, setDraft] = useState<SearchState>({ criteria: search.searchQuery ?? [], matchAny: false });
  const [deleting, setDeleting] = useState<Deployment | null>(null);
  const sorting = sortingOf(search, 'deploymentTime', 'desc');
  const page = search.page ?? 1;
  const query = useMemo(() => toQuery({ criteria: search.searchQuery ?? [], matchAny: false }, DEPLOYMENT_CRITERIA), [search.searchQuery]);
  const deployments = usePagedList<Deployment>(['cockpit', engine, 'list'], {
    listUrl: engineUrl(engine, '/deployment'),
    countUrl: engineUrl(engine, '/deployment/count'),
    query,
    page,
    sorting,
  });
  const items = deployments.data?.items;
  const pageCount = deployments.data ? Math.ceil(deployments.data.count / DEFAULT_PAGE_SIZE) : 0;

  // apply the search while typing, without a request per key
  useEffect(() => {
    const timer = setTimeout(() => {
      if (JSON.stringify(draft.criteria) !== JSON.stringify(search.searchQuery ?? [])) {
        onSearchChange({ searchQuery: draft.criteria.length ? draft.criteria : undefined, page: undefined });
      }
    }, 500);
    return () => clearTimeout(timer);
    // only the draft drives this
  }, [draft]);

  // a deployment that is not on the page (or none): the first one is shown
  useEffect(() => {
    if (items && !items.some((deployment) => deployment.id === search.deployment)) {
      onSelect(items[0]?.id, true);
    }
  }, [items, search.deployment]);

  const value = (text: string | null) => text || <span className="cz-null">{t('REPOSITORY_DEPLOYMENTS_NULL')}</span>;

  return (
    <section className="cz-repository__column cz-repository__deployments" aria-label={t('COCKPIT_DEPLOYMENTS')}>
      <div className="cz-repository__sorting">
        <Select
          id="cz-deployments-sort"
          labelText={t('REPOSITORY_DEPLOYMENTS_DEPLOYMENT_TIME')}
          hideLabel
          size="sm"
          value={sorting.sortBy}
          onChange={(event) => onSearchChange({ sortBy: event.target.value, sortOrder: sorting.sortOrder, page: undefined })}
        >
          {SORT_FIELDS.map((field) => (
            <SelectItem key={field.key} value={field.key} text={t(field.label)} />
          ))}
        </Select>
        <Button
          kind="ghost"
          size="sm"
          hasIconOnly
          renderIcon={sorting.sortOrder === 'asc' ? SortAscending : SortDescending}
          iconDescription={t(sorting.sortOrder === 'asc' ? 'REPOSITORY_DEPLOYMENTS_TOOLTIP_SORT_ASC' : 'REPOSITORY_DEPLOYMENTS_TOOLTIP_SORT_DESC')}
          onClick={() => onSearchChange({ sortBy: sorting.sortBy, sortOrder: sorting.sortOrder === 'asc' ? 'desc' : 'asc', page: undefined })}
        />
      </div>
      <CriteriaSearch namespace="cockpit" types={DEPLOYMENT_CRITERIA} value={draft} onChange={setDraft} allowMatchAny={false} />
      {deployments.isPending && <SkeletonText paragraph lineCount={6} />}
      {deployments.isError && (
        <InlineNotification kind="error" lowContrast hideCloseButton title={t('REPOSITORY_DEPLOYMENTS_LOADING_LEGEND')} subtitle={deployments.error.message} />
      )}
      {items?.length === 0 && <p className="cz-list-empty">{t('REPOSITORY_DEPLOYMENTS_NO_DEPLOYMENTS_AVAILABLE')}</p>}
      <ul className="cz-repository__list">
        {items?.map((deployment) => (
          <li key={deployment.id} className={deployment.id === search.deployment ? 'cz-repository__item is-selected' : 'cz-repository__item'}>
            <button
              type="button"
              className="cz-repository__select"
              aria-current={deployment.id === search.deployment ? 'true' : undefined}
              onClick={() => onSelect(deployment.id, false)}
            >
              <span className="cz-repository__name">{deployment.name || deployment.id}</span>
              <dl className="cz-repository__meta">
                <dt>{t('REPOSITORY_DEPLOYMENTS_TIME')}</dt>
                <dd>{formatDateTime(deployment.deploymentTime, i18n.language)}</dd>
                <dt>{t('REPOSITORY_DEPLOYMENTS_SOURCE')}</dt>
                <dd>{value(deployment.source)}</dd>
                <dt>{t('REPOSITORY_DEPLOYMENTS_TENANT_ID')}</dt>
                <dd>{value(deployment.tenantId)}</dd>
              </dl>
            </button>
            <Button
              kind="ghost"
              size="sm"
              hasIconOnly
              className="cz-repository__delete"
              renderIcon={TrashCan}
              iconDescription={t('REPOSITORY_DEPLOYMENTS_DELETE_DELETE_TOOLTIP')}
              onClick={() => setDeleting(deployment)}
            />
          </li>
        ))}
      </ul>
      {pageCount > 1 && (
        <PaginationNav
          totalItems={pageCount}
          page={page - 1}
          itemsShown={5}
          onChange={(index: number) => onSearchChange({ page: index > 0 ? index + 1 : undefined })}
        />
      )}
      {deleting && <DeleteDeploymentModal engine={engine} deployment={deleting} onClose={() => setDeleting(null)} />}
    </section>
  );
}
