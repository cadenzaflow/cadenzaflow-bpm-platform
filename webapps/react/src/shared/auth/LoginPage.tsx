import { useState, type FormEvent } from 'react';
import { Button, Form, InlineNotification, PasswordInput, Stack, TextInput, Tile } from '@carbon/react';
import { useTranslation } from 'react-i18next';
import type { ModuleName } from '../config';
import { PluginPoint } from '../plugins/PluginPoint';
import { passLogin, usePluginPoint } from '../plugins/plugins';
import logo from '../../assets/cadenzaflow-login-logo.png';
import { useLogin } from './authentication';

interface LoginPageProps {
  engine: string;
  module: ModuleName;
  /** the name of the webapp, e.g. "Cockpit" (`app.name` of the classic config.js) */
  appName: string;
  /** e.g. "CadenzaFlow" (`app.vendor` of the classic config.js) */
  vendor: string;
}

/**
 * The logo and the name of the webapp, as on the login page of the classic webapps, then the
 * login form, followed by the {module}.login plugins; {module}.login.data plugins get each login.
 */
export function LoginPage({ engine, module, appName, vendor }: LoginPageProps) {
  const { t } = useTranslation();
  const login = useLogin(engine, module);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const loginDataPlugins = usePluginPoint(module, `${module}.login.data`);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const result = login.mutateAsync({ username, password });
    passLogin(loginDataPlugins, result);
    result.catch(() => setPassword(''));
  };

  return (
    <main className="cz-login">
      <div className="cz-login__content">
        <header className="cz-login__header">
          <img src={logo} alt={vendor} className="cz-login__logo" />
          <h1 className="cz-login__title">{appName}</h1>
        </header>
        <Tile className="cz-login__tile">
          <Form onSubmit={submit} aria-label={t('PAGE_LOGIN_PLEASE_SIGN_IN')}>
            <Stack gap={6}>
              {login.isError && (
                <InlineNotification
                  kind="error"
                  lowContrast
                  hideCloseButton
                  title={t('PAGE_LOGIN_FAILED')}
                  subtitle={t('PAGE_LOGIN_ERROR_MSG')}
                />
              )}
              <TextInput
                id="cz-login-username"
                labelText={t('PAGE_LOGIN_USERNAME')}
                autoComplete="username"
                autoFocus
                value={username}
                onChange={(event) => setUsername(event.target.value)}
              />
              <PasswordInput
                id="cz-login-password"
                labelText={t('PAGE_LOGIN_PASSWORD')}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <Button type="submit" disabled={!username || !password || login.isPending}>
                {t('PAGE_LOGIN_SIGN_IN_ACTION')}
              </Button>
            </Stack>
          </Form>
          <PluginPoint module={module} point={`${module}.login`} engine={engine} className="cz-plugin-section" />
        </Tile>
      </div>
    </main>
  );
}
