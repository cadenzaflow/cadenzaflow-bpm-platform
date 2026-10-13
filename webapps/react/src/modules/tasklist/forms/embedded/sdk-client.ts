import { engineUrl, request, type QueryParams } from '../../../../shared/api/client';
import type { Variables } from '../../../../shared/variables';

type Done = (error: Error | null, result?: unknown) => void;

/** Thrown back to the form runtime when the submission failed and the user was told already. */
export class ReportedError extends Error {}

function callback(promise: Promise<unknown>, done: Done) {
  promise.then(
    (result) => done(null, result),
    (error: Error) => done(error),
  );
}

/**
 * The part of the camunda-bpm-sdk-js client the embedded-form runtime calls,
 * on top of the webapp's REST client (session cookie, CSRF token). Submitting
 * goes through `submit`, so it shares notifications and list refresh with the
 * other forms.
 */
export function createSdkClient(
  engine: string,
  submit: (variables: Variables, businessKey?: string) => Promise<boolean>,
) {
  const formVariables = (path: string, data: { names: string[]; deserializeValues: boolean }, done: Done) =>
    callback(
      request(engineUrl(engine, `${path}/form-variables`), {
        query: { variableNames: data.names.join(','), deserializeValues: data.deserializeValues },
      }),
      done,
    );
  const submitForm = (data: { variables: Variables; businessKey?: string }, done: Done) =>
    submit(data.variables, data.businessKey).then((sent) =>
      sent ? done(null) : done(new ReportedError('The form could not be submitted')),
    );

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
      if (name === 'process-definition') {
        return {
          formVariables(data: { id: string; names: string[]; deserializeValues: boolean }, done: Done) {
            formVariables(`/process-definition/${encodeURIComponent(data.id)}`, data, done);
          },
          submitForm,
        };
      }
      if (name !== 'task') {
        throw new Error(`The embedded form asked for the unsupported resource "${name}"`);
      }
      const taskPath = (id: string) => `/task/${encodeURIComponent(id)}`;
      return {
        formVariables(data: { id: string; names: string[]; deserializeValues: boolean }, done: Done) {
          formVariables(taskPath(data.id), data, done);
        },
        submitForm,
        bpmnError(
          data: { id: string; errorCode: string; errorMessage?: string; variables: Variables },
          done: Done,
        ) {
          callback(
            request(engineUrl(engine, `${taskPath(data.id)}/bpmnError`), {
              method: 'POST',
              json: { errorCode: data.errorCode, errorMessage: data.errorMessage, variables: data.variables },
            }),
            done,
          );
        },
        bpmnEscalation(data: { id: string; escalationCode: string; variables: Variables }, done: Done) {
          callback(
            request(engineUrl(engine, `${taskPath(data.id)}/bpmnEscalation`), {
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
