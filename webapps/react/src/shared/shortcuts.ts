import { useEffect, useRef } from 'react';

/** Whether the event is the key combination, such as "ctrl+alt+c" (modifiers first, then one key). */
export function matchesShortcut(event: KeyboardEvent, combination: string): boolean {
  const parts = combination.toLowerCase().split('+');
  const key = parts.pop();
  const modifiers = new Set(parts);
  if (
    event.ctrlKey !== modifiers.has('ctrl') ||
    event.altKey !== modifiers.has('alt') ||
    event.shiftKey !== modifiers.has('shift') ||
    event.metaKey !== modifiers.has('meta')
  ) {
    return false;
  }
  // the key code keeps letters working where ctrl+alt (AltGr) types another character
  return event.key.toLowerCase() === key || (/^[a-z]$/.test(key ?? '') && event.code === `Key${key!.toUpperCase()}`);
}

/** Typing in a field never triggers a shortcut, as in the classic webapps. */
function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName))
  );
}

/** Calls the handler when the key combination is pressed, while enabled. */
export function useShortcut(combination: string, handler: () => void, enabled = true): void {
  const latest = useRef(handler);
  useEffect(() => {
    latest.current = handler;
  });

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }
    const listener = (event: KeyboardEvent) => {
      if (!isTyping(event.target) && matchesShortcut(event, combination)) {
        event.preventDefault();
        latest.current();
      }
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [combination, enabled]);
}

/** Moves the focus to the first element in the container that matches the selector. */
export function focusFirst(container: HTMLElement | null, selector: string): void {
  container?.querySelector<HTMLElement>(selector)?.focus();
}
