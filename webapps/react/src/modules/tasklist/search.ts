/**
 * The Tasklist is a single page; its state lives in the query string so a
 * selected filter, task and tab can be bookmarked and shared:
 * ?filter=<filterId>&task=<taskId>&detailsTab=<tab id>
 * ?processStart=<key>&processTenant=<id> opens the start form of a process
 * (same parameters as the AngularJS Tasklist).
 */
export interface TasklistSearch {
  filter?: string;
  task?: string;
  detailsTab?: string;
  processStart?: string;
  processTenant?: string;
}

const optionalString = (value: unknown) => (typeof value === 'string' && value ? value : undefined);

export function validateTasklistSearch(search: Record<string, unknown>): TasklistSearch {
  return {
    filter: optionalString(search.filter),
    task: optionalString(search.task),
    detailsTab: optionalString(search.detailsTab),
    processStart: optionalString(search.processStart),
    processTenant: optionalString(search.processTenant),
  };
}
