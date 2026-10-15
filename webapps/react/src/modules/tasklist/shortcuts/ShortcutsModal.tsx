import { Modal, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@carbon/react';
import { useTranslation } from 'react-i18next';
import { shortcutText, useTasklistShortcuts } from './shortcuts';

/** Lists the keyboard shortcuts. */
export function ShortcutsModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('tasklist');
  const shortcuts = useTasklistShortcuts();

  return (
    <Modal open passiveModal modalHeading={t('SHORTCUT_HELP')} onRequestClose={onClose}>
      <Table size="sm">
        <TableHead>
          <TableRow>
            <TableHeader>{t('SHORTCUT')}</TableHeader>
            <TableHeader>{t('DESCRIPTION')}</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {Object.values(shortcuts).map((shortcut) => (
            <TableRow key={shortcut.key}>
              <TableCell>
                <kbd>{shortcutText(shortcut.key)}</kbd>
              </TableCell>
              <TableCell>{shortcut.description}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Modal>
  );
}
