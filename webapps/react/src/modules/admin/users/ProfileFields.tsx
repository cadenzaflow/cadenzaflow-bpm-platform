import { useState } from 'react';
import { TextInput } from '@carbon/react';
import { useTranslation } from 'react-i18next';
import type { User } from '../api';

/** Empty, or something@something (like an HTML email field). */
export function isEmail(value: string | null | undefined): boolean {
  return !value || /^[^\s@]+@[^\s@]+$/.test(value);
}

/** First name, last name (both required) and email of a user. */
export function ProfileFields({ profile, onChange }: { profile: User; onChange: (profile: User) => void }) {
  const { t } = useTranslation('admin');
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const touch = (field: string) => setTouched((current) => ({ ...current, [field]: true }));

  return (
    <>
      <TextInput
        id="cz-user-first-name"
        labelText={t('USERS_FIRSTNAME')}
        value={profile.firstName ?? ''}
        invalid={touched.firstName && !profile.firstName?.trim()}
        invalidText={t('USERS_FIRSTNAME_REQUIRED')}
        onBlur={() => touch('firstName')}
        onChange={(event) => onChange({ ...profile, firstName: event.target.value })}
      />
      <TextInput
        id="cz-user-last-name"
        labelText={t('USERS_LASTNAME')}
        value={profile.lastName ?? ''}
        invalid={touched.lastName && !profile.lastName?.trim()}
        invalidText={t('USERS_LASTNAME_REQUIRED')}
        onBlur={() => touch('lastName')}
        onChange={(event) => onChange({ ...profile, lastName: event.target.value })}
      />
      <TextInput
        id="cz-user-email"
        type="email"
        labelText={t('USERS_EMAIL')}
        value={profile.email ?? ''}
        invalid={!isEmail(profile.email)}
        invalidText={t('USERS_EMAIL_INVALID')}
        onChange={(event) => onChange({ ...profile, email: event.target.value })}
      />
    </>
  );
}
