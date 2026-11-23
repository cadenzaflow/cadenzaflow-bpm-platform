# Tests of a running distribution

These tests run against a CadenzaFlow that is started from a distribution
archive: Run, Run 4, Tomcat 10.1 or Tomcat 11. They use the REST API and,
in a browser, the webapps. Nothing is mocked.

| File | What it covers |
| --- | --- |
| `tests/distribution.spec.ts` | version, engine and example; a process over a user task, a gateway and an external task; a decision; a called process; a timer job; the classic and the React pages with their files; security headers; session, CSRF token and logout |
| `tests/login.spec.ts` | login of the classic webapps and of the React webapps, deep links, logout |
| `tests/tasklist.spec.ts` | React Tasklist: Camunda Forms, generic and embedded forms; due date, comment, candidate groups, assignee, history and diagram of a task; starting a process; creating a task; filters; search and sorting |
| `tests/cockpit.spec.ts` | React Cockpit: dashboard, definition and instance pages, the diagram, variables, suspension, incidents and retries, called instances, user and external tasks, job definitions, history time to live, decisions, deployments, human tasks, batches |
| `tests/admin.spec.ts` | React Admin: users, groups, tenants, authorizations, system; the Welcome page |

What a test does in the browser it checks at the engine through REST.

## Run them

```sh
npm ci
npx playwright install chromium          # once; or use a browser of the machine, see below

env/start.sh <path to>/cadenzaflow-bpm-run-<version>.tar.gz   # needs Java and curl, uses port 8080
npm test
env/stop.sh                              # fails when the server logged an error the tests did not cause
```

`env/start.sh` unpacks the archive and starts the server with the start
script the archive ships.

| Variable | Meaning |
| --- | --- |
| `E2E_SERVER` | the server, default `http://localhost:8080` |
| `E2E_VERSION` | the version the distribution has to report |
| `E2E_AUTHORIZATION` | `true` when the distribution checks authorizations (the Tomcat distributions), `false` when it does not (Run and Run 4 as shipped) |
| `E2E_CHANNEL` | `msedge` or `chrome`: use that browser of the machine instead of the installed Chromium |

The tests deploy their own processes (`tests/processes.ts`) once per engine
and work on data of their own, so they can run again on the same engine.
