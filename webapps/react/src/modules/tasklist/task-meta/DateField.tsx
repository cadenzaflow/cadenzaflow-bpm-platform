import { useState } from 'react';
import { Button, TextInput } from '@carbon/react';
import { Checkmark, Close, Edit } from '@carbon/icons-react';
import { useTranslation } from 'react-i18next';
import { formatDateTime, parseEngineDate } from '../../../shared/format';
import { parseLocalDateTime, toEngineDate, toLocalDateTimeText } from '../../../shared/variables';

interface DateFieldProps {
  id: string;
  label: string;
  /** engine date or null */
  value: string | null;
  setLabel: string;
  resetLabel: string;
  disabled: boolean;
  /** engine date, or null to remove the date */
  onSave: (value: string | null) => Promise<unknown>;
}

/** A task date (due, follow-up) that can be set, changed and removed in place. */
export function DateField({ id, label, value, setLabel, resetLabel, disabled, onSave }: DateFieldProps) {
  const { t, i18n } = useTranslation('tasklist');
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');

  const startEditing = () => {
    const date = parseEngineDate(value);
    // datetime-local wants yyyy-MM-ddTHH:mm
    setText(date ? toLocalDateTimeText(date).substring(0, 16) : '');
    setEditing(true);
  };
  const parsed = parseLocalDateTime(text);
  const save = () => parsed && onSave(toEngineDate(parsed)).then(() => setEditing(false), () => undefined);

  return (
    <div className="cz-task__field">
      <dt>{label}</dt>
      <dd className="cz-task__editable">
        {editing ? (
          <>
            <TextInput
              id={id}
              labelText={label}
              hideLabel
              size="sm"
              type="datetime-local"
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
            <Button kind="ghost" size="sm" hasIconOnly renderIcon={Checkmark} iconDescription={t('SAVE')} disabled={!parsed} onClick={save} />
            <Button kind="ghost" size="sm" hasIconOnly renderIcon={Close} iconDescription={t('CANCEL')} onClick={() => setEditing(false)} />
          </>
        ) : value ? (
          <>
            <span>{formatDateTime(value, i18n.language)}</span>
            {!disabled && (
              <>
                <Button kind="ghost" size="sm" hasIconOnly renderIcon={Edit} iconDescription={setLabel} onClick={startEditing} />
                <Button kind="ghost" size="sm" hasIconOnly renderIcon={Close} iconDescription={resetLabel} onClick={() => onSave(null)} />
              </>
            )}
          </>
        ) : (
          <Button kind="ghost" size="sm" disabled={disabled} onClick={startEditing}>
            {setLabel}
          </Button>
        )}
      </dd>
    </div>
  );
}
