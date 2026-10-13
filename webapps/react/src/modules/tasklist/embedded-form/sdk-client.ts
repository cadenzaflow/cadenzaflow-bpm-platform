import { engineUrl, request, type QueryParams } from '../../../shared/api/client';
import type { Variables } from '../../../shared/variables';

type Done = (error: Error | null, result?: unknown) => void;

/** Thrown back to the form runtime when the completion failed and the user was told already. */
export class ReportedError extends Error {}

const taskPath = (id: string, path: string) => `/task/${encodeURIComponent(id)}${path}`;

function callback(promise: Promise<unknown>, done: Done) {
  promise.then(
    (result) => done(null, result),
    (error: Error) => done(error),
  );
}

/**
 * The part of the camunda-bpm-sdk-js client the embedded-form runtime calls,
 * on top of the webapp's REST client (session cookie, CSRF token). Completing
 * goes through `complete`, so it shares notifications and list refresh with
 * the other forms.
 */
export function createSdkClient(engine: string, complete: (variables: Variables) => Promise<boolean>) {
  return {
    baseUrl: engineUrl(engine, ''),
    http: {
      load(url: string, options: { accept?: string; data?: QueryParams; done: Done }) {
        callback(
          request<string>(url, { query: options.data, accept: options.accept ?? '*/*', responseType: 'text' }),
          options.done,
        );
      },
    },
    resource(name: string) {
      if (name !== 'task') {
        throw new Error(`The embedded form asked for the unsupported resource "${name}"`);
      }
      return {
        formVariables(data: { id: string; names: string[]; deserializeValues: boolean }, done: Done) {
          callback(
            request(engineUrl(engine, taskPath(data.id, '/form-variables')), {
              query: { variableNames: data.names.join(','), deserializeValues: data.deserializeValues },
            }),
            done,
          );
        },
        submitForm(data: { variables: Variables }, done: Done) {
          complete(data.variables).then((completed) =>
            completed ? done(null) : done(new ReportedError('The task could not be completed')),
          );
        },
        bpmnError(
          data: { id: string; errorCode: string; errorMessage?: string; variables: Variables },
          done: Done,
        ) {
          callback(
            request(engineUrl(engine, taskPath(data.id, '/bpmnError')), {
              method: 'POST',
              json: { errorCode: data.errorCode, errorMessage: data.errorMessage, variables: data.variables },
            }),
            done,
          );
        },
        bpmnEscalation(data: { id: string; escalationCode: string; variables: Variables }, done: Done) {
          callback(
            request(engineUrl(engine, taskPath(data.id, '/bpmnEscalation')), {
              method: 'POST',
              json: { escalationCode: data.escalationCode, variables: data.variables },
            }),
            done,
          );
        },
      };
    },
  };
}
