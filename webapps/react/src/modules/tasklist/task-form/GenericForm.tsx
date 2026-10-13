import { useState } from 'react';
import { Button, Checkbox, Link, Select, SelectItem, Stack, TextInput } from '@carbon/react';
import { Add, TrashCan } from '@carbon/icons-react';
import { useTranslation } from 'react-i18next';
import { engineUrl } from '../../../shared/api/client';
import { parseEngineDate } from '../../../shared/format';
import { notify } from '../../../shared/notifications';
import {
  PRIMITIVE_TYPES,
  isPrimitiveType,
  toLocalDateTimeText,
  toVariableValue,
  validateValue,
  type Variables,
} from '../../../shared/variables';
import { fetchFormVariables, useBusinessKey } from './api';
import { FormActions } from './FormActions';
import type { FormProps } from './TaskFormTab';

interface Row {
  id: number;
  name: string;
  type: string;
  value: string | boolean;
  /** loaded from the task: name and type cannot change */
  loaded?: boolean;
  /** objects and files are passed through unchanged */
  readOnly?: boolean;
  valueInfo?: Record<string, unknown>;
  touched?: boolean;
}

let nextRowId = 1;

/** Errors of a row as i18n keys, by field. */
export function rowErrors(row: Row, rows: Row[]): { name?: string; type?: string; value?: string } {
  const errors: { name?: string; type?: string; value?: string } = {};
  if (!row.name.trim()) {
    errors.name = 'REQUIRED_FIELD';
  } else if (rows.some((other) => other !== row && other.name.trim() === row.name.trim())) {
    errors.name = 'REQUIRE_UNIQUE_NAME';
  }
  if (!row.type) {
    errors.type = 'REQUIRED_FIELD';
  } else if (isPrimitiveType(row.type)) {
    errors.value = validateValue(row.type, row.value) ?? undefined;
  }
  return errors;
}

export function toVariables(rows: Row[]): Variables {
  const variables: Variables = {};
  for (const row of rows) {
    if (isPrimitiveType(row.type)) {
      variables[row.name.trim()] = toVariableValue(row.type, row.value);
    } else if (row.type === 'Object') {
      variables[row.name] = { type: 'Object', value: row.value, valueInfo: row.valueInfo };
    }
    // files are shown for download only
  }
  return variables;
}

/** Form for tasks without a form key: the user sets variables by hand. */
export function GenericForm({ engine, task, disabled, complete, completing }: FormProps) {
  const { t } = useTranslation('tasklist');
  const businessKey = useBusinessKey(engine, task.processInstanceId);
  const [rows, setRows] = useState<Row[]>([]);
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'loaded'>('idle');

  const update = (id: number, changes: Partial<Row>) =>
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...changes, touched: true } : row)));

  const addRow = () => setRows((current) => [...current, { id: nextRowId++, name: '', type: '', value: '' }]);

  const loadVariables = async () => {
    setLoadState('loading');
    try {
      const variables = await fetchFormVariables(engine, task.id);
      const loaded: Row[] = Object.entries(variables).flatMap(([name, variable]): Row[] => {
        const type = variable.type ?? '';
        if (isPrimitiveType(type)) {
          const value =
            type === 'Date'
              ? toLocalDateTimeText(parseEngineDate(variable.value as string) ?? new Date(NaN))
              : type === 'Boolean'
                ? variable.value === true
                : String(variable.value ?? '');
          return [{ id: nextRowId++, name, type, value, loaded: true }];
        }
        if (type === 'Object' || type === 'File') {
          return [
            {
              id: nextRowId++,
              name,
              type,
              value: type === 'Object' ? String(variable.value ?? '') : '',
              valueInfo: variable.valueInfo,
              loaded: true,
              readOnly: true,
            },
          ];
        }
        return [];
      });
      if (loaded.length === 0) {
        notify({ kind: 'info', title: t('NO_TASK_VARIABLES') });
      }
      setRows((current) => [...loaded, ...current.filter((row) => !loaded.some((l) => l.name === row.name))]);
      setLoadState('loaded');
    } catch (error) {
      notify({ kind: 'error', title: t('LOAD_VARIABLES_FAILURE'), subtitle: (error as Error).message });
      setLoadState('idle');
    }
  };

  const errors = new Map(rows.map((row) => [row.id, rowErrors(row, rows)]));
  const valid = [...errors.values()].every((e) => !e.name && !e.type && !e.value);

  return (
    <Stack gap={6} className="cz-generic-form">
      <p className="cz-form-hint">{t('USE_GENERIC_FORM')}</p>
      {businessKey.data && (
        <TextInput id="cz-generic-business-key" labelText={t('BUSINESS_KEY')} value={businessKey.data} readOnly />
      )}
      {rows.map((row) => {
        const rowError = row.touched ? errors.get(row.id) : undefined;
        return (
          <div key={row.id} className="cz-generic-form__row">
            <TextInput
              id={`cz-variable-name-${row.id}`}
              labelText={t('NAME')}
              placeholder={t('VARIABLE_NAME')}
              value={row.name}
              readOnly={row.loaded}
              disabled={disabled}
              invalid={!!rowError?.name}
              invalidText={rowError?.name && t(rowError.name)}
              onChange={(event) => update(row.id, { name: event.target.value })}
            />
            <Select
              id={`cz-variable-type-${row.id}`}
              labelText={t('TYPE')}
              value={row.type}
              disabled={disabled || row.loaded}
              invalid={!!rowError?.type}
              invalidText={rowError?.type && t(rowError.type)}
              onChange={(event) => update(row.id, { type: event.target.value, value: event.target.value === 'Boolean' ? false : '' })}
            >
              <SelectItem value="" text={t('VARIABLE_TYPE')} disabled hidden />
              {(row.readOnly ? [row.type] : PRIMITIVE_TYPES).map((type) => (
                <SelectItem key={type} value={type} text={type} />
              ))}
            </Select>
            {row.type === 'Boolean' ? (
              <Checkbox
                id={`cz-variable-value-${row.id}`}
                labelText={t('VALUE')}
                checked={row.value === true}
                disabled={disabled}
                onChange={(_, { checked }) => update(row.id, { value: checked })}
              />
            ) : row.type === 'File' ? (
              <Link
                href={engineUrl(engine, `/task/${encodeURIComponent(task.id)}/variables/${encodeURIComponent(row.name)}/data`)}
              >
                {t('DOWNLOAD')}
              </Link>
            ) : (
              <TextInput
                id={`cz-variable-value-${row.id}`}
                labelText={t('VALUE')}
                placeholder={row.type === 'Date' ? 'yyyy-MM-ddTHH:mm:ss' : undefined}
                value={String(row.value)}
                readOnly={row.readOnly}
                disabled={disabled || !row.type}
                invalid={!!rowError?.value}
                invalidText={rowError?.value && t(rowError.value, { type: row.type })}
                onChange={(event) => update(row.id, { value: event.target.value })}
              />
            )}
            {!row.loaded ? (
              <Button
                kind="ghost"
                size="md"
                hasIconOnly
                renderIcon={TrashCan}
                iconDescription={t('REMOVE')}
                disabled={disabled}
                onClick={() => setRows((current) => current.filter((r) => r.id !== row.id))}
              />
            ) : (
              <span />
            )}
          </div>
        );
      })}
      <div className="cz-generic-form__tools">
        <Button kind="ghost" size="sm" renderIcon={Add} disabled={disabled} onClick={addRow}>
          {t('ADD_VARIABLE')}
        </Button>
        <Button kind="ghost" size="sm" disabled={disabled || loadState !== 'idle'} onClick={loadVariables}>
          {t('LOAD_VARIABLES')}
        </Button>
      </div>
      <FormActions
        disabled={disabled}
        completing={completing}
        onComplete={() => {
          // show the errors of rows the user has not touched yet
          if (!valid) {
            setRows((current) => current.map((row) => ({ ...row, touched: true })));
            return;
          }
          complete(toVariables(rows));
        }}
      />
    </Stack>
  );
}
