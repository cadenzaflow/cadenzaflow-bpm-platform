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
