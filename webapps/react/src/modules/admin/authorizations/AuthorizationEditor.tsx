import { Button, MultiSelect, Select, SelectItem, TableCell, TableRow, TextInput } from '@carbon/react';
import { Checkmark, Close, User, UserMultiple } from '@carbon/icons-react';
import { useTranslation } from 'react-i18next';
import type { AuthorizationDraft } from './api';
import { AUTHORIZATION_TYPES, PERMISSIONS, expandPermissions, formatPermissions, toStoredPermissions } from './permissions';

const GLOBAL = 0;

interface AuthorizationEditorProps {
  draft: AuthorizationDraft;
  saving: boolean;
  onChange: (draft: AuthorizationDraft) => void;
  onSave: () => void;
  onCancel: () => void;
}

/** A table row for creating or changing an authorization in place, as in the classic Admin. */
export function AuthorizationEditor({ draft, saving, onChange, onSave, onCancel }: AuthorizationEditorProps) {
  const { t } = useTranslation('admin');
  const id = draft.id ?? 'new';
  const available = PERMISSIONS[draft.resourceType] ?? [];
  const valid = !!draft.identityId.trim() && !!draft.resourceId.trim();

  return (
    <TableRow className="cz-authorization-editor">
      <TableCell>
        {/* the engine keeps the type of an existing authorization; it is chosen when creating */}
        {draft.id ? (
          t(AUTHORIZATION_TYPES.find((type) => type.id === draft.type)?.label ?? String(draft.type))
        ) : (
          <Select
            id={`cz-authorization-type-${id}`}
            labelText={t('AUTHORIZATION_TYPE')}
            hideLabel
            size="sm"
            value={draft.type}
            onChange={(event) => {
              const type = Number(event.target.value);
              // a GLOBAL authorization applies to every user
              onChange(type === GLOBAL ? { ...draft, type, identityType: 'user', identityId: '*' } : { ...draft, type });
            }}
          >
            {AUTHORIZATION_TYPES.map((type) => (
              <SelectItem key={type.id} value={type.id} text={t(type.label)} />
            ))}
          </Select>
        )}
      </TableCell>
      <TableCell>
        <div className="cz-authorization-identity">
          <Button
            kind="ghost"
            size="sm"
            hasIconOnly
            disabled={draft.type === GLOBAL}
            renderIcon={draft.identityType === 'user' ? User : UserMultiple}
            iconDescription={t(draft.identityType === 'user' ? 'AUTHORIZATION_USER' : 'AUTHORIZATION_GROUP')}
            onClick={() => onChange({ ...draft, identityType: draft.identityType === 'user' ? 'group' : 'user' })}
          />
          <TextInput
            id={`cz-authorization-identity-${id}`}
            labelText={t(draft.identityType === 'user' ? 'AUTHORIZATION_USER_ID' : 'AUTHORIZATION_GROUP_ID')}
            hideLabel
            size="sm"
            placeholder={t(draft.identityType === 'user' ? 'AUTHORIZATION_USER_ID' : 'AUTHORIZATION_GROUP_ID')}
            disabled={draft.type === GLOBAL}
            value={draft.identityId}
            onChange={(event) => onChange({ ...draft, identityId: event.target.value })}
          />
        </div>
      </TableCell>
      <TableCell>
        <MultiSelect<string>
          id={`cz-authorization-permissions-${id}`}
          titleText={t('AUTHORIZATION_PERMISSIONS')}
          hideLabel
          size="sm"
          label={formatPermissions(draft.permissions)}
          items={available}
          itemToString={(permission) => permission ?? ''}
          selectedItems={expandPermissions(draft.permissions, draft.resourceType)}
          // keep the order of the classic Admin
          sortItems={(items) => [...items]}
          onChange={({ selectedItems }) =>
            onChange({ ...draft, permissions: toStoredPermissions(selectedItems ?? [], draft.resourceType) })
          }
        />
      </TableCell>
      <TableCell>
        <TextInput
          id={`cz-authorization-resource-${id}`}
          labelText={t('AUTHORIZATION_RESOURCE_ID')}
          hideLabel
          size="sm"
          placeholder={draft.resourceType === 0 ? t('AUTHORIZATION_COCKPIT_OR_TASKLIST') : t('AUTHORIZATION_RESOURCE_ID')}
          value={draft.resourceId}
          onChange={(event) => onChange({ ...draft, resourceId: event.target.value })}
        />
      </TableCell>
      <TableCell>
        <Button
          kind="ghost"
          size="sm"
          hasIconOnly
          renderIcon={Checkmark}
          iconDescription={t('AUTHORIZATION_SAVE')}
          disabled={!valid || saving}
          onClick={onSave}
        />
        <Button kind="ghost" size="sm" hasIconOnly renderIcon={Close} iconDescription={t('CANCEL')} onClick={onCancel} />
      </TableCell>
    </TableRow>
  );
}
