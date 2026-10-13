import { useEffect, useMemo, useState } from 'react';
import { Button, InlineNotification, PaginationNav, SkeletonText } from '@carbon/react';
import { Add } from '@carbon/icons-react';
import { Link, getRouteApi } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import type { QueryParams } from '../../../shared/api/client';
import { toQuery, type SearchState } from '../../../shared/search/criteria';
import { CriteriaSearch } from '../../../shared/search/CriteriaSearch';
import { ADMIN_PAGE_SIZE, usePage, useResourceAccess, type User } from '../api';
import { AdminPage } from '../components/AdminPage';
import { ListTable, type Column } from '../components/ListTable';
import { sortingOf, type AdminListSearch } from '../search';
import { USER_CRITERIA } from './api';

const route = getRouteApi('/admin/$engine/users');

export function UsersPage() {
  const { t } = useTranslation('admin');
  const { engine } = route.useParams();
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const access = useResourceAccess(engine, '/user');
  const [draft, setDraft] = useState<SearchState>({ criteria: search.searchQuery ?? [], matchAny: false });

  const update = (changes: Partial<AdminListSearch>) =>
    navigate({ search: (previous: AdminListSearch) => ({ ...previous, ...changes }) });

  // apply the search while typing, without a request per key
  useEffect(() => {
    const timer = setTimeout(() => {
      if (JSON.stringify(draft.criteria) !== JSON.stringify(search.searchQuery ?? [])) {
        update({ searchQuery: draft.criteria.length ? draft.criteria : undefined, page: undefined });
      }
    }, 500);
    return () => clearTimeout(timer);
    // only the draft drives this
  }, [draft]);

  const sorting = sortingOf(search, 'userId');
  const query = useMemo(
    () => toQuery({ criteria: search.searchQuery ?? [], matchAny: false }, USER_CRITERIA) as QueryParams,
    [search.searchQuery],
  );
  const page = search.page ?? 1;
  const users = usePage<User>(engine, '/user', query, page, sorting);
  const pageCount = users.data ? Math.ceil(users.data.count / ADMIN_PAGE_SIZE) : 0;

  const userLink = (user: User, text: string) => (
    <Link to="/admin/$engine/users/$userId" params={{ engine, userId: user.id }}>
      {text}
    </Link>
  );
  const columns: Column<User>[] = [
    { key: 'id', header: t('USERS_ID'), sortBy: 'userId', render: (user) => userLink(user, user.id) },
    { key: 'firstName', header: t('PLUGIN_SEARCH_USER_FIRSTNAME'), sortBy: 'firstName', render: (user) => user.firstName },
    { key: 'lastName', header: t('PLUGIN_SEARCH_USER_LASTNAME'), sortBy: 'lastName', render: (user) => user.lastName },
    { key: 'email', header: t('USERS_EMAIL'), sortBy: 'email', render: (user) => user.email },
    { key: 'action', header: t('USERS_ACTION'), render: (user) => userLink(user, t('USERS_EDIT')) },
  ];

  return (
    <AdminPage
      title={t('USERS_LIST_OF_USERS')}
      breadcrumbs={[t('USERS_USERS')]}
      actions={
        access.data?.has('create') && (
          <Button
            size="md"
            renderIcon={Add}
            onClick={() => navigate({ to: '/admin/$engine/user-create', params: { engine } })}
          >
            {t('USERS_ADD_USER')}
          </Button>
        )
      }
    >
      <CriteriaSearch namespace="admin" types={USER_CRITERIA} value={draft} onChange={setDraft} allowMatchAny={false} />
      {users.data && !users.data.sortable && (
        <InlineNotification
          kind="info"
          lowContrast
          hideCloseButton
          title={t('USERS_NO_SORTING_HEADER')}
          subtitle={t('USERS_NO_SORTING_BODY')}
        />
      )}
      {users.isPending && <SkeletonText paragraph lineCount={5} />}
      {users.isError && <InlineNotification kind="error" lowContrast hideCloseButton subtitle={users.error.message} />}
      {users.data?.items.length === 0 && <p className="cz-admin-empty">{t('USERS_NOT_FOUND')}</p>}
      {!!users.data?.items.length && (
        <ListTable
          columns={columns}
          items={users.data.items}
          rowKey={(user) => user.id}
          sorting={sorting}
          sortable={users.data.sortable}
          onSortingChange={(next) => update({ sortBy: next.sortBy, sortOrder: next.sortOrder, page: undefined })}
        />
      )}
      {pageCount > 1 && (
        <PaginationNav
          totalItems={pageCount}
          page={page - 1}
          itemsShown={7}
          onChange={(index: number) => update({ page: index > 0 ? index + 1 : undefined })}
        />
      )}
    </AdminPage>
  );
}
