import { useEffect, useState } from 'react';
import {
  Accordion,
  AccordionItem,
  ActionableNotification,
  Button,
  Checkbox,
  InlineNotification,
  Modal,
  Select,
  SelectItem,
  SelectItemGroup,
  Stack,
  Tag,
  TextArea,
  TextInput,
  Toggle,
} from '@carbon/react';
import { Add, TrashCan } from '@carbon/icons-react';
import { useTranslation } from 'react-i18next';
import { notify } from '../../../shared/notifications';
import type { TaskFilter } from '../api';
import { toReadPermissions, useDeleteFilter, useFilterAuthorizations, useSaveFilter, type ReadPermissions } from './api';
import {
  FILTER_CRITERIA,
  findCriterion,
  fromFilterQuery,
  toFilterQuery,
  validateRow,
  type FilterQueryForm,
} from './filter-criteria';

interface FilterModalProps {
  engine: string;
  /** null creates a new filter */
  filter: TaskFilter | null;
  onClose: () => void;
  onSaved: (filterId: string) => void;
  onDeleted: () => void;
}

const DEFAULT_COLOR = '#555555';

/** Create, change or delete a task filter: general settings, criteria, shown variables, read permissions. */
export function FilterModal({ engine, filter, onClose, onSaved, onDeleted }: FilterModalProps) {
  const { t } = useTranslation('tasklist');
  const save = useSaveFilter(engine);
  const remove = useDeleteFilter(engine);
  const authorizations = useFilterAuthorizations(engine, filter?.id);

  const [name, setName] = useState(filter?.name ?? '');
  const [description, setDescription] = useState(filter?.properties?.description ?? '');
  const [priority, setPriority] = useState(String(filter?.properties?.priority ?? 0));
  const [color, setColor] = useState(filter?.properties?.color ?? DEFAULT_COLOR);
  const [refresh, setRefresh] = useState(filter?.properties?.refresh ?? false);
  const [query, setQuery] = useState<FilterQueryForm>(() => fromFilterQuery(filter?.query));
  const [variables, setVariables] = useState(filter?.properties?.variables ?? []);
  const [showUndefined, setShowUndefined] = useState(
    (filter?.properties as { showUndefinedVariable?: boolean } | undefined)?.showUndefinedVariable ?? false,
  );
  const [permissions, setPermissions] = useState<ReadPermissions>({ everybody: false, identities: [] });
  const [newIdentity, setNewIdentity] = useState<{ kind: 'user' | 'group'; id: string }>({ kind: 'user', id: '' });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (authorizations.data) {
      setPermissions(toReadPermissions(authorizations.data));
    }
  }, [authorizations.data]);

  // the permissions can be edited when they could be read (new filters: try)
  const permissionsEditable = !filter || authorizations.isSuccess;
  const rowErrors = query.rows.map(validateRow);
  const priorityInvalid = !/^-?\d+$/.test(priority.trim());
  const variablesInvalid = variables.some((variable) => !variable.name.trim());
  const invalid = !name.trim() || priorityInvalid || variablesInvalid || rowErrors.some(Boolean);
  const duplicate = permissions.identities.some(
    (identity) => identity.kind === newIdentity.kind && identity.id === newIdentity.id.trim(),
  );
  const usesCandidates = query.rows.some((row) => findCriterion(row.key)?.includeAssignedTasks);

  const updateRow = (index: number, changes: Partial<FilterQueryForm['rows'][number]>) =>
    setQuery((q) => ({ ...q, rows: q.rows.map((row, i) => (i === index ? { ...row, ...changes } : row)) }));

  const submit = () => {
    setSubmitted(true);
    if (invalid) {
      return;
    }
    const permissionsChanged =
      permissionsEditable &&
      JSON.stringify(permissions) !== JSON.stringify(authorizations.data ? toReadPermissions(authorizations.data) : { everybody: false, identities: [] });
    save.mutate(
      {
        filter: {
          id: filter?.id,
          resourceType: 'Task',
          name: name.trim(),
          query: toFilterQuery(query),
          properties: {
            description: description.trim() || undefined,
            priority: Number(priority),
            color,
            refresh,
            variables: variables.map((variable) => ({ name: variable.name.trim(), label: variable.label.trim() })),
            showUndefinedVariable: showUndefined,
          },
        },
        permissions: permissionsChanged ? { current: authorizations.data ?? [], wanted: permissions } : undefined,
      },
      {
        onSuccess: (id) => {
          notify({ kind: 'success', title: t('FILTER_SAVE_SUCCESS') });
          onSaved(id);
        },
        onError: (error) => notify({ kind: 'error', title: t('FILTER_SAVE_ERROR'), subtitle: error.message }),
      },
    );
  };

  const deleteFilter = () =>
    remove.mutate(filter!.id, {
      onSuccess: () => {
        notify({ kind: 'success', title: t('FILTER_DELETION_SUCCESS') });
        onDeleted();
      },
      onError: (error) => notify({ kind: 'error', title: t('FILTER_DELETION_ERROR'), subtitle: error.message }),
    });

  return (
    <Modal
      open
      size="lg"
      modalHeading={t(filter ? 'FILTER_EDIT' : 'FILTER_CREATE')}
      primaryButtonText={t('SAVE')}
      secondaryButtonText={t('CANCEL')}
      primaryButtonDisabled={save.isPending || (submitted && invalid)}
      onRequestSubmit={submit}
      onRequestClose={onClose}
    >
      <Accordion className="cz-filter-form">
        <AccordionItem title={t('FILTER_FORM_BASICS')} open>
          <Stack gap={5}>
            <TextInput
              id="cz-filter-name"
              labelText={t('FILTER_NAME_LABEL')}
              placeholder={t('FILTER_NAME_PLACEHOLDER')}
              value={name}
              invalid={submitted && !name.trim()}
              invalidText={t('REQUIRED_FIELD')}
              onChange={(event) => setName(event.target.value)}
            />
            <TextArea
              id="cz-filter-description"
              labelText={t('FILTER_DESCRIPTION_LABEL')}
              placeholder={t('FILTER_DESCRIPTION_PLACEHOLDER')}
              rows={2}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
            <div className="cz-filter-form__row">
              <TextInput
                id="cz-filter-priority"
                labelText={t('FILTER_PRIORITY_LABEL')}
                value={priority}
                invalid={priorityInvalid}
                invalidText={t('INVALID_VALUE_FOR_TYPE', { type: 'Integer' })}
                onChange={(event) => setPriority(event.target.value)}
              />
              <TextInput
                id="cz-filter-color"
                labelText={t('FILTER_COLOR_LABEL')}
                type="color"
                value={color}
                onChange={(event) => setColor(event.target.value)}
              />
            </div>
            <Checkbox
              id="cz-filter-refresh"
              labelText={t('FILTER_REFRESH_LABEL')}
              helperText={t('FILTER_REFRESH_TOOLTIP')}
              checked={refresh}
              onChange={(_, { checked }) => setRefresh(checked)}
            />
          </Stack>
        </AccordionItem>

        <AccordionItem title={t('FILTER_FORM_CRITERIA')} open>
          <Stack gap={4}>
            <p className="cz-form-hint">{t('FILTER_FORM_CRITERIA_HINT')}</p>
            {query.rows.map((row, index) => {
              const criterion = findCriterion(row.key);
              return (
                <div key={index} className="cz-filter-form__criterion">
                  <Select
                    id={`cz-filter-criterion-${index}`}
                    labelText={t('FILTER_CRITERIA_KEY')}
                    hideLabel
                    value={row.key}
                    onChange={(event) => updateRow(index, { key: event.target.value, value: '' })}
                  >
                    {FILTER_CRITERIA.map((group) => (
                      <SelectItemGroup key={group.group} label={group.group}>
                        {group.criteria.map((option) => (
                          <SelectItem
                            key={option.key}
                            value={option.key}
                            text={`${option.label}${option.expression ? ' *' : ''}`}
                          />
                        ))}
                      </SelectItemGroup>
                    ))}
                  </Select>
                  {criterion?.kind !== 'bool' ? (
                    <TextInput
                      id={`cz-filter-criterion-value-${index}`}
                      labelText={t('FILTER_CRITERIA_VALUE')}
                      hideLabel
                      placeholder={criterion?.kind === 'date' ? 'yyyy-MM-ddTHH:mm:ss' : criterion?.kind === 'list' ? 'a, b' : t('FILTER_CRITERIA_VALUE')}
                      value={row.value}
                      invalid={submitted && !!rowErrors[index]}
                      invalidText={rowErrors[index] ? t(rowErrors[index]!, { type: 'Integer' }) : undefined}
                      onChange={(event) => updateRow(index, { value: event.target.value })}
                    />
                  ) : (
                    <span />
                  )}
                  <Button
                    kind="ghost"
                    hasIconOnly
                    renderIcon={TrashCan}
                    iconDescription={t('FILTER_REMOVE_CRITERION')}
                    onClick={() => setQuery((q) => ({ ...q, rows: q.rows.filter((_, i) => i !== index) }))}
                  />
                </div>
              );
            })}
            <div className="cz-filter-form__tools">
              <Button
                kind="ghost"
                size="sm"
                renderIcon={Add}
                onClick={() =>
                  setQuery((q) => ({ ...q, rows: [...q.rows, { key: FILTER_CRITERIA[0].criteria[0].key, value: '' }] }))
                }
              >
                {t('FILTER_ADD_CRITERION')}
              </Button>
              {query.rows.length > 1 && (
                <Toggle
                  id="cz-filter-match"
                  size="sm"
                  labelText={t('MATCH_ANY_CRITERION')}
                  hideLabel
                  labelA={t('MATCH_ALL')}
                  labelB={t('MATCH_ANY')}
                  toggled={query.matchAny}
                  onToggle={(matchAny) => setQuery((q) => ({ ...q, matchAny }))}
                />
              )}
            </div>
            {usesCandidates && (
              <Checkbox
                id="cz-filter-include-assigned"
                labelText={t('FILTER_CRITERIA_INCLUDE_ASSIGNED_TASKS')}
                checked={query.includeAssignedTasks}
                onChange={(_, { checked }) => setQuery((q) => ({ ...q, includeAssignedTasks: checked }))}
              />
            )}
          </Stack>
        </AccordionItem>

        <AccordionItem title={t('FILTER_FORM_VARIABLES')}>
          <Stack gap={4}>
            <p className="cz-form-hint">{t('FILTER_FORM_VARIABLES_HINT')}</p>
            {variables.map((variable, index) => (
              <div key={index} className="cz-filter-form__criterion">
                <TextInput
                  id={`cz-filter-variable-name-${index}`}
                  labelText={t('FILTER_VARIABLE_NAME')}
                  placeholder={t('FILTER_VARIABLE_NAME_PLACEHOLDER')}
                  value={variable.name}
                  invalid={submitted && !variable.name.trim()}
                  invalidText={t('REQUIRED_FIELD')}
                  onChange={(event) =>
                    setVariables((list) => list.map((v, i) => (i === index ? { ...v, name: event.target.value } : v)))
                  }
                />
                <TextInput
                  id={`cz-filter-variable-label-${index}`}
                  labelText={t('FILTER_VARIABLE_LABEL')}
                  placeholder={t('FILTER_VARIABLE_LABEL_PLACEHOLDER')}
                  value={variable.label}
                  onChange={(event) =>
                    setVariables((list) => list.map((v, i) => (i === index ? { ...v, label: event.target.value } : v)))
                  }
                />
                <Button
                  kind="ghost"
                  hasIconOnly
                  renderIcon={TrashCan}
                  iconDescription={t('FILTER_REMOVE_VARIABLE')}
                  onClick={() => setVariables((list) => list.filter((_, i) => i !== index))}
                />
              </div>
            ))}
            <div className="cz-filter-form__tools">
              <Button
                kind="ghost"
                size="sm"
                renderIcon={Add}
                onClick={() => setVariables((list) => [...list, { name: '', label: '' }])}
              >
                {t('FILTER_ADD_VARIABLE')}
              </Button>
            </div>
            <Checkbox
              id="cz-filter-show-undefined"
              labelText={t('FILTER_FORM_VARIABLES_SHOW_UNDEFINED')}
              checked={showUndefined}
              onChange={(_, { checked }) => setShowUndefined(checked)}
            />
          </Stack>
        </AccordionItem>

        <AccordionItem title={t('FILTER_FORM_PERMISSIONS')}>
          {!permissionsEditable ? (
            <InlineNotification kind="info" lowContrast hideCloseButton subtitle={t('FILTER_FORM_PERMISSIONS_EDIT_HINT')} />
          ) : (
            <Stack gap={4}>
              <p className="cz-form-hint">{t('FILTER_FORM_PERMISSIONS_HINT')}</p>
              <Checkbox
                id="cz-filter-everybody"
                labelText={t('FILTER_FORM_PERMISSIONS_GLOBAL')}
                checked={permissions.everybody}
                onChange={(_, { checked }) => setPermissions((p) => ({ ...p, everybody: checked }))}
              />
              {!permissions.everybody && (
                <>
                  <div className="cz-filter-form__criterion">
                    <Select
                      id="cz-filter-identity-kind"
                      labelText={t('FILTER_FORM_PERMISSIONS_IDENTITY_TYPE_USER')}
                      hideLabel
                      value={newIdentity.kind}
                      onChange={(event) => setNewIdentity((n) => ({ ...n, kind: event.target.value as 'user' | 'group' }))}
                    >
                      <SelectItem value="user" text={t('FILTER_FORM_PERMISSIONS_IDENTITY_TYPE_USER')} />
                      <SelectItem value="group" text={t('FILTER_FORM_PERMISSIONS_IDENTITY_TYPE_GROUP')} />
                    </Select>
                    <TextInput
                      id="cz-filter-identity-id"
                      labelText={t(newIdentity.kind === 'user' ? 'FILTER_FORM_PERMISSIONS_USER_ID' : 'FILTER_FORM_PERMISSIONS_GROUP_ID')}
                      hideLabel
                      placeholder={t(newIdentity.kind === 'user' ? 'FILTER_FORM_PERMISSIONS_USER_ID' : 'FILTER_FORM_PERMISSIONS_GROUP_ID')}
                      value={newIdentity.id}
                      invalid={duplicate}
                      invalidText={t(newIdentity.kind === 'user' ? 'FILTER_FORM_PERMISSIONS_DUPLICATE_USER' : 'FILTER_FORM_PERMISSIONS_DUPLICATE_GROUP')}
                      onChange={(event) => setNewIdentity((n) => ({ ...n, id: event.target.value }))}
                    />
                    <Button
                      kind="ghost"
                      hasIconOnly
                      renderIcon={Add}
                      iconDescription={t('ADD')}
                      disabled={!newIdentity.id.trim() || duplicate}
                      onClick={() => {
                        setPermissions((p) => ({ ...p, identities: [...p.identities, { ...newIdentity, id: newIdentity.id.trim() }] }));
                        setNewIdentity((n) => ({ ...n, id: '' }));
                      }}
                    />
                  </div>
                  <div className="cz-groups__list">
                    {permissions.identities.map((identity) => (
                      <Tag
                        key={`${identity.kind}:${identity.id}`}
                        type={identity.kind === 'user' ? 'blue' : 'cool-gray'}
                        filter
                        title={t('FILTER_FORM_PERMISSIONS_REMOVE')}
                        onClose={() =>
                          setPermissions((p) => ({ ...p, identities: p.identities.filter((other) => other !== identity) }))
                        }
                      >
                        {identity.id}
                      </Tag>
                    ))}
                  </div>
                </>
              )}
            </Stack>
          )}
        </AccordionItem>
      </Accordion>

      {filter && (
        <div className="cz-filter-form__delete">
          {confirmDelete ? (
            <ActionableNotification
              inline
              kind="warning"
              lowContrast
              hideCloseButton
              title={t('FILTER_DELETE')}
              subtitle={t('FILTER_DELETION_WARNING')}
              actionButtonLabel={t('FILTER_DELETE')}
              onActionButtonClick={deleteFilter}
            />
          ) : (
            <Button kind="danger--tertiary" size="sm" renderIcon={TrashCan} onClick={() => setConfirmDelete(true)}>
              {t('FILTER_DELETE')}
            </Button>
          )}
        </div>
      )}
    </Modal>
  );
}
