import { useState } from 'react';
import { Checkbox, Modal, RadioButton, RadioButtonGroup, Stack, TextInput } from '@carbon/react';
import { parseLocalDateTime, toEngineDate, toLocalDateTimeText } from '../../../shared/variables';

export interface SuspensionChoice {
  /** also the existing jobs / process instances */
  includeExisting: boolean;
  /** engine date; immediately when missing */
  executionDate?: string;
}

interface SuspensionModalProps {
  title: string;
  /** what will happen */
  legend: string;
  /** label of "also the existing ..." */
  includeLabel: string;
  submitLabel: string;
  closeLabel: string;
  /** labels of the timing choice and the date field */
  labels: { execute: string; immediately: string; delayed: string; scheduleAt: string; invalidDate: string };
  busy: boolean;
  onSubmit: (choice: SuspensionChoice) => void;
  onClose: () => void;
}

/**
 * Suspends or activates a job definition or process definition, as the
 * classic Cockpit asks: with or without the existing jobs/instances,
 * immediately or at a given time.
 */
export function SuspensionModal({ title, legend, includeLabel, submitLabel, closeLabel, labels, busy, onSubmit, onClose }: SuspensionModalProps) {
  const [includeExisting, setIncludeExisting] = useState(true);
  const [timing, setTiming] = useState<'immediately' | 'delayed'>('immediately');
  const [dateText, setDateText] = useState(() => toLocalDateTimeText(new Date()));
  const date = parseLocalDateTime(dateText);
  const valid = timing === 'immediately' || !!date;

  return (
    <Modal
      open
      modalHeading={title}
      primaryButtonText={submitLabel}
      secondaryButtonText={closeLabel}
      primaryButtonDisabled={!valid || busy}
      onRequestClose={onClose}
      onRequestSubmit={() =>
        onSubmit({ includeExisting, executionDate: timing === 'delayed' && date ? toEngineDate(date) : undefined })
      }
    >
      <Stack gap={5}>
        <p>{legend}</p>
        <Checkbox
          id="cz-suspension-include"
          labelText={includeLabel}
          checked={includeExisting}
          onChange={(_, { checked }) => setIncludeExisting(checked)}
        />
        <RadioButtonGroup
          legendText={labels.execute}
          name="cz-suspension-timing"
          valueSelected={timing}
          onChange={(value) => setTiming(value as 'immediately' | 'delayed')}
        >
          <RadioButton id="cz-suspension-now" value="immediately" labelText={labels.immediately} />
          <RadioButton id="cz-suspension-later" value="delayed" labelText={labels.delayed} />
        </RadioButtonGroup>
        {timing === 'delayed' && (
          <TextInput
            id="cz-suspension-date"
            type="datetime-local"
            step={1}
            labelText={labels.scheduleAt}
            value={dateText}
            invalid={!date}
            invalidText={labels.invalidDate}
            onChange={(event) => setDateText(event.target.value)}
          />
        )}
      </Stack>
    </Modal>
  );
}
