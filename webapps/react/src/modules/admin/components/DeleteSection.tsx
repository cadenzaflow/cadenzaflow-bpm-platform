import { useState } from 'react';
import { Button, InlineNotification, Stack } from '@carbon/react';
import { ConfirmModal } from './ConfirmModal';

interface DeleteSectionProps {
  /** e.g. "Delete Group": heading, button and dialog title */
  label: string;
  warningTitle: string;
  warningText: string;
  /** e.g. "Really delete group sales?" */
  question: string;
  busy: boolean;
  onDelete: () => void;
}

/** Warning, delete button and confirmation of an edit page. */
export function DeleteSection({ label, warningTitle, warningText, question, busy, onDelete }: DeleteSectionProps) {
  const [confirming, setConfirming] = useState(false);
  return (
    <Stack gap={5}>
      <h2 className="cz-admin-form__section">{label}</h2>
      <InlineNotification kind="warning" lowContrast hideCloseButton title={warningTitle} subtitle={warningText} />
      <div>
        <Button kind="danger" onClick={() => setConfirming(true)}>
          {label}
        </Button>
      </div>
      {confirming && (
        <ConfirmModal title={label} confirmLabel={label} busy={busy} onConfirm={onDelete} onClose={() => setConfirming(false)}>
          <p>{question}</p>
        </ConfirmModal>
      )}
    </Stack>
  );
}
