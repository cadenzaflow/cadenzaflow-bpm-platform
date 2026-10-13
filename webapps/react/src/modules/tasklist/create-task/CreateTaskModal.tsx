import { useState } from 'react';
import { Modal, Stack, TextArea, TextInput } from '@carbon/react';
import { useTranslation } from 'react-i18next';
import { notify } from '../../../shared/notifications';
import { useCreateTask } from './api';

const orNull = (value: string) => value.trim() || null;

/** "Create task": a task that belongs to no process. */
export function CreateTaskModal({ engine, onClose }: { engine: string; onClose: () => void }) {
  const { t } = useTranslation('tasklist');
  const createTask = useCreateTask(engine);
  const [name, setName] = useState('');
  const [assignee, setAssignee] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [description, setDescription] = useState('');
  const [touched, setTouched] = useState(false);

  return (
    <Modal
      open
      modalHeading={t('CREATE_TASK')}
      primaryButtonText={t('SAVE')}
      secondaryButtonText={t('CANCEL')}
      primaryButtonDisabled={!name.trim() || createTask.isPending}
      onRequestClose={onClose}
      onRequestSubmit={() =>
        createTask.mutate(
          { name: name.trim(), assignee: orNull(assignee), tenantId: orNull(tenantId), description: orNull(description) },
          {
            onSuccess: onClose,
            onError: (error) => notify({ kind: 'error', title: t('TASK_SAVE_ERROR'), subtitle: error.message }),
          },
        )
      }
    >
      <Stack gap={5}>
        <TextInput
          id="cz-new-task-name"
          labelText={t('NEW_TASK_NAME')}
          value={name}
          data-modal-primary-focus
          invalid={touched && !name.trim()}
          invalidText={t('REQUIRED_FIELD')}
          onChange={(event) => setName(event.target.value)}
          onBlur={() => setTouched(true)}
        />
        <TextInput
          id="cz-new-task-assignee"
          labelText={t('NEW_TASK_ASSIGNEE')}
          value={assignee}
          onChange={(event) => setAssignee(event.target.value)}
        />
        <TextInput
          id="cz-new-task-tenant"
          labelText={t('NEW_TASK_TENANT_ID')}
          value={tenantId}
          onChange={(event) => setTenantId(event.target.value)}
        />
        <TextArea
          id="cz-new-task-description"
          labelText={t('NEW_TASK_DESCRIPTION')}
          rows={4}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </Stack>
    </Modal>
  );
}
