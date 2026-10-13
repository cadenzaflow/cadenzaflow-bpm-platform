import { useTranslation } from 'react-i18next';
import { engineUrl } from '../../../shared/api/client';
import type { CriterionType } from '../../../shared/search/criteria';
import type { Column } from '../../../shared/ui/ListTable';
import { SearchableList } from '../../../shared/ui/SearchableList';
import type { AdminListSearch } from '../search';

interface ResourceListProps<T extends { id: string }> {
  engine: string;
  /** list resource of the engine REST API, e.g. /user */
  listPath: string;
  criteria: CriterionType[];
  defaultSortBy: string;
  columns: Column<T>[];
  emptyText: string;
  /** state from the URL and how to change it */
  search: AdminListSearch;
  onSearchChange: (changes: Partial<AdminListSearch>) => void;
}

/** Search, sortable table and pages of users, groups or tenants; the state lives in the URL. */
export function ResourceList<T extends { id: string }>({ engine, listPath, ...list }: ResourceListProps<T>) {
  const { t } = useTranslation('admin');
  return (
    <SearchableList<T>
      scope={['admin-list', engine]}
      listUrl={engineUrl(engine, listPath)}
      countUrl={engineUrl(engine, `${listPath}/count`)}
      namespace="admin"
      unsortedNotice={{ title: t('USERS_NO_SORTING_HEADER'), subtitle: t('USERS_NO_SORTING_BODY') }}
      {...list}
    />
  );
}
