import { useState, type FormEvent } from 'react';
import { Button, Form, InlineNotification, PasswordInput, Stack, TextInput, Tile } from '@carbon/react';
import { useTranslation } from 'react-i18next';
import type { ModuleName } from '../config';
import { useLogin } from './authentication';

interface LoginPageProps {
  engine: string;
  module: ModuleName;
}

export function LoginPage({ engine, module }: LoginPageProps) {
  const { t } = useTranslation();
  const login = useLogin(engine, module);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    login.mutate({ username, password }, { onError: () => setPassword('') });
  };

  return (
    <main className="cz-login">
      <Tile className="cz-login__tile">
        <Form onSubmit={submit} aria-labelledby="cz-login-title">
          <Stack gap={6}>
            <h1 id="cz-login-title" className="cz-login__title">
              {t('PAGE_LOGIN_PLEASE_SIGN_IN')}
            </h1>
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
      </Tile>
    </main>
  );
}
