import { useState } from 'react';
import { Button, ButtonSet, Form, Stack, TextInput } from '@carbon/react';
import { Link, getRouteApi } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { notify } from '../../../shared/notifications';
import { PageFrame } from '../../../shared/ui/PageFrame';
import type { User } from '../api';
import { PasswordFields, usePasswordCheck } from '../../../shared/ui/PasswordFields';
import { useCreateUser } from './api';
import { ProfileFields, isEmail } from './ProfileFields';

const route = getRouteApi('/admin/$engine/user-create');

export function UserCreatePage() {
  const { t } = useTranslation('admin');
  const { engine } = route.useParams();
  const navigate = route.useNavigate();
  const createUser = useCreateUser(engine);
  const [profile, setProfile] = useState<User>({ id: '', firstName: '', lastName: '', email: '' });
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const check = usePasswordCheck(engine, password, profile);

  const valid =
    !!profile.id.trim() &&
    !!profile.firstName?.trim() &&
    !!profile.lastName?.trim() &&
    isEmail(profile.email) &&
    check.valid &&
    password === repeat;

  const create = () =>
    createUser.mutate(
      { profile: { ...profile, id: profile.id.trim() }, password },
      {
        onSuccess: () => {
          notify({ kind: 'success', title: t('USERS_CREATE_SUCCESS', { user: profile.id.trim() }) });
          navigate({ to: '/admin/$engine/users', params: { engine } });
        },
        onError: (error) =>
          notify({ kind: 'error', title: t('NOTIFICATIONS_STATUS_FAILED'), subtitle: t('USERS_CREATE_FAILED', { message: error.message }) }),
      },
    );

  return (
    <PageFrame
      title={t('USERS_CREATE_NEW_USER')}
      breadcrumbs={[
        <Link key="users" to="/admin/$engine/users" params={{ engine }}>
          {t('USERS_USERS')}
        </Link>,
        t('USERS_CREATE'),
      ]}
    >
      <Form
        className="cz-admin-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (valid) {
            create();
          }
        }}
      >
        <Stack gap={6}>
          <h2 className="cz-admin-form__section">{t('USERS_USER_PROFILE')}</h2>
          <TextInput
            id="cz-user-id"
            labelText={t('USERS_USER_ID')}
            value={profile.id}
            onChange={(event) => setProfile((p) => ({ ...p, id: event.target.value }))}
          />
          <ProfileFields profile={profile} onChange={setProfile} />
          <h2 className="cz-admin-form__section">{t('USERS_USER_ACCOUNT')}</h2>
          <PasswordFields
            idPrefix="cz-user"
            password={password}
            repeat={repeat}
            check={check}
            passwordLabel={t('USERS_PASSWORD')}
            repeatLabel={t('USERS_PASSWORD_REPEAT')}
            onPasswordChange={setPassword}
            onRepeatChange={setRepeat}
          />
          <ButtonSet>
            <Button kind="secondary" onClick={() => navigate({ to: '/admin/$engine/users', params: { engine } })}>
              {t('USERS_CANCEL')}
            </Button>
            <Button type="submit" disabled={!valid || createUser.isPending}>
              {t('USERS_CREATE_USER')}
            </Button>
          </ButtonSet>
        </Stack>
      </Form>
    </PageFrame>
  );
}
