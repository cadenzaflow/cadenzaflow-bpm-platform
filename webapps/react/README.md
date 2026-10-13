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
(routing happens in the browser) and fills in two placeholders: `$APP_ROOT`
(context path plus application path) and `$CSP_NONCE` (the nonce of the
Content-Security-Policy; every `<script>` needs it). Modules that are not
rewritten yet link to the classic UI, and the user menu switches to it.

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
