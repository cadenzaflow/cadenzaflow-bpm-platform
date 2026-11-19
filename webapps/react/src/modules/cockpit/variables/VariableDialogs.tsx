import { useState } from 'react';
import { ContentSwitcher, FileUploader, InlineNotification, Modal, SkeletonText, Stack, Switch, TextArea } from '@carbon/react';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../../../shared/api/client';
import { notify } from '../../../shared/notifications';
import {
  useAddVariable,
  useDeleteVariable,
  useDeserializedValue,
  useSaveDeserialized,
  useSaveVariable,
  useUploadVariable,
  type VariableInstance,
} from './api';
import { draftOf, emptyDraft, isBinary, jsonProblem, problemOf, valueOf } from './variable-draft';
import { VariableFields } from './VariableFields';

const isAuthorizationError = (error: Error) => error instanceof ApiError && error.type === 'AuthorizationException';

interface VariableDialogProps {
  engine: string;
  variable: VariableInstance;
  onClose: () => void;
}

/**
 * Changes type and value of a variable. An Object is changed as it is stored
 * (with a warning) or as the engine deserializes it, as in the classic
 * inspect dialog; a variable that becomes a binary one takes a file.
 */
export function EditVariableModal({ engine, variable, onClose }: VariableDialogProps) {
  const { t } = useTranslation('cockpit');
  const save = useSaveVariable(engine);
  const upload = useUploadVariable(engine);
  const saveDeserialized = useSaveDeserialized(engine);
  const [draft, setDraft] = useState(() => draftOf(variable));
  const [file, setFile] = useState<File | null>(null);
  const [view, setView] = useState<'serialized' | 'deserialized'>('serialized');
  /** the deserialized value as edited; null while it is as loaded */
  const [json, setJson] = useState<string | null>(null);

  const isObject = variable.type === 'Object' && draft.type === 'Object';
  const editsDeserialized = isObject && view === 'deserialized';
  const deserialized = useDeserializedValue(engine, variable, editsDeserialized);
  const deserializationError = deserialized.data?.errorMessage ?? deserialized.error?.message;
  const loadedJson = deserialized.data && !deserializationError ? JSON.stringify(deserialized.data.value) : null;
  const jsonError = json === null ? null : jsonProblem(json);
  const problem = problemOf(draft, false);

  const unchanged = json === null || json === loadedJson;
  const blocked = editsDeserialized ? unchanged || !!jsonError || !!deserializationError : isBinary(draft.type) ? !file : !!problem;
  const outcome = {
    onSuccess: () => {
      notify({
        kind: 'success' as const,
        title: t('PLUGIN_VARIABLE_INSTANCES_STATUS_VARIABLE'),
        subtitle: t('PLUGIN_VARIABLE_INSTANCES_MESSAGES_ADD_1', { name: variable.name }),
      });
      onClose();
    },
    onError: (error: Error) =>
      notify({
        kind: 'error' as const,
        title: t('PLUGIN_VARIABLE_INSTANCES_STATUS_VARIABLE'),
        subtitle: isAuthorizationError(error)
          ? t('PLUGIN_VARIABLE_INSTANCES_MESSAGES_ERROR_2', { message: error.message })
          : `${t('PLUGIN_VARIABLE_INSTANCES_MESSAGES_ERROR_1', { name: variable.name })} ${error.message}`,
      }),
  };

  return (
    <Modal
      open
      modalLabel={t('PLUGIN_VARIABLE_INSTANCES_STATUS_VARIABLE')}
      modalHeading={variable.name}
      primaryButtonText={t('VARIABLE_INSPECT_CHANGE')}
      secondaryButtonText={t('VARIABLE_INSPECT_CLOSE')}
      primaryButtonDisabled={blocked || save.isPending || upload.isPending || saveDeserialized.isPending}
      onRequestClose={onClose}
      onRequestSubmit={() => {
        if (editsDeserialized) {
          saveDeserialized.mutate({ variable, json: json ?? '' }, outcome);
        } else if (isBinary(draft.type)) {
          if (file) {
            upload.mutate({ variable, file, type: draft.type }, outcome);
          }
        } else {
          save.mutate({ variable, value: valueOf(draft) }, outcome);
        }
      }}
    >
      <Stack gap={5}>
        {variable.type === 'Object' && (
          <InlineNotification kind="warning" lowContrast hideCloseButton title={t('VARIABLE_INSPECT_WARNING')}>
            {t('VARIABLE_INSPECT_WARNING_MESSAGE')}
          </InlineNotification>
        )}
        {isObject && (
          <ContentSwitcher
            size="sm"
            selectedIndex={view === 'serialized' ? 0 : 1}
            onChange={({ name }) => setView(name === 'deserialized' ? 'deserialized' : 'serialized')}
          >
            <Switch name="serialized" text={t('VARIABLE_INSPECT_SERIALIZED')} />
            <Switch name="deserialized" text={t('VARIABLE_INSPECT_DESERIALIZED')} />
          </ContentSwitcher>
        )}
        {editsDeserialized && deserialized.isPending && <SkeletonText paragraph lineCount={4} />}
        {editsDeserialized && deserializationError && (
          <InlineNotification kind="error" lowContrast hideCloseButton title={t('VARIABLE_INSPECT_DESERIALIZED_ERROR')} subtitle={deserializationError} />
        )}
        {editsDeserialized && loadedJson !== null && (
          <TextArea
            id="cz-edit-variable-deserialized"
            labelText={t('VARIABLE_INSPECT_DESERIALIZED')}
            rows={8}
            className="cz-code-input"
            value={json ?? loadedJson}
            invalid={!!jsonError}
            invalidText={jsonError ? t('VARIABLE_INSPECT_MESSAGE_ERR_1', { exception: jsonError }) : undefined}
            onChange={(event) => setJson(event.target.value)}
          />
        )}
        {!editsDeserialized && (
          <>
            <VariableFields id="cz-edit-variable" draft={draft} onChange={setDraft} problem={problem} existing />
            {isBinary(draft.type) && (
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
            )}
          </>
        )}
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
