import { useState } from 'react';
import { Checkbox, Modal, RadioButton, RadioButtonGroup, Stack, TextInput } from '@carbon/react';
import { useTranslation } from 'react-i18next';
import { notify } from '../../../../shared/notifications';
import { parseLocalDateTime, toEngineDate, toLocalDateTimeText } from '../../../../shared/variables';
import { useChangeDueDate, type Job } from './api';

type Kind = 'creation' | 'now' | 'specific';

/** Changes the due date of a timer job, as the classic Cockpit's "Change timer due date" dialog. */
export function DueDateModal({ engine, job, onClose }: { engine: string; job: Job; onClose: () => void }) {
  const { t } = useTranslation('cockpit');
  const change = useChangeDueDate(engine);
  const [kind, setKind] = useState<Kind | null>(null);
  const [cascade, setCascade] = useState(true);
  const [date, setDate] = useState(() => toLocalDateTimeText(new Date()));
  const parsed = parseLocalDateTime(date);
  const specific = kind === 'specific';

  const submit = () => {
    if (!kind) {
      return;
    }
    change.mutate(
      { id: job.id, change: kind === 'specific' ? { kind, dueDate: toEngineDate(parsed!), cascade } : { kind } },
      {
        onSuccess: () => {
          notify({
            kind: 'success',
            title: t('PLUGIN_JOBS_RECALCULATE_SUCCESS'),
            subtitle: t(specific ? 'PLUGIN_JOBS_SET_DUEDATE_SUCCESS_MESSAGE' : 'PLUGIN_JOBS_RECALCULATE_SUCCESS_MESSAGE'),
          });
          onClose();
        },
        onError: (error) =>
          notify({
            kind: 'error',
            title: t('PLUGIN_JOBS_RECALCULATE_ERROR'),
            subtitle: `${t(specific ? 'PLUGIN_JOBS_SET_DUEDATE_ERROR_MESSAGE' : 'PLUGIN_JOBS_RECALCULATE_ERROR_MESSAGE')} ${error.message}`,
          }),
      },
    );
  };

  return (
    <Modal
      open
      modalHeading={t('PLUGIN_JOBS_MODAL_TITLE')}
      primaryButtonText={t('PLUGIN_JOBS_CHANGE')}
      secondaryButtonText={t('PLUGIN_JOBS_CLOSE')}
      primaryButtonDisabled={!kind || (specific && !parsed) || change.isPending}
      onRequestClose={onClose}
      onRequestSubmit={submit}
    >
      <Stack gap={6}>
        <p>{t('PLUGIN_JOBS_MODAL_DESCRIPTION')}</p>
        <RadioButtonGroup
          name="cz-due-date-kind"
          legendText={t('PLUGIN_JOBS_RECALCULATE')}
          helperText={t(specific ? 'PLUGIN_JOBS_SPECIFIC_DATE_TOOLTIP' : 'PLUGIN_JOBS_RECALCULATE_TOOLTIP')}
          orientation="vertical"
          valueSelected={kind ?? ''}
          onChange={(value) => setKind(value as Kind)}
        >
          <RadioButton id="cz-due-date-creation" value="creation" labelText={t('PLUGIN_JOBS_FROM_CREATION')} />
          <RadioButton id="cz-due-date-now" value="now" labelText={t('PLUGIN_JOBS_FROM_NOW')} />
          <RadioButton id="cz-due-date-specific" value="specific" labelText={t('PLUGIN_JOBS_SPECIFIC_DATE')} />
        </RadioButtonGroup>
        {specific && (
          <>
            <TextInput
              id="cz-due-date"
              labelText={t('PLUGIN_JOBS_DATE_INPUT')}
              placeholder="yyyy-MM-ddTHH:mm:ss"
              value={date}
              invalid={!parsed}
              invalidText={t('PLUGIN_JOBS_VALID_PATTERN')}
              onChange={(event) => setDate(event.target.value)}
            />
            <Checkbox
              id="cz-due-date-cascade"
              labelText={t('PLUGIN_JOBS_CASCADE')}
              helperText={t('PLUGIN_JOBS_CASCADE_TOOLTIP')}
              checked={cascade}
              onChange={(_, { checked }) => setCascade(checked)}
            />
          </>
        )}
      </Stack>
    </Modal>
  );
}
