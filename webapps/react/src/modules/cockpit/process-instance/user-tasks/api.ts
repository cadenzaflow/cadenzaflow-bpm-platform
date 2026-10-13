import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { engineUrl, request } from '../../../../shared/api/client';
import { useInvalidateCockpit } from '../../incidents/api';

/** A user task of the instance as the engine REST API lists it. */
export interface UserTask {
  id: string;
  name: string | null;
  taskDefinitionKey: string;
  executionId: string;
  assignee: string | null;
  owner: string | null;
  created: string;
  due: string | null;
  followUp: string | null;
  priority: number;
  delegationState: string | null;
}

export interface IdentityLink {
  type: string;
  userId: string | null;
  groupId: string | null;
}

/** Candidate groups or candidate users, as the identity links dialog manages them. */
export type LinkKey = 'groupId' | 'userId';

const taskUrl = (engine: string, taskId: string, path = '') => engineUrl(engine, `/task/${encodeURIComponent(taskId)}${path}`);

/** Sets the assignee to another user, or removes it (null). */
export function useSetAssignee(engine: string) {
  const invalidate = useInvalidateCockpit(engine);
  return useMutation({
    mutationFn: ({ taskId, userId }: { taskId: string; userId: string | null }) =>
      request<void>(taskUrl(engine, taskId, '/assignee'), { method: 'POST', json: { userId } }),
    onSettled: invalidate,
  });
}

/** The links of one kind (groups or users), without assignee and owner, which are links too. */
export function useIdentityLinks(engine: string, taskId: string, key: LinkKey) {
  return useQuery({
    queryKey: ['cockpit', engine, 'identity-links', taskId, key],
    queryFn: async () =>
      (await request<IdentityLink[]>(taskUrl(engine, taskId, '/identity-links'))).filter(
        (link) => link[key] && link.type !== 'assignee' && link.type !== 'owner',
      ),
  });
}

/** Adds a candidate link, or removes the given link. */
export function useChangeIdentityLink(engine: string, taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ link, remove }: { link: Partial<IdentityLink>; remove?: boolean }) =>
      request<void>(taskUrl(engine, taskId, remove ? '/identity-links/delete' : '/identity-links'), { method: 'POST', json: link }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['cockpit', engine, 'identity-links', taskId] }),
  });
}
