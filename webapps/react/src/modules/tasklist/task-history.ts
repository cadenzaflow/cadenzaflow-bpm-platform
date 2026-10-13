import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { engineUrl, request } from '../../shared/api/client';
import { parseEngineDate } from '../../shared/format';

/** GET /history/user-operation: one entry per changed property of an operation. */
export interface UserOperation {
  operationId: string;
  operationType: string;
  userId: string | null;
  timestamp: string;
  property: string | null;
  orgValue: string | null;
  newValue: string | null;
}

/** GET /task/{id}/comment */
export interface TaskComment {
  id: string;
  userId: string | null;
  time: string;
  message: string;
}

export interface Change {
  property: string;
  /** dueDate and followUpDate come as epoch milliseconds */
  isDate: boolean;
  orgValue: string | null;
  newValue: string | null;
}

export type HistoryEvent =
  | { kind: 'operation'; id: string; time: Date; type: string; userId: string | null; changes: Change[] }
  | { kind: 'comment'; id: string; time: Date; userId: string | null; message: string };

export interface HistoryDay {
  /** local date, yyyy-MM-dd */
  day: string;
  events: HistoryEvent[];
}

const DATE_PROPERTIES = ['dueDate', 'followUpDate'];
export const HISTORY_PAGE_SIZE = 50;

const localDay = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/**
 * Groups operations (by operation id) and comments by local day, newest
 * first, like the AngularJS Tasklist's history tab.
 */
export function groupHistory(operations: UserOperation[], comments: TaskComment[]): HistoryDay[] {
  const events: HistoryEvent[] = [];
  const byOperation = new Map<string, Extract<HistoryEvent, { kind: 'operation' }>>();
  for (const entry of operations) {
    let event = byOperation.get(entry.operationId);
    if (!event) {
      event = {
        kind: 'operation',
        id: entry.operationId,
        time: parseEngineDate(entry.timestamp) ?? new Date(0),
        type: entry.operationType,
        userId: entry.userId,
        changes: [],
      };
      byOperation.set(entry.operationId, event);
      events.push(event);
    }
    if (entry.property) {
      event.changes.push({
        property: entry.property,
        isDate: DATE_PROPERTIES.includes(entry.property),
        orgValue: entry.orgValue,
        newValue: entry.newValue,
      });
    }
  }
  for (const comment of comments) {
    events.push({
      kind: 'comment',
      id: comment.id,
      time: parseEngineDate(comment.time) ?? new Date(0),
      userId: comment.userId,
      message: comment.message,
    });
  }

  const days = new Map<string, HistoryEvent[]>();
  for (const event of events.sort((a, b) => b.time.getTime() - a.time.getTime())) {
    const day = localDay(event.time);
    days.set(day, [...(days.get(day) ?? []), event]);
  }
  return [...days.entries()].map(([day, dayEvents]) => ({ day, events: dayEvents }));
}

export function useTaskHistory(engine: string, taskId: string, page: number) {
  return useQuery({
    queryKey: ['task-history', engine, taskId, page],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const [operations, count, comments] = await Promise.all([
        request<UserOperation[]>(engineUrl(engine, '/history/user-operation'), {
          query: { taskId, maxResults: HISTORY_PAGE_SIZE, firstResult: (page - 1) * HISTORY_PAGE_SIZE },
        }),
        request<{ count: number }>(engineUrl(engine, '/history/user-operation/count'), { query: { taskId } }),
        // comments of the task come along on the first page only
        page === 1
          ? request<TaskComment[]>(engineUrl(engine, `/task/${encodeURIComponent(taskId)}/comment`)).catch(() => [])
          : Promise.resolve([]),
      ]);
      return { days: groupHistory(operations, comments), count: count.count };
    },
  });
}
