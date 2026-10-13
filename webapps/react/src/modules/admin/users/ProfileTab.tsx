import { useState } from 'react';
import { Button, Form, Stack } from '@carbon/react';
import { useTranslation } from 'react-i18next';
import { notify } from '../../../shared/notifications';
import type { User } from '../api';
import { useUpdateProfile } from './api';
import { ProfileFields, isEmail } from './ProfileFields';

export function ProfileTab({ engine, profile }: { engine: string; profile: User }) {
  const { t } = useTranslation('admin');
  const updateProfile = useUpdateProfile(engine, profile.id);
  const [edited, setEdited] = useState<User>(profile);
  const changed = JSON.stringify(edited) !== JSON.stringify(profile);
  const valid = !!edited.firstName?.trim() && !!edited.lastName?.trim() && isEmail(edited.email);

  return (
    <Form
      className="cz-admin-form"
      onSubmit={(event) => {
        event.preventDefault();
        updateProfile.mutate(edited, {
          onSuccess: () => notify({ kind: 'success', title: t('USERS_EDIT_SUCCESS_MSN') }),
          onError: (error) =>
            notify({ kind: 'error', title: t('NOTIFICATIONS_STATUS_FAILED'), subtitle: t('USERS_EDIT_FAILED', { message: error.message }) }),
        });
      }}
    >
      <Stack gap={6}>
        <ProfileFields profile={edited} onChange={setEdited} />
        <div>
          <Button type="submit" disabled={!changed || !valid || updateProfile.isPending}>
            {t('USERS_UPDATE_PROFILE')}
          </Button>
        </div>
      </Stack>
    </Form>
  );
}
