import { useState } from 'react';
import { Button } from '@carbon/react';
import { Pause, Play } from '@carbon/icons-react';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { engineUrl, request } from '../../../shared/api/client';
import { notify } from '../../../shared/notifications';
import type { ProcessDefinition } from '../api';
import { SuspensionModal } from '../components/SuspensionModal';
import { useInvalidateCockpit } from '../incidents/api';

/**
 * Suspends or activates the process definition (no new instances while
 * suspended), with or without its instances, now or later.
 */
export function DefinitionSuspension({ engine, definition }: { engine: string; definition: ProcessDefinition }) {
  const { t } = useTranslation('cockpit');
  const invalidate = useInvalidateCockpit(engine);
  const [open, setOpen] = useState(false);
  const suspend = !definition.suspended;
  const update = useMutation({
    mutationFn: (body: { includeProcessInstances: boolean; executionDate?: string }) =>
      request<void>(engineUrl(engine, `/process-definition/${encodeURIComponent(definition.id)}/suspended`), {
        method: 'PUT',
        json: { suspended: suspend, ...body },
      }),
    onSettled: invalidate,
  });
  const label = t(suspend ? 'PLUGIN_SUSPENSION_SUSPEND_PROCESS' : 'PLUGIN_SUSPENSION_ACTIVATE_PROCESS');

  return (
    <>
      <Button kind="tertiary" size="md" renderIcon={suspend ? Pause : Play} onClick={() => setOpen(true)}>
        {label}
      </Button>
      {open && (
        <SuspensionModal
          title={label}
          legend={t(suspend ? 'PLUGIN_SUSPENSION_MESSAGE_2' : 'PLUGIN_SUSPENSION_MESSAGE_1')}
          includeLabel={t('PLUGIN_SUSPENSION_INCLUDE_INSTANCES')}
          submitLabel={t(suspend ? 'PLUGIN_SUSPENSION_SUSPEND' : 'PLUGIN_SUSPENSION_ACTIVATE')}
          closeLabel={t('PLUGIN_SUSPENSION_CLOSE')}
          labels={{
            execute: t('PLUGIN_SUSPENSION_EXECUTE'),
            immediately: t('PLUGIN_SUSPENSION_IMMEDIATELY'),
            delayed: t('PLUGIN_SUSPENSION_DELAYED'),
            scheduleAt: t('PLUGIN_SUSPENSION_SCHEDULE_AT'),
            invalidDate: t('PLUGIN_SUSPENSION_VALID_PATTERN'),
          }}
          busy={update.isPending}
          onClose={() => setOpen(false)}
          onSubmit={({ includeExisting, executionDate }) =>
            update.mutate(
              { includeProcessInstances: includeExisting, executionDate },
              {
                onSuccess: () => {
                  notify({
                    kind: 'success',
                    title: t('PLUGIN_UPDATE_SUSPENSION_STATE_STATUS_FINISHED'),
                    subtitle: t(executionDate ? 'PLUGIN_UPDATE_SUSPENSION_STATE_MESSAGE_2' : 'PLUGIN_UPDATE_SUSPENSION_STATE_MESSAGE_1'),
                  });
                  setOpen(false);
                },
                onError: (error) =>
                  notify({
                    kind: 'error',
                    title: t('PLUGIN_UPDATE_SUSPENSION_STATE'),
                    subtitle: t(executionDate ? 'PLUGIN_UPDATE_SUSPENSION_STATE_MESSAGE_4' : 'PLUGIN_UPDATE_SUSPENSION_STATE_MESSAGE_3', {
                      message: error.message,
                    }),
                  }),
              },
            )
          }
        />
      )}
    </>
  );
}
