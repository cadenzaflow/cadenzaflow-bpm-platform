import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../../../shared/classic-settings';

/** The keyboard shortcuts of the Tasklist, with the keys of the classic Tasklist. */
export const TASKLIST_SHORTCUTS = {
  claimTask: { key: 'ctrl+alt+c', description: 'SHORTCUT_CLAIM_TASK' },
  focusFilter: { key: 'ctrl+shift+f', description: 'SHORTCUT_FOCUS_FILTER' },
  focusList: { key: 'ctrl+alt+l', description: 'SHORTCUT_FOCUS_LIST' },
  focusForm: { key: 'ctrl+alt+f', description: 'SHORTCUT_FOCUS_FORM' },
  startProcess: { key: 'ctrl+alt+p', description: 'SHORTCUT_START_PROCESS' },
} as const;

/** "ctrl+alt+c" as "Ctrl + Alt + C". */
export function shortcutText(combination: string): string {
  return combination
    .split('+')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' + ');
}

export type ShortcutName = keyof typeof TASKLIST_SHORTCUTS;

/** The descriptions in the config.js the classic Tasklist ships: they keep this UI's translations. */
const SHIPPED_DESCRIPTIONS: Record<ShortcutName, string> = {
  claimTask: 'claims the currently selected task',
  focusFilter: 'set the focus to the first filter in the list',
  focusList: 'sets the focus to the first task in the list',
  focusForm: 'sets the focus to the first input field in a task form',
  startProcess: 'opens the start process modal dialog',
};

/**
 * The Tasklist shortcuts with the keys of the classic config.js (shortcuts).
 * A description changed there replaces the translated one.
 */
export function useTasklistShortcuts(): Record<ShortcutName, { key: string; description: string }> {
  const { t } = useTranslation('tasklist');
  const { shortcuts } = useSettings('tasklist');
  return useMemo(() => {
    const result = {} as Record<ShortcutName, { key: string; description: string }>;
    for (const name of Object.keys(TASKLIST_SHORTCUTS) as ShortcutName[]) {
      const configured = shortcuts[name];
      const custom = configured?.description && configured.description !== SHIPPED_DESCRIPTIONS[name];
      result[name] = {
        key: configured?.key ?? TASKLIST_SHORTCUTS[name].key,
        description: custom ? configured.description! : t(TASKLIST_SHORTCUTS[name].description),
      };
    }
    return result;
  }, [shortcuts, t]);
}
