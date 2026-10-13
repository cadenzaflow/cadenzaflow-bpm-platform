import { useState } from 'react';
import { Button, ButtonSet, Form, Stack, TextInput } from '@carbon/react';
import { Link, getRouteApi } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { notify } from '../../../shared/notifications';
import { PageFrame } from '../../../shared/ui/PageFrame';
import type { Tenant } from '../api';
import { useIdentityItem } from '../resources';

const route = getRouteApi('/admin/$engine/tenant-create');

export function TenantCreatePage() {
  const { t } = useTranslation('admin');
  const { engine } = route.useParams();
  const navigate = route.useNavigate();
  const { create } = useIdentityItem<Tenant>(engine, '/tenant', undefined);
  const [tenant, setTenant] = useState<Tenant>({ id: '', name: '' });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const id = tenant.id.trim();
  const valid = !!id && !!tenant.name?.trim();

  const submit = () =>
    create.mutate(
      { ...tenant, id },
      {
        onSuccess: () => {
          notify({ kind: 'success', title: t('TENANTS_CREATE_TENANT_SUCCESS', { tenant: id }) });
          navigate({ to: '/admin/$engine/tenants', params: { engine } });
        },
        onError: (error) =>
          notify({ kind: 'error', title: t('NOTIFICATIONS_STATUS_FAILED'), subtitle: t('TENANTS_CREATE_TENANT_FAILED', { message: error.message }) }),
      },
    );

  return (
    <PageFrame
      title={t('TENANTS_CREATE_TENANT')}
      breadcrumbs={[
        <Link key="tenants" to="/admin/$engine/tenants" params={{ engine }}>
          {t('TENANTS_TENANTS')}
        </Link>,
        t('TENANTS_CREATE_NEW'),
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
            id="cz-tenant-id"
            labelText={t('TENANTS_TENANT_ID')}
            value={tenant.id}
            invalid={touched.id && !id}
            invalidText={t('TENANTS_ID_REQUIRED')}
            onBlur={() => setTouched((current) => ({ ...current, id: true }))}
            onChange={(event) => setTenant((value) => ({ ...value, id: event.target.value }))}
          />
          <TextInput
            id="cz-tenant-name"
            labelText={t('TENANTS_TENANT_NAME')}
            value={tenant.name ?? ''}
            invalid={touched.name && !tenant.name?.trim()}
            invalidText={t('TENANTS_NAME_REQUIRED')}
            onBlur={() => setTouched((current) => ({ ...current, name: true }))}
            onChange={(event) => setTenant((value) => ({ ...value, name: event.target.value }))}
          />
          <ButtonSet>
            <Button kind="secondary" onClick={() => navigate({ to: '/admin/$engine/tenants', params: { engine } })}>
              {t('TENANTS_CANCEL')}
            </Button>
            <Button type="submit" disabled={!valid || create.isPending}>
              {t('TENANTS_CREATE_TENANT')}
            </Button>
          </ButtonSet>
        </Stack>
      </Form>
    </PageFrame>
  );
}
