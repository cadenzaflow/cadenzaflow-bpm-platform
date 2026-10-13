import { createRootRoute, createRoute, createRouter, type RouterHistory } from '@tanstack/react-router';
import { appRoot, BASE_PATH, type ModuleName } from '../shared/config';
import { Shell } from './Shell';
import { ErrorView } from './ErrorView';
import { NotFound } from './NotFound';
import { NotYetAvailable } from './NotYetAvailable';
import { TasklistPage } from '../modules/tasklist/TasklistPage';
import { validateTasklistSearch } from '../modules/tasklist/search';
import { AdminLayout } from '../modules/admin/AdminLayout';
import { AdminDashboard } from '../modules/admin/dashboard/AdminDashboard';
import { validateEditSearch, validateListSearch } from '../modules/admin/search';
import { UsersPage } from '../modules/admin/users/UsersPage';
import { UserCreatePage } from '../modules/admin/users/UserCreatePage';
import { UserEditPage } from '../modules/admin/users/UserEditPage';
import { GroupsPage } from '../modules/admin/groups/GroupsPage';
import { GroupCreatePage } from '../modules/admin/groups/GroupCreatePage';
import { GroupEditPage } from '../modules/admin/groups/GroupEditPage';
import { TenantsPage } from '../modules/admin/tenants/TenantsPage';
import { TenantCreatePage } from '../modules/admin/tenants/TenantCreatePage';
import { TenantEditPage } from '../modules/admin/tenants/TenantEditPage';
import { AuthorizationsPage } from '../modules/admin/authorizations/AuthorizationsPage';
import { validateAuthorizationSearch } from '../modules/admin/authorizations/search';
import { SystemPage } from '../modules/admin/system/SystemPage';
import { validateSystemSearch } from '../modules/admin/system/search';
import { SetupPage } from '../modules/admin/setup/SetupPage';
import { CockpitLayout } from '../modules/cockpit/CockpitLayout';
import { CockpitDashboard } from '../modules/cockpit/dashboard/CockpitDashboard';
import { ProcessesPage } from '../modules/cockpit/processes/ProcessesPage';
import { ProcessDefinitionPage } from '../modules/cockpit/process-definition/ProcessDefinitionPage';
import { validateProcessDefinitionSearch } from '../modules/cockpit/process-definition/search';
import { ProcessInstancePage } from '../modules/cockpit/process-instance/ProcessInstancePage';
import { validateProcessInstanceSearch } from '../modules/cockpit/process-instance/search';
import { DecisionsPage } from '../modules/cockpit/decisions/DecisionsPage';
import { DecisionDefinitionPage } from '../modules/cockpit/decisions/DecisionDefinitionPage';
import { DecisionInstancePage } from '../modules/cockpit/decisions/DecisionInstancePage';
import { validateDecisionInstanceSearch } from '../modules/cockpit/decisions/search';
import { TasksPage } from '../modules/cockpit/tasks/TasksPage';
import { RepositoryPage } from '../modules/cockpit/repository/RepositoryPage';
import { validateRepositorySearch } from '../modules/cockpit/repository/search';
import { BatchesPage } from '../modules/cockpit/batches/BatchesPage';
import { validateBatchesSearch } from '../modules/cockpit/batches/search';
import { validateListSearch as validateCockpitListSearch } from '../shared/search/list-search';

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

// Admin: one route per page; paths as in the classic Admin (#/users, #/user-create, #/users/:userId, ...).
const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'admin/$engine',
  staticData: { module: 'admin' },
  component: AdminLayout,
});

const adminRoutes = [
  createRoute({ getParentRoute: () => adminRoute, path: '/', component: AdminDashboard }),
  createRoute({ getParentRoute: () => adminRoute, path: 'users', validateSearch: validateListSearch, component: UsersPage }),
  createRoute({ getParentRoute: () => adminRoute, path: 'user-create', component: UserCreatePage }),
  createRoute({
    getParentRoute: () => adminRoute,
    path: 'users/$userId',
    validateSearch: validateEditSearch,
    component: UserEditPage,
  }),
  createRoute({ getParentRoute: () => adminRoute, path: 'groups', validateSearch: validateListSearch, component: GroupsPage }),
  createRoute({ getParentRoute: () => adminRoute, path: 'group-create', component: GroupCreatePage }),
  createRoute({
    getParentRoute: () => adminRoute,
    path: 'groups/$groupId',
    validateSearch: validateEditSearch,
    component: GroupEditPage,
  }),
  createRoute({ getParentRoute: () => adminRoute, path: 'tenants', validateSearch: validateListSearch, component: TenantsPage }),
  createRoute({ getParentRoute: () => adminRoute, path: 'tenant-create', component: TenantCreatePage }),
  createRoute({
    getParentRoute: () => adminRoute,
    path: 'tenants/$tenantId',
    validateSearch: validateEditSearch,
    component: TenantEditPage,
  }),
  createRoute({
    getParentRoute: () => adminRoute,
    path: 'authorization',
    validateSearch: validateAuthorizationSearch,
    component: AuthorizationsPage,
  }),
  createRoute({ getParentRoute: () => adminRoute, path: 'system', validateSearch: validateSystemSearch, component: SystemPage }),
];

// Cockpit: paths as in the classic Cockpit (#/dashboard, #/processes, ...).
const cockpitRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'cockpit/$engine',
  staticData: { module: 'cockpit' },
  component: CockpitLayout,
});

const cockpitRoutes = [
  createRoute({ getParentRoute: () => cockpitRoute, path: '/', component: CockpitDashboard }),
  createRoute({ getParentRoute: () => cockpitRoute, path: 'processes', validateSearch: validateCockpitListSearch, component: ProcessesPage }),
  createRoute({
    getParentRoute: () => cockpitRoute,
    path: 'process-definition/$id',
    validateSearch: validateProcessDefinitionSearch,
    component: ProcessDefinitionPage,
  }),
  createRoute({
    getParentRoute: () => cockpitRoute,
    path: 'process-instance/$id',
    validateSearch: validateProcessInstanceSearch,
    component: ProcessInstancePage,
  }),
  createRoute({ getParentRoute: () => cockpitRoute, path: 'decisions', validateSearch: validateCockpitListSearch, component: DecisionsPage }),
  createRoute({
    getParentRoute: () => cockpitRoute,
    path: 'decision-definition/$id',
    validateSearch: validateCockpitListSearch,
    component: DecisionDefinitionPage,
  }),
  createRoute({
    getParentRoute: () => cockpitRoute,
    path: 'decision-instance/$id',
    validateSearch: validateDecisionInstanceSearch,
    component: DecisionInstancePage,
  }),
  createRoute({ getParentRoute: () => cockpitRoute, path: 'tasks', component: TasksPage }),
  createRoute({ getParentRoute: () => cockpitRoute, path: 'repository', validateSearch: validateRepositorySearch, component: RepositoryPage }),
  createRoute({ getParentRoute: () => cockpitRoute, path: 'batch', validateSearch: validateBatchesSearch, component: BatchesPage }),
];

// The first admin user of an engine without one: no module, so no login and no header.
const setupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'admin/$engine/setup',
  component: SetupPage,
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
  adminRoute.addChildren(adminRoutes),
  setupRoute,
  cockpitRoute.addChildren(cockpitRoutes),
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
