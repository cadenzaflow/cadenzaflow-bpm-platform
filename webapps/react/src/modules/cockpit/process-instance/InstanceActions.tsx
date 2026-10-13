import { useState } from 'react';
import { Button, Checkbox, Modal, Stack } from '@carbon/react';
import { Pause, Play, TrashCan } from '@carbon/icons-react';
import { useTranslation } from 'react-i18next';
import { notify } from '../../../shared/notifications';
import { useCancelInstance, useInstanceSuspension, type ProcessInstance } from './api';

interface InstanceActionsProps {
  engine: string;
  instance: ProcessInstance;
  /** after the instance was deleted, e.g. back to its definition */
  onCanceled: () => void;
}

/** Suspend/activate and cancel (delete) the process instance, as in the classic Cockpit. */
export function InstanceActions({ engine, instance, onCanceled }: InstanceActionsProps) {
  const { t } = useTranslation('cockpit');
  const suspension = useInstanceSuspension(engine, instance.id);
  const cancel = useCancelInstance(engine, instance.id);
  const [dialog, setDialog] = useState<'suspension' | 'cancel' | null>(null);
  const [skipCustomListeners, setSkipCustomListeners] = useState(true);
  const [skipIoMappings, setSkipIoMappings] = useState(true);
  const suspend = !instance.suspended;

  return (
    <>
      <Button kind="tertiary" size="md" renderIcon={suspend ? Pause : Play} onClick={() => setDialog('suspension')}>
        {t(suspend ? 'PLUGIN_UPDATE_DIALOG_SUSPEND' : 'PLUGIN_UPDATE_DIALOG_ACTIVATE')}
      </Button>
      <Button kind="danger--tertiary" size="md" renderIcon={TrashCan} onClick={() => setDialog('cancel')}>
        {t('PLUGIN_CANCEL_PROCESS_DELETE_PROCESS_INSTANCE')}
      </Button>

      {dialog === 'suspension' && (
        <Modal
          open
          modalHeading={t(suspend ? 'PLUGIN_UPDATE_DIALOG_SUSPEND' : 'PLUGIN_UPDATE_DIALOG_ACTIVATE')}
          primaryButtonText={t(suspend ? 'PLUGIN_UPDATE_DIALOG_BTN_SUSPEND' : 'PLUGIN_UPDATE_DIALOG_BTN_ACTIVATE')}
          secondaryButtonText={t('PLUGIN_UPDATE_DIALOG_BTN_CLOSE')}
          primaryButtonDisabled={suspension.isPending}
          onRequestClose={() => setDialog(null)}
          onRequestSubmit={() =>
            suspension.mutate(suspend, {
              onSuccess: () => {
                notify({ kind: 'success', title: t('PLUGIN_UPDATE_DIALOG_STATUS_FINISHED'), subtitle: t('PLUGIN_UPDATE_DIALOG_MESSAGES_1') });
                setDialog(null);
              },
              onError: (error) =>
                notify({ kind: 'error', title: t('PLUGIN_UPDATE_SUSPENSION_STATE'), subtitle: t('PLUGIN_UPDATE_DIALOG_ERROR_1', { message: error.message }) }),
            })
          }
        >
          <Stack gap={4}>
            {suspend ? (
              <>
                <p>
                  {t('PLUGIN_UPDATE_DIALOG_LEGEND_8')} <em>{t('PLUGIN_UPDATE_DIALOG_LEGEND_9')}</em> {t('PLUGIN_UPDATE_DIALOG_LEGEND_10')}
                </p>
                <div className="cz-dialog-text">
                  {t('PLUGIN_UPDATE_DIALOG_LEGEND_11')}
                  <ul className="cz-dialog-list">
                    <li>{t('PLUGIN_UPDATE_DIALOG_CLAIMING')}</li>
                    <li>{t('PLUGIN_UPDATE_DIALOG_COMPLETING')}</li>
                    <li>{t('PLUGIN_UPDATE_DIALOG_DELEGATION')}</li>
                    <li>{t('PLUGIN_UPDATE_DIALOG_CHANGES_IN')}</li>
                  </ul>
                  {t('PLUGIN_UPDATE_DIALOG_LEGEND_12')}
                </div>
                <p>{t('PLUGIN_UPDATE_DIALOG_LEGEND_13')}</p>
                <p>{t('PLUGIN_UPDATE_DIALOG_LEGEND_14')}</p>
                <p>{t('PLUGIN_UPDATE_DIALOG_LEGEND_15')}</p>
              </>
            ) : (
              <>
                <p>
                  {t('PLUGIN_UPDATE_DIALOG_LEGEND_1')} <em>{t('PLUGIN_UPDATE_DIALOG_LEGEND_2')}</em> {t('PLUGIN_UPDATE_DIALOG_LEGEND_3')}
                </p>
                <p>{t('PLUGIN_UPDATE_DIALOG_LEGEND_4')}</p>
                <p>{t('PLUGIN_UPDATE_DIALOG_LEGEND_5')}</p>
                <p>{t('PLUGIN_UPDATE_DIALOG_LEGEND_6')}</p>
                <p>{t('PLUGIN_UPDATE_DIALOG_LEGEND_7')}</p>
              </>
            )}
          </Stack>
        </Modal>
      )}

      {dialog === 'cancel' && (
        <Modal
          open
          danger
          modalHeading={t('PLUGIN_CANCEL_PROCESS_RUNNING_PROCESS_INSTANCE')}
          primaryButtonText={t('PLUGIN_CANCEL_PROCESS_DELETE_PROCESS_INSTANCE')}
          secondaryButtonText={t('PLUGIN_CANCEL_PROCESS_CLOSE')}
          primaryButtonDisabled={cancel.isPending}
          onRequestClose={() => setDialog(null)}
          onRequestSubmit={() =>
            cancel.mutate(
              { skipCustomListeners, skipIoMappings },
              {
                onSuccess: () => {
                  notify({ kind: 'success', title: t('PLUGIN_CANCEL_PROCESS_STATUS_DELETED'), subtitle: t('PLUGIN_CANCEL_PROCESS_MESSAGE_1') });
                  setDialog(null);
                  onCanceled();
                },
                onError: (error) =>
                  notify({ kind: 'error', title: t('PLUGIN_CANCEL_PROCESS_STATUS_FAILED'), subtitle: t('PLUGIN_CANCEL_PROCESS_MESSAGE_2', { message: error.message }) }),
              },
            )
          }
        >
          <Stack gap={5}>
            <p>{t('PLUGIN_CANCEL_PROCESS_DELETE_CONFIRM')}</p>
            <p>
              {t('PLUGIN_CANCEL_PROCESS_ID')}: <code>{instance.id}</code>
            </p>
            <Checkbox
              id="cz-cancel-skip-listeners"
              labelText={t('PLUGIN_CANCEL_PROCESS_SKIP_CUSTOM_LISTENERS')}
              helperText={t('PLUGIN_CANCEL_PROCESS_TOOLTIP_VALUE_ENABLED')}
              checked={skipCustomListeners}
              onChange={(_, { checked }) => setSkipCustomListeners(checked)}
            />
            <Checkbox
              id="cz-cancel-skip-io"
              labelText={t('PLUGIN_CANCEL_PROCESS_SKIP_IO_MAPPINGS')}
              helperText={t('PLUGIN_CANCEL_PROCESS_TOOLTIP_VALUE_ENABLED_IO')}
              checked={skipIoMappings}
              onChange={(_, { checked }) => setSkipIoMappings(checked)}
            />
          </Stack>
        </Modal>
      )}
    </>
  );
}
