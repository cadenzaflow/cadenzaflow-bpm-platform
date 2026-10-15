import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, readClassicSettings } from './classic-settings';
import { loadBpmnJsExtensions } from './diagram/bpmn-extensions';
import { formatMoment } from './format';
import { chooseLanguage } from './i18n';
import { loadCustomScripts } from './plugins/plugins';

describe('classic config.js settings', () => {
  it('has the classic defaults for what config.js leaves out', () => {
    expect(DEFAULT_SETTINGS).toEqual({
      appName: undefined,
      appVendor: undefined,
      locales: undefined,
      dateFormat: undefined,
      csrfCookieName: undefined,
      customScripts: [],
      skipCustomListeners: { default: true, hidden: false },
      skipIoMappings: { default: true, hidden: false },
      cascadeDefault: false,
      activityInstanceMetrics: true,
      autoLoadEndedBatches: true,
      annotationLength: 4000,
      previewHtml: true,
      bpmnJs: { additionalModules: [], moddleExtensions: {} },
      shortcuts: {},
      assignProcessInstanceIdToTaskComment: false,
    });
  });

  it('reads the settings config.js sets', () => {
    const settings = readClassicSettings({
      app: { name: 'Operations', vendor: 'Company' },
      locales: { availableLocales: ['de', 'en'], fallbackLocale: 'de' },
      dateFormat: { normal: 'DD.MM.YYYY HH:mm', long: 'LLLL' },
      csrfCookieName: 'MY-XSRF',
      customScripts: ['my-script/script'],
      skipCustomListeners: { default: false, hidden: true },
      skipIoMappings: { hidden: true },
      cascade: { default: true },
      runtimeActivityInstanceMetrics: { display: false },
      batchOperation: { mode: 'search', autoLoadEnded: false },
      userOperationLogAnnotationLength: 500,
      previewHtml: false,
      bpmnJs: { additionalModules: ['my-module/module'], moddleExtensions: { camunda: 'my-moddle/camunda' } },
      shortcuts: { claimTask: { key: 'ctrl+shift+c', description: 'claims it' } },
      assignProcessInstanceIdToTaskComment: true,
    });

    expect(settings).toEqual({
      appName: 'Operations',
      appVendor: 'Company',
      locales: { available: ['de', 'en'], fallback: 'de' },
      dateFormat: 'DD.MM.YYYY HH:mm',
      csrfCookieName: 'MY-XSRF',
      customScripts: ['my-script/script'],
      skipCustomListeners: { default: false, hidden: true },
      skipIoMappings: { default: true, hidden: true },
      cascadeDefault: true,
      activityInstanceMetrics: false,
      autoLoadEndedBatches: false,
      annotationLength: 500,
      previewHtml: false,
      bpmnJs: { additionalModules: ['my-module/module'], moddleExtensions: { camunda: 'my-moddle/camunda' } },
      shortcuts: { claimTask: { key: 'ctrl+shift+c', description: 'claims it' } },
      assignProcessInstanceIdToTaskComment: true,
    });
  });

  it('loads config.js anew each time, as the classic webapps do', async () => {
    const { importClassicConfig } = await vi.importActual<typeof import('./classic-config')>('./classic-config');
    const urls: string[] = [];
    const config = await importClassicConfig('cockpit', async (url) => {
      urls.push(url);
      return { default: { previewHtml: false } };
    });

    expect(config).toEqual({ previewHtml: false });
    expect(urls[0]).toMatch(/^\/app\/cockpit\/scripts\/config\.js\?bust=\d+$/);
  });

  it('ignores values of the wrong type, as the defaults stand for them', () => {
    expect(
      readClassicSettings({
        app: 'Operations',
        locales: { availableLocales: 'de' },
        customScripts: 'my-script',
        skipCustomListeners: { default: 'no' },
        runtimeActivityInstanceMetrics: { display: 0 },
        userOperationLogAnnotationLength: -1,
        bpmnJs: { additionalModules: [42], moddleExtensions: { camunda: {} } },
        shortcuts: { claimTask: 'ctrl+c' },
      }),
    ).toEqual(DEFAULT_SETTINGS);
  });
});

describe('dates in a moment.js format', () => {
  const date = new Date(2026, 9, 5, 14, 7, 9);

  it('formats the common tokens; [text] stays as it is', () => {
    expect(formatMoment(date, 'DD.MM.YYYY HH:mm:ss', 'en')).toBe('05.10.2026 14:07:09');
    expect(formatMoment(date, 'D/M/YY h:mm a', 'en')).toBe('5/10/26 2:07 pm');
    expect(formatMoment(date, '[Today is] dddd', 'en')).toBe('Today is Monday');
    expect(formatMoment(date, 'MMMM', 'de')).toBe('Oktober');
  });

  it('formats the localized formats in the language', () => {
    expect(formatMoment(date, 'LLL', 'en')).toBe(new Intl.DateTimeFormat('en', { dateStyle: 'long', timeStyle: 'short' }).format(date));
    expect(formatMoment(date, 'L', 'de')).toBe('05.10.2026');
    expect(formatMoment(date, 'LT', 'de')).toBe('14:07');
  });
});

describe('the language', () => {
  it('is the browser language among those config.js allows, else its fallback', () => {
    expect(chooseLanguage(undefined, ['de-CH', 'en'])).toBe('de');
    expect(chooseLanguage({ available: ['en'], fallback: 'en' }, ['de-CH', 'en'])).toBe('en');
    expect(chooseLanguage({ available: ['en', 'de'], fallback: 'en' }, ['fr', 'de'])).toBe('de');
    expect(chooseLanguage({ available: ['fr', 'de'], fallback: 'de' }, ['fr'])).toBe('de');
    // a fallback this UI does not have
    expect(chooseLanguage({ available: ['fr'], fallback: 'fr' }, ['fr'])).toBe('en');
  });
});

describe('extensions from config.js', () => {
  it('loads the bpmn-js modules and moddle extensions below the app, without what fails', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const imported: string[] = [];
    const loaded: string[] = [];
    const extensions = await loadBpmnJsExtensions(
      'cockpit',
      { additionalModules: ['my-module/module', 'broken/module.js'], moddleExtensions: { camunda: 'my-moddle/camunda', other: 'missing' } },
      async (url) => {
        imported.push(url);
        if (url.includes('broken')) {
          throw new Error('404');
        }
        return { default: { __init__: ['myModule'] } };
      },
      async (url) => {
        loaded.push(url);
        if (url.includes('missing')) {
          throw new Error('404');
        }
        return { name: 'Camunda' };
      },
    );

    expect(imported).toEqual(['/app/cockpit/my-module/module.js', '/app/cockpit/broken/module.js']);
    expect(loaded).toEqual(['/app/cockpit/my-moddle/camunda.json', '/app/cockpit/missing.json']);
    expect(extensions).toEqual({ additionalModules: [{ __init__: ['myModule'] }], moddleExtensions: { camunda: { name: 'Camunda' } } });
    expect(error).toHaveBeenCalledTimes(2);
    error.mockRestore();
  });

  it('runs the custom scripts and takes the plugins they export', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const plugin = { id: 'scripted', pluginPoint: 'cockpit.dashboard', render: () => {} };
    const scripts: Record<string, { default?: unknown }> = {
      '/app/cockpit/my-script/script.js': { default: [plugin, { id: 'no plugin' }] },
      '/app/cockpit/side-effect.js': {},
    };

    const plugins = await loadCustomScripts('cockpit', ['my-script/script', 'side-effect.js', 'angular-script'], async (url) => {
      if (!scripts[url]) {
        throw new Error('angular is not defined');
      }
      return scripts[url];
    });

    expect(plugins).toEqual([plugin]);
    expect(error).toHaveBeenCalledWith('The custom script angular-script could not be loaded', expect.any(Error));
    error.mockRestore();
  });
});
