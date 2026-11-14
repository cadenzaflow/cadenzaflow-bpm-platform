import { Button, Select, SelectItem, TextInput, Toggle } from '@carbon/react';
import { Add, TrashCan } from '@carbon/icons-react';
import { useTranslation } from 'react-i18next';
import { OPERATOR_LABELS, isComplete, type Criterion, type CriterionType, type SearchState } from './criteria';
import './criteria-search.scss';

interface CriteriaSearchProps {
  /** i18n namespace of the type labels */
  namespace: string;
  types: CriterionType[];
  value: SearchState;
  onChange: (value: SearchState) => void;
  /** false: the query has no "or" (e.g. users), all criteria must match */
  allowMatchAny?: boolean;
  /** the number of results of the search, shown next to it */
  total?: number;
}

/** Builds query criteria; incomplete ones are kept but not applied. */
export function CriteriaSearch({ namespace, types, value, onChange, allowMatchAny = true, total }: CriteriaSearchProps) {
  const { t } = useTranslation(namespace);
  const totalLabel = t('CAM_WIDGET_SEARCH_TOTAL_NUMBER_RESULTS');
  const operatorLabel = (key: string) => t(OPERATOR_LABELS[key] ?? key);

  const update = (index: number, changes: Partial<Criterion>) =>
    onChange({ ...value, criteria: value.criteria.map((c, i) => (i === index ? { ...c, ...changes } : c)) });
  const remove = (index: number) => onChange({ ...value, criteria: value.criteria.filter((_, i) => i !== index) });
  const add = () =>
    onChange({ ...value, criteria: [...value.criteria, { type: types[0].key, operator: types[0].operators[0] ?? 'eq', value: '' }] });

  return (
    <div className="cz-criteria">
      {value.criteria.map((criterion, index) => {
        const type = types.find((candidate) => candidate.key === criterion.type);
        const complete = isComplete(criterion, type);
        return (
          <fieldset key={index} className="cz-criteria__item" aria-label={t('SEARCH_CRITERION')}>
            <div className="cz-criteria__row">
              <Select
                id={`cz-criterion-type-${index}`}
                labelText={t('SEARCH_CRITERION')}
                hideLabel
                size="sm"
                value={criterion.type}
                onChange={(event) => {
                  const next = types.find((candidate) => candidate.key === event.target.value)!;
                  update(index, { type: next.key, operator: next.operators[0] ?? 'eq', name: undefined, value: '' });
                }}
              >
                {types.map((candidate) => (
                  <SelectItem key={candidate.key} value={candidate.key} text={t(candidate.label)} />
                ))}
              </Select>
              <Button
                kind="ghost"
                size="sm"
                hasIconOnly
                renderIcon={TrashCan}
                iconDescription={t('REMOVE_CRITERION')}
                onClick={() => remove(index)}
              />
            </div>
            {type && type.kind !== 'flag' && (
              <div className="cz-criteria__row">
                {type.kind === 'variable' && (
                  <TextInput
                    id={`cz-criterion-name-${index}`}
                    labelText={t('VARIABLE_NAME')}
                    hideLabel
                    size="sm"
                    placeholder={t('VARIABLE_NAME')}
                    value={criterion.name ?? ''}
                    onChange={(event) => update(index, { name: event.target.value })}
                  />
                )}
                {type.operators.length > 1 && (
                  <Select
                    id={`cz-criterion-operator-${index}`}
                    labelText={t('OPERATOR')}
                    hideLabel
                    size="sm"
                    className="cz-criteria__operator"
                    value={criterion.operator}
                    onChange={(event) => update(index, { operator: event.target.value })}
                  >
                    {type.operators.map((operator) => (
                      <SelectItem key={operator} value={operator} text={operatorLabel(operator)} />
                    ))}
                  </Select>
                )}
                <TextInput
                  id={`cz-criterion-value-${index}`}
                  labelText={t('VALUE')}
                  hideLabel
                  size="sm"
                  type={type.valueType === 'date' ? 'datetime-local' : 'text'}
                  placeholder={type.valueType === 'list' ? 'a, b, c' : t('VALUE')}
                  value={criterion.value}
                  invalid={!complete && criterion.value !== ''}
                  onChange={(event) => update(index, { value: event.target.value })}
                />
              </div>
            )}
          </fieldset>
        );
      })}
      <div className="cz-criteria__tools">
        <Button kind="ghost" size="sm" renderIcon={Add} onClick={add}>
          {t('ADD_CRITERION')}
        </Button>
        {allowMatchAny && value.criteria.length > 1 && (
          <Toggle
            id="cz-criteria-match"
            size="sm"
            labelText={t('MATCH_ANY_CRITERION')}
            hideLabel
            labelA={t('MATCH_ALL')}
            labelB={t('MATCH_ANY')}
            toggled={value.matchAny}
            onToggle={(matchAny) => onChange({ ...value, matchAny })}
          />
        )}
        {total !== undefined && (
          <span className="cz-criteria__total" title={totalLabel}>
            <span className="cds--visually-hidden">{totalLabel}: </span>
            {total.toLocaleString()}
          </span>
        )}
      </div>
    </div>
  );
}
