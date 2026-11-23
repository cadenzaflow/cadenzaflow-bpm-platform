import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { DEPLOYMENT_NAME, RESOURCES } from './processes';

/** The server under test, without a trailing slash. */
export const SERVER = (process.env.E2E_SERVER ?? 'http://localhost:8080').replace(/\/$/, '');
export const REST = `${SERVER}/engine-rest`;

/** A business key (and name) that tells the data of this run from that of earlier runs on the same engine. */
export const runKey = (name: string) => `${name}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;

export interface Variable {
  value: unknown;
  type?: string;
}

/** The engine's REST API: what the tests prepare and what they check afterwards. */
export class Engine {
  constructor(private readonly request: APIRequestContext) {}

  async get<T = any>(path: string): Promise<T> {
    const response = await this.request.get(`${REST}${path}`);
    expect(response.status(), `GET ${path}`).toBe(200);
    return response.json();
  }

  async post<T = any>(path: string, data?: unknown): Promise<T | undefined> {
    const response = await this.request.post(`${REST}${path}`, { data: data ?? {} });
    expect([200, 204], `POST ${path}: ${response.status()} ${await response.text()}`).toContain(response.status());
    return response.status() === 200 ? response.json() : undefined;
  }

  async put(path: string, data: unknown): Promise<void> {
    const response = await this.request.put(`${REST}${path}`, { data });
    expect([200, 204], `PUT ${path}: ${response.status()} ${await response.text()}`).toContain(response.status());
  }

  async delete(path: string): Promise<number> {
    return (await this.request.delete(`${REST}${path}`)).status();
  }

  /** Deploys the processes of the tests; the engine keeps what it has already. */
  async deployTestProcesses(): Promise<void> {
    const multipart: Record<string, string | { name: string; mimeType: string; buffer: Buffer }> = {
      'deployment-name': DEPLOYMENT_NAME,
      'enable-duplicate-filtering': 'true',
      'deploy-changed-only': 'true',
      'deployment-source': 'e2e tests',
    };
    for (const [name, content] of Object.entries(RESOURCES)) {
      multipart[name] = { name, mimeType: 'application/octet-stream', buffer: Buffer.from(content, 'utf-8') };
    }
    const response = await this.request.post(`${REST}/deployment/create`, { multipart });
    expect(response.status(), `deployment: ${await response.text()}`).toBe(200);
  }

  /** Starts a process instance and returns its id. */
  async start(key: string, businessKey: string, variables: Record<string, Variable> = {}): Promise<string> {
    const instance = await this.post<{ id: string }>(`/process-definition/key/${key}/start`, { businessKey, variables });
    return instance!.id;
  }

  async definitionId(key: string): Promise<string> {
    return (await this.get<{ id: string }>(`/process-definition/key/${key}`)).id;
  }

  /** The open tasks of a process instance. */
  tasks(processInstanceId: string): Promise<{ id: string; name: string; assignee: string | null; due: string | null }[]> {
    return this.get(`/task?processInstanceId=${processInstanceId}`);
  }

  async variable(processInstanceId: string, name: string): Promise<unknown> {
    const variables = await this.get<Record<string, Variable>>(`/process-instance/${processInstanceId}/variables`);
    return variables[name]?.value;
  }

  /** The state of an instance in the history: ACTIVE, SUSPENDED, COMPLETED, EXTERNALLY_TERMINATED, ... */
  async state(processInstanceId: string): Promise<string> {
    return (await this.get<{ state: string }>(`/history/process-instance/${processInstanceId}`)).state;
  }

  /**
   * Starts e2e-failing and lets its job fail for good: the timer job is run,
   * the service task after it throws, and the retries are set to none. The
   * instance has an incident then, and the job an exception.
   */
  async startFailed(businessKey: string): Promise<{ instance: string; job: string }> {
    const instance = await this.start('e2e-failing', businessKey);
    const [job] = await this.get<{ id: string }[]>(`/job?processInstanceId=${instance}`);
    const run = await this.request.post(`${REST}/job/${job.id}/execute`, { data: {} });
    expect(run.status(), 'the job fails').toBeGreaterThanOrEqual(400);
    await this.put(`/job/${job.id}/retries`, { retries: 0 });
    return { instance, job: job.id };
  }

  /** Removes the running instances with this business key (best effort, to leave the engine tidy). */
  async removeInstances(businessKey: string): Promise<void> {
    const instances = await this.get<{ id: string }[]>(`/process-instance?businessKey=${encodeURIComponent(businessKey)}`);
    for (const instance of instances) {
      await this.delete(`/process-instance/${instance.id}?skipCustomListeners=true&skipIoMappings=true`);
    }
  }
}

export type App = 'cockpit' | 'tasklist' | 'admin' | 'welcome';

/** Opens a page of the React webapps and logs in when the login page comes up. */
export async function open(page: Page, path: string, user = 'demo', password = 'demo'): Promise<void> {
  await page.goto(path);
  const username = page.getByLabel('Username');
  const header = page.getByRole('banner');
  await expect(username.or(header).first()).toBeVisible();
  if (await username.isVisible()) {
    await username.fill(user);
    await page.getByRole('textbox', { name: 'Password' }).fill(password);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(header).toBeVisible();
  }
}

/** A message the app shows after an action. */
export const notification = (page: Page, text: string | RegExp) => page.locator('.cz-notifications').getByText(text).first();
