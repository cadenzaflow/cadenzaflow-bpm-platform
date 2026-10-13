import { useState } from 'react';
import { FileUploader, InlineNotification, Modal, Stack } from '@carbon/react';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../../../shared/api/client';
import { notify } from '../../../shared/notifications';
import { useAddVariable, useDeleteVariable, useSaveVariable, useUploadVariable, type VariableInstance } from './api';
import { draftOf, emptyDraft, problemOf, valueOf } from './variable-draft';
import { VariableFields } from './VariableFields';

const isAuthorizationError = (error: Error) => error instanceof ApiError && error.type === 'AuthorizationException';

interface VariableDialogProps {
  engine: string;
  variable: VariableInstance;
  onClose: () => void;
}

/** Changes type and value of a variable; an Object's serialized value with a warning, as in the classic inspect dialog. */
export function EditVariableModal({ engine, variable, onClose }: VariableDialogProps) {
  const { t } = useTranslation('cockpit');
  const save = useSaveVariable(engine);
  const [draft, setDraft] = useState(() => draftOf(variable));
  const problem = problemOf(draft, false);

  return (
    <Modal
      open
      modalLabel={t('PLUGIN_VARIABLE_INSTANCES_STATUS_VARIABLE')}
      modalHeading={variable.name}
      primaryButtonText={t('VARIABLE_INSPECT_CHANGE')}
      secondaryButtonText={t('VARIABLE_INSPECT_CLOSE')}
      primaryButtonDisabled={!!problem || save.isPending}
      onRequestClose={onClose}
      onRequestSubmit={() =>
        save.mutate(
          { variable, value: valueOf(draft) },
          {
            onSuccess: () => {
              notify({
                kind: 'success',
                title: t('PLUGIN_VARIABLE_INSTANCES_STATUS_VARIABLE'),
                subtitle: t('PLUGIN_VARIABLE_INSTANCES_MESSAGES_ADD_1', { name: variable.name }),
              });
              onClose();
            },
            onError: (error) =>
              notify({
                kind: 'error',
                title: t('PLUGIN_VARIABLE_INSTANCES_STATUS_VARIABLE'),
                subtitle: isAuthorizationError(error)
                  ? t('PLUGIN_VARIABLE_INSTANCES_MESSAGES_ERROR_2', { message: error.message })
                  : `${t('PLUGIN_VARIABLE_INSTANCES_MESSAGES_ERROR_1', { name: variable.name })} ${error.message}`,
              }),
          },
        )
      }
    >
      <Stack gap={5}>
        {variable.type === 'Object' && (
          <InlineNotification kind="warning" lowContrast hideCloseButton title={t('VARIABLE_INSPECT_WARNING')}>
            {t('VARIABLE_INSPECT_WARNING_MESSAGE')}
          </InlineNotification>
        )}
        <VariableFields id="cz-edit-variable" draft={draft} onChange={setDraft} problem={problem} />
      </Stack>
    </Modal>
  );
}

export function DeleteVariableModal({ engine, variable, onClose }: VariableDialogProps) {
  const { t } = useTranslation('cockpit');
  const remove = useDeleteVariable(engine);

  return (
    <Modal
      open
      danger
      modalLabel={t('PLUGIN_VARIABLE_INSTANCES_STATUS_VARIABLE')}
      modalHeading={t('PLUGIN_VARIABLE_DELETE')}
      primaryButtonText={t('PLUGIN_VARIABLE_DELETE')}
      secondaryButtonText={t('PLUGIN_VARIABLE_ABORT')}
      primaryButtonDisabled={remove.isPending}
      onRequestClose={onClose}
      onRequestSubmit={() =>
        remove.mutate(variable, {
          onSuccess: () => {
            notify({
              kind: 'success',
              title: t('PLUGIN_VARIABLE_INSTANCES_STATUS_VARIABLE'),
              subtitle: t('PLUGIN_VARIABLE_INSTANCES_MESSAGES_ADD_0', { name: variable.name }),
            });
            onClose();
          },
          onError: (error) =>
            notify({
              kind: 'error',
              title: t('PLUGIN_VARIABLE_INSTANCES_STATUS_VARIABLE'),
              subtitle: isAuthorizationError(error)
                ? t('PLUGIN_VARIABLE_INSTANCES_MESSAGES_ERROR_3', { message: error.message })
                : `${t('PLUGIN_VARIABLE_INSTANCES_MESSAGES_ERROR_0', { name: variable.name })} ${error.message}`,
            }),
        })
      }
    >
      <p>{t('PLUGIN_VARIABLE_DELETE_DIALOGUE', { name: variable.name })}</p>
    </Modal>
  );
}

/** New content for a binary (Bytes or File) variable. */
export function UploadVariableModal({ engine, variable, onClose }: VariableDialogProps) {
  const { t } = useTranslation('cockpit');
  const upload = useUploadVariable(engine);
  const [file, setFile] = useState<File | null>(null);

  return (
    <Modal
      open
      modalLabel={variable.name}
      modalHeading={t('VARIABLE_UPLOAD_MODAL_TITLE')}
      primaryButtonText={t('VARIABLE_UPLOAD_UPLOAD')}
      secondaryButtonText={t('VARIABLE_UPLOAD_CLOSE')}
      primaryButtonDisabled={!file || upload.isPending}
      onRequestClose={onClose}
      onRequestSubmit={() =>
        file &&
        upload.mutate(
          { variable, file },
          {
            onSuccess: () => {
              notify({ kind: 'success', title: t('PLUGIN_VARIABLE_INSTANCES_STATUS_VARIABLE'), subtitle: t('VARIABLE_UPLOAD_MESSAGE_ADD') });
              onClose();
            },
            onError: (error) =>
              notify({
                kind: 'error',
                title: t('PLUGIN_VARIABLE_INSTANCES_STATUS_VARIABLE'),
                subtitle: `${t('VARIABLE_UPLOAD_MESSAGE_ERR')} ${error.message}`,
              }),
          },
        )
      }
    >
      <FileUploader
        labelTitle={t('VARIABLE_UPLOAD_FILE')}
        labelDescription={t('VARIABLE_UPLOAD_SELECT_FILE')}
        buttonLabel={t('VARIABLE_UPLOAD_FILE')}
        buttonKind="tertiary"
        filenameStatus="edit"
        iconDescription={t('VARIABLE_UPLOAD_CLOSE')}
        onChange={(event) => setFile((event.target as HTMLInputElement).files?.[0] ?? null)}
        onDelete={() => setFile(null)}
      />
    </Modal>
  );
}

/** A new variable on the process instance (the classic "Add Variable" action). */
export function AddVariableModal({ engine, processInstanceId, onClose }: { engine: string; processInstanceId: string; onClose: () => void }) {
  const { t } = useTranslation('cockpit');
  const add = useAddVariable(engine, processInstanceId);
  const [draft, setDraft] = useState(emptyDraft);
  const problem = problemOf(draft, true);
  const name = draft.name.trim();

  return (
    <Modal
      open
      modalHeading={t('VARIABLE_ADD_MODAL_TITLE_PROCESS')}
      primaryButtonText={t('VARIABLE_ADD_ADD')}
      secondaryButtonText={t('VARIABLE_ADD_CLOSE')}
      primaryButtonDisabled={!!problem || add.isPending}
      onRequestClose={onClose}
      onRequestSubmit={() =>
        add.mutate(
          { name, value: valueOf(draft) },
          {
            onSuccess: () => {
              notify({ kind: 'success', title: t('VARIABLE_ADD_MESSAGE_STATUS_FINISHED'), subtitle: t('VARIABLE_ADD_MESSAGE_MESSAGE_ADD', { name }) });
              onClose();
            },
            onError: (error) =>
              notify({
                kind: 'error',
                title: t('VARIABLE_ADD_MESSAGE_STATUS_FINISHED'),
                subtitle: t('VARIABLE_ADD_MESSAGE_MESSAGE_ERROR', { message: error.message }),
              }),
          },
        )
      }
    >
      <VariableFields id="cz-add-variable" draft={draft} onChange={setDraft} problem={problem} withName />
    </Modal>
  );
}
