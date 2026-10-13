import { useState } from 'react';
import { Button, TextInput } from '@carbon/react';
import { Checkmark, Close, Edit } from '@carbon/icons-react';
import { useTranslation } from 'react-i18next';
import { notify } from '../../../../shared/notifications';
import { useSetAssignee, type UserTask } from './api';

/** The assignee of a task, changed in place (empty removes it), as in the classic Cockpit. */
export function AssigneeCell({ engine, task, label }: { engine: string; task: UserTask; label: string }) {
  const { t } = useTranslation('cockpit');
  const setAssignee = useSetAssignee(engine);
  const [draft, setDraft] = useState<string | null>(null);

  if (draft === null) {
    return (
      <span className="cz-inline-edit">
        <span>{task.assignee}</span>
        <Button
          kind="ghost"
          size="sm"
          hasIconOnly
          renderIcon={Edit}
          iconDescription={t('PLUGIN_USER_TASKS_ASSIGNEE')}
          onClick={() => setDraft(task.assignee ?? '')}
        />
      </span>
    );
  }

  const save = () => {
    const userId = draft.trim() || null;
    setAssignee.mutate(
      { taskId: task.id, userId },
      {
        onSuccess: () => {
          notify({
            kind: 'success',
            title: t('PLUGIN_USER_TASKS_STATUS_ASSIGNEE'),
            subtitle: userId
              ? t('PLUGIN_USER_TASKS_MESSAGE_1', { name: label, assignee: userId })
              : t('PLUGIN_USER_TASKS_MESSAGE_2', { name: label }),
          });
          setDraft(null);
        },
        onError: (error) =>
          notify({
            kind: 'error',
            title: t('PLUGIN_USER_TASKS_STATUS_ASSIGNEE'),
            subtitle: userId
              ? t('PLUGIN_USER_TASKS_MESSAGE_3', { name: label, assignee: userId, error: error.message })
              : t('PLUGIN_USER_TASKS_MESSAGE_4', { name: label, error: error.message }),
          }),
      },
    );
  };

  return (
    <form
      className="cz-inline-edit"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <TextInput
        id={`cz-assignee-${task.id}`}
        labelText={t('PLUGIN_USER_TASKS_ASSIGNEE')}
        hideLabel
        size="sm"
        autoFocus
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => event.key === 'Escape' && setDraft(null)}
      />
      <Button kind="ghost" size="sm" hasIconOnly type="submit" renderIcon={Checkmark} iconDescription={t('PLUGIN_USER_TASKS_ASSIGNEE')} disabled={setAssignee.isPending} />
      <Button kind="ghost" size="sm" hasIconOnly renderIcon={Close} iconDescription={t('PLUGIN_IDENTITY_LINKS_CLOSE')} onClick={() => setDraft(null)} />
    </form>
  );
}
