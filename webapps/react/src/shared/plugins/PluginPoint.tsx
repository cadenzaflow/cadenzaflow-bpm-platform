import { useEffect, useRef } from 'react';
import type { ModuleName } from '../config';
import { moduleOf, pluginApi, usePluginLookup, usePluginPoint, type FrontendPlugin } from './plugins';

interface PluginViewProps {
  plugin: FrontendPlugin;
  engine: string;
  /** what the page shows, e.g. { processInstanceId } */
  props?: Record<string, unknown>;
  /** props that are no plain data, e.g. { viewer } (keep the object the same while they are) */
  objects?: Record<string, unknown>;
  className?: string;
}

/**
 * One plugin, rendered into its own element. It is rendered again (after
 * unmount) when the page shows something else; a plugin that fails is logged
 * and leaves the page intact.
 */
export function PluginView({ plugin, engine, props = {}, objects, className }: PluginViewProps) {
  const container = useRef<HTMLDivElement>(null);
  const propsKey = JSON.stringify(props);
  const lookup = usePluginLookup(moduleOf(plugin.pluginPoint));

  useEffect(() => {
    const node = document.createElement('div');
    container.current?.appendChild(node);
    try {
      plugin.render?.(node, { api: pluginApi(engine), plugins: lookup, ...props, ...objects });
    } catch (error) {
      console.error(`The plugin ${plugin.id} failed to render`, error);
    }
    return () => {
      try {
        plugin.unmount?.();
      } catch (error) {
        console.error(`The plugin ${plugin.id} failed to unmount`, error);
      }
      node.remove();
    };
  }, [plugin, engine, propsKey, objects, lookup]);

  return <div ref={container} className={className ?? 'cz-plugin'} data-plugin-id={plugin.id} />;
}

interface PluginPointProps {
  module: ModuleName;
  /** e.g. cockpit.processInstance.runtime.action */
  point: string;
  engine: string;
  props?: Record<string, unknown>;
  objects?: Record<string, unknown>;
  className?: string;
}

/** All plugins of a plugin point, highest priority first; nothing when there are none. */
export function PluginPoint({ module, point, engine, props, objects, className }: PluginPointProps) {
  const plugins = usePluginPoint(module, point);
  return (
    <>
      {plugins.map((plugin) => (
        <PluginView key={plugin.id} plugin={plugin} engine={engine} props={props} objects={objects} className={className} />
      ))}
    </>
  );
}
