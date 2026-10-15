import { useQuery } from '@tanstack/react-query';
import { importClassicConfig } from './classic-config';
import type { ModuleName } from './config';

/** A checkbox of a dialog: whether it starts checked and whether it is shown at all. */
export interface DialogOption {
  default: boolean;
  hidden: boolean;
}

/** A Tasklist shortcut as config.js may change it. */
export interface ShortcutSetting {
  key?: string;
  description?: string;
}

/**
 * The settings of the classic app/{module}/scripts/config.js that this UI
 * applies. A setting config.js does not set keeps this UI's default, which is
 * the classic default (cam-configuration.js) - except the languages and the
 * date format, which this UI takes from the browser.
 */
export interface ClassicSettings {
  /** replaces the app name and the vendor in the header and the page title */
  appName?: string;
  appVendor?: string;
  /** set: the languages to choose from (by the browser's preference) and the one to fall back to */
  locales?: { available: string[]; fallback: string };
  /** a moment.js format (e.g. "LLL" or "DD.MM.YYYY HH:mm") for date and time */
  dateFormat?: string;
  csrfCookieName?: string;
  /** scripts below app/{module}/ (without .js), loaded as ES modules; they may export plugins */
  customScripts: string[];
  skipCustomListeners: DialogOption;
  skipIoMappings: DialogOption;
  /** whether "delete process instances" starts checked when a deployment is deleted */
  cascadeDefault: boolean;
  /** the instance and incident counts on the process definition diagram */
  activityInstanceMetrics: boolean;
  /** whether the ended batches are listed without asking */
  autoLoadEndedBatches: boolean;
  /** the maximum length of an annotation */
  annotationLength: number;
  /** HTML resources of a deployment are shown rendered (in a sandbox), not only as source */
  previewHtml: boolean;
  /** bpmn-js modules (ES modules below app/{module}/, without .js) and moddle extensions (JSON, without .json) */
  bpmnJs: { additionalModules: string[]; moddleExtensions: Record<string, string> };
  shortcuts: Record<string, ShortcutSetting>;
  /** comments on a task carry its process instance id */
  assignProcessInstanceIdToTaskComment: boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): string | undefined => (typeof value === 'string' && value.trim() !== '' ? value : undefined);
const flag = (value: unknown, fallback: boolean): boolean => (typeof value === 'boolean' ? value : fallback);
const texts = (value: unknown): string[] => (Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item !== '') : []);

function dialogOption(value: unknown): DialogOption {
  const option = isRecord(value) ? value : {};
  return { default: flag(option.default, true), hidden: flag(option.hidden, false) };
}

/** The settings of a config.js default export, with the defaults for what it leaves out or gets wrong. */
export function readClassicSettings(config: Record<string, unknown>): ClassicSettings {
  const app = isRecord(config.app) ? config.app : {};
  const locales = isRecord(config.locales) ? config.locales : undefined;
  const available = texts(locales?.availableLocales);
  const dateFormat = isRecord(config.dateFormat) ? config.dateFormat : {};
  const bpmnJs = isRecord(config.bpmnJs) ? config.bpmnJs : {};
  const moddleExtensions = isRecord(bpmnJs.moddleExtensions) ? bpmnJs.moddleExtensions : {};
  const shortcuts = isRecord(config.shortcuts) ? config.shortcuts : {};
  const annotationLength = config.userOperationLogAnnotationLength;

  return {
    appName: text(app.name),
    appVendor: text(app.vendor),
    locales: available.length ? { available, fallback: text(locales?.fallbackLocale) ?? available[0] } : undefined,
    dateFormat: text(dateFormat.normal),
    csrfCookieName: text(config.csrfCookieName),
    customScripts: texts(config.customScripts),
    skipCustomListeners: dialogOption(config.skipCustomListeners),
    skipIoMappings: dialogOption(config.skipIoMappings),
    cascadeDefault: flag(isRecord(config.cascade) ? config.cascade.default : undefined, false),
    activityInstanceMetrics: flag(isRecord(config.runtimeActivityInstanceMetrics) ? config.runtimeActivityInstanceMetrics.display : undefined, true),
    autoLoadEndedBatches: flag(isRecord(config.batchOperation) ? config.batchOperation.autoLoadEnded : undefined, true),
    annotationLength: typeof annotationLength === 'number' && annotationLength > 0 ? annotationLength : 4000,
    previewHtml: flag(config.previewHtml, true),
    bpmnJs: {
      additionalModules: texts(bpmnJs.additionalModules),
      moddleExtensions: Object.fromEntries(Object.entries(moddleExtensions).filter((entry): entry is [string, string] => typeof entry[1] === 'string')),
    },
    shortcuts: Object.fromEntries(
      Object.entries(shortcuts)
        .filter((entry): entry is [string, Record<string, unknown>] => isRecord(entry[1]))
        .map(([name, shortcut]) => [name, { key: text(shortcut.key), description: text(shortcut.description) }]),
    ),
    assignProcessInstanceIdToTaskComment: flag(config.assignProcessInstanceIdToTaskComment, false),
  };
}

/** The settings of the module's classic config.js (all defaults when it is missing or broken). */
export function useClassicSettings(module: ModuleName) {
  return useQuery({
    queryKey: ['classic-settings', module],
    staleTime: Infinity,
    queryFn: async () => readClassicSettings(await importClassicConfig(module)),
  });
}

/** The settings once loaded (the module shell waits for them), else the defaults. */
export function useSettings(module: ModuleName): ClassicSettings {
  return useClassicSettings(module).data ?? DEFAULT_SETTINGS;
}

export const DEFAULT_SETTINGS: ClassicSettings = readClassicSettings({});
