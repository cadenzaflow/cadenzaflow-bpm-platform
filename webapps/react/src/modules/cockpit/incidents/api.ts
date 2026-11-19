import { useMutation, useQueryClient } from '@tanstack/react-query';
import { engineUrl, request } from '../../../shared/api/client';

/** An open incident as the Cockpit plugin API lists it. */
export interface Incident {
  id: string;
  processDefinitionId: string;
  processInstanceId: string;
  incidentTimestamp: string;
  incidentType: string;
  activityId: string;
  failedActivityId: string | null;
  incidentMessage: string | null;
  /** the job or external task id; none on an incident passed up from a called instance */
  configuration: string | null;
  causeIncidentProcessInstanceId: string | null;
  causeIncidentActivityId?: string | null;
  rootCauseIncidentProcessInstanceId: string | null;
  rootCauseIncidentActivityId?: string | null;
  rootCauseIncidentConfiguration: string | null;
  /** the message of the incident this one goes back to; its own message for a root cause */
  rootCauseIncidentMessage?: string | null;
  annotation: string | null;
}

/**
 * What went wrong. An incident passed up from a called instance has no
 * message of its own: it shows the message of its root cause, as the classic
 * Cockpit does.
 */
export const messageOf = (incident: Incident) => incident.rootCauseIncidentMessage || incident.incidentMessage;

/** The incident types that have a job or an external task, with a stack trace. */
export const RETRYABLE = ['failedJob', 'failedExternalTask'];

/** Whether the incident has a job or an external task of its own to retry (as in the classic Cockpit). */
export const canRetry = (incident: Incident) => RETRYABLE.includes(incident.incidentType) && !!incident.configuration;

/** Where the stack trace of an incident's root cause is (a job's stack trace, an external task's error details). */
export function stacktraceUrl(engine: string, incident: Incident): string {
  const id = encodeURIComponent(incident.rootCauseIncidentConfiguration ?? incident.configuration ?? '');
  return incident.incidentType === 'failedExternalTask'
    ? engineUrl(engine, `/external-task/${id}/errorDetails`)
    : engineUrl(engine, `/job/${id}/stacktrace`);
}

/** After a change: lists, statistics and badges of the Cockpit are reloaded. */
export function useInvalidateCockpit(engine: string) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['cockpit', engine] });
}

/**
 * Gives the failed job (optionally with a new due date) or external task of
 * an incident one more retry.
 */
export function useRetry(engine: string) {
  const invalidate = useInvalidateCockpit(engine);
  return useMutation({
    mutationFn: ({ incident, dueDate }: { incident: Incident; dueDate?: string }) =>
      incident.incidentType === 'failedExternalTask'
        ? request<void>(engineUrl(engine, `/external-task/${encodeURIComponent(incident.configuration ?? '')}/retries`), {
            method: 'PUT',
            json: { retries: 1 },
          })
        : request<void>(engineUrl(engine, `/job/${encodeURIComponent(incident.configuration ?? '')}/retries`), {
            method: 'PUT',
            json: dueDate ? { retries: 1, dueDate } : { retries: 1 },
          }),
    onSettled: invalidate,
  });
}

/** Sets an incident's annotation; an empty one removes it. */
export function useAnnotation(engine: string) {
  const invalidate = useInvalidateCockpit(engine);
  return useMutation({
    mutationFn: ({ incident, annotation }: { incident: Incident; annotation: string }) =>
      request<void>(engineUrl(engine, `/incident/${encodeURIComponent(incident.id)}/annotation`), {
        method: annotation ? 'PUT' : 'DELETE',
        json: annotation ? { annotation } : undefined,
      }),
    onSettled: invalidate,
  });
}
