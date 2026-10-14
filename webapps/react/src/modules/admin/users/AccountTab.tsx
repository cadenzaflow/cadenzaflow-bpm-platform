import { useState } from 'react';
import { Button, Form, InlineNotification, PasswordInput, Stack } from '@carbon/react';
import { getRouteApi } from '@tanstack/react-router';
import { Trans, useTranslation } from 'react-i18next';
import { ApiError } from '../../../shared/api/client';
import { useAuthentication, useLogout, useUserProfile } from '../../../shared/auth/authentication';
import { displayName } from '../../../shared/format';
import { notify } from '../../../shared/notifications';
import type { User } from '../api';
import { ConfirmModal } from '../components/ConfirmModal';
import { PasswordFields, usePasswordCheck } from '../../../shared/ui/PasswordFields';
import { useDeleteUser, useUnlockUser, useUpdateCredentials } from './api';

const route = getRouteApi('/admin/$engine/users/$userId');

/** Change the password, delete the user, unlock the user. */
export function AccountTab({ engine, profile }: { engine: string; profile: User }) {
  const { t } = useTranslation('admin');
  const navigate = route.useNavigate();
  const me = useAuthentication(engine).data?.userId;
  const myProfile = useUserProfile(engine, me);
  const own = me === profile.id;
  const updateCredentials = useUpdateCredentials(engine, profile.id);
  const deleteUser = useDeleteUser(engine, profile.id);
  const unlockUser = useUnlockUser(engine, profile.id);
  const logout = useLogout(engine);
  const [myPassword, setMyPassword] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const check = usePasswordCheck(engine, password, profile);
  const canChange = !!myPassword && check.valid && password === repeat && !updateCredentials.isPending;

  const changePassword = () =>
    updateCredentials.mutate(
      { password, authenticatedUserPassword: myPassword },
      {
        onSuccess: () => {
          notify({ kind: 'success', title: t('NOTIFICATIONS_STATUS_PASSWORD'), subtitle: t('USERS_PASSWORD_CHANGED') });
          setMyPassword('');
          setPassword('');
          setRepeat('');
        },
        onError: (error) =>
          notify({
            kind: 'error',
            title: t('NOTIFICATIONS_STATUS_PASSWORD'),
            subtitle:
              error instanceof ApiError && error.status === 400
                ? t(own ? 'USERS_OLD_PASSWORD_NOT_VALID' : 'USERS_PASSWORD_NOT_VALID')
                : t('USERS_PASSWORD_COULD_NOT_CHANGE', { message: error.message }),
          }),
      },
    );

  const remove = () =>
    deleteUser.mutate(undefined, {
      onSuccess: () => {
        setConfirmDelete(false);
        if (own) {
          // the account is gone: back to the login page
          logout.mutate();
          return;
        }
        notify({ kind: 'success', title: t('USERS_USER_DELETE_SUCCESS', { user: profile.id }) });
        navigate({ to: '/admin/$engine/users', params: { engine } });
      },
      onError: (error) =>
        notify({
          kind: 'error',
          title: t('NOTIFICATIONS_STATUS_ERROR'),
          subtitle: t('USERS_USER_DELETE_FAILED', { user: profile.id, message: error.message }),
        }),
    });

  const unlock = () =>
    unlockUser.mutate(undefined, {
      onSuccess: () => {
        notify({ kind: 'success', title: t('USERS_USER_UNLOCK_SUCCESS', { user: profile.id }) });
        navigate({ to: '/admin/$engine/users', params: { engine } });
      },
      onError: (error) => notify({ kind: 'error', title: t('NOTIFICATIONS_STATUS_FAILED'), subtitle: error.message }),
    });

  return (
    <Stack gap={7} className="cz-admin-form">
      <Form
        onSubmit={(event) => {
          event.preventDefault();
          if (canChange) {
            changePassword();
          }
        }}
      >
        <Stack gap={6}>
          <h2 className="cz-admin-form__section">{t('USERS_CHANGE_PASSWORD')}</h2>
          <p>{t('USERS_TYPE_NEW_PASSWORD')}</p>
          <PasswordInput
            id="cz-account-my-password"
            autoComplete="current-password"
            labelText={own ? t('USERS_OLD_PASSWORD') : t('USERS_MY_PASSWORD', { name: displayName(myProfile.data, me ?? '') })}
            value={myPassword}
            onChange={(event) => setMyPassword(event.target.value)}
          />
          <PasswordFields
            idPrefix="cz-account"
            password={password}
            repeat={repeat}
            check={check}
            passwordLabel={t('USERS_NEW_PASSWORD')}
            repeatLabel={t('USERS_NEW_PASSWORD_REPEAT')}
            onPasswordChange={setPassword}
            onRepeatChange={setRepeat}
          />
          <div>
            <Button type="submit" disabled={!canChange}>
              {t('USERS_CHANGE_PASSWORD')}
            </Button>
          </div>
        </Stack>
      </Form>

      <Stack gap={5}>
        <h2 className="cz-admin-form__section">{t('USERS_DELETE_USER')}</h2>
        <InlineNotification kind="warning" lowContrast hideCloseButton title={t('USERS_WARNING')} subtitle={t('USERS_DELETING_UNDONE')} />
        <div>
          <Button kind="danger" onClick={() => setConfirmDelete(true)}>
            {t('USERS_DELETE_USER')}
          </Button>
        </div>
      </Stack>

      <Stack gap={5}>
        <h2 className="cz-admin-form__section">{t('USERS_UNLOCK_USER')}</h2>
        <InlineNotification kind="info" lowContrast hideCloseButton title={t('USERS_NOTICE')} subtitle={t('USERS_UNLOCKING_USER')} />
        <div>
          <Button kind="tertiary" disabled={unlockUser.isPending} onClick={unlock}>
            {t('USERS_UNLOCK_USER')}
          </Button>
        </div>
      </Stack>

      {confirmDelete && (
        <ConfirmModal
          title={t('USERS_DELETE_USER')}
          confirmLabel={t('USERS_DELETE_USER')}
          busy={deleteUser.isPending}
          onConfirm={remove}
          onClose={() => setConfirmDelete(false)}
        >
          <Stack gap={5}>
            <p>{t('USERS_USER_DELETE_CONFIRM', { user: profile.id })}</p>
            <p>
              <Trans t={t} i18nKey="USERS_USER_DELETE_INFO" />
            </p>
          </Stack>
        </ConfirmModal>
      )}
    </Stack>
  );
}
