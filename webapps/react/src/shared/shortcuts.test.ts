import { describe, expect, it } from 'vitest';
import { matchesShortcut } from './shortcuts';

const key = (init: KeyboardEventInit) => new KeyboardEvent('keydown', init);

describe('matchesShortcut', () => {
  it('needs exactly the modifiers of the combination', () => {
    expect(matchesShortcut(key({ key: 'c', ctrlKey: true, altKey: true }), 'ctrl+alt+c')).toBe(true);
    expect(matchesShortcut(key({ key: 'c', ctrlKey: true }), 'ctrl+alt+c')).toBe(false);
    expect(matchesShortcut(key({ key: 'c', ctrlKey: true, altKey: true, shiftKey: true }), 'ctrl+alt+c')).toBe(false);
  });

  it('ignores the case of letters typed with shift', () => {
    expect(matchesShortcut(key({ key: 'F', ctrlKey: true, shiftKey: true }), 'ctrl+shift+f')).toBe(true);
  });

  it('matches letters by key code where ctrl+alt (AltGr) types another character', () => {
    expect(matchesShortcut(key({ key: 'ć', code: 'KeyC', ctrlKey: true, altKey: true }), 'ctrl+alt+c')).toBe(true);
    expect(matchesShortcut(key({ key: 'ć', code: 'KeyV', ctrlKey: true, altKey: true }), 'ctrl+alt+c')).toBe(false);
  });
});
