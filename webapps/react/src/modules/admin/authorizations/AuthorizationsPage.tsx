import { useState } from 'react';
import {
  Button,
  InlineNotification,
  PaginationNav,
  SkeletonText,
  StructuredListBody,
  StructuredListCell,
  StructuredListRow,
  StructuredListWrapper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@carbon/react';
import { Add, Edit, TrashCan, User, UserMultiple } from '@carbon/icons-react';
import { Link, getRouteApi } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { notify } from '../../../shared/notifications';
import { usePage } from '../api';
import { PageFrame } from '../../../shared/ui/PageFrame';
import { ConfirmModal } from '../components/ConfirmModal';
import {
  AUTHORIZATION_PAGE_SIZE,
  toDraft,
  useDeleteAuthorization,
  useSaveAuthorization,
  type Authorization,
  type AuthorizationDraft,
} from './api';
import { AuthorizationEditor } from './AuthorizationEditor';
import { AUTHORIZATION_TYPES, RESOURCE_TYPES, formatPermissions } from './permissions';
import type { AuthorizationSearch } from './search';

const route = getRouteApi('/admin/$engine/authorization');

/**
 * Authorizations of one resource type (?resource=N, chosen on the left):
 * create, change in place, delete.
 */
export function AuthorizationsPage() {
  const { t } = useTranslation('admin');
  const { engine } = route.useParams();
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const resourceType = search.resource ?? 0;
  const page = search.page ?? 1;
  const list = usePage<Authorization>(engine, '/authorization', { resourceType }, page, undefined, AUTHORIZATION_PAGE_SIZE);
  const save = useSaveAuthorization(engine);
  const remove = useDeleteAuthorization(engine);
  const [draft, setDraft] = useState<AuthorizationDraft | null>(null);
  const [deleting, setDeleting] = useState<Authorization | null>(null);
  const pageCount = list.data ? Math.ceil(list.data.count / AUTHORIZATION_PAGE_SIZE) : 0;
  const resourceLabel = t(RESOURCE_TYPES.find((type) => type.id === resourceType)?.label ?? 'AUTHORIZATION_AUTHORIZATIONS');
  const typeLabel = (type: number) => t(AUTHORIZATION_TYPES.find((candidate) => candidate.id === type)?.label ?? String(type));

  const identity = (authorization: Authorization) => (
    <span className="cz-authorization-identity">
      {authorization.userId ? (
        <User aria-label={t('AUTHORIZATION_USER')} />
      ) : (
        <UserMultiple aria-label={t('AUTHORIZATION_GROUP')} />
      )}
      {authorization.userId ?? authorization.groupId}
    </span>
  );

  const saveDraft = () => {
    if (!draft) {
      return;
    }
    save.mutate(
      { ...draft, identityId: draft.identityId.trim(), resourceId: draft.resourceId.trim() },
      {
        onSuccess: () => setDraft(null),
        onError: (error) =>
          notify({ kind: 'error', title: t(draft.id ? 'AUTHORIZATION_UPDATE' : 'AUTHORIZATION_CREATE'), subtitle: error.message }),
      },
    );
  };
  const editor = (current: AuthorizationDraft) => (
    <AuthorizationEditor
      key={current.id ?? 'new'}
      draft={current}
      saving={save.isPending}
      onChange={setDraft}
      onSave={saveDraft}
      onCancel={() => setDraft(null)}
    />
  );

  return (
    <div className="cz-admin-split">
      <nav className="cz-admin-split__nav" aria-label={t('AUTHORIZATION_RESOURCE')}>
        <ul>
          {RESOURCE_TYPES.map((type) => (
            <li key={type.id}>
              <Link
                to="/admin/$engine/authorization"
                params={{ engine }}
                search={{ resource: type.id }}
                className={type.id === resourceType ? 'is-active' : undefined}
                aria-current={type.id === resourceType ? 'page' : undefined}
                onClick={() => setDraft(null)}
              >
                {t(type.label)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <PageFrame
        title={resourceLabel}
        breadcrumbs={[t('AUTHORIZATION_AUTHORIZATIONS'), resourceLabel]}
        actions={
          <Button
            size="md"
            renderIcon={Add}
            disabled={!!draft}
            onClick={() =>
              setDraft({
                type: 1,
                identityType: 'group',
                identityId: '',
                permissions: ['ALL'],
                resourceType,
                resourceId: '*',
              })
            }
          >
            {t('AUTHORIZATION_CREATE_NEW_AUTHORIZATION')}
          </Button>
        }
      >
        {resourceType === 1 && (
          <InlineNotification kind="info" lowContrast hideCloseButton subtitle={t('AUTHORIZATION_USER_AUTH_INFO')} />
        )}
        {list.isPending && <SkeletonText paragraph lineCount={5} />}
        {list.isError && <InlineNotification kind="error" lowContrast hideCloseButton subtitle={list.error.message} />}
        {list.data && (
          <Table size="md" className="cz-list-table cz-authorizations__table">
            <TableHead>
              <TableRow>
                <TableHeader>{t('AUTHORIZATION_TYPE')}</TableHeader>
                <TableHeader>{t('AUTHORIZATION_USER_GROUP')}</TableHeader>
                <TableHeader>{t('AUTHORIZATION_PERMISSIONS')}</TableHeader>
                <TableHeader>{t('AUTHORIZATION_RESOURCE_ID')}</TableHeader>
                <TableHeader>{t('AUTHORIZATION_ACTION')}</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {draft && !draft.id && editor(draft)}
              {list.data.items.map((authorization) =>
                draft?.id === authorization.id ? (
                  editor(draft)
                ) : (
                  <TableRow key={authorization.id}>
                    <TableCell>{typeLabel(authorization.type)}</TableCell>
                    <TableCell>{identity(authorization)}</TableCell>
                    <TableCell className="cz-authorizations__permissions">{formatPermissions(authorization.permissions)}</TableCell>
                    <TableCell>{authorization.resourceId}</TableCell>
                    <TableCell>
                      <Button
                        kind="ghost"
                        size="sm"
                        hasIconOnly
                        renderIcon={Edit}
                        iconDescription={t('AUTHORIZATION_EDIT')}
                        disabled={!!draft}
                        onClick={() => setDraft(toDraft(authorization))}
                      />
                      <Button
                        kind="ghost"
                        size="sm"
                        hasIconOnly
                        renderIcon={TrashCan}
                        iconDescription={t('AUTHORIZATION_DELETE')}
                        disabled={!!draft}
                        onClick={() => setDeleting(authorization)}
                      />
                    </TableCell>
                  </TableRow>
                ),
              )}
            </TableBody>
          </Table>
        )}
        {list.data?.items.length === 0 && !draft && <p className="cz-list-empty">{t('AUTHORIZATION_EMPTY')}</p>}
        {pageCount > 1 && (
          <PaginationNav
            totalItems={pageCount}
            page={page - 1}
            itemsShown={7}
            onChange={(index: number) =>
              navigate({ search: (previous: AuthorizationSearch) => ({ ...previous, page: index > 0 ? index + 1 : undefined }) })
            }
          />
        )}
      </PageFrame>
      {deleting && (
        <ConfirmModal
          title={t('AUTHORIZATION_CONFIRM_DELETE_TITLE')}
          confirmLabel={t('AUTHORIZATION_DELETE_DELETE')}
          busy={remove.isPending}
          onClose={() => setDeleting(null)}
          onConfirm={() =>
            remove.mutate(deleting.id, {
              onSuccess: () => {
                setDeleting(null);
                notify({ kind: 'success', title: t('AUTHORIZATION_DELETE_MESSAGE') });
              },
              onError: (error) => notify({ kind: 'error', title: t('NOTIFICATIONS_STATUS_FAILED'), subtitle: error.message }),
            })
          }
        >
          <p>{t('AUTHORIZATION_CONFIRM_DELETE_MESSAGE')}</p>
          <StructuredListWrapper isCondensed className="cz-authorizations__details">
            <StructuredListBody>
              {[
                [t('AUTHORIZATION_TYPE'), typeLabel(deleting.type)],
                [t(deleting.userId ? 'AUTHORIZATION_USER' : 'AUTHORIZATION_GROUP'), deleting.userId ?? deleting.groupId],
                [t('AUTHORIZATION_PERMISSIONS'), formatPermissions(deleting.permissions)],
                [t('AUTHORIZATION_RESOURCE'), resourceLabel],
                [t('AUTHORIZATION_RESOURCE_ID'), deleting.resourceId],
              ].map(([label, value]) => (
                <StructuredListRow key={label}>
                  <StructuredListCell noWrap>{label}</StructuredListCell>
                  <StructuredListCell>{value}</StructuredListCell>
                </StructuredListRow>
              ))}
            </StructuredListBody>
          </StructuredListWrapper>
        </ConfirmModal>
      )}
    </div>
  );
}
