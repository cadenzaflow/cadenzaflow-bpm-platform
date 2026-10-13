import { Select, SelectItem, Stack, TextArea, TextInput, Toggle } from '@carbon/react';
import { useTranslation } from 'react-i18next';
import { EDITABLE_TYPES, type DraftProblem, type VariableDraft } from './variable-draft';

interface VariableFieldsProps {
  /** prefix of the input ids */
  id: string;
  draft: VariableDraft;
  onChange: (draft: VariableDraft) => void;
  problem: DraftProblem;
  /** a new variable: its name is entered too */
  withName?: boolean;
}

/** Name, type and value of a variable, the value input fitting the type (as in the classic Cockpit dialogs). */
export function VariableFields({ id, draft, onChange, problem, withName }: VariableFieldsProps) {
  const { t } = useTranslation('cockpit');
  const set = (changes: Partial<VariableDraft>) => onChange({ ...draft, ...changes });
  const invalidText = problem && problem !== 'required' ? t(problem.key, problem.values) : undefined;

  return (
    <Stack gap={5}>
      {withName && (
        <TextInput
          id={`${id}-name`}
          labelText={t('VARIABLE_ADD_VARIABLE_NAME')}
          value={draft.name}
          onChange={(event) => set({ name: event.target.value })}
          data-modal-primary-focus
        />
      )}
      <Select
        id={`${id}-type`}
        labelText={t('VARIABLE_ADD_VARIABLE_TYPE')}
        value={draft.type}
        // switching between Boolean and the other types starts with a fitting value
        onChange={(event) =>
          set({ type: event.target.value, text: event.target.value === 'Boolean' ? 'false' : draft.type === 'Boolean' ? '' : draft.text })
        }
      >
        {(EDITABLE_TYPES.includes(draft.type) ? EDITABLE_TYPES : [draft.type, ...EDITABLE_TYPES]).map((type) => (
          <SelectItem key={type} value={type} text={type} />
        ))}
      </Select>
      {draft.type === 'Boolean' && (
        <Toggle
          id={`${id}-value`}
          labelText={t('VARIABLE_ADD_VARIABLE_VALUE')}
          labelA="false"
          labelB="true"
          toggled={draft.text === 'true'}
          onToggle={(checked) => set({ text: String(checked) })}
        />
      )}
      {draft.type === 'Object' && (
        <>
          <TextInput
            id={`${id}-object-type`}
            labelText={t('VARIABLE_OBJECT_TYPE_NAME')}
            value={draft.objectTypeName}
            onChange={(event) => set({ objectTypeName: event.target.value })}
          />
          <TextInput
            id={`${id}-format`}
            labelText={t('VARIABLE_SERIALIZATION_DATA_FORMAT')}
            placeholder="application/json"
            value={draft.serializationDataFormat}
            onChange={(event) => set({ serializationDataFormat: event.target.value })}
          />
        </>
      )}
      {['Object', 'Json', 'Xml'].includes(draft.type) && (
        <TextArea
          id={`${id}-value`}
          labelText={t(draft.type === 'Object' ? 'VARIABLE_SERIALIZED_VALUE' : 'VARIABLE_ADD_VARIABLE_VALUE')}
          rows={8}
          className="cz-code-input"
          value={draft.text}
          onChange={(event) => set({ text: event.target.value })}
        />
      )}
      {!['Boolean', 'Null', 'Object', 'Json', 'Xml'].includes(draft.type) && (
        <TextInput
          id={`${id}-value`}
          labelText={t('VARIABLE_ADD_VARIABLE_VALUE')}
          placeholder={draft.type === 'Date' ? 'yyyy-MM-ddTHH:mm:ss' : undefined}
          value={draft.text}
          invalid={!!invalidText}
          invalidText={invalidText}
          onChange={(event) => set({ text: event.target.value })}
        />
      )}
    </Stack>
  );
}
