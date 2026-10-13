import { createRootRoute, createRoute, createRouter, type RouterHistory } from '@tanstack/react-router';
import { appRoot, BASE_PATH, type ModuleName } from '../shared/config';
import { Shell } from './Shell';
import { ErrorView } from './ErrorView';
import { NotFound } from './NotFound';
import { NotYetAvailable } from './NotYetAvailable';
import { TasklistPage } from '../modules/tasklist/TasklistPage';
import { validateTasklistSearch } from '../modules/tasklist/search';

declare module '@tanstack/react-router' {
  interface StaticDataRouteOption {
    /** The webapp module a route belongs to; the shell uses it for header, login and access checks. */
    module?: ModuleName;
  }
  interface Register {
    router: typeof router;
  }
}

const rootRoute = createRootRoute({
  component: Shell,
  notFoundComponent: NotFound,
});

// The AngularJS webapps keep /app/{module}/{engine}/; this UI lives next to
// them under /app/react/{module}/{engine}/ (see ProcessEnginesFilter).
const tasklistRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'tasklist/$engine',
  staticData: { module: 'tasklist' },
  validateSearch: validateTasklistSearch,
  component: TasklistPage,
});

/** Modules that are not rewritten yet point to the classic UI. */
function notYetAvailableRoutes(module: ModuleName) {
  return [`${module}/$engine`, `${module}/$engine/$`].map((path) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path,
      staticData: { module },
      component: () => <NotYetAvailable module={module} />,
    }),
  );
}

const routeTree = rootRoute.addChildren([
  tasklistRoute,
  ...notYetAvailableRoutes('cockpit'),
  ...notYetAvailableRoutes('admin'),
  ...notYetAvailableRoutes('welcome'),
]);

/** Tests pass a memory history; the app uses the browser history. */
export function createAppRouter(history?: RouterHistory) {
  return createRouter({
    routeTree,
    history,
    basepath: `${appRoot}${BASE_PATH}`,
    defaultErrorComponent: ErrorView,
  });
}

export const router = createAppRouter();
