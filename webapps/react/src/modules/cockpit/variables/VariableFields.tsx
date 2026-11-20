import { Checkbox, Select, SelectItem, Stack, TextArea, TextInput, Toggle } from '@carbon/react';
import { useTranslation } from 'react-i18next';
import { BINARY_TYPES, EDITABLE_TYPES, isBinary, type DraftProblem, type VariableDraft } from './variable-draft';

interface VariableFieldsProps {
  /** prefix of the input ids */
  id: string;
  draft: VariableDraft;
  onChange: (draft: VariableDraft) => void;
  problem: DraftProblem;
  /** a new variable: its name is entered too */
  withName?: boolean;
  /**
   * an existing variable: it can be set to null keeping its type, and it can
   * become a binary one (the content is then uploaded by the dialog)
   */
  existing?: boolean;
}

/** Name, type and value of a variable, the value input fitting the type (as in the classic Cockpit dialogs). */
export function VariableFields({ id, draft, onChange, problem, withName, existing }: VariableFieldsProps) {
  const { t } = useTranslation('cockpit');
  const set = (changes: Partial<VariableDraft>) => onChange({ ...draft, ...changes });
  const invalidText = problem && problem !== 'required' ? t(problem.key, problem.values) : undefined;
  const types = existing ? [...EDITABLE_TYPES, ...BINARY_TYPES] : EDITABLE_TYPES;
  const withoutValue = draft.type === 'Null' || draft.isNull || isBinary(draft.type);

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
          set({
            type: event.target.value,
            // Boolean starts as true, as in the classic Cockpit
            text: event.target.value === 'Boolean' ? 'true' : draft.type === 'Boolean' ? '' : draft.text,
            isNull: draft.isNull && event.target.value !== 'Null' && !isBinary(event.target.value),
          })
        }
      >
        {(types.includes(draft.type) ? types : [draft.type, ...types]).map((type) => (
          <SelectItem key={type} value={type} text={type} />
        ))}
      </Select>
      {existing && draft.type !== 'Null' && !isBinary(draft.type) && (
        <Checkbox
          id={`${id}-null`}
          labelText={t('CAM_WIDGET_VARIABLE_SET_VALUE_NULL')}
          checked={draft.isNull}
          onChange={(_, { checked }) => set({ isNull: checked, text: !checked && draft.type === 'Boolean' && !draft.text ? 'true' : draft.text })}
        />
      )}
      {draft.type === 'Boolean' && !withoutValue && (
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
      {['Object', 'Json', 'Xml'].includes(draft.type) && !withoutValue && (
        <TextArea
          id={`${id}-value`}
          labelText={t(draft.type === 'Object' ? 'VARIABLE_SERIALIZED_VALUE' : 'VARIABLE_ADD_VARIABLE_VALUE')}
          rows={8}
          className="cz-code-input"
          value={draft.text}
          invalid={!!invalidText}
          invalidText={invalidText}
          onChange={(event) => set({ text: event.target.value })}
        />
      )}
      {!['Boolean', 'Object', 'Json', 'Xml'].includes(draft.type) && !withoutValue && (
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
