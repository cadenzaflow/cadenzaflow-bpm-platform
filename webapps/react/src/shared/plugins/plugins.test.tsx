import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PluginPoint } from './PluginPoint';
import { loadPlugins, logOutWith, matchesRoutePath, pluginApi, readPluginList, type FrontendPlugin } from './plugins';

function pluginList(json: string) {
  const doc = document.implementation.createHTMLDocument();
  doc.body.innerHTML = `<script type="application/json" id="cadenzaflow-plugins">${json}</script>`;
  return doc;
}

const fakePlugin = (id: string, pluginPoint: string, priority?: number) => {
  const plugin = {
    id,
    pluginPoint,
    priority,
    render: vi.fn((node: HTMLElement, props: Record<string, unknown>) => {
      node.textContent = `${id} for ${JSON.stringify(props.processInstanceId ?? null)}`;
    }),
    unmount: vi.fn(),
  };
  return plugin;
};

afterEach(() => {
  document.cookie = 'XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
});

describe('plugin list', () => {
  it('reads the plugins of a module, without the AngularJS plugins of the classic webapps', () => {
    const doc = pluginList(
      JSON.stringify({
        cockpit: [
          { id: 'cockpitPlugins', location: '/api/cockpit/plugin/cockpitPlugins/static/app' },
          { id: 'legacyReports', location: '/api/cockpit/plugin/legacyReports/static/app' },
          { id: 'my-plugin', location: '/api/cockpit/plugin/my-plugin/static/app' },
        ],
        tasklist: [{ id: 'other', location: '/x' }],
      }),
    );
    expect(readPluginList('cockpit', doc)).toEqual([{ id: 'my-plugin', location: '/api/cockpit/plugin/my-plugin/static/app' }]);
    expect(readPluginList('admin', doc)).toEqual([]);
  });

  it('has no plugins without a (valid) list, e.g. in dev mode', () => {
    expect(readPluginList('cockpit', pluginList('$PLUGINS'))).toEqual([]);
    expect(readPluginList('cockpit', document.implementation.createHTMLDocument())).toEqual([]);
  });
});

describe('loading plugins', () => {
  it('takes one plugin or an array, skips what is no plugin and survives modules that fail', async () => {
    const doc = document.implementation.createHTMLDocument();
    const one = fakePlugin('one', 'cockpit.dashboard');
    const two = fakePlugin('two', 'cockpit.dashboard');
    const logout = { id: 'logout', pluginPoint: 'cockpit.logout', logout: vi.fn() };
    const modules: Record<string, () => Promise<{ default?: unknown }>> = {
      '/a/plugin.js': async () => ({ default: one }),
      '/b/plugin.js': async () => ({ default: [two, { id: 'broken' }, logout] }),
      '/c/plugin.js': async () => {
        throw new Error('404');
      },
    };
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    const plugins = await loadPlugins(
      [
        { id: 'a', location: '/a' },
        { id: 'b', location: '/b' },
        { id: 'c', location: '/c' },
      ],
      (url) => modules[url](),
      doc,
    );

    expect(plugins).toEqual([one, two, logout]);
    expect([...doc.head.querySelectorAll('link')].map((link) => link.getAttribute('href'))).toEqual(['/a/plugin.css', '/b/plugin.css', '/c/plugin.css']);
    expect(error).toHaveBeenCalledWith('The plugin c could not be loaded', expect.any(Error));
    error.mockRestore();
  });

  it('gives plugins the REST APIs, the engine and the CSRF token', () => {
    document.cookie = 'XSRF-TOKEN=token-1';
    expect(pluginApi('default')).toEqual({
      adminApi: '/api/admin',
      baseApi: '/api/engine',
      cockpitApi: '/api/cockpit',
      tasklistApi: '/api/tasklist',
      engineApi: '/api/engine/engine/default',
      engine: 'default',
      CSRFToken: 'token-1',
    });
  });
});

describe('route plugin paths', () => {
  it('are read as by the routes of the classic webapps', () => {
    expect(matchesRoutePath('/my-page', '/my-page')).toBe(true);
    expect(matchesRoutePath('/my-page', '/my-page?tab=log')).toBe(true);
    expect(matchesRoutePath('/my-page', '/my-page/42')).toBe(false);
    expect(matchesRoutePath('/my-page', '/my-pages')).toBe(false);
    // :name is one segment
    expect(matchesRoutePath('/my-page/:id', '/my-page/42')).toBe(true);
    expect(matchesRoutePath('/my-page/:id', '/my-page/42?tab=log')).toBe(true);
    expect(matchesRoutePath('/my-page/:id', '/my-page')).toBe(false);
    expect(matchesRoutePath('/my-page/:id', '/my-page/42/log')).toBe(false);
    // :name? may be left out, :name* takes one segment or more
    expect(matchesRoutePath('/my-page/:id?', '/my-page')).toBe(true);
    expect(matchesRoutePath('/my-page/:id?', '/my-page/42')).toBe(true);
    expect(matchesRoutePath('/my-page/:rest*', '/my-page/42/log')).toBe(true);
    expect(matchesRoutePath('/my-page/:rest*', '/my-page')).toBe(false);
    // the rest of the path is text, not a pattern
    expect(matchesRoutePath('/a.b', '/axb')).toBe(false);
    expect(matchesRoutePath('/a.b', '/a.b')).toBe(true);
  });
});

describe('plugin points', () => {
  const renderPoint = (plugins: FrontendPlugin[], processInstanceId: string) => {
    const client = new QueryClient();
    client.setQueryData(['plugins', 'cockpit'], plugins);
    const point = (id: string) => (
      <QueryClientProvider client={client}>
        <PluginPoint module="cockpit" point="cockpit.processInstance.runtime.action" engine="default" props={{ processInstanceId: id }} />
      </QueryClientProvider>
    );
    const result = render(point(processInstanceId));
    return { ...result, show: (id: string) => result.rerender(point(id)) };
  };

  it('renders the plugins of the point, highest priority first, and unmounts them again', () => {
    const low = fakePlugin('low', 'cockpit.processInstance.runtime.action', 1);
    const high = fakePlugin('high', 'cockpit.processInstance.runtime.action', 10);
    const elsewhere = fakePlugin('elsewhere', 'cockpit.dashboard');
    const { container, show, unmount } = renderPoint([low, high, elsewhere], 'pi-1');

    expect([...container.querySelectorAll('[data-plugin-id]')].map((node) => node.textContent)).toEqual(['high for "pi-1"', 'low for "pi-1"']);
    expect(high.render).toHaveBeenCalledWith(expect.any(HTMLElement), expect.objectContaining({ processInstanceId: 'pi-1', api: expect.objectContaining({ engine: 'default' }) }));
    expect(elsewhere.render).not.toHaveBeenCalled();

    // another instance: unmounted and rendered again
    show('pi-2');
    expect(high.unmount).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-plugin-id="high"]')?.textContent).toBe('high for "pi-2"');

    unmount();
    expect(high.unmount).toHaveBeenCalledTimes(2);
    expect(low.unmount).toHaveBeenCalledTimes(2);
  });

  it('keeps the page when a plugin fails', () => {
    const failing = fakePlugin('failing', 'cockpit.processInstance.runtime.action');
    failing.render.mockImplementation(() => {
      throw new Error('broken');
    });
    const working = fakePlugin('working', 'cockpit.processInstance.runtime.action');
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { container } = renderPoint([failing, working], 'pi-1');

    expect(container.querySelector('[data-plugin-id="working"]')?.textContent).toBe('working for "pi-1"');
    expect(error).toHaveBeenCalledWith('The plugin failing failed to render', expect.any(Error));
    error.mockRestore();
  });
});

describe('logout plugins', () => {
  it('log the user out with the REST APIs, or leave it to the webapp when they fail', () => {
    const logout = vi.fn();
    expect(logOutWith({ id: 'sso', pluginPoint: 'cockpit.logout', logout }, 'default')).toBe(true);
    expect(logout).toHaveBeenCalledWith({ api: pluginApi('default') });

    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const failing = vi.fn(() => {
      throw new Error('broken');
    });
    expect(logOutWith({ id: 'failing', pluginPoint: 'cockpit.logout', logout: failing }, 'default')).toBe(false);
    expect(error).toHaveBeenCalledWith('The plugin failing failed to log out', expect.any(Error));
    error.mockRestore();
  });
});
