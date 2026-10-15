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

Tabs of plugins come after the built-in tabs.

A plugin at `<app>.logout` (`cockpit.logout`, `tasklist.logout`,
`admin.logout`, `welcome.logout`) has a `logout(props)` function instead of
`render`: "Log out" in the user menu calls it instead of logging out itself
(if it throws, the app logs out itself). The SSO logout of
`starter-security` is such a plugin.

To try a plugin with
`npm run dev`, put its files below `src/` and list it in `CZ_PLUGINS`, e.g.
`CZ_PLUGINS='{"cockpit":[{"id":"my-plugin","location":"/src/my-plugin"}]}'`.

## Settings of the classic config.js

Operators configure the AngularJS webapps in `app/{app}/scripts/config.js`
(an ES module whose default export is the settings). This UI reads the same
file of each app (`shared/classic-settings.ts`) before it shows the app, so
existing settings keep working. A setting the file does not set keeps this
UI's default, which is the default of the classic webapps - except the
language and the date format, which come from the browser.

| Setting | Apps | Effect here |
|---|---|---|
| `app.name`, `app.vendor` | all | the app name and vendor in the header and the page title |
| `locales.availableLocales`, `locales.fallbackLocale` | all | the language: the browser's preferred one among the available ones this UI has (English, German), else the fallback |
| `dateFormat.normal` | all | dates with time, as a moment.js format (`LLL`, `DD.MM.YYYY HH:mm`, ...) |
| `csrfCookieName` | all | the cookie the CSRF token is read from |
| `customScripts` | all | ES modules below `app/{app}/` that are loaded with the app; plugins they export (as `plugin.js` does) join the app's plugins |
| `links` | Welcome | the links of the Welcome page |
| `skipCustomListeners`, `skipIoMappings` (`default`, `hidden`) | Cockpit | the options when a process instance or a deployment is deleted |
| `cascade.default` | Cockpit | whether deleting a deployment deletes its process instances |
| `runtimeActivityInstanceMetrics.display` | Cockpit | `false`: no instance counts on the process definition diagram (the statistics query is not sent) |
| `batchOperation.autoLoadEnded` | Cockpit | `false`: the ended batches are listed only on request |
| `userOperationLogAnnotationLength` | Cockpit | the maximum length of an incident annotation |
| `previewHtml` | Cockpit | `false`: HTML resources of a deployment are shown only as source; otherwise also as a form preview in a sandboxed frame (no scripts, no access to the page or the session, no submission) |
| `bpmnJs.additionalModules`, `bpmnJs.moddleExtensions` | Cockpit | bpmn-js modules (ES modules) and moddle extensions (JSON) below `app/cockpit/` for the Cockpit diagrams |
| `shortcuts` | Tasklist | the keys of the shortcuts; a description changed from the shipped one replaces the translated text |
| `assignProcessInstanceIdToTaskComment` | Tasklist | comments on a task carry its process instance |

Not applied:

- `requireJsConfig` and custom scripts that need AngularJS or RequireJS: this
  UI has neither. Such a script fails to load; the error is logged.
- `historicActivityInstanceMetrics`, `defaultFilter` and `batchOperation.mode`:
  they configure views of the Enterprise Cockpit, which this UI does not have.
- `disableWelcomeMessage`: the classic webapps do not use it either.

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
- **Welcome links** come from `links` in the classic
  `app/welcome/scripts/config.js`, the file operators already maintain for the
  AngularJS Welcome page; without it the documentation is linked.
- **Keyboard shortcuts** (`useShortcut` in `shared/shortcuts.ts`; the
  Tasklist's list is `modules/tasklist/shortcuts/shortcuts.ts`) use the keys
  of the classic Tasklist, as its `config.js` sets them (see below). Typing in
  a field never triggers one.
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
