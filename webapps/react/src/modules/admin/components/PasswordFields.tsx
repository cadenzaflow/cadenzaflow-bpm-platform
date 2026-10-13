import { useEffect, useState } from 'react';
import { PasswordInput } from '@carbon/react';
import { CheckmarkFilled, Misuse } from '@carbon/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ApiError, engineUrl, request } from '../../../shared/api/client';

interface PolicyRule {
  /** i18n key, e.g. PASSWORD_POLICY_LENGTH */
  placeholder: string;
  parameter: Record<string, string> | null;
  valid?: boolean;
}

export interface PasswordProfile {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}

export interface PasswordCheck {
  /** the engine has a password policy */
  active: boolean;
  /** the password may be used (policy fulfilled, or no policy and not empty) */
  valid: boolean;
  checking: boolean;
  failed: boolean;
  rules: PolicyRule[];
}

/**
 * Checks a password against the engine's password policy
 * (/identity/password-policy), like the classic webapps: the rules are shown,
 * the password is checked a moment after typing stops. Without a policy any
 * non-empty password is fine.
 */
export function usePasswordCheck(engine: string, password: string, profile: PasswordProfile): PasswordCheck {
  const [typed, setTyped] = useState(password);
  useEffect(() => {
    const timer = setTimeout(() => setTyped(password), 400);
    return () => clearTimeout(timer);
  }, [password]);

  const policy = useQuery({
    queryKey: ['password-policy', engine],
    staleTime: Infinity,
    retry: false,
    queryFn: () =>
      request<{ rules: PolicyRule[] }>(engineUrl(engine, '/identity/password-policy')).catch((error) => {
        // no policy configured
        if (error instanceof ApiError && error.status === 404) {
          return null;
        }
        throw error;
      }),
  });
  const sanitized = {
    id: profile.id ?? '',
    firstName: profile.firstName ?? '',
    lastName: profile.lastName ?? '',
    email: profile.email ?? '',
  };
  const check = useQuery({
    queryKey: ['password-check', engine, typed, sanitized],
    enabled: !!policy.data && typed !== '',
    retry: false,
    gcTime: 0,
    queryFn: () =>
      request<{ valid: boolean; rules: PolicyRule[] }>(engineUrl(engine, '/identity/password-policy'), {
        method: 'POST',
        json: { password: typed, profile: sanitized },
      }),
  });

  if (!policy.data) {
    return { active: false, valid: password !== '', checking: policy.isPending, failed: false, rules: [] };
  }
  const current = typed === password && password !== '';
  return {
    active: true,
    valid: current && !!check.data?.valid,
    checking: current && check.isPending,
    failed: current && check.isError,
    rules: current && check.data ? check.data.rules : policy.data.rules,
  };
}

interface PasswordFieldsProps {
  idPrefix: string;
  password: string;
  repeat: string;
  check: PasswordCheck;
  passwordLabel: string;
  repeatLabel: string;
  onPasswordChange: (password: string) => void;
  onRepeatChange: (repeat: string) => void;
}

/** New password + repeat, with the rules of the password policy. */
export function PasswordFields({
  idPrefix,
  password,
  repeat,
  check,
  passwordLabel,
  repeatLabel,
  onPasswordChange,
  onRepeatChange,
}: PasswordFieldsProps) {
  const { t } = useTranslation('admin');
  const checked = check.active && password !== '' && !check.checking;

  return (
    <>
      <PasswordInput
        id={`${idPrefix}-password`}
        labelText={passwordLabel}
        autoComplete="new-password"
        value={password}
        invalid={checked && !check.valid}
        invalidText={t(check.failed ? 'PASSWORD_POLICY_TOOLTIP_ERROR' : 'PASSWORD_POLICY_TOOLTIP_PARTIAL')}
        onChange={(event) => onPasswordChange(event.target.value)}
      />
      {check.active && (
        <div className="cz-password-policy" aria-live="polite">
          {!checked && <p>{t('PASSWORD_POLICY_TOOLTIP')}</p>}
          <ul>
            {check.rules.map((rule) => (
              <li key={rule.placeholder} className={checked ? (rule.valid ? 'is-valid' : 'is-invalid') : undefined}>
                {checked && (rule.valid ? <CheckmarkFilled aria-hidden="true" /> : <Misuse aria-hidden="true" />)}
                {t(rule.placeholder, rule.parameter ?? {})}
              </li>
            ))}
          </ul>
        </div>
      )}
      <PasswordInput
        id={`${idPrefix}-repeat`}
        labelText={repeatLabel}
        autoComplete="new-password"
        value={repeat}
        invalid={repeat !== '' && repeat !== password}
        invalidText={t('USERS_PASSWORDS_NOT_EQUAL')}
        onChange={(event) => onRepeatChange(event.target.value)}
      />
    </>
  );
}
