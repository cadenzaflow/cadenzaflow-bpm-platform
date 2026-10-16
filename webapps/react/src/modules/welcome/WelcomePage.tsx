import { useState, type FormEvent } from 'react';
import {
  Button,
  ClickableTile,
  InlineNotification,
  Link as CarbonLink,
  PaginationNav,
  PasswordInput,
  SkeletonText,
  Stack,
  TextInput,
  Tile,
} from '@carbon/react';
import { getRouteApi, useLocation, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useAuthentication, useUserProfile, type UserProfile } from '../../shared/auth/authentication';
import { moduleUrl, type ModuleName } from '../../shared/config';
import { displayName } from '../../shared/format';
import { notify } from '../../shared/notifications';
import { PluginPoint, PluginView } from '../../shared/plugins/PluginPoint';
import { useRoutePlugin } from '../../shared/plugins/plugins';
import { PasswordFields, usePasswordCheck } from '../../shared/ui/PasswordFields';
import { useChangePassword, useMemberGroups, useUpdateProfile, useWelcomeLinks } from './api';
import './welcome.scss';

const route = getRouteApi('/welcome/$engine');

/** State of the Welcome page in the query string: which form of the profile is open. */
export interface WelcomeSearch {
  form?: 'profile' | 'password';
}

export function validateWelcomeSearch(search: Record<string, unknown>): WelcomeSearch {
  return { form: search.form === 'profile' || search.form === 'password' ? search.form : undefined };
}

const APPS: ModuleName[] = ['cockpit', 'tasklist', 'admin'];

const GROUP_PAGE_SIZE = 25;

/** The user's name, email and groups. */
function ProfileDisplay({ engine, profile, onEdit, onChangePassword }: { engine: string; profile: UserProfile; onEdit: () => void; onChangePassword: () => void }) {
  const { t } = useTranslation('welcome');
  const [page, setPage] = useState(1);
  const groups = useMemberGroups(engine, profile.id, page, GROUP_PAGE_SIZE);
  const pageCount = groups.data ? Math.ceil(groups.data.count / GROUP_PAGE_SIZE) : 0;

  return (
    <Stack gap={5}>
      <div>
        <h3 className="cz-welcome__name" title={t('USERNAME_FOR_AUTHENTICATION', { username: profile.id })}>
          {displayName(profile, profile.id)}
        </h3>
        {profile.email && <p className="cz-welcome__email">{profile.email}</p>}
      </div>
      <div className="cz-welcome__actions">
        <Button kind="ghost" size="sm" onClick={onEdit}>
          {t('EDIT_PROFILE')}
        </Button>
        <Button kind="ghost" size="sm" onClick={onChangePassword}>
          {t('CHANGE_PASSWORD')}
        </Button>
      </div>
      {groups.isPending && <SkeletonText paragraph lineCount={2} />}
      {!!groups.data?.items.length && (
        <section>
          <h4 className="cz-welcome__subtitle">{t('GROUPS')}</h4>
          <ul className="cz-welcome__groups">
            {groups.data.items.map((group) => (
              <li key={group.id} title={group.id}>
                {group.name || group.id}
              </li>
            ))}
          </ul>
          {pageCount > 1 && <PaginationNav totalItems={pageCount} page={page - 1} itemsShown={5} onChange={(index: number) => setPage(index + 1)} />}
        </section>
      )}
    </Stack>
  );
}

/** Name and email; the username cannot change. */
function ProfileForm({ engine, profile, onDone }: { engine: string; profile: UserProfile; onDone: () => void }) {
  const { t } = useTranslation('welcome');
  const update = useUpdateProfile(engine, profile.id);
  const [values, setValues] = useState({ firstName: profile.firstName ?? '', lastName: profile.lastName ?? '', email: profile.email ?? '' });
  const changed = values.firstName !== (profile.firstName ?? '') || values.lastName !== (profile.lastName ?? '') || values.email !== (profile.email ?? '');
  const valid = values.firstName.trim() !== '' && values.lastName.trim() !== '';

  const submit = (event: FormEvent) => {
    event.preventDefault();
    update.mutate(values, {
      onSuccess: () => {
        notify({ kind: 'success', title: t('CHANGES_SAVED') });
        onDone();
      },
      onError: (error) => notify({ kind: 'error', title: t('ERROR_WHILE_SAVING'), subtitle: error.message }),
    });
  };

  return (
    <form onSubmit={submit}>
      <Stack gap={5}>
        <h3 className="cz-welcome__subtitle">{t('EDIT_YOUR_PROFILE')}</h3>
        <TextInput id="cz-profile-username" labelText={t('USERNAME')} value={profile.id} readOnly />
        <TextInput
          id="cz-profile-first-name"
          labelText={t('FIRST_NAME')}
          value={values.firstName}
          invalid={values.firstName.trim() === ''}
          invalidText={t('REQUIRED_FIELD')}
          onChange={(event) => setValues({ ...values, firstName: event.target.value })}
        />
        <TextInput
          id="cz-profile-last-name"
          labelText={t('LAST_NAME')}
          value={values.lastName}
          invalid={values.lastName.trim() === ''}
          invalidText={t('REQUIRED_FIELD')}
          onChange={(event) => setValues({ ...values, lastName: event.target.value })}
        />
        <TextInput id="cz-profile-email" labelText={t('EMAIL')} type="email" value={values.email} onChange={(event) => setValues({ ...values, email: event.target.value })} />
        <div className="cz-welcome__actions">
          <Button kind="secondary" onClick={onDone}>
            {t('CANCEL')}
          </Button>
          <Button type="submit" disabled={!valid || !changed || update.isPending}>
            {t('UPDATE')}
          </Button>
        </div>
      </Stack>
    </form>
  );
}

/** The current password, then the new one twice; the engine's password policy applies. */
function PasswordForm({ engine, profile, onDone }: { engine: string; profile: UserProfile; onDone: () => void }) {
  const { t } = useTranslation('welcome');
  const change = useChangePassword(engine, profile.id);
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const check = usePasswordCheck(engine, password, profile);
  const valid = current !== '' && check.valid && password === repeat;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    change.mutate(
      { current, password },
      {
        onSuccess: () => {
          notify({ kind: 'success', title: t('PASSWORD_CHANGED') });
          onDone();
        },
        onError: (error) => notify({ kind: 'error', title: t('ERROR_WHILE_CHANGING_PASSWORD'), subtitle: error.message }),
      },
    );
  };

  return (
    <form onSubmit={submit}>
      <Stack gap={5}>
        <h3 className="cz-welcome__subtitle">{t('CHANGE_YOUR_PASSWORD')}</h3>
        <PasswordInput
          id="cz-profile-current-password"
          labelText={t('CURRENT_PASSWORD')}
          autoComplete="current-password"
          value={current}
          onChange={(event) => setCurrent(event.target.value)}
        />
        <PasswordFields
          idPrefix="cz-profile-new"
          password={password}
          repeat={repeat}
          check={check}
          passwordLabel={t('NEW_PASSWORD')}
          repeatLabel={t('CONFIRM_NEW_PASSWORD')}
          onPasswordChange={setPassword}
          onRepeatChange={setRepeat}
        />
        <div className="cz-welcome__actions">
          <Button kind="secondary" onClick={onDone}>
            {t('CANCEL')}
          </Button>
          <Button type="submit" disabled={!valid || change.isPending}>
            {t('CHANGE_PASSWORD')}
          </Button>
        </div>
      </Stack>
    </form>
  );
}

/**
 * The Welcome page as in the classic webapps: the applications the user may
 * open and the configured links, next to the user's profile (shown, edited,
 * or the password changed). A route plugin's page (classic path, e.g.
 * #/my-page) shows instead when the URL names it.
 */
export function WelcomePage() {
  const { t } = useTranslation('welcome');
  const { engine } = route.useParams();
  const search = route.useSearch();
  const navigate = useNavigate();
  const authentication = useAuthentication(engine);
  const userId = authentication.data?.userId;
  const profile = useUserProfile(engine, userId);
  const links = useWelcomeLinks();
  const apps = APPS.filter((app) => authentication.data?.authorizedApps.includes(app));
  const showForm = (form: WelcomeSearch['form']) => navigate({ to: '/welcome/$engine', params: { engine }, search: { form } });
  const { hash } = useLocation();
  const routePlugin = useRoutePlugin('welcome', hash);

  if (routePlugin) {
    return (
      <section className="cz-page cz-page--wide">
        <PluginView plugin={routePlugin} engine={engine} />
      </section>
    );
  }

  return (
    <div className="cz-page cz-welcome">
      <div className="cz-welcome__main">
        <section>
          <h2 className="cz-welcome__title">{t('APPLICATIONS')}</h2>
          <div className="cz-welcome__apps">
            {apps.map((app) => (
              <ClickableTile
                key={app}
                href={moduleUrl(app, engine)}
                className={`cz-welcome__app cz-welcome__app--${app}`}
                onClick={(event) => {
                  event.preventDefault();
                  navigate({ to: `/${app}/$engine`, params: { engine } });
                }}
              >
                {t(app.toUpperCase())}
              </ClickableTile>
            ))}
          </div>
        </section>
        {!!links.data?.length && (
          <section>
            <h2 className="cz-welcome__title">{t('LINKS')}</h2>
            <ul className="cz-welcome__links">
              {links.data.map((link) => (
                <li key={`${link.href}:${link.label}`}>
                  <CarbonLink href={link.href}>{t(link.label)}</CarbonLink>
                  {link.description && <p className="cz-welcome__link-description">{t(link.description)}</p>}
                </li>
              ))}
            </ul>
          </section>
        )}
        <PluginPoint module="welcome" point="welcome.dashboard" engine={engine} className="cz-plugin-section" />
      </div>
      <aside className="cz-welcome__profile">
        <Tile>
          <h2 className="cz-welcome__title">{t('PROFILE')}</h2>
          {profile.isPending && <SkeletonText paragraph lineCount={3} />}
          {profile.isError && <InlineNotification kind="error" lowContrast hideCloseButton subtitle={profile.error.message} />}
          {profile.data &&
            (search.form === 'profile' ? (
              <ProfileForm engine={engine} profile={profile.data} onDone={() => showForm(undefined)} />
            ) : search.form === 'password' ? (
              <PasswordForm engine={engine} profile={profile.data} onDone={() => showForm(undefined)} />
            ) : (
              <ProfileDisplay engine={engine} profile={profile.data} onEdit={() => showForm('profile')} onChangePassword={() => showForm('password')} />
            ))}
        </Tile>
        <PluginPoint module="welcome" point="welcome.profile" engine={engine} className="cz-plugin-section" />
      </aside>
    </div>
  );
}
