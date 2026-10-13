import type { ReactNode } from 'react';
import { Modal } from '@carbon/react';
import { useTranslation } from 'react-i18next';

interface ConfirmModalProps {
  title: string;
  /** label of the confirming button, e.g. "Delete User" */
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  children: ReactNode;
}

/** Asks before an action that cannot be undone. */
export function ConfirmModal({ title, confirmLabel, danger = true, busy, onConfirm, onClose, children }: ConfirmModalProps) {
  const { t } = useTranslation('admin');
  return (
    <Modal
      open
      danger={danger}
      size="sm"
      modalHeading={title}
      primaryButtonText={confirmLabel}
      secondaryButtonText={t('CANCEL')}
      primaryButtonDisabled={busy}
      onRequestClose={onClose}
      onRequestSubmit={onConfirm}
    >
      {children}
    </Modal>
  );
}
