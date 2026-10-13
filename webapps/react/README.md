# CadenzaFlow webapps (React)

Cockpit, Tasklist and Admin as one React single-page app. It runs next to the
AngularJS webapps in `../frontend` and does not depend on them: same server,
same login session and REST APIs, its own address.

## Run it

You need Node.js 24 and a running CadenzaFlow with webapps, for example
CadenzaFlow Run on `http://localhost:8080` (user `demo` / `demo`).

```bash
npm ci
npm run dev
```

Open http://localhost:5173/cadenzaflow/app/react/tasklist/default/. The dev
server serves the app itself and proxies every other path to the backend (REST
APIs, the AngularJS webapps, forms of process applications). For another backend set `CZ_BACKEND` (default
`http://localhost:8080`) and `CZ_APP_ROOT` (context path plus webapp
application path, default `/cadenzaflow`).

| Command | What it does |
|---|---|
| `npm test` | unit and component tests (Vitest, Testing Library, jsdom) |
| `npm run typecheck` | TypeScript check |
| `npm run build` | type check and production build into `target/webapp/app/react` |
| `npm run license-check` | fails on a dependency license outside the allow-list |

The Maven build (`webapps/pom.xml`) installs its own Node.js into `./node` and
runs `npm ci`, the license check, the tests and the build. The assemblies copy
`target/webapp` into the webapp, so the bundle ends up under `/app/react/`.

## How the server serves it

The AngularJS webapps stay at `/app/{app}/{engine}/` and remain the default.
This app lives at `/app/react/{app}/{engine}/` (`app` = cockpit, tasklist,
admin or welcome); its files are in `/app/react/assets/`. `ProcessEnginesFilter`
answers every path below `/app/react/{app}/` with `app/react/index.html`
(routing happens in the browser) and fills in three placeholders: `$APP_ROOT`
(context path plus application path), `$CSP_NONCE` (the nonce of the
Content-Security-Policy; every `<script>` needs it) and `$PLUGINS` (the
frontend plugins of every app, see below). Modules that are not rewritten yet
link to the classic UI, and the user menu switches to it.

## Frontend plugins (Cockpit)

Plugins are packaged as for the AngularJS Cockpit: a jar with a
`CockpitPlugin` (registered in
`META-INF/services/org.cadenzaflow.bpm.cockpit.plugin.spi.CockpitPlugin`), a
root resource `@Path("plugin/<id>")` extending `AbstractCockpitPluginRootResource`,
and the files `plugin-webapp/<id>/app/plugin.js` (and optionally
`app/plugin.css`). The server lists the plugins of every app in `index.html`;
the app loads each `plugin.js` as an ES module (and its `plugin.css`). The
plugins of the AngularJS webapps themselves (`cockpitPlugins`, `cockpitEE`,
`adminPlugins`, `adminEE`, `tasklistPlugins`) and `legacy*` plugins are
AngularJS modules and are not loaded.

`plugin.js` exports one plugin or an array of them (the same contract as the
AngularJS webapps' JavaScript plugins):

```js
export default [
  {
    id: 'my-tab',                                      // unique; also the tab's URL parameter
    pluginPoint: 'cockpit.processInstance.runtime.tab',
    label: 'My Tab',                                   // tabs, reports
    priority: 10,                                      // higher first
    render: (node, { api, processInstanceId }) => { /* draw into node */ },
    unmount: () => { /* clean up */ },
  },
];
```

`render` gets a DOM element (for `*.diagram.plugin` the bpmn-js viewer) and
the props `api` and, depending on the plugin point, the ids of what the page
shows. `api` holds `adminApi`, `baseApi`, `cockpitApi`, `tasklistApi`,
`engineApi` (the engine REST API of the current engine), `engine` and
`CSRFToken` (send it as `X-XSRF-TOKEN` with POST, PUT and DELETE). When the
page shows something else, the plugin is unmounted and rendered again;
`unmount` is called without arguments. A plugin that throws is logged and
leaves the page intact.

| Plugin point | Where | Props besides `api` |
|---|---|---|
| `cockpit.dashboard` | below the dashboard | |
| `cockpit.navigation` | in the section navigation | |
| `cockpit.route` | a page of its own at `#<properties.path>`, e.g. `#/my-page` | |
| `cockpit.report` | the Reports section (shown when there are report plugins) | |
| `cockpit.processes.dashboard` | below the processes | |
| `cockpit.processes.action` | an action column of the processes | `processDefinitionId` |
| `cockpit.processDefinition.runtime.tab` | a tab of the process definition | `processDefinitionId` |
| `cockpit.processDefinition.runtime.action` | an action of the process definition | `processDefinitionId` |
| `cockpit.processDefinition.diagram.plugin` | the process definition's diagram (viewer) | `processDefinitionId` |
| `cockpit.jobDefinition.action` | an action of a job definition | `jobDefinitionId` |
| `cockpit.processInstance.runtime.tab` | a tab of the process instance | `processInstanceId` |
| `cockpit.processInstance.runtime.action` | an action of the process instance | `processInstanceId` |
| `cockpit.processInstance.diagram.plugin` | the process instance's diagram (viewer) | `processInstanceId` |
| `cockpit.incident.action` | an action of an incident | `incidentId` |
| `cockpit.decisions.dashboard` | below the decisions | |
| `cockpit.decisionDefinition.tab` | a tab of the decision definition | `decisionDefinitionId` |
| `cockpit.decisionDefinition.action` | an action of the decision definition | `decisionDefinitionId` |
| `cockpit.decisionInstance.tab` | a tab of the evaluation | `decisionInstanceId` |
| `cockpit.decisionInstance.action` | an action of the evaluation | `decisionInstanceId` |
| `cockpit.tasks.dashboard` | below the human tasks | |
| `cockpit.repository.deployments.list` | above the deployments | |
| `cockpit.repository.deployment.action` | an action of a deployment | `deploymentId` |
| `cockpit.repository.resource.action` | an action of a resource | `deploymentId`, `resourceId` |
| `cockpit.repository.resource.detail` | below a resource | `deploymentId`, `resourceId` |

Tabs of plugins come after the built-in tabs. To try a plugin with
`npm run dev`, put its files below `src/` and list it in `CZ_PLUGINS`, e.g.
`CZ_PLUGINS='{"cockpit":[{"id":"my-plugin","location":"/src/my-plugin"}]}'`.

## Code layout

```
src/
  main.tsx           start-up: i18n, TanStack Query, router
  app/               routes, shell (login gate, header), error and not-found pages
  shared/            used by all modules: REST client, authentication, i18n, formatting
  modules/tasklist/  one folder per module: API hooks, components, styles, tests
  locales/{en,de}/   translations, one file per namespace (common, tasklist)
  styles/            Carbon setup and app-wide styles
```

- **REST calls** go through `shared/api/client.ts`. It sends the session
  cookie and, on POST/PUT/DELETE, the CSRF token (`X-XSRF-TOKEN`, taken from
  the `XSRF-TOKEN` cookie). Server state lives in TanStack Query; a 401
  anywhere sends the user back to the login page.
- **Routes** are declared in `app/router.tsx` (code-based TanStack Router
  routes, no generated files). Page state that should survive a reload or be
  shareable goes into the URL, e.g. the Tasklist's `?filter=&task=&detailsTab=`.
- **Forms** (`modules/tasklist/forms`), for task forms and start forms
  alike (`FormTarget`): generic form (no form key), external form (link),
  Camunda Forms (form-js, loaded on demand) and embedded HTML forms.
  Embedded forms run on the runtime of the old camunda-bpm-sdk-js
  (`forms/embedded/sdk`, ES modules, changes marked
  `CadenzaFlow:`): `cam-variable-*`, `cam-choices`, `cam-file-download`,
  `cam-error-code`, `cam-escalation-code` and `<script cam-script>` with
  `camForm`, `$` and `jQuery` work; AngularJS features (`ng-*`, `$scope`,
  `inject`) do not. Bootstrap 3 classes of such forms are mapped onto Carbon
  in `embedded-form.scss`.
- **Diagrams** (`shared/diagram`, loaded on demand): BPMN with bpmn-js, DMN
  with dmn-js. DMN 1.1 and 1.2 definitions are migrated to DMN 1.3 in the
  browser first (`@bpmn-io/dmn-migrate`), since dmn-js only reads DMN 1.3.
  Their license requires the bpmn.io watermark to stay visible.
- **Tabs of the Tasklist task detail** are registered by file: every
  `modules/tasklist/task-tabs/*.tab.tsx` exports a `tab` and appears in the
  panel, ordered by `order`.
- **Keyboard shortcuts** (`useShortcut` in `shared/shortcuts.ts`; the
  Tasklist's list is `modules/tasklist/shortcuts/shortcuts.ts`) use the default
  keys of the classic Tasklist. They are fixed: `shortcuts` in the classic
  `config.js` does not apply here. Typing in a field never triggers one.
- **Translations** reuse the keys and texts of the AngularJS webapps
  (`../frontend/public/app/*/locales`) where the text already exists. A test
  checks that every language has every key.
- **Styles**: Carbon components and Carbon design tokens; a small SCSS file
  per module, class names prefixed with `cz-`. Fonts are bundled because the
  CSP only allows fonts from the server itself. The CadenzaFlow brand (logo,
  header line and colors of the classic webapps, buttons and links in a
  darker shade for contrast) is in `styles/_brand.scss` and
  `assets/cadenzaflow-logo.png`.
- **TypeScript** runs with `strict` off but `strictNullChecks` on (TanStack
  Router requires it).

## Dependencies

Versions are pinned exactly (`.npmrc`: `save-exact`). New or updated packages
are installed with a two-week release cooldown, e.g.
`npm install --before=<date two weeks ago> <package>@<version>`; security fixes
are applied right away. Install scripts are disabled (`ignore-scripts`), which
also keeps the Carbon packages' telemetry from running.
