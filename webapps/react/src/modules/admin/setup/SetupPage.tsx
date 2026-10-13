import { useState } from 'react';
import { Button, Form, InlineNotification, Link as CarbonLink, Stack, TextInput, Tile } from '@carbon/react';
import { useMutation } from '@tanstack/react-query';
import { Link, getRouteApi } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { adminUrl, request } from '../../../shared/api/client';
import type { User } from '../api';
import { PasswordFields, usePasswordCheck } from '../components/PasswordFields';
import { ProfileFields, isEmail } from '../users/ProfileFields';
import '../admin.scss';

const route = getRouteApi('/admin/$engine/setup');

const INSTALLATION_GUIDE = 'https://docs.cadenzaflow.org/manual/latest/installation/';

/**
 * Creates the first administrative user of an engine that has none (the
 * server leads every page here until then). No login and no header: there is
 * nobody to log in yet.
 */
export function SetupPage() {
  const { t } = useTranslation('admin');
  const { engine } = route.useParams();
  const [profile, setProfile] = useState<User>({ id: '', firstName: '', lastName: '', email: '' });
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  // the engine API needs a login; the engine checks a password policy itself
  const check = usePasswordCheck(engine, password, profile, false);
  const createUser = useMutation({
    mutationFn: () =>
      request<void>(adminUrl(`/setup/${encodeURIComponent(engine)}/user/create`), {
        method: 'POST',
        json: { profile: { ...profile, id: profile.id.trim() }, credentials: { password } },
      }),
  });
  const valid =
    !!profile.id.trim() &&
    !!profile.firstName?.trim() &&
    !!profile.lastName?.trim() &&
    isEmail(profile.email) &&
    check.valid &&
    password === repeat;

  return (
    <main className="cz-login cz-setup">
      <Tile className="cz-login__tile cz-setup__tile">
        <Stack gap={6}>
          <h1 className="cz-login__title">{t('SETUP_SETUP')}</h1>
          {createUser.isSuccess ? (
            <>
              <InlineNotification
                kind="success"
                lowContrast
                hideCloseButton
                title={t('SETUP_USER_CREATED')}
                subtitle={t('SETUP_USER_INITIAL')}
              />
              <p>
                {t('SETUP_USER_REDIRECT_1')}{' '}
                <Link to="/admin/$engine" params={{ engine }}>
                  {t('SETUP_USER_REDIRECT_2')}
                </Link>{' '}
                {t('SETUP_USER_REDIRECT_3')}
              </p>
            </>
          ) : (
            <>
              <InlineNotification
                kind="info"
                lowContrast
                hideCloseButton
                title={t('SETUP_USER_MESSAGE_1')}
                subtitle={`${t('SETUP_USER_MESSAGE_2')}${engine}${t('SETUP_USER_MESSAGE_3')} ${t('SETUP_USER_MESSAGE_4')}`}
              />
              <CarbonLink href={INSTALLATION_GUIDE} target="_blank" rel="noreferrer">
                {t('SETUP_USER_LDAP')}
              </CarbonLink>
              {createUser.isError && (
                <InlineNotification
                  kind="error"
                  lowContrast
                  hideCloseButton
                  title={t('SETUP_COULD_NOT_CREATE_USER')}
                  subtitle={createUser.error.message}
                />
              )}
              <Form
                onSubmit={(event) => {
                  event.preventDefault();
                  if (valid) {
                    createUser.mutate();
                  }
                }}
              >
                <Stack gap={6}>
                  <h2 className="cz-admin-form__section">{t('SETUP_USER_PROFILE')}</h2>
                  <TextInput
                    id="cz-setup-id"
                    labelText={t('SETUP_USER_ID')}
                    value={profile.id}
                    onChange={(event) => setProfile((p) => ({ ...p, id: event.target.value }))}
                  />
                  <ProfileFields profile={profile} onChange={setProfile} />
                  <h2 className="cz-admin-form__section">{t('SETUP_USER_ACCOUNT')}</h2>
                  <PasswordFields
                    idPrefix="cz-setup"
                    password={password}
                    repeat={repeat}
                    check={check}
                    passwordLabel={t('SETUP_USER_PASSWORD')}
                    repeatLabel={t('SETUP_USER_PASSWORD_REPEAT')}
                    onPasswordChange={setPassword}
                    onRepeatChange={setRepeat}
                  />
                  <div>
                    <Button type="submit" disabled={!valid || createUser.isPending}>
                      {t('SETUP_USER_NEW_USER')}
                    </Button>
                  </div>
                </Stack>
              </Form>
            </>
          )}
        </Stack>
      </Tile>
    </main>
  );
}
