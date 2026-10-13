import { useState } from 'react';
import { Button, InlineNotification, Modal, NumberInput, RadioButton, RadioButtonGroup, Stack } from '@carbon/react';
import { Edit } from '@carbon/icons-react';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { engineUrl, request } from '../../../shared/api/client';
import { notify } from '../../../shared/notifications';
import { useInvalidateCockpit } from '../incidents/api';

interface TimeToLiveProps {
  engine: string;
  /** e.g. process-definition or decision-definition */
  resource: string;
  id: string;
  /** days; null when not set */
  value: number | null;
}

/** The history time to live of a definition, with a dialog to change or clear it. */
export function TimeToLive({ engine, resource, id, value }: TimeToLiveProps) {
  const { t } = useTranslation('cockpit');
  const invalidate = useInvalidateCockpit(engine);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'update' | 'clear'>('update');
  const [days, setDays] = useState<number | null>(value);
  const update = useMutation({
    mutationFn: (historyTimeToLive: number | null) =>
      request<void>(engineUrl(engine, `/${resource}/${encodeURIComponent(id)}/history-time-to-live`), {
        method: 'PUT',
        json: { historyTimeToLive },
      }),
    onSettled: invalidate,
  });
  const valid = mode === 'clear' || (days !== null && Number.isInteger(days) && days >= 0);

  return (
    <span className="cz-annotation">
      {value === null ? (
        <span className="cz-null">{t('TIME_TO_LIVE_NULL')}</span>
      ) : (
        t(value === 1 ? 'TIME_TO_LIVE_DAY' : 'TIME_TO_LIVE_DAYS', { ttl: value })
      )}
      <Button
        kind="ghost"
        size="sm"
        hasIconOnly
        renderIcon={Edit}
        iconDescription={t('TIME_TO_LIVE_POPUP_TITLE_EDIT')}
        onClick={() => {
          setMode('update');
          setDays(value);
          setOpen(true);
        }}
      />
      {open && (
        <Modal
          open
          modalHeading={t('TIME_TO_LIVE_POPUP_TITLE_EDIT')}
          primaryButtonText={t('SAVE')}
          secondaryButtonText={t('CANCEL')}
          primaryButtonDisabled={!valid || update.isPending}
          onRequestClose={() => setOpen(false)}
          onRequestSubmit={() => {
            const next = mode === 'clear' ? null : days;
            update.mutate(next, {
              onSuccess: () => {
                notify({
                  kind: 'success',
                  title: t('TIME_TO_LIVE_POPUP_STATE_SUCCESS'),
                  subtitle:
                    next === null
                      ? t('TIME_TO_LIVE_POPUP_STATE_SUCCESS_MESSAGE_CLEAR')
                      : t('TIME_TO_LIVE_POPUP_STATE_SUCCESS_MESSAGE_UPDATE', { ttl: next }),
                });
                setOpen(false);
              },
              onError: (error) => notify({ kind: 'error', title: t('TIME_TO_LIVE_MESSAGE_ERR'), subtitle: error.message }),
            });
          }}
        >
          <Stack gap={5}>
            <RadioButtonGroup
              legendText={t('TIME_TO_LIVE_POPUP_SUBTITLE')}
              name="cz-ttl-mode"
              orientation="vertical"
              valueSelected={mode}
              onChange={(next) => setMode(next as 'update' | 'clear')}
            >
              <RadioButton id="cz-ttl-update" value="update" labelText={t('TIME_TO_LIVE_POPUP_RADIO_UPDATE')} />
              <RadioButton id="cz-ttl-clear" value="clear" labelText={t('TIME_TO_LIVE_POPUP_RADIO_CLEAR')} />
            </RadioButtonGroup>
            {mode === 'update' && (
              <NumberInput
                id="cz-ttl-days"
                label={t('TIME_TO_LIVE_DAYS', { ttl: '' }).trim()}
                min={0}
                step={1}
                allowEmpty
                value={days ?? ''}
                invalid={!valid}
                onChange={(_, { value: next }) => setDays(next === '' || next === undefined ? null : Number(next))}
              />
            )}
            <InlineNotification
              kind="info"
              lowContrast
              hideCloseButton
              subtitle={`${t('TIME_TO_LIVE_POPUP_REMOVAL_TIME_NOT_UPDATED_INFO')} ${t('TIME_TO_LIVE_POPUP_RUN_BATCH_JOB_INFO')}`}
            />
          </Stack>
        </Modal>
      )}
    </span>
  );
}
