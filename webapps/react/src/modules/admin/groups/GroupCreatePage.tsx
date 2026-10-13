import { useState } from 'react';
import { Button, ButtonSet, Form, Stack, TextInput } from '@carbon/react';
import { Link, getRouteApi } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { notify } from '../../../shared/notifications';
import { PageFrame } from '../../../shared/ui/PageFrame';
import type { Group } from '../api';
import { useIdentityItem } from '../resources';

const route = getRouteApi('/admin/$engine/group-create');

export function GroupCreatePage() {
  const { t } = useTranslation('admin');
  const { engine } = route.useParams();
  const navigate = route.useNavigate();
  const { create } = useIdentityItem<Group>(engine, '/group', undefined);
  const [group, setGroup] = useState<Group>({ id: '', name: '', type: '' });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const id = group.id.trim();
  const valid = !!id && !!group.name?.trim();

  const submit = () =>
    create.mutate(
      { ...group, id, type: group.type?.trim() || null },
      {
        onSuccess: () => {
          notify({ kind: 'success', title: t('GROUP_CREATE_MESSAGE_SUCCESS', { group: id }) });
          navigate({ to: '/admin/$engine/groups', params: { engine } });
        },
        onError: (error) =>
          notify({ kind: 'error', title: t('NOTIFICATIONS_STATUS_FAILED'), subtitle: t('GROUP_CREATE_MESSAGE_ERROR', { group: id, message: error.message }) }),
      },
    );

  return (
    <PageFrame
      title={t('GROUP_CREATE_NEW_GROUP')}
      breadcrumbs={[
        <Link key="groups" to="/admin/$engine/groups" params={{ engine }}>
          {t('GROUPS_GROUPS')}
        </Link>,
        t('GROUP_CREATE_LABEL_NEW_GROUP'),
      ]}
    >
      <Form
        className="cz-admin-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (valid) {
            submit();
          }
        }}
      >
        <Stack gap={6}>
          <TextInput
            id="cz-group-id"
            labelText={t('GROUP_CREATE_GROUP_ID')}
            value={group.id}
            invalid={touched.id && !id}
            invalidText={t('GROUP_CREATE_ID_REQUIRED')}
            onBlur={() => setTouched((current) => ({ ...current, id: true }))}
            onChange={(event) => setGroup((g) => ({ ...g, id: event.target.value }))}
          />
          <TextInput
            id="cz-group-name"
            labelText={t('GROUP_CREATE_GROUP_NAME')}
            value={group.name ?? ''}
            invalid={touched.name && !group.name?.trim()}
            invalidText={t('GROUP_CREATE_NAME_REQUIRED')}
            onBlur={() => setTouched((current) => ({ ...current, name: true }))}
            onChange={(event) => setGroup((g) => ({ ...g, name: event.target.value }))}
          />
          <TextInput
            id="cz-group-type"
            labelText={t('GROUP_GROUP_TYPE')}
            value={group.type ?? ''}
            onChange={(event) => setGroup((g) => ({ ...g, type: event.target.value }))}
          />
          <ButtonSet>
            <Button kind="secondary" onClick={() => navigate({ to: '/admin/$engine/groups', params: { engine } })}>
              {t('GROUP_CREATE_CANCEL')}
            </Button>
            <Button type="submit" disabled={!valid || create.isPending}>
              {t('GROUP_CREATE_NEW_GROUP')}
            </Button>
          </ButtonSet>
        </Stack>
      </Form>
    </PageFrame>
  );
}
