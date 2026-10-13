import { describe, expect, it } from 'vitest';
import { classicUrl, moduleUrl, readAppRoot } from './config';
import { displayName, formatRelative, parseEngineDate } from './format';
import { detectLanguage, resources } from './i18n';

describe('readAppRoot', () => {
  it('reads the app root the server wrote into index.html', () => {
    const doc = document.implementation.createHTMLDocument();
    doc.head.innerHTML = '<meta name="cadenzaflow-app-root" content="/cadenzaflow/">';
    expect(readAppRoot(doc)).toBe('/cadenzaflow');
  });

  it('is empty for a webapp at the server root', () => {
    expect(readAppRoot(document.implementation.createHTMLDocument())).toBe('');
  });
});

describe('moduleUrl', () => {
  it('points to the start page of a module, here and in the classic UI', () => {
    expect(moduleUrl('cockpit', 'default')).toBe('/app/react/cockpit/default/');
    expect(moduleUrl('tasklist', 'my engine')).toBe('/app/react/tasklist/my%20engine/');
    expect(classicUrl('cockpit', 'default')).toBe('/app/cockpit/default/');
  });
});

describe('format', () => {
  it('parses engine dates with an offset without colon', () => {
    expect(parseEngineDate('2026-10-13T08:49:55.851+0000')?.toISOString()).toBe('2026-10-13T08:49:55.851Z');
    expect(parseEngineDate('2026-10-13T10:49:55.851+0200')?.toISOString()).toBe('2026-10-13T08:49:55.851Z');
    expect(parseEngineDate(null)).toBeNull();
    expect(parseEngineDate('not a date')).toBeNull();
  });

  it('formats relative times', () => {
    const now = Date.parse('2026-10-13T10:00:00Z');
    expect(formatRelative('2026-10-13T07:00:00.000+0000', 'en', now)).toBe('3 hours ago');
    expect(formatRelative('2026-10-15T10:00:00.000+0000', 'en', now)).toBe('in 2 days');
  });

  it('shows the user name, or the id when there is none', () => {
    expect(displayName({ firstName: 'Demo', lastName: 'User' }, 'demo')).toBe('Demo User');
    expect(displayName({ firstName: null, lastName: null }, 'demo')).toBe('demo');
    expect(displayName(undefined, 'demo')).toBe('demo');
  });
});

describe('i18n', () => {
  it('picks the first supported browser language, English otherwise', () => {
    expect(detectLanguage(['de-AT', 'en'])).toBe('de');
    expect(detectLanguage(['fr-FR', 'en-US'])).toBe('en');
    expect(detectLanguage(['tr'])).toBe('en');
  });

  it('has every key in every language', () => {
    for (const namespace of Object.keys(resources.en) as (keyof typeof resources.en)[]) {
      const english = Object.keys(resources.en[namespace]).sort();
      expect(Object.keys(resources.de[namespace]).sort(), namespace).toEqual(english);
    }
  });
});
