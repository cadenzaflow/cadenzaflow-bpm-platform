import { useState } from 'react';
import { Button, TextInput } from '@carbon/react';
import { Checkmark, Close, Edit } from '@carbon/icons-react';
import { useTranslation } from 'react-i18next';
import { useAuthentication } from '../../../shared/auth/authentication';
import { displayName } from '../../../shared/format';
import { notify } from '../../../shared/notifications';
import { useShortcut } from '../../../shared/shortcuts';
import { useAssignTask, type TaskDetails } from '../api';
import { TASKLIST_SHORTCUTS } from '../shortcuts/shortcuts';
import { useSetAssignee, userExists } from './api';

/**
 * Claim and unclaim for the current user; give the task to another user
 * (checked to exist) or take the assignee away.
 */
export function AssigneeField({ engine, details: { task, users } }: { engine: string; details: TaskDetails }) {
  const { t } = useTranslation('tasklist');
  const userId = useAuthentication(engine).data?.userId ?? null;
  const claim = useAssignTask(engine, task.id);
  const setAssignee = useSetAssignee(engine, task.id);
  const [editing, setEditing] = useState(false);
  const [newAssignee, setNewAssignee] = useState('');
  const [unknownUser, setUnknownUser] = useState(false);
  const busy = claim.isPending || setAssignee.isPending;

  const failed = (key: string) => (error: Error) => notify({ kind: 'error', title: t(key), subtitle: error.message });
  const claimForMe = () => claim.mutate(userId, { onError: failed('CLAIM_ERROR') });
  useShortcut(TASKLIST_SHORTCUTS.claimTask.key, claimForMe, !task.assignee && !!userId && !busy);

  const save = async () => {
    const id = newAssignee.trim();
    if (!(await userExists(engine, id).catch(() => false))) {
      setUnknownUser(true);
      return;
    }
    setAssignee.mutate(id, {
      onSuccess: () => {
        notify({ kind: 'success', title: t('ASSIGNED_OK') });
        setEditing(false);
      },
      onError: failed('ASSIGNED_ERROR'),
    });
  };

  if (editing) {
    return (
      <div className="cz-task__assignment">
        <TextInput
          id="cz-task-assignee"
          labelText={t('ASSIGNEE')}
          hideLabel
          size="sm"
          placeholder={t('ASSIGNEE')}
          value={newAssignee}
          invalid={unknownUser}
          invalidText={t('ASSIGNEE_NOT_FOUND')}
          onChange={(event) => {
            setNewAssignee(event.target.value);
            setUnknownUser(false);
          }}
          onKeyDown={(event) => event.key === 'Enter' && newAssignee.trim() && save()}
        />
        <Button kind="ghost" size="sm" hasIconOnly renderIcon={Checkmark} iconDescription={t('SAVE')} disabled={!newAssignee.trim() || busy} onClick={save} />
        <Button kind="ghost" size="sm" hasIconOnly renderIcon={Close} iconDescription={t('CANCEL')} onClick={() => setEditing(false)} />
      </div>
    );
  }

  return (
    <div className="cz-task__assignment">
      <span>
        {t('ASSIGNEE')}: {task.assignee ? displayName(users.get(task.assignee), task.assignee) : t('UNASSIGNED')}
      </span>
      {!task.assignee && userId && (
        <Button size="sm" kind="primary" disabled={busy} onClick={claimForMe}>
          {t('CLAIM_TASK')}
        </Button>
      )}
      {task.assignee && (
        <Button
          kind="ghost"
          size="sm"
          hasIconOnly
          renderIcon={Edit}
          iconDescription={t('CHANGE_ASSIGNEE')}
          onClick={() => {
            setNewAssignee(task.assignee ?? '');
            setEditing(true);
          }}
        />
      )}
      {task.assignee && task.assignee === userId && (
        <Button size="sm" kind="tertiary" disabled={busy} onClick={() => claim.mutate(null, { onError: failed('UNCLAIM_ERROR') })}>
          {t('UNCLAIM_TASK')}
        </Button>
      )}
      {task.assignee && task.assignee !== userId && (
        <Button
          size="sm"
          kind="tertiary"
          disabled={busy}
          onClick={() =>
            setAssignee.mutate(null, {
              onSuccess: () => notify({ kind: 'success', title: t('ASSIGNEE_RESET_OK') }),
              onError: failed('ASSIGNEE_RESET_ERROR'),
            })
          }
        >
          {t('RESET_TASK_ASSIGNEE')}
        </Button>
      )}
    </div>
  );
}
